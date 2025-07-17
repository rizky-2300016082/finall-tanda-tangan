import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { Upload, UserCircle, LogOut, FileText, Shield, Briefcase, Send, Users, Clock, CheckCircle } from 'lucide-react';
import Profile from './Profile';
import DocumentList from './DocumentList';
import Security from './Security';
import Contacts from './Contacts';
import SignedDocuments from './SignedDocuments';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [activeView, setActiveView] = useState('documents'); // Default to 'documents' view
  const navigate = useNavigate();
  const [documentStats, setDocumentStats] = useState({ pending: 0, signed: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // Extract user metadata for easier access
  const userName = user?.user_metadata?.full_name || "User";
  const avatarUrl = user?.user_metadata?.avatar_url;

  useEffect(() => {
    if (activeView === 'documents') {
      fetchDocumentStats();
    }
  }, [activeView, user]);

  const fetchDocumentStats = async () => {
    if (!user) return;
    try {
      setLoadingStats(true);
      const { data, error } = await supabase
        .from('documents')
        .select('status')
        .eq('sender_id', user.id);

      if (error) throw error;

      const pendingCount = data.filter(doc => doc.status === 'sent').length;
      const signedCount = data.filter(doc => doc.status === 'signed').length;
      
      setDocumentStats({ pending: pendingCount, signed: signedCount });
    } catch (err) {
      console.error('Failed to fetch document stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: documentData, error: dbError } = await supabase
        .from('documents')
        .insert({
          filename: file.name,
          file_path: uploadData.path,
          sender_id: user.id,
          status: 'pending_setup'
        })
        .select()
        .single();

      if (dbError) throw dbError;

      navigate(`/editor/${documentData.id}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };
  
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  // Sidebar component defined internally
  const Sidebar = () => {
      const navLink = (view, icon, text) => (
        <a href="#" 
           onClick={(e) => { e.preventDefault(); setActiveView(view); }}
           className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium ${activeView === view ? 'text-white bg-green-500' : 'text-gray-600 hover:bg-gray-100'}`}>
          {icon} {text}
        </a>
      );

      return (
        <div className="w-64 bg-white h-screen p-6 flex flex-col justify-between border-r border-gray-200">
          <div>
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-green-600 mb-6">Signature</h1>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} className="w-10 h-10 rounded-full" />
                ) : (
                  <UserCircle size={40} className="text-gray-400" />
                )}
                <div>
                  <p className="font-semibold text-gray-800">{userName}</p>
                  <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full"></span>
                </div>
              </div>
            </div>
            <nav className="flex flex-col space-y-2">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Profile</h2>
              {navLink('profile', <UserCircle size={20} />, 'Akun Saya')}
              {navLink('security', <Shield size={20} />, 'Keamanan')}
              {navLink('organization', <Briefcase size={20} />, 'Organisasi')}
              
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-2">Tanda Tangan</h2>
              {navLink('documents', <FileText size={20} />, 'Dashboard')}
              {navLink('sent', <Send size={20} />, 'Terkirim')}
              {navLink('signed', <CheckCircle size={20} />, 'Tertandatangani')}
              {navLink('contacts', <Users size={20} />, 'Kontak')}
            </nav>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium">
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      );
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'profile':
        return <Profile user={user} />;
      case 'security':
        return <Security />;
      case 'contacts':
        return <Contacts />;
      case 'signed':
        return <SignedDocuments />;
      case 'documents':
        return (
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h2>
            {loadingStats ? <p>Loading stats...</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between border-l-4 border-yellow-400">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Menunggu Tanda Tangan</p>
                    <p className="text-3xl font-bold text-gray-800">{documentStats.pending}</p>
                  </div>
                  <Clock size={32} className="text-yellow-400" />
                </div>
                <div className="bg-white rounded-lg shadow p-6 flex items-center justify-between border-l-4 border-green-500">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Sudah Ditandatangani</p>
                    <p className="text-3xl font-bold text-gray-800">{documentStats.signed}</p>
                  </div>
                  <CheckCircle size={32} className="text-green-500" />
                </div>
              </div>
            )}
            <DocumentList />
          </div>
        );
      case 'organization':
        return <h2 className="text-3xl font-bold">Organisasi</h2>;
      case 'sent':
        return <h2 className="text-3xl font-bold">Terkirim</h2>;
      default:
        return <Profile user={user} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm py-4 px-8 flex justify-end items-center border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-medium rounded-md cursor-pointer hover:bg-green-600">
              <Upload size={18} />
              {uploading ? 'Uploading...' : 'Upload Dokumen'}
              <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
             {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="w-9 h-9 rounded-full" />
              ) : (
                <div className="p-2 rounded-full bg-yellow-100">
                   <UserCircle size={28} className="text-yellow-500" />
                </div>
              )}
          </div>
        </header>
        <main className="flex-grow p-8">
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
