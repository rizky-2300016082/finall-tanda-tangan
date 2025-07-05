
import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../config/supabase'
import { PDFDocument } from 'pdf-lib'
import { ArrowLeft, Save } from 'lucide-react'

const DocumentEditor = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
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
      // Use PDF.js for rendering
      const pdfjsLib = window.pdfjsLib
      if (!pdfjsLib) {
        // Fallback to simple PDF display
        renderSimplePage(pageIndex)
        return
      }

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      const page = await pdf.getPage(pageIndex + 1)
      
      const canvas = canvasRef.current
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
    if (!isPlacingSignature) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = (event.clientX - rect.left) / canvas.width
    const y = (event.clientY - rect.top) / canvas.height

    const newSignatureArea = {
      id: Date.now(),
      page: currentPage,
      x,
      y,
      width: 0.15,
      height: 0.05
    }

    setSignatureAreas([...signatureAreas, newSignatureArea])
    setIsPlacingSignature(false)
  }

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

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="document-editor">
      <header className="editor-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
        <h1>Setup Document Signature</h1>
        <button onClick={saveDocument} className="save-btn">
          <Save size={16} />
          Save & Generate Link
        </button>
      </header>

      <div className="editor-content">
        <div className="editor-sidebar">
          <div className="form-group">
            <label>Recipient Email:</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Enter recipient email"
              required
            />
          </div>

          <div className="signature-controls">
            <button
              onClick={() => setIsPlacingSignature(true)}
              className={`place-signature-btn ${isPlacingSignature ? 'active' : ''}`}
            >
              {isPlacingSignature ? 'Click on PDF to place signature' : 'Add Signature Area'}
            </button>
            {isPlacingSignature && (
              <p className="instruction-text">
                Click anywhere on the PDF to place a signature field
              </p>
            )}
          </div>

          <div className="signature-areas-list">
            <h3>Signature Areas ({signatureAreas.length}):</h3>
            {signatureAreas.map((area) => (
              <div key={area.id} className="signature-area-item">
                <span>Page {area.page + 1}</span>
                <button onClick={() => removeSignatureArea(area.id)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="page-controls">
            <button
              onClick={() => {
                const newPage = Math.max(0, currentPage - 1)
                setCurrentPage(newPage)
                renderPage(newPage)
              }}
              disabled={currentPage === 0}
            >
              Previous Page
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
              Next Page
            </button>
          </div>
        </div>

        <div className="pdf-viewer">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`pdf-canvas ${isPlacingSignature ? 'placing-signature' : ''}`}
          />
          {signatureAreas
            .filter(area => area.page === currentPage)
            .map((area) => (
              <div
                key={area.id}
                className="signature-overlay"
                style={{
                  left: `${area.x * 100}%`,
                  top: `${area.y * 100}%`,
                  width: `${area.width * 100}%`,
                  height: `${area.height * 100}%`
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  removeSignatureArea(area.id)
                }}
              >
                Signature Area (Click to remove)
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default DocumentEditor
