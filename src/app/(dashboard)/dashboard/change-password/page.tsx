"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Key, ShieldCheck, Check } from "lucide-react";
import Button from "@/components/common/Button";

export default function ChangePasswordPage() {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      return setError("New passwords do not match.");
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(passwords.newPassword)) {
      return setError("Password must contain at least 8 characters, one uppercase, one lowercase, one number, and one special character.");
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/auth/change-password`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwords.currentPassword,
          newPassword: passwords.newPassword
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setSuccess(true);
      setTimeout(() => {
        const role = localStorage.getItem("userRole");
        if (role === "PLAYER") {
          router.push("/dashboard/player");
        } else if (role === "MEMBER") {
          router.push("/dashboard/member");
        } else {
          router.push("/dashboard/admin");
        }
      }, 2000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] py-20 px-4">
      <div className="max-w-[500px] mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#DEE2E6] shadow-sm p-8 md:p-12 rounded-sm"
        >
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-[#FFF5EE] rounded-full flex items-center justify-center mx-auto mb-6">
              <Key size={32} className="text-[#FF7400]" />
            </div>
            <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Update Password</h2>
            <p className="text-gray-500 text-sm">Please set a new password for your account</p>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
              <p className="text-gray-500">Your password has been updated. Redirecting...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    name="currentPassword"
                    value={passwords.currentPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-12 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
                    placeholder="Enter current password"
                    required
                  />
                  <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    name="newPassword"
                    value={passwords.newPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-12 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
                    placeholder="Enter new password"
                    required
                  />
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-800 uppercase">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    name="confirmPassword"
                    value={passwords.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-4 bg-[#F8F9FA] border border-[#DEE2E6] rounded text-sm text-gray-900 focus:outline-none focus:border-[#FF7400] focus:ring-1 focus:ring-[#FF7400]/20 transition-all"
                    placeholder="Confirm new password"
                    required
                  />
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <Button 
                type="submit" 
                variant="primary" 
                className="w-full py-4 rounded-full text-sm font-bold shadow-md"
                disabled={loading}
              >
                {loading ? "Updating..." : "Change Password"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </main>
  );
}
