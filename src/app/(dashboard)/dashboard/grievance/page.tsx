"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  History,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Loader2,
  Clock,
  Reply,
  ImageIcon,
  FileText,
  X,
  Paperclip
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function GrievancePage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUserData(data);
        fetchGrievances(data.user.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const fetchGrievances = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/grievances/user/${userId}`);
      const data = await res.json();
      if (res.ok) setGrievances(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const token = localStorage.getItem("token");
      const form = new FormData();
      form.append("userId", userData.user.id);
      form.append("userName", userData.user.fullName);
      form.append("userEmail", userData.user.email);
      form.append("role", userData.role);
      form.append("subject", subject);
      form.append("description", description);
      images.forEach(f => form.append("images", f));
      documents.forEach(f => form.append("documents", f));

      const res = await fetch(`${API_BASE}/grievances`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Your grievance has been submitted successfully." });
        setSubject("");
        setDescription("");
        setImages([]);
        setDocuments([]);
        fetchGrievances(userData.user.id);
        setTimeout(() => setActiveTab("history"), 2000);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to submit grievance." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const ADMIN_ROLES = ["SUPER_ADMIN", "CEO", "STATE_PRESIDENT", "STATE_SECRETARY"];

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
      </div>
    );
  }

  if (ADMIN_ROLES.includes(userData?.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4 max-w-md mx-auto">
        <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-slate-500 text-sm">
          Admin roles cannot submit grievances. You can view and respond to grievances from the
          <a href="/dashboard/admin/grievances" className="text-[#FF7400] font-bold ml-1 underline">Admin Grievances panel</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Grievance Mail Module</h1>
          <p className="text-slate-500">Submit your complaints or suggestions to the TNJA administration.</p>
        </div>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-fit">
        <button
          onClick={() => setActiveTab("new")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === "new" ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <Send size={18} />
          New Grievance
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === "history" ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <History size={18} />
          History
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "new" ? (
          <motion.div
            key="new"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    {userData?.role === "STUDENT" ? "Player ID" :
                     userData?.role === "COACH" ? "Coach ID" :
                     userData?.role === "CLUB" ? "Club ID" : "Member ID"}
                  </label>
                  <input
                    type="text"
                    value={userData?.user.permanentId || userData?.user.tempId}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Role</label>
                  <input
                    type="text"
                    value={userData?.role}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What is this regarding?"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF7400]/20 focus:border-[#FF7400] transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Complaint Description</label>
                <textarea
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe your grievance in detail..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF7400]/20 focus:border-[#FF7400] transition-all outline-none resize-none"
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <ImageIcon size={16} className="text-[#FF7400]" /> Attach Images (optional)
                </label>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#FF7400]/50 hover:bg-orange-50/30 transition-all">
                  <Paperclip size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-500 font-medium">Click to upload images (JPG, PNG, etc.)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => setImages(Array.from(e.target.files || []))}
                  />
                </label>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {images.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs font-semibold text-orange-700">
                        <ImageIcon size={12} /> {f.name}
                        <button type="button" onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}>
                          <X size={12} className="hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Document Upload */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <FileText size={16} className="text-[#FF7400]" /> Attach Documents (optional)
                </label>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#FF7400]/50 hover:bg-orange-50/30 transition-all">
                  <Paperclip size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-500 font-medium">Click to upload documents (PDF, DOC, etc.)</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    multiple
                    className="hidden"
                    onChange={e => setDocuments(Array.from(e.target.files || []))}
                  />
                </label>
                {documents.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {documents.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
                        <FileText size={12} /> {f.name}
                        <button type="button" onClick={() => setDocuments(docs => docs.filter((_, j) => j !== i))}>
                          <X size={12} className="hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {message.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}>
                  {message.type === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-[#FF7400] text-white rounded-xl font-bold text-lg hover:bg-[#E56900] transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-lg shadow-orange-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Grievance
                    <Send size={20} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            {grievances.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">No history found</h3>
                <p className="text-slate-500">You haven't submitted any grievances yet.</p>
              </div>
            ) : (
              grievances.map((g, idx) => (
                <div key={g.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-slate-800">{g.subject}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(g.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          g.status === "PENDING" ? "bg-amber-100 text-amber-600" :
                          g.status === "CLOSED" ? "bg-red-100 text-red-600" :
                          "bg-green-100 text-green-600"
                        }`}>
                          {g.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {g.description}
                  </p>
                  {g.reply && (
                    <div className="pl-6 border-l-4 border-orange-100 space-y-2 pt-2">
                      <div className="flex items-center gap-2 text-[#FF7400] font-bold text-sm">
                        <Reply size={16} />
                        Admin Reply
                      </div>
                      <p className="text-slate-700 text-sm italic bg-orange-50/50 p-4 rounded-xl">
                        {g.reply}
                      </p>
                    </div>
                  )}
                  {g.remark && (
                    <div className="pl-6 border-l-4 border-red-100 space-y-2 pt-2 mt-2">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                        <CheckCircle2 size={16} />
                        Admin Remark (Closed)
                      </div>
                      <p className="text-slate-700 text-sm italic bg-red-50/50 p-4 rounded-xl">
                        {g.remark}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
