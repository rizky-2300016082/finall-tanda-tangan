
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Download, LogOut } from 'lucide-react'

const Dashboard = () => {
  const { user, signOut } = useAuth()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchDocuments()
  }, [user])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a PDF file')
      return
    }

    setUploading(true)
    try {
      const fileName = `${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`pdfs/${fileName}`, file)

      if (uploadError) throw uploadError

      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          filename: file.name,
          file_path: uploadData.path,
          sender_id: user.id,
          status: 'pending_setup'
        })
        .select()
        .single()

      if (dbError) throw dbError

      navigate(`/editor/${documentData.id}`)
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Error uploading file')
    } finally {
      setUploading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const downloadDocument = async (document) => {
    try {
      const filePath = document.signed_file_path || document.file_path
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath)

      if (error) throw error

      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = document.filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading document:', error)
      alert('Error downloading document')
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Document Signature Manager</h1>
        <div className="header-actions">
          <span>Welcome, {user?.email}</span>
          <button onClick={handleSignOut} className="sign-out-btn">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="upload-section">
          <h2>Upload New Document</h2>
          <label className="upload-button">
            <Upload size={20} />
            {uploading ? 'Uploading...' : 'Upload PDF'}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className="documents-section">
          <h2>Your Documents</h2>
          {documents.length === 0 ? (
            <p>No documents uploaded yet.</p>
          ) : (
            <div className="documents-grid">
              {documents.map((doc) => (
                <div key={doc.id} className="document-card">
                  <div className="document-icon">
                    <FileText size={24} />
                  </div>
                  <div className="document-info">
                    <h3>{doc.filename}</h3>
                    <p>Status: {doc.status}</p>
                    {doc.recipient_email && (
                      <p>Recipient: {doc.recipient_email}</p>
                    )}
                    <p>Created: {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="document-actions">
                    {doc.status === 'pending_setup' && (
                      <button
                        onClick={() => navigate(`/editor/${doc.id}`)}
                        className="edit-btn"
                      >
                        Setup Signature
                      </button>
                    )}
                    {doc.status === 'sent' && doc.public_link && (
                      <button
                        onClick={() => navigator.clipboard.writeText(
                          `${window.location.origin}/sign/${doc.public_link}`
                        )}
                        className="copy-btn"
                      >
                        Copy Link
                      </button>
                    )}
                    {(doc.status === 'signed' || doc.status === 'sent') && (
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="download-btn"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
