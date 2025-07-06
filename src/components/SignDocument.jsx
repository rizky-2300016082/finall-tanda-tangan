
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom' // Import useNavigate
import { supabase } from '../config/supabase'
import { PDFDocument, rgb } from 'pdf-lib'
import { Save, Upload } from 'lucide-react'

// Helper function to sanitize filename for URL/path
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, '_') // Replace non-alphanumeric, non-underscore, non-dot, non-hyphen with underscore
}

const SignDocument = () => {
  const { documentId } = useParams()
  const navigate = useNavigate() // Initialize useNavigate
  const canvasRef = useRef(null)
  const signatureCanvasRef = useRef(null)
  const pdfViewerRef = useRef(null)
  const [document, setDocument] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfBytes, setPdfBytes] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [signatureMode, setSignatureMode] = useState('draw')
  const [signatureText, setSignatureText] = useState('')
  const [signatureImage, setSignatureImage] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const initializePdfJs = () => {
      if (typeof window !== 'undefined' && window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      } else {
        setTimeout(initializePdfJs, 100)
      }
    }
    
    initializePdfJs()
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    try {
      if (!documentId) {
        setDocument(null)
        setLoading(false)
        return
      }
      
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('public_link', documentId)
        .single()
      
      if (docError || !docData) {
        console.error('Error fetching document:', docError)
        setDocument(null)
        setLoading(false)
        return
      }
      
      setDocument(docData)

      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(docData.file_path)

      if (fileError || !fileData) {
        console.error('Error downloading file:', fileError)
        setDocument(null)
        setLoading(false)
        return
      }

      const arrayBuffer = await fileData.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      setPdfBytes(bytes)
      
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setTotalPages(pdf.getPageCount())
      
      await renderPage(0, bytes)
      setupSignatureCanvas()
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading document:', error)
      setDocument(null)
      setLoading(false)
    }
  }

  const renderPage = async (pageIndex, bytes = pdfBytes) => {
    if (!bytes) return;

    const canvas = canvasRef.current
    if (!canvas) return;

    try {
      const pdfjsLib = window.pdfjsLib
      if (!pdfjsLib) {
        renderSimplePage(pageIndex)
        return
      }
      
      const loadingTask = pdfjsLib.getDocument({ data: bytes, cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/', cMapPacked: true })
      
      const pdf = await loadingTask.promise
      const page = await pdf.getPage(pageIndex + 1)
      
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
      console.error('Error rendering PDF with pdf.js, falling back to simple render:', error)
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
    ctx.fillText('Please create your signature and submit', canvas.width / 2, 100)
    
    ctx.strokeStyle = '#ddd'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
    if (!canvas) return
    
    canvas.width = 400
    canvas.height = 150
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  const startDrawing = (event) => {
    if (signatureMode !== 'draw') return
    setIsDrawing(true)
    draw(event)
  }

  const draw = (event) => {
    if (!isDrawing || signatureMode !== 'draw') return
    
    const canvas = signatureCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = 'black'
    
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const stopDrawing = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const ctx = signatureCanvasRef.current.getContext('2d')
    ctx.beginPath()
  }

  const clearSignature = () => {
    setupSignatureCanvas()
    setSignatureText('')
    setSignatureImage(null)
  }

  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSignatureImage(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const renderTextSignature = () => {
    if (!signatureText) return
    
    const canvas = signatureCanvasRef.current
    if (!canvas) return // Added null check here
    const ctx = canvas.getContext('2d')
    
    setupSignatureCanvas()
    
    ctx.font = '32px Brush Script MT, cursive'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(signatureText, canvas.width / 2, canvas.height / 2)
  }

  useEffect(() => {
    if (signatureMode === 'type' && signatureText) {
      renderTextSignature()
    }
  }, [signatureText, signatureMode])

  const hasValidSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) {
      console.warn("Signature canvas is not available for validation.");
      return false; 
    }

    if (signatureMode === 'draw') {
      const ctx = canvas.getContext('2d')
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
          return true
        }
      }
      return false
    } else if (signatureMode === 'type') {
      return signatureText.trim().length > 0
    } else if (signatureMode === 'upload') {
      return signatureImage !== null
    }
    return false
  }

  const submitSignature = async () => {
    if (!document || !pdfDoc) {
      alert('Document not loaded properly')
      return
    }

    if (!hasValidSignature()) {
      alert('Please create a signature first')
      return
    }

    setSigning(true)
    try {
      let signatureDataUrl = ''
      
      if (signatureMode === 'draw' || signatureMode === 'type') {
        signatureDataUrl = signatureCanvasRef.current.toDataURL('image/png')
      } else if (signatureMode === 'upload' && signatureImage) {
        signatureDataUrl = signatureImage
      }

      if (!signatureDataUrl) {
        alert('Please create a signature first')
        setSigning(false)
        return
      }

      const pdfDocCopy = await PDFDocument.load(await pdfDoc.save())
      
      const signatureAreas = document.signature_areas || []
      
      if (signatureAreas.length === 0) {
        alert('No signature areas found in this document')
        setSigning(false)
        return
      }

      const response = await fetch(signatureDataUrl)
      const signatureBytes = await response.arrayBuffer()
      
      let signatureImageEmbed
      try {
        signatureImageEmbed = await pdfDocCopy.embedPng(signatureBytes)
      } catch (error) {
        console.warn('Failed to embed PNG, trying JPG:', error)
        signatureImageEmbed = await pdfDocCopy.embedJpg(signatureBytes)
      }
      
      for (const area of signatureAreas) {
        const page = pdfDocCopy.getPage(area.page)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        
        const signatureWidth = pageWidth * area.width
        const signatureHeight = pageHeight * area.height
        
        // Convert Y-coordinate from top-left (web) to bottom-left (PDF)
        const x = pageWidth * area.x
        const y = pageHeight * (1 - area.y) - signatureHeight

        page.drawImage(signatureImageEmbed, {
          x,
          y,
          width: signatureWidth,
          height: signatureHeight,
        })
      }

      const signedPdfBytes = await pdfDocCopy.save()
      const sanitizedFileName = sanitizeFilename(document.filename) // Sanitize the filename
      const signedFileName = `signed_${sanitizedFileName}`
      const uploadPath = `signed/${signedFileName}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(uploadPath, signedPdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadError) {
        console.error("Supabase Upload Error:", uploadError)
        throw uploadError
      }

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'signed',
          signed_file_path: uploadData.path,
          signed_at: new Date().toISOString()
        })
        .eq('id', document.id)

      if (updateError) {
        console.error("Supabase Database Update Error:", updateError)
        throw updateError
      }

      navigate('/signature-success')
      
    } catch (error) {
      console.error('Error signing document:', error)
      alert(`Error signing document: ${error.message || error.toString()}`)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return (
    <div className="flex justify-center items-center h-screen text-lg text-gray-600">
      <p>Loading document...</p>
    </div>
  )

  if (!document && !loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-red-600 text-center p-8">
        <h2 className="text-2xl font-bold mb-4">Document Not Found</h2>
        <p className="mb-2">The document you're looking for could not be found or the link has expired.</p>
        <p className="mb-4">Please check the link and try again.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
        >
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm py-4 px-6 text-center border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Sign Document: {document.filename}</h1>
        <p className="text-gray-600">Recipient: {document.recipient_email} - Document sent by sender</p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div ref={pdfViewerRef} className="flex-1 flex flex-col items-center p-6 relative overflow-auto">
          <canvas ref={canvasRef} className="border-2 border-gray-300 rounded-lg shadow-lg bg-white max-w-full h-auto" />
          
          {document.signature_areas
            ?.filter(area => area.page === currentPage)
            .map((area) => {
              const canvas = canvasRef.current;
              if (!canvas) return null;
              const canvasRect = canvas.getBoundingClientRect();
              const viewerRect = pdfViewerRef.current.getBoundingClientRect();

              const renderPixelLeft = (area.x * canvasRect.width);
              const renderPixelTop = (area.y * canvasRect.height);
              const pixelWidth = area.width * canvasRect.width;
              const pixelHeight = area.height * canvasRect.height;
              
              return (
                <div
                  key={area.id}
                  className="absolute border-2 border-red-500 bg-red-100 flex items-center justify-center text-xs text-red-700 font-bold animate-pulse"
                  style={{
                    left: `${renderPixelLeft + (canvasRect.left - viewerRect.left)}px`,
                    top: `${renderPixelTop + (canvasRect.top - viewerRect.top)}px`,
                    width: `${pixelWidth}px`,
                    height: `${pixelHeight}px`,
                    pointerEvents: 'none',
                  }}
                >
                  Sign Here
                </div>
              )
            })}
          
          <div className="mt-6 flex justify-between items-center p-4 bg-gray-50 rounded-lg w-full max-w-md">
            <button
              onClick={() => {
                const newPage = Math.max(0, currentPage - 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === 0}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
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
              Next
            </button>
          </div>
        </div>

        <div className="w-full max-w-sm bg-white border-l border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Create Your Signature</h3>
          
          <div className="flex mb-6 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <button
              className={`flex-1 py-3 text-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${
                signatureMode === 'draw' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : ''
              }`}
              onClick={() => setSignatureMode('draw')}
            >
              Draw
            </button>
            <button
              className={`flex-1 py-3 text-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${
                signatureMode === 'type' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : ''
              }`}
              onClick={() => setSignatureMode('type')}
            >
              Type
            </button>
            <button
              className={`flex-1 py-3 text-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 ${
                signatureMode === 'upload' ? 'border-b-2 border-blue-600 text-blue-600 bg-white' : ''
              }`}
              onClick={() => setSignatureMode('upload')}
            >
              Upload
            </button>
          </div>

          {signatureMode === 'draw' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-3">Draw your signature in the box below:</p>
              <canvas
                ref={signatureCanvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="signature-canvas border border-gray-300 rounded-md bg-white w-full h-40 cursor-crosshair"
              />
            </div>
          )}

          {signatureMode === 'type' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-3">Type your signature:</p>
              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Type your signature"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              />
              <canvas ref={signatureCanvasRef} className="signature-canvas mt-4 border border-gray-300 rounded-md bg-white w-full h-40" />
            </div>
          )}

          {signatureMode === 'upload' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-3">Upload your signature image:</p>
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white font-medium rounded-md cursor-pointer hover:bg-blue-600 transition-colors duration-200 w-full">
                <Upload size={20} />
                Upload Signature Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {signatureImage && (
                <img src={signatureImage} alt="Signature Preview" className="mt-4 max-w-full max-h-40 border border-gray-300 rounded-md object-contain mx-auto" />
              )}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button 
              onClick={clearSignature} 
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200"
            >
              Clear
            </button>
            <button
              onClick={submitSignature}
              disabled={signing || !hasValidSignature()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {signing ? 'Submitting...' : 'Submit Signature'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignDocument
