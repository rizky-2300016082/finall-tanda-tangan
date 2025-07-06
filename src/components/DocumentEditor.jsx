
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { PDFDocument } from 'pdf-lib'
import { ArrowLeft, Save } from 'lucide-react'

const DocumentEditor = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const pdfViewerRef = useRef(null)
  const [document, setDocument] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [signatureAreas, setSignatureAreas] = useState([])
  const [isPlacingSignature, setIsPlacingSignature] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)

  const [dragState, setDragState] = useState({
    isDragging: false,
    id: null,
    initialMouseX: 0,
    initialMouseY: 0,
    initialAreaX: 0,
    initialAreaY: 0,
  });

  useEffect(() => {
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (docError) throw docError
      setDocument(docData)
      if (docData.signature_areas) {
        setSignatureAreas(docData.signature_areas)
      }

      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(docData.file_path)

      if (fileError) throw fileError

      const arrayBuffer = await fileData.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      setPdfBytes(bytes)
      
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setTotalPages(pdf.getPageCount())
      
      await renderPage(0, bytes)
      setLoading(false)
    } catch (error) {
      console.error('Error loading document:', error)
      setLoading(false)
    }
  }

  const renderPage = async (pageIndex, bytes = pdfBytes) => {
    if (!bytes) return

    try {
      const pdfjsLib = window.pdfjsLib
      if (!pdfjsLib) {
        renderSimplePage(pageIndex)
        return
      }

      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const page = await pdf.getPage(pageIndex + 1)
      
      const canvas = canvasRef.current
      if (!canvas) return;
      const ctx = canvas.getContext('2d')
      
      const viewport = page.getViewport({ scale: 1.5 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      
      setScale(1.5) 

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      }
      
      await page.render(renderContext).promise
    } catch (error) {
      console.error('Error rendering PDF with PDF.js:', error)
      renderSimplePage(pageIndex)
    }
  }

  const renderSimplePage = (pageIndex) => {
    const canvas = canvasRef.current
    if (!canvas) return;
    const ctx = canvas.getContext('2d')
    
    canvas.width = 800
    canvas.height = 1000
    setScale(1) 
    
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40)
    
    ctx.fillStyle = 'black'
    ctx.font = '24px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`PDF Page ${pageIndex + 1}`, canvas.width / 2, 60)
    
    ctx.font = '16px Arial'
    ctx.fillText('Click "Add Signature Area" and then click on this area', canvas.width / 2, 100)
    ctx.fillText('to place signature fields for the recipient', canvas.width / 2, 120)
    
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  const handleCanvasClick = (event) => {
    if (!isPlacingSignature || dragState.isDragging) return 

    const canvas = canvasRef.current
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect()
    
    const xPx = event.clientX - rect.left
    const yPx = event.clientY - rect.top

    const x = xPx / rect.width
    const y = yPx / rect.height

    const newSignatureArea = {
      id: Date.now(),
      page: currentPage,
      x,
      y,
      width: 0.15, 
      height: 0.05 
    }

    setSignatureAreas(prevAreas => [...prevAreas, newSignatureArea])
    setIsPlacingSignature(false)
  }

  const handleMouseDownSignatureArea = useCallback((event, area) => {
    event.stopPropagation() 
    setDragState({
      isDragging: true,
      id: area.id,
      initialMouseX: event.clientX,
      initialMouseY: event.clientY,
      initialAreaX: area.x,
      initialAreaY: area.y,
    });
  }, [])

  const handleMouseMove = useCallback((event) => {
    if (!dragState.isDragging) return

    const canvas = canvasRef.current
    if (!canvas) return

    const canvasRect = canvas.getBoundingClientRect()
    const currentDraggedArea = signatureAreas.find(area => area.id === dragState.id);

    if (!currentDraggedArea) return;

    const deltaX = event.clientX - dragState.initialMouseX;
    const deltaY = event.clientY - dragState.initialMouseY;

    const deltaXPercent = deltaX / canvasRect.width;
    const deltaYPercent = deltaY / canvasRect.height;
    
    const newX = dragState.initialAreaX + deltaXPercent;
    const newY = dragState.initialAreaY + deltaYPercent;

    const boundedX = Math.max(0, Math.min(1 - currentDraggedArea.width, newX));
    const boundedY = Math.max(0, Math.min(1 - currentDraggedArea.height, newY));

    setSignatureAreas(prevAreas =>
      prevAreas.map(area =>
        area.id === dragState.id
          ? { ...area, x: boundedX, y: boundedY }
          : area
      )
    )
  }, [dragState, signatureAreas])

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }));
  }, [])

  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp])


  const removeSignatureArea = (id) => {
    setSignatureAreas(signatureAreas.filter(area => area.id !== id))
  }

  const saveDocument = async () => {
    if (!recipientEmail || signatureAreas.length === 0) {
      alert('Please enter recipient email and place at least one signature area')
      return
    }

    try {
      const publicLink = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const { error } = await supabase
        .from('documents')
        .update({
          recipient_email: recipientEmail,
          signature_areas: signatureAreas,
          public_link: publicLink,
          status: 'sent'
        })
        .eq('id', documentId)

      if (error) throw error

      alert(`Document setup complete! Share this link: ${window.location.origin}/sign/${publicLink}`)
      navigate('/dashboard')
    } catch (error) {
      console.error('Error saving document:', error)
      alert('Error saving document')
    }
  }

  if (loading) return <div className="flex justify-center items-center h-screen text-lg text-gray-600">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center border-b border-gray-200">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <h1 className="text-xl font-bold text-gray-800">Setup Document Signature</h1>
        <button 
          onClick={saveDocument} 
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200"
        >
          <Save size={16} />
          Save & Generate Link
        </button>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-96 bg-white border-r border-gray-200 p-6 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-semibold mb-2">
              Recipient Email:
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email"
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="my-6">
            <button
              onClick={() => setIsPlacingSignature(true)}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 transition-colors duration-200 ${
                isPlacingSignature ? 'bg-blue-600 animate-pulse' : ''
              }`}
            >
              {isPlacingSignature ? 'Click on PDF to place signature' : 'Add Signature Area'}
            </button>
            {isPlacingSignature && (
              <p className="text-green-600 text-sm text-center mt-2 p-3 bg-green-50 rounded-md">
                Click anywhere on the PDF to place a signature field
              </p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Signature Areas ({signatureAreas.length}):</h3>
            {signatureAreas.length === 0 ? (
              <p className="text-gray-600 text-sm">No signature areas added yet.</p>
            ) : (
              signatureAreas.map((area) => (
                <div key={area.id} className="flex justify-between items-center p-3 border border-gray-200 rounded-md bg-gray-50 mb-2">
                  <span className="font-medium text-gray-700">Page {area.page + 1}</span>
                  <button 
                    onClick={() => removeSignatureArea(area.id)}
                    className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 transition-colors duration-200"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 flex justify-between items-center p-4 bg-gray-50 rounded-lg">
            <button
              onClick={() => {
                const newPage = Math.max(0, currentPage - 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous Page
            </button>
            <span className="font-semibold text-gray-700">Page {currentPage + 1} of {totalPages}</span>
            <button
              onClick={() => {
                const newPage = Math.min(totalPages - 1, currentPage + 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === totalPages - 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Page
            </button>
          </div>
        </div>

        <div ref={pdfViewerRef} className="flex-1 flex flex-col items-center p-6 relative overflow-auto">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`border-2 border-gray-300 rounded-lg shadow-lg bg-white max-w-full h-auto ${isPlacingSignature ? 'cursor-crosshair border-green-500 ring-4 ring-green-200' : ''}`}
          />
          {signatureAreas
            .filter(area => area.page === currentPage)
            .map((area) => {
              const canvas = canvasRef.current;
              if (!canvas) return null; 
              const canvasRect = canvas.getBoundingClientRect();
              const viewerRect = pdfViewerRef.current.getBoundingClientRect();

              const renderPixelLeft = (area.x * canvasRect.width) + (canvasRect.left - viewerRect.left);
              const renderPixelTop = (area.y * canvasRect.height) + (canvasRect.top - viewerRect.top);
              const pixelWidth = area.width * canvasRect.width;
              const pixelHeight = area.height * canvasRect.height;

              return (
                <div
                  key={area.id}
                  className="absolute border-2 border-blue-500 bg-blue-100 cursor-move flex items-center justify-center text-xs text-blue-700 font-bold hover:bg-red-100 hover:border-red-500 hover:text-red-700"
                  style={{
                    left: `${renderPixelLeft}px`,
                    top: `${renderPixelTop}px`,
                    width: `${pixelWidth}px`,
                    height: `${pixelHeight}px`,
                    pointerEvents: isPlacingSignature ? 'none' : 'auto', 
                    zIndex: dragState.isDragging && dragState.id === area.id ? 100 : 10 
                  }}
                  onMouseDown={(e) => handleMouseDownSignatureArea(e, area)}
                  onClick={(e) => e.stopPropagation()}
                >
                  Signature Area (Drag to move)
                </div>
              );
            })}
        </div>
      </div>
    </div>
  )
}

export default DocumentEditor
