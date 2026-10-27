"use client";

import { useEffect } from 'react';
import { DIGILOCKER_CHANNEL } from '@/components/features/registers/useAadhaarDigilocker';

// DigiLocker redirects here after the user allows (or denies) access to their Aadhaar.
// Tell the registration form to check the result now, then close this popup.
export default function DigilockerCallbackPage() {
  useEffect(() => {
    try {
      const channel = new BroadcastChannel(DIGILOCKER_CHANNEL);
      channel.postMessage('done');
      channel.close();
    } catch {
      // Older browser: the form's slow poll still picks up the result.
    }
    if (window.opener) window.close();
  }, []);

  return (
    <div className="max-w-md mx-auto my-20 px-6 text-center">
      <h1 className="text-xl font-bold text-[#2B1300] mb-3">DigiLocker step complete</h1>
      <p className="text-sm text-gray-600">You can close this window and return to the registration form. Your Aadhaar verification status will update there automatically.</p>
    </div>
  );
}
