"use client";

import React, { useState } from 'react';
import Button from '@/components/common/Button';
import { Asterisk, Check, Mail } from 'lucide-react';

type Status = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

// Email verification by a 6-digit OTP sent to the address. The form keeps this state
// so it can block submit and send verificationToken with the registration.
export function useEmailOtp() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
  const emailRegex = /^(?=.{1,254}$)(?=.{1,64}@)[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const send = async (email: string) => {
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    const statusOnError: Status = otpToken ? 'sent' : 'idle';
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/email-otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setOtpToken(data.emailOtpToken);
        setOtpValue("");
        setStatus('sent');
      } else {
        setError(data.error || "Failed to send OTP.");
        setStatus(statusOnError);
      }
    } catch {
      setError("Failed to connect to server.");
      setStatus(statusOnError);
    }
  };

  const verify = async (email: string) => {
    if (otpValue.length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setStatus('verifying');
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/auth/email-otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpValue, emailOtpToken: otpToken })
      });
      const data = await res.json();
      if (res.ok) {
        setVerificationToken(data.emailVerificationToken);
        setStatus('verified');
      } else {
        setError(data.error || "Failed to verify OTP.");
        setStatus('sent');
      }
    } catch {
      setError("Failed to connect to server.");
      setStatus('sent');
    }
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setOtpValue("");
    setOtpToken("");
    setVerificationToken("");
  };

  return {
    status,
    verified: status === 'verified',
    otpSent: !!otpToken,
    error,
    otpValue,
    setOtpValue: (value: string) => setOtpValue(value.replace(/\D/g, '').slice(0, 6)),
    verificationToken,
    send,
    verify,
    reset,
  };
}

interface EmailVerificationFieldProps {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  emailOtp: ReturnType<typeof useEmailOtp>;
}

export default function EmailVerificationField({ label, name, placeholder, value, onChange, emailOtp }: EmailVerificationFieldProps) {
  const { status, verified, error } = emailOtp;
  const locked = status !== 'idle';

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-xs font-bold text-gray-800 flex items-center gap-1">
        {label} <Asterisk size={10} className="text-red-500 stroke-[4px]" />
      </label>
      <div className="flex gap-2">
        <div className="relative w-full">
          <input
            type="email"
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            disabled={locked}
            className={`w-full pl-10 py-3 bg-white border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all placeholder:text-gray-400 ${locked ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''}`}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Mail size={18} />
          </div>
        </div>
        {verified ? (
          <div className="flex items-center justify-center px-4 bg-green-50 border border-green-200 text-green-600 rounded whitespace-nowrap font-bold text-sm">
            <Check size={16} className="mr-1" /> Verified
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={() => emailOtp.send(value)}
            disabled={status === 'sending' || status === 'verifying' || !value}
            className="whitespace-nowrap px-6"
          >
            {status === 'sending' ? 'Sending...' : status === 'idle' ? 'Verify' : 'Resend OTP'}
          </Button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs font-medium">{error}</p>}

      {!verified && emailOtp.otpSent && (
        <div className="mt-2 p-4 bg-blue-50 border border-blue-100 rounded flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-blue-800 font-medium">An OTP has been sent to <strong>{value}</strong>. Check your inbox (and spam folder).</p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={emailOtp.otpValue}
              onChange={(e) => emailOtp.setOtpValue(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-blue-200 rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <Button
              type="button"
              variant="primary"
              onClick={() => emailOtp.verify(value)}
              disabled={status === 'verifying' || emailOtp.otpValue.length !== 6}
              className="whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
            >
              {status === 'verifying' ? 'Verifying...' : 'Verify'}
            </Button>
          </div>
          <button type="button" onClick={emailOtp.reset} className="self-start text-xs font-bold text-gray-500 underline">
            Change email
          </button>
        </div>
      )}
    </div>
  );
}
