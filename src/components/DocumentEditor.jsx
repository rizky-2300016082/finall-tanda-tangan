
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
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [signatureAreas, setSignatureAreas] = useState([])
  const [isPlacingSignature, setIsPlacingSignature] = useState(false)
  const [loading, setLoading] = useState(true)

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
      const pdf = await PDFDocument.load(arrayBuffer)
      setPdfDoc(pdf)
      setTotalPages(pdf.getPageCount())
      
      await renderPage(0, pdf)
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
          </div>

          <div className="signature-areas-list">
            <h3>Signature Areas:</h3>
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
                Signature Area
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default DocumentEditor
