import React from 'react';

const SignatureSuccess = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Anda Berhasil Menandatangani!
        </h2>
        <p className="mt-2 text-lg text-gray-600">
          Dokumen Anda telah berhasil ditandatangani secara digital.
        </p>
      </div>
    </div>
  );
};

export default SignatureSuccess;
