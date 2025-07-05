
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
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [signatureMode, setSignatureMode] = useState('draw')
  const [signatureText, setSignatureText] = useState('')
  const [signatureImage, setSignatureImage] = useState(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    loadDocument()
  }, [documentId])

  const loadDocument = async () => {
    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('public_link', documentId)
        .single()

      if (docError) throw docError
      setDocument(docData)

      const { data: fileData, error: fileError } = await supabase.storage
        .from('documents')
        .download(docData.file_path)

      if (fileError) throw fileError

      const arrayBuffer = await fileData.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setTotalPages(pdf.getPageCount())
      
      await renderPage(0, pdf)
      setupSignatureCanvas()
      setLoading(false)
    } catch (error) {
      console.error('Error loading document:', error)
      setLoading(false)
    }
  }

  const renderPage = async (pageIndex, pdf = pdfDoc) => {
    if (!pdf) return

    const page = pdf.getPage(pageIndex)
    const { width, height } = page.getSize()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const scale = Math.min(800 / width, 600 / height)
    canvas.width = width * scale
    canvas.height = height * scale
    
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'black'
    ctx.font = '16px Arial'
    ctx.textAlign = 'center'
    ctx.fillText(`Page ${pageIndex + 1} of ${totalPages}`, canvas.width / 2, 30)
    
    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(0, 0, canvas.width, canvas.height)
  }

  const setupSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current
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

  const submitSignature = async () => {
    if (!document || !pdfDoc) return

    setSigning(true)
    try {
      let signatureDataUrl = ''
      
      if (signatureMode === 'draw' || signatureMode === 'type') {
        signatureDataUrl = signatureCanvasRef.current.toDataURL()
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
      
      for (const area of signatureAreas) {
        const page = pdfDocCopy.getPage(area.page)
        const { width, height } = page.getSize()
        
        const signatureBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer())
        const signatureImageEmbed = await pdfDocCopy.embedPng(signatureBytes)
        
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
          contentType: 'application/pdf'
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

      alert('Document signed successfully!')
      
    } catch (error) {
      console.error('Error signing document:', error)
      alert('Error signing document')
    } finally {
      setSigning(false)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  if (!document) {
    return <div className="error">Document not found or link has expired.</div>
  }

  return (
    <div className="sign-document">
      <header className="sign-header">
        <h1>Sign Document: {document.filename}</h1>
        <p>Requested by: {document.recipient_email}</p>
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
              disabled={signing}
              className="submit-signature-btn"
            >
              <Save size={16} />
              {signing ? 'Signing...' : 'Submit Signature'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignDocument
