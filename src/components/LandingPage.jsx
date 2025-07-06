
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      {/* Navbar */}
      <nav className="absolute top-0 left-0 right-0 py-4 px-8 flex justify-between items-center bg-white shadow-sm">
        <h1 className="text-3xl font-bold text-gray-800">Signature</h1>
        <div className="flex items-center space-x-6">
          <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">Manfaat</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">Kasus Penggunaan</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-medium">FAQ</a>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 transition-colors duration-200 font-medium"
          >
            Masuk
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="text-center mt-20">
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Ucapkan Selamat Tinggal<br/>pada Kertas.
        </h2>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Tanda Tangan Dokumen Secara Digital—<br/>Cepat, Aman, dan Sah Secara Hukum.
        </p>
        <p className="text-base text-gray-500 mb-10 max-w-2xl mx-auto">
          Platform tanda tangan elektronik terpercaya untuk bisnis, profesional,<br/>dan individu di Indonesia.
        </p>
        
        <button
          onClick={() => navigate('/login')}
          className="px-8 py-3 border border-blue-500 text-blue-500 font-bold rounded-lg hover:bg-blue-50 transition-colors duration-200 text-lg"
        >
          Daftar
        </button>
        <p className="mt-2 text-sm text-gray-500">
          Tanpa perlu kartu kredit
        </p>
      </div>

      {/* Footer / Creator Info */}
      <div className="absolute bottom-8 text-center text-gray-600 text-sm">
        <p className="mb-2">Creator By:</p>
        <ul className="flex justify-center space-x-8">
          <li>• Bp. Farid Surya</li>
          <li>• Sepuh Niko</li>
          <li>• Kelompok 4 & 5</li>
        </ul>
      </div>
    </div>
  );
};

export default LandingPage;
