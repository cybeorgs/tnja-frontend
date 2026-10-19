"use client";

import { useEffect } from 'react';

// DigiLocker redirects here after the user allows (or denies) access to their Aadhaar.
// The registration form polls the backend for the result, so this popup just closes itself.
export default function DigilockerCallbackPage() {
  useEffect(() => {
    if (window.opener) window.close();
  }, []);

  return (
    <div className="max-w-md mx-auto my-20 px-6 text-center">
      <h1 className="text-xl font-bold text-[#2B1300] mb-3">DigiLocker step complete</h1>
      <p className="text-sm text-gray-600">You can close this window and return to the registration form. Your Aadhaar verification status will update there automatically.</p>
    </div>
  );
}
