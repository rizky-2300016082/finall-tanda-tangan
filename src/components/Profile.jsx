import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const Profile = ({ user }) => {
  const { setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [signature, setSignature] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setPhone(user.user_metadata?.phone || '');
      setSignature(user.user_metadata?.signature || '');
    }
  }, [user]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setError('');
    setSuccess('');
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { 
        full_name: fullName,
        phone: phone,
        signature: signature,
      }
    });

    setLoading(false);

    if (updateError) {
      setError(`Failed to update profile: ${updateError.message}`);
    } else if (data.user) {
      setUser(data.user);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const oldAvatarUrl = user?.user_metadata?.avatar_url;
    const newAvatarPath = `${user.id}/${Date.now()}_${file.name}`;

    // Step 1: Upload the new avatar
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(newAvatarPath, file);

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setLoading(false);
      return;
    }

    // Step 2: Get the public URL for the new file
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(newAvatarPath);

    const newPublicUrl = urlData.publicUrl;

    // Step 3: Update user metadata with the new URL
    const { data: updatedUserData, error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: newPublicUrl }
    });

    if (updateError) {
      setError(`Failed to update your profile: ${updateError.message}`);
      // If profile update fails, delete the newly uploaded file to prevent orphans
      await supabase.storage.from('avatars').remove([newAvatarPath]);
      setLoading(false);
      return;
    }
    
    // Step 4: If everything was successful, update the UI and delete the old avatar.
    setUser(updatedUserData.user);
    setSuccess('Avatar updated successfully!');

    if (oldAvatarUrl) {
      try {
        // Correctly parse the URL and extract the path for deletion
        const urlObject = new URL(oldAvatarUrl);
        const oldAvatarPath = urlObject.pathname.split('/avatars/')[1];
        
        if (oldAvatarPath) {
          console.log(`Attempting to delete old avatar at path: ${oldAvatarPath}`);
          const { error: deleteError } = await supabase.storage
            .from('avatars')
            .remove([oldAvatarPath]);
          
          if (deleteError) {
            console.error("Failed to delete old avatar:", deleteError);
            // This is not a critical error, so we just log it and alert the user.
            setError("New avatar set, but failed to remove the old one.");
          } else {
            console.log(`Successfully deleted old avatar: ${oldAvatarPath}`);
          }
        }
      } catch (e) {
          console.error("Error processing old avatar URL for deletion:", e);
          setError("Avatar updated, but could not remove old one due to a URL processing error.");
      }
    }

    setLoading(false);
  };
  
  if (!user) {
      return <p>Loading profile...</p>;
  }

  const currentAvatar = user?.user_metadata?.avatar_url;

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Akun Saya</h2>
      
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-700">Profil</h3>
            <button onClick={handleEditToggle} className="text-blue-500 hover:text-blue-700 font-medium">
              {isEditing ? 'Batal' : 'Edit'}
            </button>
          </div>

          {error && <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-md mb-6">{error}</div>}
          {success && <div className="bg-green-100 border border-green-400 text-green-700 p-3 rounded-md mb-6">{success}</div>}

          <form onSubmit={handleProfileUpdate}>
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0">
                  <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      {currentAvatar ? (
                        <img src={currentAvatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      )}
                  </div>
                  {isEditing && (
                    <div className="mt-2 text-sm">
                      <label htmlFor="avatar-upload" className="font-medium text-blue-600 hover:text-blue-500 cursor-pointer">
                        Ganti Foto
                      </label>
                      <input id="avatar-upload" type="file" onChange={handleAvatarUpload} disabled={loading} className="hidden"/>
                    </div>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-gray-600 flex-grow">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nama</label>
                  {isEditing ? (
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{user.user_metadata?.full_name || 'Not set'}</p>
                  )}
                </div>
                 <div>
                  <label className="text-sm font-medium text-gray-500">Tanda Tangan Pribadi</label>
                   {isEditing ? (
                    <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{user.user_metadata?.signature || 'Not set'}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="font-semibold">{user.email}</p>
                </div>
                 <div>
                  <label className="text-sm font-medium text-gray-500">Nomor WhatsApp</label>
                   {isEditing ? (
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{user.user_metadata?.phone || 'Not set'}</p>
                  )}
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end mt-8">
                <button type="submit" disabled={loading} className="px-6 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 disabled:opacity-50">
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            )}
          </form>
        </>
      </div>
    </div>
  );
};

export default Profile;
