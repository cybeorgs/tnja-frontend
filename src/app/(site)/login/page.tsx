"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Home } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedIdentifier = localStorage.getItem("rememberedIdentifier");
      if (savedIdentifier) {
        setFormData((prev) => ({ ...prev, identifier: savedIdentifier }));
        setRememberMe(true);
      }

      const params = new URLSearchParams(window.location.search);
      const identifier = params.get("identifier");
      if (identifier) {
        setFormData((prev) => ({ ...prev, identifier }));
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      // Store auth data
      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", data.role);
      localStorage.setItem("userName", data.user.fullName);
      localStorage.setItem("userStatus", data.user.status || "APPROVED");
      localStorage.setItem("userEmail", data.user.email);

      // Remember Me Logic
      if (rememberMe) {
        localStorage.setItem("rememberedIdentifier", formData.identifier);
      } else {
        localStorage.removeItem("rememberedIdentifier");
      }

      // Check if password change is required
      if (data.user.mustChangePassword) {
        router.push("/dashboard/change-password");
        return;
      }

      // Redirect based on role/status
      if (data.user.status === "PENDING") {
        throw new Error("Your application is pending approval. Please check the tracking page.");
      }
      if (data.user.status === "REJECTED" || data.user.status === "REPLAY") {
        router.push("/dashboard/resubmit");
        return;
      }

      if (["SUPER_ADMIN", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(data.role)) {
        router.push("/dashboard/admin");
      } else if (data.role === "PLAYER") {
        router.push("/dashboard/player");
      } else {
        router.push("/dashboard/member");
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-[#E58311]">
      {/* Background with Blur/Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/login-bg1.png"
          alt="Login Background"
          fill
          className="object-cover opacity-60"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/30 to-transparent mix-blend-overlay"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[1020px] mx-4"
      >
        <div className="bg-white rounded-[30px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden p-7 md:p-8 relative">
          {/* Home Button */}
          <Link
            href="/"
            aria-label="Back to home"
            className="absolute top-6 left-6 flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-[#FF7400] transition-colors"
          >
            <Home size={18} />
          </Link>
 
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center pt-6 md:pt-2">
            
            {/* Left Section: Form */}
            <div className="flex flex-col items-center">
              <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                  Sign In
                </h1>
                <p className="mt-1 text-xs text-gray-400 font-medium">
                  Welcome back, please enter your details
                </p>
              </div>
 
              <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
                {error && (
                  <div className="p-2.5 bg-red-50 border-l-4 border-red-500 text-red-600 text-xs font-medium">
                    {error}
                  </div>
                )}
 
                {/* Username Input */}
                <div className="relative group">
                  <div className="absolute -top-2.5 left-4 px-2 bg-white text-xs font-medium text-gray-500 transition-all group-focus-within:text-[#FF7400] z-10">
                    Username
                  </div>
                  <div className="relative shadow-[0_4px_10px_-4px_rgba(255,218,0,0.6)] rounded-xl">
                    <input
                      type="text"
                      name="identifier"
                      value={formData.identifier}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-[#FF7400] rounded-xl text-sm text-gray-700 focus:outline-none transition-all placeholder:text-gray-300"
                      placeholder="Enter your ID or email"
                      required
                    />
                  </div>
                </div>
 
                {/* Password Input */}
                <div className="relative group">
                  <div className="absolute -top-2.5 left-4 px-2 bg-white text-xs font-medium text-gray-500 transition-all group-focus-within:text-[#FF7400] z-10">
                    Password
                  </div>
                  <div className="relative shadow-[0_4px_10px_-4px_rgba(255,218,0,0.6)] rounded-xl">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-[#FF7400] rounded-xl text-sm text-gray-700 focus:outline-none transition-all placeholder:text-gray-300"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF7400] transition-colors"
                    >
                      {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                </div>
 
                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border border-[#FFDAB9] text-[#FF7400] focus:ring-[#FF7400]/20 cursor-pointer" 
                    />
                    <span className="text-xs text-gray-500 font-semibold group-hover:text-gray-700 transition-colors">Remember Me</span>
                  </label>
                  <Link href="/forgot-password" className="text-[11px] text-gray-400 font-medium hover:text-[#FF7400] transition-colors italic">
                    Forgot Password?
                  </Link>
                </div>
 
                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-gradient-to-r from-[#FF7400] to-[#FF9D00] text-white text-base font-bold rounded-xl shadow-[0_6px_0_rgba(0,0,0,0.08),0_8px_15px_rgba(0,0,0,0.08)] active:shadow-none active:translate-y-[2px] transition-all disabled:opacity-70"
                >
                  {loading ? "Signing in..." : "Login"}
                </button>
 
                {/* Separator */}
                <div className="flex items-center my-3">
                  <div className="flex-grow border-t border-gray-150"></div>
                  <span className="mx-2 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Or</span>
                  <div className="flex-grow border-t border-gray-150"></div>
                </div>
 
                {/* Register Button */}
                <Link
                  href="/register"
                  className="block w-full py-2 text-center border border-[#FF7400] text-[#FF7400] hover:bg-[#FF7400]/5 text-sm font-bold rounded-xl shadow-[0_4px_10px_rgba(255,116,0,0.05)] transition-all active:translate-y-[2px]"
                >
                  Register / Create Account
                </Link>

                {/* Track Registration */}
                <Link
                  href="/track"
                  className="block w-full py-2.5 text-center text-slate-500 hover:text-[#FF7400] hover:bg-orange-50/60 text-xs font-semibold rounded-xl transition-colors"
                >
                  Track your registration status
                </Link>
              </form>
            </div>
 
            {/* Right Section: Image */}
            <div className="hidden lg:block h-full min-h-[450px]">
              <div 
                className="relative h-full w-full rounded-[25px] overflow-hidden border border-[#FFDA00]"
                style={{
                  boxShadow: 'inset 4px 4px 8px rgba(0, 0, 0, 0.24), inset -4px -4px 8px rgba(0, 0, 0, 0.25)'
                }}
              >
                <Image
                  src="/images/login-side1.png"
                  alt="Martial Arts Action"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-600/20 to-transparent pointer-events-none"></div>
              </div>
            </div>
 
          </div>
        </div>
      </motion.div>
    </main>
  );
}
