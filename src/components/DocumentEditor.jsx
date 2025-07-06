
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { PDFDocument } from 'pdf-lib';
import { ArrowLeft, Save, PlusCircle } from 'lucide-react';

const DocumentEditor = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const pdfViewerRef = useRef(null);
  
  const [docDetails, setDocDetails] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null); // pdf-lib document
  const [pdfJsDoc, setPdfJsDoc] = useState(null); // pdf.js document
  const [currentPage, setCurrentPage] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [signatureAreas, setSignatureAreas] = useState([]);
  const [isPlacingSignature, setIsPlacingSignature] = useState(false);
  const [loading, setLoading] = useState(true);

  const [dragState, setDragState] = useState({
    isDragging: false,
    id: null,
    initialMouseX: 0,
    initialMouseY: 0,
    initialAreaX: 0,
    initialAreaY: 0,
  });

  // Load the document from Supabase
  const loadDocument = useCallback(async () => {
    setLoading(true);
    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();
      if (docError) throw docError;

      setDocDetails(docData);
      setRecipientEmail(docData.recipient_email || '');
      setSignatureAreas(docData.signature_areas || []);

      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(docData.file_path);
      if (fileError) throw fileError;

      const arrayBuffer = await fileData.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      setPdfDoc(pdf);

      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${window.pdfjsLib.version}/pdf.worker.min.js`;
      }
      const pdfJs = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfJsDoc(pdfJs);

    } catch (error) {
      console.error('Error loading document:', error);
      alert('Failed to load document.');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);
  
  // Render the current page
  const renderPage = useCallback(async (pageNumber) => {
    if (!pdfJsDoc || !canvasRef.current || !pdfViewerRef.current) return;

    try {
      const page = await pdfJsDoc.getPage(pageNumber);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = pdfViewerRef.current;
      
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(
        (container.clientWidth - 32) / viewport.width, 
        (container.clientHeight - 32) / viewport.height
      );
      const scaledViewport = page.getViewport({ scale });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: scaledViewport,
      };
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Failed to render page:', error);
    }
  }, [pdfJsDoc]);

  // Effect to render page when dependencies change
  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, renderPage]);

  // Effect to handle responsive rendering on resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      renderPage(currentPage);
    });

    const viewer = pdfViewerRef.current;
    if (viewer) {
      resizeObserver.observe(viewer);
    }

    return () => {
      if (viewer) {
        resizeObserver.unobserve(viewer);
      }
    };
  }, [currentPage, renderPage]);

  const handleCanvasClick = (event) => {
    if (!isPlacingSignature || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    const newSignatureArea = {
      id: Date.now(),
      page: currentPage - 1, // Store as 0-indexed
      x: Math.max(0, x - 0.075), // Center the box on click
      y: Math.max(0, y - 0.025),
      width: 0.15,
      height: 0.05,
    };

    setSignatureAreas(prev => [...prev, newSignatureArea]);
    setIsPlacingSignature(false);
  };

  const handleMouseDownSignatureArea = useCallback((event, area) => {
    event.stopPropagation();
    setDragState({
      isDragging: true,
      id: area.id,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      initialAreaX: area.x,
      initialAreaY: area.y,
    });
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!dragState.isDragging || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const deltaX = (event.clientX - dragState.initialMouseX) / canvasRect.width;
    const deltaY = (event.clientY - dragState.initialMouseY) / canvasRect.height;

    const newX = dragState.initialAreaX + deltaX;
    const newY = dragState.initialAreaY + deltaY;

    setSignatureAreas(prevAreas =>
      prevAreas.map(area => {
        if (area.id === dragState.id) {
          // Prevent dragging out of bounds
          const boundedX = Math.max(0, Math.min(1 - area.width, newX));
          const boundedY = Math.max(0, Math.min(1 - area.height, newY));
          return { ...area, x: boundedX, y: boundedY };
        }
        return area;
      })
    );
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, []);
  
  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);


  const removeSignatureArea = (id) => {
    setSignatureAreas(areas => areas.filter(area => area.id !== id));
  };

  const saveDocument = async () => {
    if (!recipientEmail || !/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      alert('Please enter a valid recipient email address.');
      return;
    }
    if (signatureAreas.length === 0) {
      alert('Please add at least one signature area to the document.');
      return;
    }

    try {
      const publicLink = docDetails.public_link || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { error } = await supabase
        .from('documents')
        .update({
          recipient_email: recipientEmail,
          signature_areas: signatureAreas,
          public_link: publicLink,
          status: 'sent',
        })
        .eq('id', documentId);
      if (error) throw error;

      alert(`Document setup complete! Share this link with the recipient:
${window.location.origin}/sign/${publicLink}`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document. Please try again.');
    }
  };

  const totalPages = pdfJsDoc?.numPages || 0;

  if (loading) return <div className="flex justify-center items-center h-screen text-lg font-semibold">Loading Document Editor...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-3 px-6 flex justify-between items-center border-b z-10">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
          <ArrowLeft size={18} />
          Dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-800 truncate px-4">{docDetails?.filename}</h1>
        <button onClick={saveDocument} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
          <Save size={18} />
          Save & Send
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r p-6 overflow-y-auto flex flex-col">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2">Recipient Email:</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="recipient@example.com"
              required
              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="my-4">
            <button
              onClick={() => setIsPlacingSignature(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 ${isPlacingSignature ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
            >
              <PlusCircle size={20} />
              {isPlacingSignature ? 'Click on PDF to Place' : 'Add Signature Area'}
            </button>
            {isPlacingSignature && (
              <p className="text-blue-600 text-sm text-center mt-2 p-2 bg-blue-50 rounded-md">
                Click anywhere on the document to add a field for the signature.
              </p>
            )}
          </div>
          
          <div className="mt-4 flex-grow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Signature Areas ({signatureAreas.length})</h3>
            <div className="space-y-2">
              {signatureAreas.length > 0 ? signatureAreas.map((area) => (
                <div key={area.id} className="flex justify-between items-center p-2 border rounded-md bg-gray-50 text-sm">
                  <span className="font-medium text-gray-700">Page {area.page + 1}</span>
                  <button onClick={() => removeSignatureArea(area.id)} className="px-2 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600">
                    Remove
                  </button>
                </div>
              )) : <p className="text-gray-500 text-sm">No signature areas added.</p>}
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div ref={pdfViewerRef} className="flex-1 flex items-center justify-center p-4 relative bg-gray-200" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
          <div className="relative shadow-lg">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`bg-white ${isPlacingSignature ? 'cursor-crosshair' : ''}`}
            />
            {signatureAreas
              .filter(area => area.page === currentPage - 1)
              .map((area) => {
                const canvas = canvasRef.current;
                if (!canvas) return null;
                return (
                  <div
                    key={area.id}
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-25 cursor-move flex items-center justify-center text-xs text-blue-800 font-bold"
                    style={{
                      left: `${area.x * 100}%`,
                      top: `${area.y * 100}%`,
                      width: `${area.width * 100}%`,
                      height: `${area.height * 100}%`,
                      pointerEvents: isPlacingSignature ? 'none' : 'auto',
                      zIndex: dragState.id === area.id ? 100 : 10,
                    }}
                    onMouseDown={(e) => handleMouseDownSignatureArea(e, area)}
                  >
                    Signature
                  </div>
                );
              })}
          </div>
        </div>
        
         {/* Bottom Navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-white p-2 rounded-lg shadow-2xl">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="font-semibold text-gray-800 px-4">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
