"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Loader2,
  Clock,
  Reply,
  CheckCircle2,
  AlertCircle,
  X,
  ImageIcon,
  FileText,
  Paperclip,
  Download,
  ZoomIn,
  Music,
  Video,
  ShieldCheck,
  Lock,
  UserCheck,
  User,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GrievanceChat from "@/components/features/GrievanceChat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const ADMIN_ROLES = ["SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY"];

/**
 * A grievance as responders receive it: confidential, so there is no complainant
 * name, email or id — only the anonymous reference number.
 */
interface Grievance {
  id: string;
  referenceNo: string;
  category: string | null;
  /** The complainant chose to stay anonymous: no complainant details exist for it. */
  isAnonymous: boolean;
  /** Identified grievances only (the server sends null for anonymous ones). */
  complainant: { name: string; tnjaId: string | null; district: string | null; email: string | null; mobile: string | null } | null;
  role: string;
  subject: string;
  description: string;
  status: "PENDING" | "REPLAY" | "CLOSED";
  remark: string | null;
  images: string[];
  documents: string[];
  audios: string[];
  videos: string[];
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: string | null;
  /** Set when marked resolved; it closes only once the complainant confirms. */
  resolvedAt: string | null;
  resolvedByName: string | null;
  closedAt: string | null;
  closedByName: string | null;
  createdAt: string;
  messageCount: number;
  canRespond: boolean;
}

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Awaiting responder", className: "bg-amber-100 text-amber-700" },
  REPLAY: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  CLOSED: { label: "Closed", className: "bg-emerald-100 text-emerald-700" },
};

/** "Awaiting confirmation" once a responder marks it resolved and before the complainant confirms. */
const statusOf = (g: Grievance) =>
  g.status !== "CLOSED" && g.resolvedAt
    ? { label: "Awaiting confirmation", className: "bg-violet-100 text-violet-700" }
    : STATUS[g.status] ?? { label: g.status, className: "bg-slate-100 text-slate-600" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Awaiting" },
  { id: "progress", label: "In progress" },
  { id: "closed", label: "Closed" },
];

const CATEGORY_LABEL: Record<string, string> = { FINE: "Fine", ANOMALY: "Anomaly" };

/** Name for identified grievances; "Anonymous" otherwise. */
const complainantLabel = (g: Grievance) =>
  g.complainant ? `${g.complainant.name}${g.complainant.tnjaId ? ` · ${g.complainant.tnjaId}` : ""}` : "Anonymous";

const attachmentCount = (g: Grievance) =>
  (g.images?.length || 0) + (g.documents?.length || 0) + (g.audios?.length || 0) + (g.videos?.length || 0);

const fileName = (url: string, fallback: string) => decodeURIComponent(url.split("/").pop() || fallback);

export default function AdminGrievancePage() {
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const selected = grievances.find((g) => g.id === selectedId) ?? null;

  const fetchGrievances = async () => {
    try {
      const res = await fetch(`${API_BASE}/grievances`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const data = await res.json();
      if (res.ok) setGrievances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole"));
    fetchGrievances();
  }, []);

  const openGrievance = (g: Grievance) => {
    setSelectedId(g.id);
    setRemarkText("");
    setCloseError("");
  };

  const handleResolve = async () => {
    if (!selected || !remarkText.trim()) return;
    setClosing(true);
    setCloseError("");
    try {
      const res = await fetch(`${API_BASE}/grievances/${selected.id}/resolve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ remark: remarkText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not mark the grievance resolved");
      setRemarkText("");
      await fetchGrievances();
    } catch (err) {
      setCloseError(err instanceof Error ? err.message : "Could not mark the grievance resolved");
    } finally {
      setClosing(false);
    }
  };

  const filteredGrievances = grievances.filter((g) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q || g.subject.toLowerCase().includes(q) || g.referenceNo.toLowerCase().includes(q) || (g.category || "").toLowerCase().includes(q) ||
      // Identified complainants can be searched by name or TNJA ID; anonymous ones carry nothing to match.
      (g.complainant?.name || "").toLowerCase().includes(q) || (g.complainant?.tnjaId || "").toLowerCase().includes(q);
    if (filter === "pending") return matchesSearch && g.status === "PENDING";
    if (filter === "progress") return matchesSearch && g.status === "REPLAY";
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

  if (userRole && !ADMIN_ROLES.includes(userRole)) {
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
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-800">
        <ShieldCheck size={20} className="shrink-0 mt-0.5" />
        <p>
          Complainants choose to share their identity or stay <strong>anonymous</strong>; anonymous ones appear only by reference number. The first responder to reply
          takes a grievance up; only they (or Super Admin / CEO) can reply to and resolve it. It closes only when the complainant confirms
          it is resolved. The complainant sees your name and office.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by reference, type, subject or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand-orange/20 outline-none transition-all"
          />
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-5 py-2 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                filter === f.id ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredGrievances.length === 0 ? (
          <div className="bg-white rounded-[2px] p-12 text-center border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">No grievances found</h3>
            <p className="text-slate-500">All caught up! No complaints to show.</p>
          </div>
        ) : (
          filteredGrievances.map((g) => {
            const status = statusOf(g);
            return (
              <motion.div
                layoutId={g.id}
                key={g.id}
                onClick={() => openGrievance(g)}
                className="bg-white rounded-3xl p-6 border border-slate-200 hover:shadow-xl hover:border-brand-orange/20 transition-all cursor-pointer group"
              >
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-600">{g.referenceNo}</span>
                      {g.category && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-white">{CATEGORY_LABEL[g.category] ?? g.category}</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-purple-100 text-purple-600">{g.role}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${status.className}`}>{status.label}</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand-orange transition-colors">{g.subject}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                      <span className={`flex items-center gap-1.5 font-semibold ${g.complainant ? "text-slate-700" : "text-slate-500"}`}>
                        {g.complainant ? <User size={16} /> : <EyeOff size={16} />}
                        {complainantLabel(g)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={16} />
                        {new Date(g.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <UserCheck size={16} />
                        {g.assignedToName ? `${g.assignedToName}${g.assignedToRole && g.assignedToRole !== g.assignedToName ? ` (${g.assignedToRole})` : ""}` : "Unassigned"}
                      </span>
                      {g.messageCount > 0 && (
                        <span className="flex items-center gap-1.5">
                          <MessageSquare size={16} />
                          {g.messageCount}
                        </span>
                      )}
                      {attachmentCount(g) > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">
                          <Paperclip size={11} />
                          {attachmentCount(g)} attachment{attachmentCount(g) > 1 ? "s" : ""}
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
            );
          })
        )}
      </div>

      {/* Grievance detail: evidence, chat and closure */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-grow">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-600">{selected.referenceNo}</span>
                      {selected.category && (
                        <span className="px-2 py-0.5 bg-slate-800 text-white rounded-sm text-[10px] font-bold uppercase">{CATEGORY_LABEL[selected.category] ?? selected.category}</span>
                      )}
                      <span className="px-2 py-0.5 bg-orange-100 text-[#FF7400] rounded-sm text-[10px] font-bold uppercase">{selected.role}</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{selected.subject}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    aria-label="Close"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                  {selected.complainant ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                        <User size={12} /> Complainant (identity shared)
                      </p>
                      <p className="font-bold text-slate-800">{selected.complainant.name}</p>
                      <p className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                        {selected.complainant.tnjaId && <span className="font-mono">{selected.complainant.tnjaId}</span>}
                        {selected.complainant.district && <span>{selected.complainant.district}</span>}
                        {selected.complainant.email && <span>{selected.complainant.email}</span>}
                        {selected.complainant.mobile && <span>{selected.complainant.mobile}</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                      <Lock size={12} /> Anonymous: identity withheld
                    </p>
                  )}
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>

                {/* Attached Images */}
                {selected.images?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <ImageIcon size={14} /> Attached Images ({selected.images.length})
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {selected.images.map((url, i) => (
                        <div
                          key={i}
                          className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-square cursor-pointer"
                          onClick={() => setLightboxUrl(url)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`attachment-${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ZoomIn size={24} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Documents */}
                {selected.documents?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <FileText size={14} /> Attached Documents ({selected.documents.length})
                    </p>
                    <div className="space-y-2">
                      {selected.documents.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-white" />
                            </div>
                            <span className="text-sm font-semibold text-blue-800 truncate">{fileName(url, `Document ${i + 1}`)}</span>
                          </div>
                          <Download size={16} className="text-blue-500 shrink-0 group-hover:text-blue-700" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Audio */}
                {selected.audios?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Music size={14} /> Attached Audio ({selected.audios.length})
                    </p>
                    <div className="space-y-2">
                      {selected.audios.map((url, i) => (
                        <div key={i} className="px-4 py-3 bg-violet-50 border border-violet-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-violet-800 truncate">{fileName(url, `Audio ${i + 1}`)}</span>
                            <a href={url} target="_blank" rel="noopener noreferrer" download aria-label="Download audio" className="text-violet-500 hover:text-violet-700 shrink-0">
                              <Download size={16} />
                            </a>
                          </div>
                          <audio controls preload="none" src={url} className="w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attached Videos */}
                {selected.videos?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Video size={14} /> Attached Videos ({selected.videos.length})
                    </p>
                    <div className="space-y-3">
                      {selected.videos.map((url, i) => (
                        <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                          <video controls preload="metadata" src={url} className="w-full max-h-80 bg-black" />
                          <div className="flex items-center justify-between gap-3 px-4 py-2 bg-white">
                            <span className="text-xs font-semibold text-slate-600 truncate">{fileName(url, `Video ${i + 1}`)}</span>
                            {/* MKV / 3GP may not play in every browser; download always works. */}
                            <a href={url} target="_blank" rel="noopener noreferrer" download className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-800 shrink-0">
                              <Download size={14} /> Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat with the complainant */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare size={14} /> Conversation
                    </p>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <UserCheck size={14} />
                      {selected.assignedToName
                        ? `Handled by ${selected.assignedToName}${selected.assignedToRole && selected.assignedToRole !== selected.assignedToName ? ` (${selected.assignedToRole})` : ""}`
                        : "Unassigned — your reply takes it up"}
                    </span>
                  </div>
                  <GrievanceChat key={selected.id} grievanceId={selected.id} viewer="RESPONDER" onSent={fetchGrievances} />
                </div>

                {selected.status === "CLOSED" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 size={14} /> Resolution
                    </p>
                    <div className="bg-emerald-50/60 p-5 rounded-3xl border border-emerald-100 text-slate-700 whitespace-pre-wrap">{selected.remark}</div>
                    <p className="text-xs text-slate-500">
                      Resolved by {selected.closedByName || "the responder"}; the complainant confirmed it and it closed{selected.closedAt ? ` on ${new Date(selected.closedAt).toLocaleString("en-IN")}` : ""}.
                    </p>
                  </div>
                ) : selected.resolvedAt ? (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm font-bold text-violet-700 flex items-center gap-2">
                      <Clock size={14} /> Waiting for the complainant to confirm
                    </p>
                    <div className="bg-violet-50/60 p-5 rounded-3xl border border-violet-100 text-slate-700 whitespace-pre-wrap">{selected.remark}</div>
                    <p className="text-xs text-slate-500">
                      Marked resolved by {selected.resolvedByName} on {new Date(selected.resolvedAt).toLocaleString("en-IN")}. If the complainant
                      says it is not resolved, their reason appears in the chat and you can resolve it again.
                    </p>
                  </div>
                ) : selected.canRespond ? (
                  <div className="space-y-2 pt-4 border-t">
                    <label htmlFor="resolution" className="text-sm font-bold text-slate-700">Mark as resolved</label>
                    <p className="text-xs text-slate-500">
                      The complainant is notified in the app and by email and asked to confirm. The grievance closes, and the chat ends, only once they confirm.
                      {selected.messageCount === 0 && " Reply in the chat first."}
                    </p>
                    <textarea
                      id="resolution"
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      placeholder="How was the grievance resolved?"
                      className="w-full px-5 py-3 bg-slate-50 text-slate-800 placeholder:text-slate-400 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white rounded-2xl outline-none transition-all min-h-[90px] resize-none"
                    />
                    {closeError && <p className="text-xs font-medium text-red-600">{closeError}</p>}
                    <button
                      disabled={closing || !remarkText.trim()}
                      onClick={handleResolve}
                      className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {closing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                      Mark resolved &amp; ask to confirm
                    </button>
                  </div>
                ) : null}
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
              aria-label="Close image"
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
