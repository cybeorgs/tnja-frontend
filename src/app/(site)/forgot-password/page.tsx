"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, ArrowRight, XCircle } from "lucide-react";
import Breadcrumb from "@/components/common/Breadcrumb";
import Button from "@/components/common/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setMessage(data.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-white min-h-screen pb-20">
      {/* Banner Section */}
      <section className="bg-[#F6F6F6] h-[150px] flex items-center mb-16">
        <div className="max-w-[1200px] mx-auto w-full px-4">
          <h1 className="text-[32px] font-bold text-[#1A1A1A] mb-2 tracking-tight">
            Forgot Password
          </h1>
          <Breadcrumb 
            items={[
              { label: "Home", href: "/" },
              { label: "Login", href: "/login" },
              { label: "Forgot Password" }
            ]} 
          />
        </div>
      </section>

      <div className="max-w-[500px] mx-auto px-4 text-center">
        {!submitted ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#DEE2E6] p-8 md:p-12 shadow-sm rounded-sm text-left"
          >
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Reset Password</h2>
            <p className="text-gray-500 text-sm mb-8">
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
                  <XCircle size={16} />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
                    placeholder="Enter your registered email"
                    required
                  />
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-4 rounded-full text-sm font-bold flex items-center justify-center gap-2"
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Reset Link"}
                {!loading && <ArrowRight size={18} />}
              </Button>

              <div className="text-center pt-4">
                <Link href="/login" className="text-sm text-gray-500 hover:text-[#FF7400] font-medium flex items-center justify-center gap-2">
                  <ArrowLeft size={16} />
                  Back to Login
                </Link>
              </div>
            </form>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-[#DEE2E6] p-8 md:p-12 shadow-sm rounded-sm"
          >
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4">Check Your Email</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              {message || "We have sent a password reset link to your email address. Please check your inbox and follow the instructions."}
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full py-4 rounded-full text-sm font-bold">
                Back to Login
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </main>
  );
}
