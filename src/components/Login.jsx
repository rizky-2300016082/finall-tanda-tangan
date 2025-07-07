
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotification('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            setError('Email ini sudah terdaftar. Silakan coba masuk.');
          } else {
            setError(signUpError.message);
          }
        } else {
          setNotification('Pendaftaran berhasil! Silakan periksa email Anda untuk link konfirmasi.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError('Email atau kata sandi salah. Silakan coba lagi.');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFormMode = (e) => {
    e.preventDefault();
    setIsSignUp(!isSignUp);
    setError('');
    setNotification('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left Side (Form) */}
      <div className="w-full lg:w-1/2 bg-[#111827] text-white p-8 sm:p-12 flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto">
          <h1 className="text-3xl font-bold mb-2">Selamat Datang di Signature</h1>
          <p className="text-gray-400 mb-8">
            {isSignUp ? 'Silakan daftar untuk membuat akun.' : 'Silakan masuk untuk melanjutkan'}
          </p>
          
          {notification && (
            <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded-md mb-6" role="alert">
              {notification}
            </div>
          )}

          {error && (
             <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded-md mb-6" role="alert">
              {error}
            </div>
          )}

          {/* Social Logins */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button className="w-full bg-[#1F2937] text-gray-300 py-2.5 px-4 rounded-md flex items-center justify-center border border-gray-700 hover:bg-gray-700 transition-colors">
              <img src="https://img.icons8.com/color/16/000000/google-logo.png" alt="Google" className="mr-2"/>
              Masuk Dengan Google
            </button>
            <button className="w-full bg-[#1F2937] text-gray-300 py-2.5 px-4 rounded-md flex items-center justify-center border border-gray-700 hover:bg-gray-700 transition-colors">
              <img src="https://img.icons8.com/color/16/000000/facebook-new.png" alt="Facebook" className="mr-2"/>
              Masuk Dengan Facebook
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="email"
                placeholder="Alamat Email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1F2937] border border-gray-700 rounded-md py-2.5 pl-8 pr-4 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="mb-6 relative">
              <svg className="w-5 h-5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type="password"
                placeholder="Kata Sandi"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1F2937] border border-gray-700 rounded-md py-2.5 pl-9 pr-4 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-md disabled:opacity-50 transition-colors"
            >
              {loading ? 'Memproses...' : (isSignUp ? 'Daftar' : 'Masuk')}
            </button>
          </form>

          {/* Toggle Form */}
          <p className="text-center text-gray-400 mt-6">
            {isSignUp ? 'Sudah mempunyai akun? ' : 'Belum mempunyai akun? '}
            <a href="#" onClick={toggleFormMode} className="text-blue-500 hover:underline">
              {isSignUp ? 'Masuk' : 'Daftar'}
            </a>
          </p>
        </div>
      </div>
      
      {/* Right Side (Info) */}
      <div className="hidden lg:flex w-1/2 bg-blue-600 text-white p-12 flex-col justify-center">
        <div className="max-w-md mx-auto">
          <h2 className="text-4xl font-bold mb-4">Solusi Tanda Tangan Digital untuk Individu dan Tim Profesional</h2>
          <p className="text-blue-100 leading-relaxed">
            Signature adalah platform tanda tangan digital yang memudahkan Anda menandatangani, meminta tanda tangan dari pihak lain, dan mengelola dokumen resmi secara aman dan efisien. Baik untuk kebutuhan pribadi maupun kolaborasi tim atau organisasi, Signature hadir untuk mempercepat proses persetujuan dokumen — kapan saja, di mana saja.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
