"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

// Every check costs a Sandbox status call. The callback page announces when DigiLocker is
// done, which triggers the one check that matters; the timer is only a slow safety net for
// browsers where that message can't arrive. Worst case (user abandons): ~13 checks.
const SAFETY_POLL_MS = 45 * 1000;
const MAX_WAIT_MS = 10 * 60 * 1000;
// "Check now" clicks closer together than this reuse the last answer instead of calling again.
const MANUAL_CHECK_GAP_MS = 10 * 1000;
export const DIGILOCKER_CHANNEL = 'tnja-digilocker';

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
  const inFlight = useRef(false);
  const checkNowRef = useRef<() => void>(() => {});

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
    // Each start is a paid Sandbox session: ignore double clicks and clicks while one is open.
    if (inFlight.current || session.current) return;
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      setError("Please enter a valid 12-digit Aadhaar Number.");
      return;
    }
    // Open the popup synchronously in the click handler so browsers don't block it.
    inFlight.current = true;
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
    } finally {
      inFlight.current = false;
    }
  };

  useEffect(() => {
    if (status !== 'waiting') return;
    let cancelled = false;
    let checking = false;
    let lastCheckAt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled) return;
      clearTimeout(timer);
      timer = setTimeout(check, SAFETY_POLL_MS);
    };

    const check = async () => {
      const current = session.current;
      if (cancelled || !current || checking) return;
      if (Date.now() - current.startedAt > MAX_WAIT_MS) return stop("Verification timed out. Please click Verify again.");
      checking = true;
      lastCheckAt = Date.now();
      try {
        const res = await fetch(`${apiUrl}/auth/aadhaar/digilocker/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aadhaarNumber: current.aadhaarNumber, digilockerSessionToken: current.token })
        });
        const data = await res.json();
        if (cancelled || session.current !== current) return;
        if (!res.ok) return stop(data.error || "Failed to verify Aadhaar.");
        if (data.status === 'verified') {
          stop(null);
          setVerificationToken(data.aadhaarVerificationToken);
          setStatus('verified');
          return;
        }
      } catch {
        // Network blip: keep polling.
      } finally {
        checking = false;
      }
      schedule();
    };

    // The callback page posts here when DigiLocker redirects back: check right away.
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DIGILOCKER_CHANNEL);
      channel.onmessage = () => {
        if (checking) return;
        clearTimeout(timer);
        check();
      };
    } catch {
      // No BroadcastChannel: the slow poll still picks up the result.
    }

    checkNowRef.current = () => {
      if (checking || Date.now() - lastCheckAt < MANUAL_CHECK_GAP_MS) return;
      clearTimeout(timer);
      check();
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      channel?.close();
      checkNowRef.current = () => {};
    };
  }, [status, apiUrl, stop]);

  return {
    verified: status === 'verified',
    loading: status === 'starting' || status === 'waiting',
    waiting: status === 'waiting',
    error,
    authorizationUrl,
    verificationToken,
    start,
    /** For "I've finished in DigiLocker": checks once now (rate limited) instead of waiting for the timer. */
    checkNow: () => checkNowRef.current(),
    cancel: () => stop(null),
  };
}
