
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Security = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { updatePassword, deleteUser } = useAuth();

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setShowPasswordModal(true);
  };

  const confirmPasswordChange = async () => {
    try {
      await updatePassword(oldPassword, newPassword);
      setSuccess('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setShowPasswordModal(false);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      await deleteUser();
      // Redirect or handle logout will be managed by AuthProvider
    } catch (err) {
      setError(err.message);
    } finally {
      setShowDeleteModal(false);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Keamanan</h2>
      
      {error && <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-md mb-6">{error}</div>}
      {success && <div className="bg-green-100 border border-green-400 text-green-700 p-3 rounded-md mb-6">{success}</div>}
      
      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200 mb-8">
        <h3 className="text-xl font-semibold text-gray-700 mb-6">Ubah Kata Sandi</h3>
        <form onSubmit={handlePasswordChange}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500">Kata Sandi Lama</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 mt-1 focus:ring-blue-500 focus:border-blue-500"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500">Kata Sandi Baru</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 mt-1 focus:ring-blue-500 focus:border-blue-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-500">Konfirmasi Kata Sandi Baru</label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2 mt-1 focus:ring-blue-500 focus:border-blue-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-6 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600">
              Ubah Kata Sandi
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h3 className="text-xl font-semibold text-gray-700 mb-4">Hapus Akun</h3>
        <p className="text-gray-600 mb-6">
          Setelah Anda menghapus akun Anda, tidak ada jalan untuk kembali. Mohon pastikan.
        </p>
        <div className="flex justify-end">
          <button
            onClick={handleDeleteAccount}
            className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600"
          >
            Hapus Akun Saya
          </button>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4">Konfirmasi Perubahan Kata Sandi</h3>
            <p className="mb-6">Apakah Anda yakin ingin mengubah kata sandi Anda?</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowPasswordModal(false)} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
                Batal
              </button>
              <button onClick={confirmPasswordChange} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                Yakin
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4">Konfirmasi Hapus Akun</h3>
            <p className="mb-6">Apakah Anda yakin ingin menghapus akun Anda? Tindakan ini tidak dapat diurungkan.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">
                Batal
              </button>
              <button onClick={confirmDeleteAccount} className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Security;
