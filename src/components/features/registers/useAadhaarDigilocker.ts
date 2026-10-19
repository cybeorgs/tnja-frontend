"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 15 * 60 * 1000;

type Status = 'idle' | 'starting' | 'waiting' | 'verified';

// Aadhaar verification through DigiLocker (UIDAI discontinued the Aadhaar OTP API).
// DigiLocker opens in a popup so the half-filled form is kept; we poll the backend
// until the user has consented, then receive the aadhaarVerificationToken.
export function useAadhaarDigilocker() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const session = useRef<{ aadhaarNumber: string; token: string; startedAt: number } | null>(null);
  const popup = useRef<Window | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';

  const stop = useCallback((message: string | null) => {
    session.current = null;
    popup.current?.close();
    popup.current = null;
    setAuthorizationUrl(null);
    setError(message);
    setStatus('idle');
  }, []);

  const start = async (aadhaarNumber: string, email?: string) => {
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      setError("Please enter a valid 12-digit Aadhaar Number.");
      return;
    }
    // Open the popup synchronously in the click handler so browsers don't block it.
    popup.current = window.open('', 'digilocker', 'width=520,height=720');
    setStatus('starting');
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/aadhaar/digilocker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aadhaarNumber, email: email || undefined })
      });
      const data = await res.json();
      if (!res.ok) return stop(data.error || "Failed to start Aadhaar verification.");

      session.current = { aadhaarNumber, token: data.digilockerSessionToken, startedAt: Date.now() };
      setAuthorizationUrl(data.authorizationUrl);
      if (popup.current && !popup.current.closed) popup.current.location.href = data.authorizationUrl;
      setStatus('waiting');
    } catch {
      stop("Failed to connect to server.");
    }
  };

  useEffect(() => {
    if (status !== 'waiting') return;
    let checking = false;
    const timer = setInterval(async () => {
      const current = session.current;
      if (!current || checking) return;
      if (Date.now() - current.startedAt > MAX_WAIT_MS) return stop("Verification timed out. Please click Verify again.");
      checking = true;
      try {
        const res = await fetch(`${apiUrl}/auth/aadhaar/digilocker/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aadhaarNumber: current.aadhaarNumber, digilockerSessionToken: current.token })
        });
        const data = await res.json();
        if (session.current !== current) return;
        if (!res.ok) return stop(data.error || "Failed to verify Aadhaar.");
        if (data.status === 'verified') {
          stop(null);
          setVerificationToken(data.aadhaarVerificationToken);
          setStatus('verified');
        }
      } catch {
        // Network blip: keep polling.
      } finally {
        checking = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, apiUrl, stop]);

  return {
    verified: status === 'verified',
    loading: status === 'starting' || status === 'waiting',
    waiting: status === 'waiting',
    error,
    authorizationUrl,
    verificationToken,
    start,
    cancel: () => stop(null),
  };
}
