
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { PDFDocument } from 'pdf-lib';
import { Save, Upload } from 'lucide-react';

const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
};

const isValidUUID = (uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

const SignDocument = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const pdfViewerRef = useRef(null);
  const renderTaskRef = useRef(null);
  
  const [docDetails, setDocDetails] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [signatureMode, setSignatureMode] = useState('draw');
  const [signatureText, setSignatureText] = useState('');
  const [signatureImage, setSignatureImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const lastPos = useRef({});

  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      if (!documentId || !isValidUUID(documentId)) {
        throw new Error("Invalid document link.");
    }
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('public_link', documentId)
        .single();
      if (docError || !docData) throw new Error("Document not found or link is invalid.");
      setDocDetails(docData);
      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(docData.file_path);
      if (fileError) throw new Error(`Failed to download document file: ${fileError.message}`);
      const arrayBuffer = await fileData.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdf);
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${window.pdfjsLib.version}/pdf.worker.min.js`;
      }
      const pdfJs = await window.pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
      setPdfJsDoc(pdfJs);
      setupSignatureCanvas();
    } catch (error) {
      console.error('Error loading document:', error);
      setDocDetails(null);
    } finally {
      setLoading(false);
    }
  }, [documentId]);
  
  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  const renderPage = useCallback(async (pageNumber) => {
    if (!pdfJsDoc || !canvasRef.current || !pdfViewerRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }
    try {
      const page = await pdfJsDoc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = pdfViewerRef.current;
      
      const viewport = page.getViewport({ scale: 1 });
      const rotation = page.rotate;
      
      const rotatedViewport = page.getViewport({ scale: 1, rotation });
      const scale = Math.min(
        (container.clientWidth - 32) / rotatedViewport.width,
        (container.clientHeight - 32) / rotatedViewport.height
      );
      const scaledViewport = page.getViewport({ scale, rotation });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport
      };
      
      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (error) {
      if (error.name === 'RenderingCancelledException') {
        console.warn(`Page render cancelled for page ${pageNumber}.`);
      } else {
        console.error(`Failed to render page ${pageNumber}:`, error);
      }
    }
  }, [pdfJsDoc]);

  useEffect(() => {
    if (pdfJsDoc) renderPage(currentPage);
  }, [currentPage, pdfJsDoc, renderPage]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (pdfJsDoc) renderPage(currentPage);
    });
    const viewer = pdfViewerRef.current;
    if (viewer) resizeObserver.observe(viewer);
    return () => {
      if (viewer) resizeObserver.unobserve(viewer);
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [currentPage, pdfJsDoc, renderPage]);

  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const getMousePos = (canvas, event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event) => {
    if (signatureMode !== 'draw') return;
    const canvas = signatureCanvasRef.current;
    lastPos.current = getMousePos(canvas, event.nativeEvent);
    setIsDrawing(true);
  };

  const draw = (event) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const currentPos = getMousePos(canvas, event.nativeEvent);
    ctx.strokeStyle = '#000000'; // Pure black color
    ctx.lineWidth = 4; // Bolder line width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    lastPos.current = currentPos;
  };

  const stopDrawing = () => setIsDrawing(false);
  
  const clearSignature = () => {
    setupSignatureCanvas();
    setSignatureText('');
    setSignatureImage(null);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setSignatureImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const renderTextSignature = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setupSignatureCanvas();
    if (signatureText) {
      // Bolder and larger font for typed signature
      ctx.font = 'bold 36px "Brush Script MT", cursive';
      ctx.fillStyle = '#000000'; // Pure black color
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(signatureText, canvas.width / 2, canvas.height / 2);
    }
  }, [signatureText]);

  useEffect(() => {
    if (signatureMode === 'type') renderTextSignature();
  }, [signatureText, signatureMode, renderTextSignature]);

  const hasValidSignature = () => {
    if (signatureMode === 'type') return signatureText.trim().length > 0;
    if (signatureMode === 'upload') return signatureImage !== null;
    if (signatureMode === 'draw') {
      const canvas = signatureCanvasRef.current;
      if (!canvas) return false;
      const blank = document.createElement('canvas');
      blank.width = canvas.width;
      blank.height = canvas.height;
      return canvas.toDataURL() !== blank.toDataURL();
    }
    return false;
  };

  const submitSignature = async () => {
    if (!docDetails || !pdfDoc) {
      alert('Document not loaded properly.');
      return;
    }
    if (!hasValidSignature()) {
      alert('Please provide a signature first.');
      return;
    }
    setSigning(true);
    try {
      let signatureDataUrl;
      if (signatureMode === 'draw' || signatureMode === 'type') {
        signatureDataUrl = signatureCanvasRef.current.toDataURL('image/png');
      } else {
        signatureDataUrl = signatureImage;
      }
      const pdfDocCopy = await PDFDocument.load(await pdfDoc.save());
      const signatureBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
      let signatureImageEmbed;
      try {
        signatureImageEmbed = await pdfDocCopy.embedPng(signatureBytes);
      } catch (e) {
        signatureImageEmbed = await pdfDocCopy.embedJpg(signatureBytes);
      }
      for (const area of docDetails.signature_areas) {
        const page = pdfDocCopy.getPage(area.page);
        const { width: pageWidth, height: pageHeight } = page.getSize();
        page.drawImage(signatureImageEmbed, {
          x: pageWidth * area.x,
          y: pageHeight * (1 - area.y - area.height),
          width: pageWidth * area.width,
          height: pageHeight * area.height,
        });
      }
      const signedPdfBytes = await pdfDocCopy.save();
      const uploadPath = `signed/signed_${Date.now()}_${sanitizeFilename(docDetails.filename)}`;
      const pdfBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(uploadPath, pdfBlob, { contentType: 'application/pdf', upsert: false }); 
      if (uploadError) throw new Error(`Storage Upload Failed: ${uploadError.message}`);
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'signed',
          signed_file_path: uploadData.path,
          signed_at: new Date().toISOString(),
        })
        .eq('id', docDetails.id);
      if (updateError) throw new Error(`Database Update Failed: ${updateError.message}`);
      navigate('/signature-success');
    } catch (error) {
      console.error('Error signing document:', error);
      alert(`An error occurred while signing: ${error.message}`);
    } finally {
      setSigning(false);
    }
  };

  const totalPages = pdfJsDoc?.numPages || 0;

  if (loading) return <div className="flex justify-center items-center h-screen text-lg font-semibold">Loading Document...</div>;
  if (!docDetails) return (
    <div className="flex flex-col justify-center items-center h-screen text-center p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Document Not Found</h2>
        <p className="text-gray-600">The link may be invalid, or the document may have been removed.</p>
        <button onClick={() => navigate('/')} className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Go Home</button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-3 px-6 text-center border-b z-10">
        <h1 className="text-2xl font-bold text-gray-800">Sign: {docDetails.filename}</h1>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div ref={pdfViewerRef} className="flex-1 flex items-center justify-center p-4 relative bg-gray-200">
            <div className="relative shadow-lg">
                <canvas ref={canvasRef} className="bg-white" />
                {docDetails.signature_areas
                    ?.filter(area => area.page === currentPage - 1)
                    .map((area) => (
                    <div
                        key={area.id}
                        className="absolute border-2 border-red-500 bg-red-500 bg-opacity-25 flex items-center justify-center text-sm text-red-700 font-bold"
                        style={{
                          left: `${area.x * 100}%`,
                          top: `${area.y * 100}%`,
                          width: `${area.width * 100}%`,
                          height: `${area.height * 100}%`,
                          pointerEvents: 'none',
                        }}
                    >
                        Sign Here
                    </div>
                ))}
            </div>
            {totalPages > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-white p-2 rounded-lg shadow-2xl">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">
                        Previous
                    </button>
                    <span className="font-semibold text-gray-800 px-4">Page {currentPage} of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">
                        Next
                    </button>
                </div>
            )}
        </div>
        <div className="w-full max-w-sm bg-white border-l p-6 overflow-y-auto flex flex-col">
          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Create Your Signature</h3>
          <div className="flex mb-4 border-b">
            {['draw', 'type', 'upload'].map(mode => (
              <button
                key={mode}
                className={`flex-1 py-2 font-medium capitalize ${signatureMode === mode ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                onClick={() => setSignatureMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex-grow">
            {signatureMode === 'draw' && (
                <canvas ref={signatureCanvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} className="border rounded-md bg-white w-full h-48 cursor-crosshair" />
            )}
            {signatureMode === 'type' && (
              <div className="flex flex-col h-full">
                <input type="text" value={signatureText} onChange={(e) => setSignatureText(e.target.value)} placeholder="Type your name" className="w-full p-2 border rounded-md mb-2" />
                <canvas ref={signatureCanvasRef} className="border rounded-md bg-gray-50 w-full flex-grow" />
              </div>
            )}
            {signatureMode === 'upload' && (
              <div className="text-center">
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600 w-full">
                  <Upload size={20} /> Upload Image
                  <input type="file" accept="image/png, image/jpeg" onChange={handleImageUpload} className="hidden" />
                </label>
                {signatureImage && <img src={signatureImage} alt="Signature Preview" className="mt-4 max-w-full max-h-36 border p-1 inline-block" />}
              </div>
            )}
          </div>
          <div className="flex gap-4 mt-6">
            <button onClick={clearSignature} className="flex-1 px-4 py-3 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">Clear</button>
            <button onClick={submitSignature} disabled={signing || !hasValidSignature()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:opacity-50">
              <Save size={18} /> {signing ? 'Submitting...' : 'Sign and Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignDocument;
