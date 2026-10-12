"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AlertCircle, 
  RotateCcw, 
  FileText, 
  CheckCircle2,
  ArrowRight,
  Upload,
  Loader2,
  XCircle
} from "lucide-react";
import Link from "next/link";
import FileUpload from "@/components/common/FileUpload";

export default function ResubmitPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");
      
      setProfileData(data.user);
      
      // Initialize form data with primitive values and URLs
      const initialForm: any = {};
      Object.keys(data.user).forEach(key => {
        const val = data.user[key];
        // Exclude specific system/relation keys
        if (["id", "password", "createdAt", "updatedAt", "status", "rejectionRemark", "role", "tempId", "permanentId", "districtId", "talukId", "zoneId", "clubId", "coachId", "district", "taluk", "zone", "club", "coach", "students", "tournaments", "members", "payments", "grievances", "matches", "logs", "approvedBy", "approvedAt", "mustChangePassword", "resetPasswordToken", "resetPasswordExpires", "isPaid", "validUntil", "wins", "losses", "draws"].includes(key)) {
          return;
        }
        
        // Include if it's not an object (primitive) OR if it is null (empty primitive)
        if (val === null || typeof val !== "object") {
          initialForm[key] = val === null ? "" : val;
        }
      });
      setFormData(initialForm);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (key: string, file: File) => {
    const uploadData = new FormData();
    uploadData.append("file", file);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadData
      });
      const data = await res.json();
      if (res.ok) {
        handleInputChange(key, data.url);
      } else {
        alert("Upload failed: " + data.error);
      }
    } catch (err) {
      alert("Failed to upload file");
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/resubmit-application`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resubmit application");
      
      // Log out user
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userStatus");
      
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (profileData?.status !== "REPLAY" && !isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">No Changes Required</h2>
          <p className="text-slate-500 mb-8">
            Your application is currently in {profileData?.status} status.
          </p>
          <Link 
            href="/dashboard/member"
            className="block w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
          >
            Go to Dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-4">Resubmitted!</h2>
          <p className="text-slate-500 mb-8">
            Your application has been resubmitted successfully. It is now "Waiting for Approval" again.
          </p>
          <Link 
            href="/login"
            className="block w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
          >
            Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Rejection Alert */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-8 flex items-start gap-6"
        >
          <div className="p-4 bg-red-100 text-red-600 rounded-2xl">
            <AlertCircle size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-bold text-red-900">Application Rejected</h2>
              <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-0.5 rounded uppercase">Replay Required</span>
            </div>
            <p className="text-red-700 font-medium mb-4">{profileData?.rejectionRemark || "No specific remark provided."}</p>
          </div>
        </motion.div>

        {/* Resubmission Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <RotateCcw size={24} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800">Edit & Resubmit</h3>
          </div>

          <form onSubmit={handleResubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="md:col-span-2 flex justify-between items-center mb-2">
                  <h4 className="font-bold text-slate-700">Edit Profile Details</h4>
                </div>
                {Object.keys(formData).map(key => {
                    const val = formData[key] || "";
                    const isUploadField = ["proof", "photo", "certificate", "document", "front", "back", "file", "upload"].some(k => key.toLowerCase().includes(k)) ||
                                          (typeof val === "string" && (val.startsWith("http") || val.includes("/uploads/")));
                    const isBoolean = typeof val === "boolean";
                    const label = key.replace(/([A-Z])/g, " $1").trim();
                    
                    if (isUploadField) {
                      return (
                        <div key={key} className="col-span-1 md:col-span-2">
                          <FileUpload 
                            label={label}
                            value={val}
                            onChange={(url) => handleInputChange(key, url)}
                          />
                        </div>
                      );
                    }
                    
                    if (isBoolean) {
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            id={key}
                            checked={val} 
                            onChange={(e) => handleInputChange(key, e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label htmlFor={key} className="text-sm font-bold text-slate-700 capitalize cursor-pointer">
                            {label}
                          </label>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={key}>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider capitalize mb-1">
                          {label}
                        </label>
                        <input 
                          type="text" 
                          value={val} 
                          onChange={(e) => handleInputChange(key, e.target.value)}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 font-bold text-sm">
                <XCircle size={18} /> {error}
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-slate-100">
              <Link 
                href="/login"
                className="flex-grow py-5 bg-slate-100 text-slate-600 text-center font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                Cancel
              </Link>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-grow py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:scale-100"
              >
                {isSubmitting ? "Submitting..." : "Resubmit Application"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
