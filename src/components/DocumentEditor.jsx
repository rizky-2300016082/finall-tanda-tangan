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
  const renderTaskRef = useRef(null);
  const isRenderingRef = useRef(false); // Lock to prevent race conditions

  const [docDetails, setDocDetails] = useState(null);
  const [pdfJsDoc, setPdfJsDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [signatureAreas, setSignatureAreas] = useState([]);
  const [isPlacingSignature, setIsPlacingSignature] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragState, setDragState] = useState({ isDragging: false, isResizing: false });

  // Load document from Supabase
  useEffect(() => {
    const loadDocument = async () => {
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
    };
    loadDocument();
  }, [documentId]);

  // Centralized and robust rendering logic
  useEffect(() => {
    if (!pdfJsDoc) return;

    const renderPage = async () => {
      if (isRenderingRef.current || !canvasRef.current || !pdfViewerRef.current) {
        return;
      }
      isRenderingRef.current = true;

      // Ensure previous task is always cancelled before starting a new one
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdfJsDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const container = pdfViewerRef.current;

        const viewport = page.getViewport({ scale: 1, rotation: 0 }); // Force 0 rotation
        const scale = Math.min(
          (container.clientWidth - 32) / viewport.width,
          (container.clientHeight - 32) / viewport.height
        );
        const outputScale = window.devicePixelRatio || 1;
        const scaledViewport = page.getViewport({ scale: scale * outputScale, rotation: 0 });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = `${scaledViewport.width / outputScale}px`;
        canvas.style.height = `${scaledViewport.height / outputScale}px`;

        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Failed to render page ${currentPage}:`, error);
        }
      } finally {
        isRenderingRef.current = false; // Release the lock
        renderTaskRef.current = null;
      }
    };

    renderPage();

    const resizeObserver = new ResizeObserver(renderPage);
    const viewer = pdfViewerRef.current;
    resizeObserver.observe(viewer);

    return () => {
      resizeObserver.disconnect();
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [currentPage, pdfJsDoc]);

  // Signature placement and manipulation logic (remains mostly the same)
  const handleCanvasClick = (event) => {
    if (!isPlacingSignature || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const viewX = (event.clientX - rect.left) / rect.width;
    const viewY = (event.clientY - rect.top) / rect.height;

    const newSignatureArea = {
      id: Date.now(),
      page: currentPage - 1,
      x: Math.max(0, viewX - 0.075),
      y: Math.max(0, viewY - 0.025),
      width: 0.15,
      height: 0.05,
    };
    setSignatureAreas(prev => [...prev, newSignatureArea]);
    setIsPlacingSignature(false);
  };
  
  const handleMouseDownOnArea = useCallback((event, area, isResizeHandle = null) => {
    event.stopPropagation();
    setDragState({
      isDragging: !isResizeHandle,
      isResizing: !!isResizeHandle,
      id: area.id,
      handle: isResizeHandle,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      initialAreaX: area.x,
      initialAreaY: area.y,
      initialAreaWidth: area.width,
      initialAreaHeight: area.height,
    });
  }, []);
  
  const handleMouseMove = useCallback((event) => {
    if (!dragState.isDragging && !dragState.isResizing) return;
    if (!canvasRef.current) return;
  
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const rawDeltaX = (event.clientX - dragState.initialMouseX) / canvasRect.width;
    const rawDeltaY = (event.clientY - dragState.initialMouseY) / canvasRect.height;
  
    setSignatureAreas(prevAreas =>
      prevAreas.map(area => {
        if (area.id !== dragState.id) return area;
  
        if (dragState.isDragging) {
            const newX = dragState.initialAreaX + rawDeltaX;
            const newY = dragState.initialAreaY + rawDeltaY;
            const boundedX = Math.max(0, Math.min(1 - area.width, newX));
            const boundedY = Math.max(0, Math.min(1 - area.height, newY));
            return { ...area, x: boundedX, y: boundedY };
        }
        
        if (dragState.isResizing) {
            let { x, y, width, height } = { ...area };
            const handle = dragState.handle;
            const minWidth = 0.02, minHeight = 0.02;

            if (handle.includes('right')) { width = Math.max(minWidth, dragState.initialAreaWidth + rawDeltaX); }
            if (handle.includes('left')) {
                const newWidth = Math.max(minWidth, dragState.initialAreaWidth - rawDeltaX);
                x = dragState.initialAreaX + (dragState.initialAreaWidth - newWidth);
                width = newWidth;
            }
            if (handle.includes('bottom')) { height = Math.max(minHeight, dragState.initialAreaHeight + rawDeltaY); }
            if (handle.includes('top')) {
                const newHeight = Math.max(minHeight, dragState.initialAreaHeight - rawDeltaY);
                y = dragState.initialAreaY + (dragState.initialAreaHeight - newHeight);
                height = newHeight;
            }

            if (x < 0) { width += x; x = 0; }
            if (y < 0) { height += y; y = 0; }
            if (x + width > 1) { width = 1 - x; }
            if (y + height > 1) { height = 1 - y; }

            return { ...area, x, y, width, height };
        }
        return area;
      })
    );
  }, [dragState]);

  const handleMouseUp = useCallback(() => {
    setDragState({ isDragging: false, isResizing: false });
  }, []);
  
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
      const publicLink = docDetails.public_link || crypto.randomUUID();
      const { error } = await supabase.from('documents').update({
        recipient_email: recipientEmail,
        signature_areas: signatureAreas,
        public_link: publicLink,
        status: 'sent',
      }).eq('id', documentId);
      if (error) throw error;
      alert(`Document setup complete! Share this link with the recipient:
${window.location.origin}/sign/${publicLink}`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Error saving document. Please try again.');
    }
  };
  
  const getUnrotatedStyles = (area) => ({ 
      left: `${area.x * 100}%`, 
      top: `${area.y * 100}%`, 
      width: `${area.width * 100}%`, 
      height: `${area.height * 100}%` 
  });

  const totalPages = pdfJsDoc?.numPages || 0;
  if (loading) return <div className="flex justify-center items-center h-screen text-lg font-semibold">Loading Document Editor...</div>;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-3 px-6 flex justify-between items-center border-b z-10">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
          <ArrowLeft size={18} /> Back
        </button>
        <h1 className="text-xl font-bold text-gray-800 truncate px-4">{docDetails?.filename}</h1>
        <button onClick={saveDocument} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600">
          <Save size={18} /> Save & Send
        </button>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 bg-white border-r p-6 overflow-y-auto flex flex-col">
           <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2">Recipient Email:</label>
            <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="recipient@example.com" required className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="my-4">
            <button onClick={() => setIsPlacingSignature(true)} className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 ${isPlacingSignature ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}>
              <PlusCircle size={20} />
              {isPlacingSignature ? 'Click on PDF to Place' : 'Add Signature Area'}
            </button>
            {isPlacingSignature && (<p className="text-blue-600 text-sm text-center mt-2 p-2 bg-blue-50 rounded-md">Click anywhere on the document to add a field.</p>)}

          </div>
          <div className="mt-4 flex-grow">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Signature Areas ({signatureAreas.length})</h3>
            <div className="space-y-2">
              {signatureAreas.length > 0 ? signatureAreas.map((area) => (
                <div key={area.id} className="flex justify-between items-center p-2 border rounded-md bg-gray-50 text-sm">
                  <span className="font-medium text-gray-700">Page {area.page + 1}</span>
                  <button onClick={() => removeSignatureArea(area.id)} className="px-2 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600">Remove</button>
                </div>
              )) : <p className="text-gray-500 text-sm">No signature areas added.</p>}
            </div>
          </div>
        </div>
        <div ref={pdfViewerRef} className="flex-1 flex items-center justify-center p-4 relative bg-gray-200">
          <div className="relative shadow-lg">
            <canvas ref={canvasRef} onClick={handleCanvasClick} className={`bg-white ${isPlacingSignature ? 'cursor-crosshair' : ''}`} />
            {signatureAreas.filter(area => area.page === currentPage - 1).map((area) => {
              if (!canvasRef.current) return null;
              const style = getUnrotatedStyles(area); 
              const resizeHandles = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
              return (
                <div
                  key={area.id}
                  className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-25 cursor-move flex items-center justify-center text-xs text-blue-800 font-bold"
                  style={{ ...style, pointerEvents: isPlacingSignature ? 'none' : 'auto', zIndex: (dragState.id === area.id) ? 100 : 10 }}
                  onMouseDown={(e) => handleMouseDownOnArea(e, area)}
                >
                  Signature
                  {resizeHandles.map(handle => (
                    <div
                      key={handle}
                      onMouseDown={(e) => handleMouseDownOnArea(e, area, handle)}
                      className={`absolute w-3 h-3 bg-white border-2 border-blue-600 rounded-full ${handle.split('-')[0] === 'top' ? '-top-1.5' : '-bottom-1.5'} ${handle.split('-')[1] === 'left' ? '-left-1.5' : '-right-1.5'}`}
                      style={{ cursor: `${handle.includes('top') ? 'n' : 's'}${handle.includes('left') ? 'w' : 'e'}-resize` }}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        {totalPages > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-white p-2 rounded-lg shadow-2xl">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">Previous</button>
              <span className="font-semibold text-gray-800 px-4">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="px-4 py-2 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentEditor;