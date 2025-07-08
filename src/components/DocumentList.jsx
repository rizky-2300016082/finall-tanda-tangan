import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import DocumentCard from './DocumentCard'; // Import the new DocumentCard component

const DocumentList = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      alert('Error loading documents.');
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (doc) => {
    try {
      const filePath = doc.signed_file_path || doc.file_path;
      const { data, error } = await supabase.storage.from('documents').download(filePath);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.signed_file_path ? `signed_${doc.filename}` : doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert(`Error downloading document: ${error.message}`);
    }
  };

  const deleteDocument = async (doc) => {
    if (!confirm(`Are you sure you want to delete "${doc.filename}"?`)) return;

    try {
      const filesToDelete = [doc.file_path];
      if (doc.signed_file_path) {
        filesToDelete.push(doc.signed_file_path);
      }

      const { error: storageError } = await supabase.storage.from('documents').remove(filesToDelete);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('documents').delete().eq('id', doc.id);
      if (dbError) throw dbError;

      setDocuments(documents.filter(d => d.id !== doc.id));
      alert('Document deleted successfully.');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert(`Error deleting document: ${error.message}`);
    }
  };
  
  const handleSetup = (docId) => {
    navigate(`/editor/${docId}`);
  };

  const handleCopyLink = async (publicLink) => {
    if (!publicLink) {
        alert("This document doesn't have a shareable link yet.");
        return;
    }
    const linkToCopy = `${window.location.origin}/sign/${publicLink}`;
    try {
        await navigator.clipboard.writeText(linkToCopy);
        alert('Signature link copied to clipboard!');
    } catch(err) {
        console.error('Failed to copy link: ', err);
        alert('Failed to copy link. Please try again.');
    }
  };
  
  // Maps backend status to the format expected by DocumentCard
  const getCardStatus = (doc) => {
    switch (doc.status) {
      case 'pending_setup':
        return { status: 'Action Required', subStatus: 'Document needs setup' };
      case 'sent':
        return { status: 'Sent', subStatus: `Waiting for ${doc.recipient_email || 'recipient'}` };
      case 'signed':
        return { status: 'Signed', subStatus: `Signed by ${doc.recipient_email || 'recipient'}` };
      default:
        return { status: 'Unknown', subStatus: '' };
    }
  };

  if (loading) {
    return <p className="text-lg text-center text-gray-600">Loading documents...</p>;
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">My Documents</h2>
      {documents.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-600">You haven't uploaded any documents yet.</p>
          <p className="text-sm text-gray-500 mt-2">Click "Upload Dokumen" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => {
            const cardInfo = {
              name: doc.filename,
              createdDate: new Date(doc.created_at).toLocaleDateString(),
              ...getCardStatus(doc)
            };
            
            return (
              <DocumentCard
                key={doc.id}
                document={cardInfo}
                onSetup={() => handleSetup(doc.id)}
                onDownload={() => downloadDocument(doc)}
                onDelete={() => deleteDocument(doc)}
                onCopyLink={() => handleCopyLink(doc.public_link)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
