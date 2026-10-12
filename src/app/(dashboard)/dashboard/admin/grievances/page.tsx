"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Loader2,
  Clock,
  User,
  Reply,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  ImageIcon,
  FileText,
  Paperclip,
  Download,
  ZoomIn,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function AdminGrievancePage() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedGrievance, setSelectedGrievance] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [remarkText, setRemarkText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"));
    fetchGrievances();
  }, []);

  const fetchGrievances = async () => {
    try {
      const res = await fetch(`${API_BASE}/grievances`);
      const data = await res.json();
      if (res.ok) setGrievances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/grievances/${selectedGrievance.id}/reply`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText })
      });
      if (res.ok) {
        setReplyText("");
        setSelectedGrievance(null);
        fetchGrievances();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async () => {
    if (!remarkText.trim()) return;
    setClosing(true);
    try {
      const res = await fetch(`${API_BASE}/grievances/${selectedGrievance.id}/close`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remark: remarkText })
      });
      if (res.ok) {
        setRemarkText("");
        setSelectedGrievance(null);
        fetchGrievances();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setClosing(false);
    }
  };

  const filteredGrievances = grievances.filter(g => {
    const matchesSearch = 
      g.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.userId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "pending") return matchesSearch && g.status === "PENDING";
    if (filter === "replied") return matchesSearch && (g.status === "REPLAY" || g.reply) && g.status !== "CLOSED";
    if (filter === "closed") return matchesSearch && g.status === "CLOSED";
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (userRole && !["SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY"].includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle size={48} className="text-red-500" />
        <h2 className="text-2xl font-bold text-slate-800">Unauthorized Access</h2>
        <p className="text-slate-500">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Grievance Management</h1>
          <p className="text-slate-500">Review and respond to complaints from students, coaches, and referees.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, ID, or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all"
          />
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 ">
          {["all", "pending", "replied", "closed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl font-bold capitalize transition-all cursor-pointer ${
                filter === f ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredGrievances.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No grievances found</h3>
            <p className="text-slate-500">All caught up! No complaints to show.</p>
          </div>
        ) : (
          filteredGrievances.map((g) => (
            <motion.div
              layoutId={g.id}
              key={g.id}
              onClick={() => {
                setSelectedGrievance(g);
                setReplyText(g.reply || "");
                setRemarkText(g.remark || "");
              }}
              className="bg-white rounded-3xl p-6 border border-slate-200 hover:shadow-xl hover:border-brand-orange/20 transition-all cursor-pointer group"
            >
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      g.role === "PLAYER" ? "bg-purple-100 text-purple-600" : 
                      g.role === "COACH" ? "bg-orange-100 text-brand-orange" : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {g.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      g.status === "PENDING" ? "bg-amber-100 text-amber-600" :
                      g.status === "CLOSED" ? "bg-red-100 text-red-600" :
                      "bg-green-100 text-green-600"
                    }`}>
                      {g.status === "REPLAY" ? "REPLIED" : g.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand-orange transition-colors">{g.subject}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1.5 font-medium">
                      <User size={16} />
                      {g.userName} ({g.userId})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock size={16} />
                      {new Date(g.createdAt).toLocaleDateString()}
                    </span>
                    {((g.images?.length > 0) || (g.documents?.length > 0)) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                        <Paperclip size={11} />
                        {(g.images?.length || 0) + (g.documents?.length || 0)} attachment{((g.images?.length || 0) + (g.documents?.length || 0)) > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 group-hover:bg-orange-50 group-hover:text-[#FF7400] transition-all">
                    <Reply size={24} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Reply Modal */}
      <AnimatePresence>
        {selectedGrievance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedGrievance(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 space-y-6 overflow-y-auto flex-grow">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7400] rounded text-[10px] font-bold uppercase">{selectedGrievance.role}</span>
                      <span className="text-xs text-slate-400 font-medium">#{selectedGrievance.userId}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{selectedGrievance.subject}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedGrievance(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FF7400] rounded-xl flex items-center justify-center text-white font-bold">
                      {selectedGrievance.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{selectedGrievance.userName}</p>
                      <p className="text-xs text-slate-400">{selectedGrievance.userEmail}</p>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {selectedGrievance.description}
                  </p>
                </div>

                {/* Attached Images */}
                {selectedGrievance.images?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={14} /> Attached Images ({selectedGrievance.images.length})
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {selectedGrievance.images.map((url: string, i: number) => (
                        <div
                          key={i}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-square cursor-pointer"
                          onClick={() => setLightboxUrl(url)}
                        >
                          <img
                            src={url}
                            alt={`attachment-${i + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Documents */}
                {selectedGrievance.documents?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={14} /> Attached Documents ({selectedGrievance.documents.length})
                    </p>
                    <div className="space-y-2">
                      {selectedGrievance.documents.map((url: string, i: number) => {
                        const fileName = url.split("/").pop() || `Document ${i + 1}`;
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                                <FileText size={16} className="text-white" />
                              </div>
                              <span className="text-sm font-semibold text-blue-800 truncate max-w-xs">{decodeURIComponent(fileName)}</span>
                            </div>
                            <Download size={16} className="text-blue-500 shrink-0 group-hover:text-blue-700 cursor-pointer" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedGrievance.reply && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-4">Current Reply</p>
                    <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 italic text-slate-700">
                      {selectedGrievance.reply}
                    </div>
                  </div>
                )}

                {selectedGrievance.remark && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-4">Remark (Closed)</p>
                    <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100 italic text-slate-700">
                      {selectedGrievance.remark}
                    </div>
                  </div>
                )}

                {["SUPER_ADMIN", "CEO", "STATE_PRESIDENT", "STATE_SECRETARY", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY"].includes(userRole || "") && selectedGrievance.status !== "CLOSED" && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-4">Your Response (Reply)</label>
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your response here..."
                          className="w-full px-6 py-4 bg-slate-50 text-slate-800 placeholder:text-slate-400 border-2 border-transparent focus:border-brand-orange/20 focus:bg-white rounded-3xl outline-none transition-all min-h-[120px] resize-none"
                        />
                        <button
                          disabled={submitting || !replyText.trim()}
                          onClick={handleReply}
                          className="w-full py-4 bg-[#FF7400] text-white rounded-2xl font-bold text-lg hover:bg-[#E56900] transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                        >
                          {submitting ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                          {selectedGrievance.reply ? "Update Reply" : "Send Reply"}
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 ml-4">Remark (For Closing)</label>
                        <textarea
                          value={remarkText}
                          onChange={(e) => setRemarkText(e.target.value)}
                          placeholder="Type remark before closing..."
                          className="w-full px-6 py-4 bg-slate-50 text-slate-800 placeholder:text-slate-400 border-2 border-transparent focus:border-red-500/20 focus:bg-white rounded-3xl outline-none transition-all min-h-[120px] resize-none"
                        />
                        <button
                          disabled={closing || !remarkText.trim()}
                          onClick={handleClose}
                          className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold text-lg hover:bg-red-600 transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                        >
                          {closing ? <Loader2 className="animate-spin" /> : <X size={20} />}
                          Close with Remark
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 cursor-zoom-out"
          >
            <motion.img
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              src={lightboxUrl}
              alt="full view"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/40 rounded-full text-white transition-colors"
            >
              <X size={24} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
