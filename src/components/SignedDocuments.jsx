import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Download, Eye, X } from 'lucide-react';

const SignedDocuments = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for PDF preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [documentToPreview, setDocumentToPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(''); // State to hold the signed URL for the iframe
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSignedDocuments();
    }
  }, [user]);

  const fetchSignedDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, filename, signed_file_path, signed_at')
        .eq('sender_id', user.id)
        .eq('status', 'signed') // Filter for signed documents
        .order('signed_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching signed documents:', error);
      alert('Error loading signed documents.');
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (doc) => {
    try {
        if (!doc.signed_file_path) {
            alert('Signed file path not available.');
            return;
        }
        const { data, error } = await supabase.storage.from('documents').download(doc.signed_file_path);
        if (error) throw error;

        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `signed_${doc.filename}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading signed document:', error);
        alert(`Error downloading document: ${error.message}`);
    }
  };

  const previewDocument = async (doc) => {
    setPreviewLoading(true);
    setDocumentToPreview(doc);
    setShowPreviewModal(true);
    setPreviewUrl(''); // Clear previous URL
    try {
      if (!doc.signed_file_path) {
          alert('Signed file path not available for preview.');
          setPreviewLoading(false);
          closePreviewModal();
          return;
      }
      
      // Use createSignedUrl to get a temporary public URL for private buckets
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.signed_file_path, 300); // URL valid for 300 seconds (5 minutes)
      
      if (error) throw error;
      
      if (data && data.signedUrl) {
        setPreviewUrl(data.signedUrl);
      } else {
        alert('Could not generate signed URL for preview.');
        closePreviewModal();
      }
    } catch (error) {
      console.error('Error previewing document:', error);
      alert(`Failed to load document for preview: ${error.message}`);
      closePreviewModal();
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    setShowPreviewModal(false);
    setDocumentToPreview(null);
    setPreviewUrl(''); // Clear URL on close
    setPreviewLoading(false);
  };

  if (loading) {
    return <p className="text-lg text-center text-gray-600">Loading signed documents...</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Signed Documents</h2>
      {documents.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg shadow-md">
          <p className="text-gray-600 text-lg">You have no signed documents yet.</p>
          <p className="text-sm text-gray-500 mt-2">Documents you send for signature will appear here once completed.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full leading-normal">
            <thead>
              <tr>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Signed Date
                </th>
                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-5 border-b border-gray-200 text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">{doc.filename}</p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 text-sm">
                    <p className="text-gray-900 whitespace-no-wrap">
                      {new Date(doc.signed_at).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 text-sm">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-md text-xs font-medium hover:bg-green-600 transition-colors"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => previewDocument(doc)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-md text-xs font-medium hover:bg-blue-600 transition-colors"
                      >
                        <Eye size={14} /> Preview
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF Preview Modal with iframe */}
      {showPreviewModal && documentToPreview && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold">Preview: {documentToPreview.filename}</h3>
              <button onClick={closePreviewModal} className="text-gray-500 hover:text-gray-700">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 w-full relative">
              {previewLoading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                  <p className="text-lg text-gray-600">Loading preview...</p>
                </div>
              ) : (
                previewUrl ? (
                  <iframe
                    src={previewUrl}
                    title="Document Preview"
                    className="w-full h-full rounded-b-lg"
                    frameBorder="0"
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                    <p className="text-lg text-red-600">Failed to load preview.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignedDocuments;
