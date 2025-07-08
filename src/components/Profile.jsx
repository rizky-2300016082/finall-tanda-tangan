import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const Profile = ({ user }) => {
  const { refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [signature, setSignature] = useState('');

  // Initialize form state when user data is available or changes
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      // These fields are mocked for now but can be added to user_metadata
      setPhone(user.user_metadata?.phone || '087788652910');
      setSignature(user.user_metadata?.signature || 'madaihsan');
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

    // Update user metadata in Supabase Auth
    const { data, error: updateError } = await supabase.auth.updateUser({
      data: { 
        full_name: fullName,
        phone: phone, // Persisting mocked data
        signature: signature // Persisting mocked data
      }
    });

    setLoading(false);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      setError(`Failed to update profile: ${updateError.message}`);
    } else {
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      // Refresh the user context to get the latest data
      await refreshUser();
    }
  };
  
  // Display a loading state if user data isn't available yet
  if (!user) {
      return <p>Loading profile...</p>;
  }

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
                  <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
                      <img src="https://img.icons8.com/color/48/000000/lock-2.png" alt="Lock Icon"/>
                  </div>
              </div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-gray-600 flex-grow">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nama</label>
                  {isEditing ? (
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{fullName || 'Not set'}</p>
                  )}
                </div>
                 <div>
                  <label className="text-sm font-medium text-gray-500">Tanda Tangan Pribadi</label>
                   {isEditing ? (
                    <input type="text" value={signature} onChange={(e) => setSignature(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{signature}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="font-semibold">{user.email}</p> {/* Email is not editable here */}
                </div>
                 <div>
                  <label className="text-sm font-medium text-gray-500">Nomor WhatsApp</label>
                   {isEditing ? (
                    <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm p-2 mt-1"/>
                  ) : (
                    <p className="font-semibold">{phone}</p>
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
