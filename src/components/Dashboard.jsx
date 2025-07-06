
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
      const fileName = `${user.id}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file)

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
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath)

      if (error) {
        console.error('Storage download error:', error)
        throw new Error(`Failed to download: ${error.message}`)
      }

      if (!data) {
        throw new Error('No file data received')
      }

      console.log('File downloaded successfully, size:', data.size)
      
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = doc.signed_file_path ? `signed_${doc.filename}` : doc.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
        
      console.log('Download completed')
    } catch (error) {
      console.error('Error downloading document:', error)
      alert(`Error downloading document: ${error.message}`)
    }
  }

  const deleteDocument = async (doc) => {
    if (!confirm(`Are you sure you want to delete "${doc.filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // 1. Identify all files to be deleted from storage
      const filesToDelete = [doc.file_path];
      if (doc.signed_file_path) {
        filesToDelete.push(doc.signed_file_path);
      }

      console.log('Attempting to delete files from storage:', filesToDelete);

      // 2. Delete files from Supabase Storage FIRST
      // This is critical because our RLS policy for deletion depends on the database record
      const { data: fileDeleteData, error: storageError } = await supabase.storage
        .from('documents')
        .remove(filesToDelete);

      if (storageError) {
        console.error('Error deleting from storage:', storageError);
        // IMPORTANT: Stop the process if storage deletion fails
        throw new Error(`Failed to delete document files from storage. Please try again. Error: ${storageError.message}`);
      }

      console.log('Files deleted from storage successfully:', fileDeleteData);

      // 3. If storage deletion was successful, delete the database record
      console.log('Deleting document record from database:', doc.id);
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        // If this fails, we have an orphaned file in storage. 
        // This is less ideal, but better than an orphaned DB record.
        // A cleanup script could be implemented for such cases.
        throw new Error(`Files were deleted, but failed to delete the document record. Please contact support. Error: ${dbError.message}`);
      }
      
      console.log('Document record deleted successfully.');

      // 4. Update the UI to reflect the deletion
      setDocuments(documents.filter(d => d.id !== doc.id));
      alert('Document and all associated files have been deleted successfully.');

    } catch (error) {
      console.error('A critical error occurred during the deletion process:', error);
      alert(error.message); // Display the specific error message to the user
    }
  };


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
