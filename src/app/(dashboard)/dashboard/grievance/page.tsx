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
  Paperclip,
  Music,
  Video,
  ShieldCheck,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GrievanceChat from "@/components/features/GrievanceChat";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type AttachmentKind = "images" | "documents" | "audio" | "videos";

/** Same types, sizes and counts the backend accepts (uploadMiddleware GRIEVANCE_MEDIA). */
const ATTACHMENT_KINDS: {
  kind: AttachmentKind;
  label: string;
  hint: string;
  accept: string;
  maxMB: number;
  maxCount: number;
  icon: typeof ImageIcon;
  chip: string;
}[] = [
  { kind: "images", label: "Attach Images", hint: "JPG, PNG, WEBP, GIF", accept: ".jpg,.jpeg,.png,.webp,.gif", maxMB: 10, maxCount: 5, icon: ImageIcon, chip: "bg-orange-50 border-orange-200 text-orange-700" },
  { kind: "documents", label: "Attach Documents", hint: "PDF, Word, Excel, CSV, TXT", accept: ".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv", maxMB: 10, maxCount: 5, icon: FileText, chip: "bg-blue-50 border-blue-200 text-blue-700" },
  { kind: "audio", label: "Attach Audio", hint: "MP3, WAV, M4A, AAC, OGG", accept: ".mp3,.wav,.m4a,.aac,.ogg", maxMB: 25, maxCount: 3, icon: Music, chip: "bg-violet-50 border-violet-200 text-violet-700" },
  { kind: "videos", label: "Attach Videos", hint: "MP4, MOV, WEBM, MKV, 3GP", accept: ".mp4,.mov,.webm,.mkv,.3gp", maxMB: 100, maxCount: 2, icon: Video, chip: "bg-emerald-50 border-emerald-200 text-emerald-700" },
];

const NO_ATTACHMENTS: Record<AttachmentKind, File[]> = { images: [], documents: [], audio: [], videos: [] };

const IDENTITY_OPTIONS = [
  { id: "SHOW", label: "Show my identity", hint: "Your name, TNJA ID, district and contact details are shared with the officials handling it" },
  { id: "ANONYMOUS", label: "Submit anonymously", hint: "Your name and personal details are not shown to anyone handling it" },
];

const CATEGORIES = [
  { id: "FINE", label: "Fine", hint: "A fine or penalty you want to dispute" },
  { id: "ANOMALY", label: "Anomaly", hint: "An irregularity or something that went wrong" },
];

const GRIEVANCE_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Awaiting responder", className: "bg-amber-100 text-amber-700" },
  REPLAY: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  CLOSED: { label: "Resolved & closed", className: "bg-emerald-100 text-emerald-700" },
};

export default function GrievancePage() {
  const [category, setCategory] = useState("");
  const [identity, setIdentity] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<Record<AttachmentKind, File[]>>(NO_ATTACHMENTS);
  const [attachmentError, setAttachmentError] = useState("");
  const [grievances, setGrievances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  // Confirming (or rejecting) a responder's resolution.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmError, setConfirmError] = useState<{ id: string; text: string } | null>(null);

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
      const res = await fetch(`${API_BASE}/grievances/user/${userId}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      const data = await res.json();
      if (res.ok) setGrievances(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Confirms the responder's resolution (closes the grievance), or says it isn't resolved yet.
  const respondToResolution = async (id: string, resolved: boolean) => {
    setConfirmingId(id);
    setConfirmError(null);
    try {
      const res = await fetch(`${API_BASE}/grievances/${id}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(resolved ? { resolved: true } : { resolved: false, reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send your answer");
      setRejectingId(null);
      setRejectReason("");
      await fetchGrievances(userData.user.id);
    } catch (err) {
      setConfirmError({ id, text: err instanceof Error ? err.message : "Could not send your answer" });
    } finally {
      setConfirmingId(null);
    }
  };

  // Adds picked files to a kind, keeping only allowed types within its size and count limits.
  const addAttachments = (kind: AttachmentKind, picked: File[]) => {
    const config = ATTACHMENT_KINDS.find((k) => k.kind === kind)!;
    const allowed = config.accept.split(",");
    const problems: string[] = [];
    const valid = picked.filter((f) => {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!allowed.includes(ext)) { problems.push(`"${f.name}" is not a supported type (${config.hint}).`); return false; }
      if (f.size > config.maxMB * 1024 * 1024) { problems.push(`"${f.name}" is larger than ${config.maxMB} MB.`); return false; }
      return true;
    });
    const merged = [...attachments[kind], ...valid];
    if (merged.length > config.maxCount) problems.push(`You can attach up to ${config.maxCount} ${kind}.`);
    setAttachments((prev) => ({ ...prev, [kind]: merged.slice(0, config.maxCount) }));
    setAttachmentError(problems.join(" "));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    if (!category) {
      setMessage({ type: "error", text: "Select whether this is a Fine or an Anomaly grievance." });
      return;
    }
    if (!identity) {
      setMessage({ type: "error", text: "Choose whether to show your identity or submit anonymously." });
      return;
    }
    if (Object.values(attachments).every((list) => list.length === 0)) {
      setMessage({ type: "error", text: "Attach at least one file (image, document, audio or video) as evidence." });
      return;
    }
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const form = new FormData();
      // No name, email or id is sent: the server files it under the logged-in account and,
      // only if identity is SHOW, takes the details from that account.
      form.append("category", category);
      form.append("identity", identity);
      form.append("subject", subject);
      form.append("description", description);
      (Object.keys(attachments) as AttachmentKind[]).forEach((kind) => attachments[kind].forEach((f) => form.append(kind, f)));

      const res = await fetch(`${API_BASE}/grievances`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await res.json();
      if (res.ok) {
        const uncleaned = data.uncleanedAttachments || 0;
        setMessage({
          type: "success",
          text: uncleaned > 0
            ? `Your grievance has been submitted anonymously. Note: ${uncleaned} attachment${uncleaned > 1 ? "s" : ""} (video, Word/Excel or non-MP3 audio) could not be cleaned of hidden details.`
            : `Your grievance has been submitted${identity === "ANONYMOUS" ? " anonymously" : ""}.`,
        });
        setCategory("");
        setIdentity("");
        setSubject("");
        setDescription("");
        setAttachments(NO_ATTACHMENTS);
        setAttachmentError("");
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
              <fieldset className="space-y-2">
                <legend className="text-sm font-bold text-slate-700 mb-2">Grievance type <span className="text-red-500">*</span></legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CATEGORIES.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${category === c.id ? "border-[#FF7400] bg-orange-50" : "border-slate-200 hover:border-[#FF7400]/40"}`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={c.id}
                        checked={category === c.id}
                        onChange={() => setCategory(c.id)}
                        className="mt-1 accent-[#FF7400]"
                      />
                      <span>
                        <span className="block font-bold text-slate-800">{c.label}</span>
                        <span className="block text-xs text-slate-500">{c.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-bold text-slate-700 mb-2">Your identity <span className="text-red-500">*</span></legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {IDENTITY_OPTIONS.map((o) => (
                    <label
                      key={o.id}
                      className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${identity === o.id ? "border-[#FF7400] bg-orange-50" : "border-slate-200 hover:border-[#FF7400]/40"}`}
                    >
                      <input
                        type="radio"
                        name="identity"
                        value={o.id}
                        checked={identity === o.id}
                        onChange={() => setIdentity(o.id)}
                        className="mt-1 accent-[#FF7400]"
                      />
                      <span>
                        <span className="flex items-center gap-1.5 font-bold text-slate-800">
                          {o.id === "ANONYMOUS" ? <EyeOff size={15} /> : <Eye size={15} />} {o.label}
                        </span>
                        <span className="block text-xs text-slate-500">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {identity === "ANONYMOUS" && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
                    <ShieldCheck size={16} className="shrink-0" />
                    <p>
                      Responders will see only a reference number and &quot;Anonymous&quot;. We remove hidden details (such as photo location) from
                      JPG, PNG and WEBP images, PDFs and MP3s. <strong>Videos, Word/Excel files and other audio can still contain your name
                      or location</strong>, and so can anything you write. Check them before attaching.
                    </p>
                  </div>
                )}
              </fieldset>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">
                    {userData?.role === "STUDENT" ? "Player ID" :
                     userData?.role === "COACH" ? "Coach ID" :
                     userData?.role === "CLUB" ? "Club ID" : "Administrative Member ID"}
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

              {/* Attachments: images, documents, audio and video. At least one is required. */}
              <p className="text-sm font-bold text-slate-700 -mb-2">
                Evidence <span className="text-red-500">*</span>
                <span className="font-medium text-slate-500"> (attach at least one image, document, audio or video)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ATTACHMENT_KINDS.map(({ kind, label, hint, accept, maxMB, maxCount, icon: Icon, chip }) => (
                  <div key={kind} className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Icon size={16} className="text-[#FF7400]" /> {label}
                    </label>
                    <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#FF7400]/50 hover:bg-orange-50/30 transition-all">
                      <Paperclip size={18} className="text-slate-400 shrink-0" />
                      <span className="text-sm text-slate-500 font-medium">
                        {hint}
                        <span className="block text-xs text-slate-400">Up to {maxCount} files, {maxMB} MB each</span>
                      </span>
                      <input
                        type="file"
                        accept={accept}
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addAttachments(kind, Array.from(e.target.files || []));
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {attachments[kind].length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {attachments[kind].map((f, i) => (
                          <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold ${chip}`}>
                            <Icon size={12} /> <span className="max-w-[160px] truncate">{f.name}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${f.name}`}
                              onClick={() => setAttachments((prev) => ({ ...prev, [kind]: prev[kind].filter((_, j) => j !== i) }))}
                            >
                              <X size={12} className="hover:text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {attachmentError && (
                <p className="text-xs font-medium text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={14} /> {attachmentError}
                </p>
              )}

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
              grievances.map((g) => {
                const awaitingConfirmation = g.status !== "CLOSED" && !!g.resolvedAt;
                const status = awaitingConfirmation
                  ? { label: "Awaiting your confirmation", className: "bg-violet-100 text-violet-700" }
                  : GRIEVANCE_STATUS[g.status] ?? { label: g.status, className: "bg-slate-100 text-slate-600" };
                const chatOpen = openChatId === g.id;
                return (
                <div key={g.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800">{g.subject}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium flex-wrap">
                      <span className="font-mono font-bold text-slate-600">{g.referenceNo}</span>
                      {g.category && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white font-bold uppercase tracking-wider">
                          {CATEGORIES.find((c) => c.id === g.category)?.label ?? g.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                        {g.isAnonymous ? <><EyeOff size={12} /> Anonymous</> : <><Eye size={12} /> Identity shared</>}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(g.createdAt).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {g.description}
                  </p>

                  <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Reply size={16} className="text-[#FF7400]" />
                    {g.assignedToName ? (
                      <span>Handled by <strong>{g.assignedToName}</strong>{g.assignedToRole && g.assignedToRole !== g.assignedToName ? ` (${g.assignedToRole})` : ""}</span>
                    ) : (
                      "Waiting for a responder to take this up"
                    )}
                  </p>

                  {/* The responder marked it resolved: it closes only when the person confirms. */}
                  {awaitingConfirmation && (
                    <div className="p-4 rounded-2xl border-2 border-violet-200 bg-violet-50/60 space-y-3">
                      <p className="flex items-center gap-2 text-sm font-bold text-violet-800">
                        <CheckCircle2 size={16} />
                        {g.resolvedByName || "The responder"} marked this resolved
                      </p>
                      <p className="text-sm text-slate-700 bg-white p-3 rounded-xl whitespace-pre-wrap">{g.remark}</p>
                      <p className="text-sm font-semibold text-slate-700">Is your issue resolved?</p>
                      {rejectingId === g.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            rows={3}
                            maxLength={4000}
                            placeholder="What is still not resolved?"
                            aria-label="What is still not resolved"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-violet-300 resize-none bg-white"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={confirmingId === g.id || !rejectReason.trim()}
                              onClick={() => respondToResolution(g.id, false)}
                              className="px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
                            >
                              Send to responder
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingId(null); setRejectReason(""); }}
                              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={confirmingId === g.id}
                            onClick={() => respondToResolution(g.id, true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                          >
                            {confirmingId === g.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            Yes, it&apos;s resolved — close it
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRejectingId(g.id); setRejectReason(""); }}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50 cursor-pointer"
                          >
                            No, not resolved yet
                          </button>
                        </div>
                      )}
                      {confirmError && confirmError.id === g.id && <p className="text-xs font-medium text-red-600">{confirmError.text}</p>}
                    </div>
                  )}

                  {g.status === "CLOSED" && g.remark && (
                    <div className="pl-6 border-l-4 border-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                        <CheckCircle2 size={16} />
                        Resolution{g.closedByName ? `, closed by ${g.closedByName}` : ""}{g.closedAt ? ` on ${new Date(g.closedAt).toLocaleDateString()}` : ""}
                      </div>
                      <p className="text-slate-700 text-sm bg-emerald-50/60 p-4 rounded-xl whitespace-pre-wrap">{g.remark}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenChatId(chatOpen ? null : g.id)}
                    aria-expanded={chatOpen}
                    className="flex items-center gap-2 text-sm font-bold text-[#FF7400] hover:text-[#E56900] cursor-pointer"
                  >
                    <MessageSquare size={16} />
                    {chatOpen ? "Hide conversation" : g.status === "CLOSED" ? "View conversation" : "Open chat with responder"}
                    <ChevronDown size={16} className={`transition-transform ${chatOpen ? "rotate-180" : ""}`} />
                  </button>
                  {chatOpen && (
                    <GrievanceChat grievanceId={g.id} viewer="USER" onSent={() => fetchGrievances(userData.user.id)} />
                  )}
                </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
