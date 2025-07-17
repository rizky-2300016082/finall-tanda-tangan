import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      {/* Navbar */}
      <nav className="absolute top-0 left-0 right-0 py-4 px-8 flex justify-between items-center bg-white shadow-sm">
        <h1 className="text-3xl font-bold text-green-500">Signature</h1>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors duration-200 font-medium"
        >
          Login
        </button>
      </nav>

      {/* Hero Section */}
      <div className="text-center mt-20">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Tinggalkan Kertas, Beralih ke Digital.
        </h2>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Platform tanda tangan digital yang cepat, aman, dan sah secara hukum untuk mempercepat proses dokumen Anda.
        </p>
        
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 transition-colors duration-200 text-lg"
        >
          Mendaftar
        </button>
        <p className="mt-2 text-sm text-gray-500">
          tanpa perlu kartu kredit, batalkan kapan saja.
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 text-center text-gray-600 text-sm">
        <p>© 2023 Signature. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LandingPage;