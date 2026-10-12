"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, ArrowRight, ShieldCheck } from "lucide-react";
import Breadcrumb from "@/components/common/Breadcrumb";
import Button from "@/components/common/Button";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token.");
    }
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError("Passwords do not match.");
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(passwords.newPassword)) {
      return setError("Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character.");
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: passwords.newPassword
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Reset failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white border border-[#DEE2E6] p-8 md:p-12 shadow-sm rounded-sm text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Password Reset Successful</h2>
        <p className="text-gray-500 text-sm mb-8">
          Your password has been reset successfully. You will be redirected to the login page in a few seconds.
        </p>
        <Button 
          variant="primary" 
          className="w-full py-4 rounded-full text-sm font-bold"
          onClick={() => router.push("/login")}
        >
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#DEE2E6] p-8 md:p-12 shadow-sm rounded-sm">
      <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Set New Password</h2>
      <p className="text-gray-500 text-sm mb-8">
        Please enter your new password below. Make sure it's secure and easy to remember.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
            <XCircle size={16} />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="newPassword"
              value={passwords.newPassword}
              onChange={handleChange}
              className="w-full pl-10 pr-12 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
              placeholder="••••••••"
              required
            />
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF7400] transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">Confirm New Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              value={passwords.confirmPassword}
              onChange={handleChange}
              className="w-full pl-10 pr-4 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
              placeholder="••••••••"
              required
            />
            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <Button 
          type="submit" 
          variant="primary" 
          className="w-full py-4 rounded-full text-sm font-bold flex items-center justify-center gap-2"
          disabled={loading || !token}
        >
          {loading ? "Resetting..." : "Reset Password"}
          {!loading && <ArrowRight size={18} />}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="bg-white min-h-screen pb-20">
      <section className="bg-[#F6F6F6] h-[150px] flex items-center mb-16">
        <div className="max-w-[1200px] mx-auto w-full px-4">
          <h1 className="text-[32px] font-bold text-[#1A1A1A] mb-2 tracking-tight">
            Reset Password
          </h1>
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Login", href: "/login" },
              { label: "Reset Password" }
            ]} 
          />
        </div>
      </section>

      <div className="max-w-[500px] mx-auto px-4">
        <Suspense fallback={
          <div className="text-center py-20 text-gray-500 font-medium">
            Loading reset form...
          </div>
        }>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
