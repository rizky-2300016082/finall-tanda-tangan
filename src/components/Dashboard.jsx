
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../config/supabase'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Download, LogOut, Trash2, Copy } from 'lucide-react'

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
      console.log('Fetching documents for user:', user.id)
      
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fetch documents error:', error)
        throw error
      }
      
      console.log('Documents fetched:', data?.length || 0)
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      alert('Error loading documents')
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

  const downloadDocument = async (doc) => {
    try {
      console.log('Downloading document:', doc.filename)
      
      const filePath = doc.signed_file_path || doc.file_path
      console.log('File path:', filePath)
      
      let retries = 3
      let data = null
      let error = null
      
      while (retries > 0 && !data) {
        try {
          const result = await supabase.storage
            .from('documents')
            .download(filePath)
          
          data = result.data
          error = result.error
          break
        } catch (downloadError) {
          console.error(`Download attempt failed, retries left: ${retries - 1}`, downloadError)
          retries--
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            error = downloadError
          }
        }
      }

      if (error) {
        console.error('Storage download error:', error)
        throw new Error(`Failed to download: ${error.message}`)
      }

      if (!data) {
        throw new Error('No file data received')
      }

      console.log('File downloaded successfully, size:', data.size)
      
      try {
        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = doc.signed_file_path ? `signed_${doc.filename}` : doc.filename
        link.style.display = 'none'
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        setTimeout(() => URL.revokeObjectURL(url), 100)
        
        console.log('Download completed')
      } catch (downloadError) {
        console.error('Browser download error:', downloadError)
        throw new Error('Failed to trigger download')
      }
    } catch (error) {
      console.error('Error downloading document:', error)
      alert(`Error downloading document: ${error.message}`)
    }
  }

  const deleteDocument = async (doc) => {
    if (!confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
      return
    }

    try {
      console.log('Deleting document:', doc.id)
      
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)
        .eq('sender_id', user.id)

      if (dbError) {
        console.error('Database delete error:', dbError)
        throw new Error(`Failed to delete from database: ${dbError.message}`)
      }

      console.log('Document deleted from database successfully')

      try {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([doc.file_path])

        if (storageError) {
          console.error('Storage delete error for main file:', storageError)
        }

        if (doc.signed_file_path) {
          const { error: signedFileError } = await supabase.storage
            .from('documents')
            .remove([doc.signed_file_path])

          if (signedFileError) {
            console.error('Storage delete error for signed file:', signedFileError)
          }
        }
      } catch (storageError) {
        console.error('Storage deletion failed, but document removed from database:', storageError)
      }

      await fetchDocuments()
      alert('Document deleted successfully')
    } catch (error) {
      console.error('Error deleting document:', error)
      alert(`Error deleting document: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center border-b border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">Document Signature Manager</h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-700 font-medium">Welcome, {user?.email}</span>
          <button 
            onClick={handleSignOut} 
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-white rounded-lg shadow-md p-8 mb-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Upload New Document</h2>
          <label className="inline-flex items-center gap-3 px-6 py-3 bg-green-500 text-white font-medium rounded-lg cursor-pointer hover:bg-green-600 transition-colors duration-200">
            <Upload size={20} />
            {uploading ? 'Uploading...' : 'Upload PDF'}
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>

        <div className="documents-section">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">Your Documents</h2>
          {documents.length === 0 ? (
            <p className="text-gray-600 text-lg">No documents uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.map((doc) => (
                <div key={doc.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 flex flex-col justify-between">
                  <div>
                    <div className="text-blue-500 mb-3">
                      <FileText size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{doc.filename}</h3>
                    <p className="text-sm text-gray-600 mb-1">Status: <span className="font-medium text-blue-600">{doc.status}</span></p>
                    {doc.recipient_email && (
                      <p className="text-sm text-gray-600 mb-1">Recipient: <span className="font-medium">{doc.recipient_email}</span></p>
                    )}
                    <p className="text-sm text-gray-600">Created: {new Date(doc.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {doc.status === 'pending_setup' && (
                      <button
                        onClick={() => navigate(`/editor/${doc.id}`)}
                        className="flex items-center gap-1 px-3 py-1 bg-cyan-600 text-white text-sm rounded-md hover:bg-cyan-700 transition-colors duration-200"
                      >
                        Setup Signature
                      </button>
                    )}
                    {doc.status === 'sent' && doc.public_link && (
                      <button
                        onClick={async () => {
                          try {
                            const link = `${window.location.origin}/sign/${doc.public_link}`
                            await navigator.clipboard.writeText(link)
                            alert(`Link copied to clipboard: ${link}`)
                          } catch (error) {
                            console.error('Failed to copy link:', error)
                            const link = `${window.location.origin}/sign/${doc.public_link}`
                            prompt('Copy this link manually:', link)
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-yellow-500 text-gray-800 text-sm rounded-md hover:bg-yellow-600 transition-colors duration-200"
                      >
                        <Copy size={16} />
                        Copy Link
                      </button>
                    )}
                    {(doc.status === 'signed' || doc.status === 'sent') && (
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white text-sm rounded-md hover:bg-green-600 transition-colors duration-200"
                      >
                        <Download size={16} />
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => deleteDocument(doc)}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors duration-200"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
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
