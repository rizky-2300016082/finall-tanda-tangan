
import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { PDFDocument, rgb } from 'pdf-lib'
import { Save, Upload } from 'lucide-react'

const SignDocument = () => {
  const { documentId } = useParams()
  const canvasRef = useRef(null)
  const signatureCanvasRef = useRef(null)
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
    // Initialize PDF.js worker
    const initializePdfJs = () => {
      if (typeof window !== 'undefined' && window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        console.log('PDF.js worker configured')
      } else {
        // Retry after a short delay if PDF.js is not loaded yet
        setTimeout(initializePdfJs, 100)
      }
    }
    
    initializePdfJs()
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    try {
      console.log('Loading document with public link:', documentId)
      
      if (!documentId) {
        console.error('No document ID provided')
        setDocument(null)
        setLoading(false)
        return
      }
      
      // Add retry logic for network issues
      let retries = 3
      let docData = null
      let docError = null
      
      while (retries > 0 && !docData) {
        try {
          const result = await supabase
            .from('documents')
            .select('*')
            .eq('public_link', documentId)
            .single()
          
          docData = result.data
          docError = result.error
          break
        } catch (fetchError) {
          console.error(`Fetch attempt failed, retries left: ${retries - 1}`, fetchError)
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            docError = fetchError
          }
        }
      }

      if (docError || !docData) {
        console.error('Database error:', docError)
        setDocument(null)
        setLoading(false)
        return
      }
      
      console.log('Document data:', docData)
      setDocument(docData)

      console.log('Attempting to download file:', docData.file_path)
      
      // Retry file download too
      retries = 3
      let fileData = null
      let fileError = null
      
      while (retries > 0 && !fileData) {
        try {
          const result = await supabase.storage
            .from('documents')
            .download(docData.file_path)
          
          fileData = result.data
          fileError = result.error
          break
        } catch (downloadError) {
          console.error(`Download attempt failed, retries left: ${retries - 1}`, downloadError)
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            fileError = downloadError
          }
        }
      }

      if (fileError || !fileData) {
        console.error('Storage error:', fileError)
        setDocument(null)
        setLoading(false)
        return
      }

      const arrayBuffer = await fileData.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      setPdfBytes(bytes)
      
      try {
        const pdf = await PDFDocument.load(arrayBuffer)
        setPdfDoc(pdf)
        setTotalPages(pdf.getPageCount())
      } catch (pdfError) {
        console.error('PDF loading error:', pdfError)
        // Continue anyway, we'll use fallback rendering
        setTotalPages(1)
      }
      
      // Wait a bit before rendering to ensure canvas is ready
      setTimeout(async () => {
        try {
          await renderPage(0, bytes)
          setupSignatureCanvas()
        } catch (renderError) {
          console.error('Error rendering page:', renderError)
          // Try fallback rendering
          renderSimplePage(0)
          setupSignatureCanvas()
        }
      }, 300)
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading document:', error)
      setDocument(null)
      setLoading(false)
    }
  }

  const renderPage = async (pageIndex, bytes = pdfBytes) => {
    if (!bytes) {
      console.log('No bytes available for rendering')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) {
      console.log('Canvas not available')
      return
    }

    try {
      // Use PDF.js for rendering
      const pdfjsLib = window.pdfjsLib
      if (!pdfjsLib) {
        console.log('PDF.js not available, using fallback')
        renderSimplePage(pageIndex)
        return
      }

      console.log('Rendering page with PDF.js:', pageIndex + 1)
      
      // Ensure PDF.js worker is set
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ 
        data: bytes,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      })
      
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
      console.log('Page rendered successfully')
    } catch (error) {
      console.error('Error rendering PDF with PDF.js:', error)
      console.log('Falling back to simple page rendering')
      renderSimplePage(pageIndex)
    }
  }

  const renderSimplePage = (pageIndex) => {
    const canvas = canvasRef.current
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
    // Add null check for signatureCanvasRef.current
    if (!signatureCanvasRef.current) {
      return false; 
    }

    if (signatureMode === 'draw') {
      const canvas = signatureCanvasRef.current
      const ctx = canvas.getContext('2d')
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // Check if canvas has any non-white pixels (indicating drawing)
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

      // Load the original PDF document
      const pdfDocCopy = await PDFDocument.load(await pdfDoc.save())
      
      const signatureAreas = document.signature_areas || []
      
      if (signatureAreas.length === 0) {
        alert('No signature areas found in this document')
        setSigning(false)
        return
      }

      // Convert signature image to PNG bytes
      const response = await fetch(signatureDataUrl)
      const signatureBytes = await response.arrayBuffer()
      
      let signatureImageEmbed
      try {
        // Try PNG first
        signatureImageEmbed = await pdfDocCopy.embedPng(signatureBytes)
      } catch (error) {
        try {
          // If PNG fails, try JPG
          signatureImageEmbed = await pdfDocCopy.embedJpg(signatureBytes)
        } catch (error) {
          throw new Error('Failed to embed signature image')
        }
      }
      
      // Apply signature to all designated areas
      for (const area of signatureAreas) {
        const page = pdfDocCopy.getPage(area.page)
        const { width, height } = page.getSize()
        
        const signatureWidth = width * area.width
        const signatureHeight = height * area.height
        const x = width * area.x
        const y = height * (1 - area.y - area.height)
        
        page.drawImage(signatureImageEmbed, {
          x,
          y,
          width: signatureWidth,
          height: signatureHeight,
        })
      }

      const signedPdfBytes = await pdfDocCopy.save()
      const signedFileName = `signed_${document.filename}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`signed/${signedFileName}`, signedPdfBytes, {
          contentType: 'application/pdf',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('documents')
        .update({
          status: 'signed',
          signed_file_path: uploadData.path,
          signed_at: new Date().toISOString()
        })
        .eq('id', document.id)

      if (updateError) throw updateError

      alert('Document signed successfully! You can now close this window.')
      
    } catch (error) {
      console.error('Error signing document:', error)
      alert(`Error signing document: ${error.message}`)
    } finally {
      setSigning(false)
    }
  }

  if (loading) return (
    <div className="loading" style={{ padding: '2rem', textAlign: 'center' }}>
      <p>Loading document...</p>
    </div>
  )

  if (!document && !loading) {
    return (
      <div className="error" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Document Not Found</h2>
        <p>The document you're looking for could not be found or the link has expired.</p>
        <p>Please check the link and try again.</p>
        <button 
          onClick={() => window.location.reload()} 
          style={{ 
            marginTop: '1rem', 
            padding: '0.5rem 1rem', 
            background: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <div className="sign-document">
      <header className="sign-header">
        <h1>Sign Document: {document.filename}</h1>
        <p>Recipient: {document.recipient_email}</p>
        <p>Document sent by sender</p>
      </header>

      <div className="sign-content">
        <div className="pdf-viewer">
          <canvas ref={canvasRef} className="pdf-canvas" />
          
          {document.signature_areas
            ?.filter(area => area.page === currentPage)
            .map((area) => (
              <div
                key={area.id}
                className="signature-required"
                style={{
                  left: `${area.x * 100}%`,
                  top: `${area.y * 100}%`,
                  width: `${area.width * 100}%`,
                  height: `${area.height * 100}%`
                }}
              >
                Sign Here
              </div>
            ))}
          
          <div className="page-controls">
            <button
              onClick={() => {
                const newPage = Math.max(0, currentPage - 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === 0}
            >
              Previous
            </button>
            <span>Page {currentPage + 1} of {totalPages}</span>
            <button
              onClick={() => {
                const newPage = Math.min(totalPages - 1, currentPage + 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === totalPages - 1}
            >
              Next
            </button>
          </div>
        </div>

        <div className="signature-panel">
          <h3>Create Your Signature</h3>
          
          <div className="signature-mode-tabs">
            <button
              className={signatureMode === 'draw' ? 'active' : ''}
              onClick={() => setSignatureMode('draw')}
            >
              Draw
            </button>
            <button
              className={signatureMode === 'type' ? 'active' : ''}
              onClick={() => setSignatureMode('type')}
            >
              Type
            </button>
            <button
              className={signatureMode === 'upload' ? 'active' : ''}
              onClick={() => setSignatureMode('upload')}
            >
              Upload
            </button>
          </div>

          {signatureMode === 'draw' && (
            <div className="signature-draw">
              <p className="instruction">Draw your signature in the box below:</p>
              <canvas
                ref={signatureCanvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="signature-canvas"
              />
            </div>
          )}

          {signatureMode === 'type' && (
            <div className="signature-type">
              <p className="instruction">Type your signature:</p>
              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Type your signature"
                className="signature-text-input"
              />
              <canvas ref={signatureCanvasRef} className="signature-canvas" />
            </div>
          )}

          {signatureMode === 'upload' && (
            <div className="signature-upload">
              <p className="instruction">Upload your signature image:</p>
              <label className="upload-signature-btn">
                <Upload size={20} />
                Upload Signature Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </label>
              {signatureImage && (
                <img src={signatureImage} alt="Signature" className="signature-preview" />
              )}
            </div>
          )}

          <div className="signature-actions">
            <button onClick={clearSignature} className="clear-btn">
              Clear
            </button>
            <button
              onClick={submitSignature}
              disabled={signing || !hasValidSignature()}
              className="submit-signature-btn"
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
