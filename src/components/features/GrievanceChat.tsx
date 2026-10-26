"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send, ShieldCheck, UserRound } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
/** How often an open chat checks for new messages. */
const POLL_MS = 10000;

interface GrievanceMessage {
  id: string;
  senderType: "USER" | "RESPONDER";
  senderName: string | null;
  senderRole: string | null;
  message: string;
  createdAt: string;
  isMine: boolean;
}

interface GrievanceChatProps {
  grievanceId: string;
  /** The complainant sees responders by name; responders see the complainant by name, or as "Anonymous". */
  viewer: "USER" | "RESPONDER";
  /** Called after this viewer sends a message (e.g. to refresh the grievance's status). */
  onSent?: () => void;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function GrievanceChat({ grievanceId, viewer, onSent }: GrievanceChatProps) {
  const [messages, setMessages] = useState<GrievanceMessage[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [closed, setClosed] = useState(false);
  const [anonymous, setAnonymous] = useState(true);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/grievances/${grievanceId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the conversation");
      setMessages(data.messages);
      setCanSend(data.canSend);
      setClosed(data.status === "CLOSED");
      setAnonymous(data.isAnonymous !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the conversation");
    } finally {
      setLoading(false);
    }
  }, [grievanceId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const message = text.trim();
    if (!message) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/grievances/${grievanceId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send the message");
      setMessages((prev) => [...prev, data.message]);
      setText("");
      onSent?.();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  };

  const senderLabel = (m: GrievanceMessage) => {
    if (m.isMine) return "You";
    // The server names the complainant only on identified grievances.
    if (m.senderType === "USER") return m.senderName || "Anonymous";
    return m.senderRole && m.senderRole !== m.senderName ? `${m.senderName} · ${m.senderRole}` : m.senderName || "TNJA Official";
  };

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
        <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
        {viewer === "USER"
          ? anonymous
            ? "You submitted anonymously: responders don't see who you are. You can see who is responding."
            : "You chose to share your identity with the officials handling this. You can see who is responding."
          : anonymous
            ? "The complainant chose to stay anonymous. Your name and office are shown to them."
            : "The complainant shared their identity. Your name and office are shown to them."}
      </div>

      <div ref={listRef} className="max-h-80 overflow-y-auto p-4 space-y-3 bg-white" aria-live="polite">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#FF7400]" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">
            {viewer === "USER" ? "No replies yet. A responder will reply here." : "No messages yet. Your reply takes up this grievance."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${m.isMine ? "bg-[#FF7400] text-white rounded-br-sm" : m.senderType === "RESPONDER" ? "bg-blue-50 text-slate-800 border border-blue-100 rounded-bl-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                <p className={`flex items-center gap-1 text-[11px] font-bold mb-0.5 ${m.isMine ? "text-orange-100" : m.senderType === "RESPONDER" ? "text-blue-700" : "text-slate-500"}`}>
                  {m.senderType === "RESPONDER" ? <ShieldCheck size={11} /> : <UserRound size={11} />}
                  {senderLabel(m)}
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{m.message}</p>
                <p className={`text-[10px] mt-1 text-right ${m.isMine ? "text-orange-100" : "text-slate-400"}`}>{fmtTime(m.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {error && <p className="px-4 pb-2 text-xs font-medium text-red-600">{error}</p>}

      {closed ? (
        <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
          <Lock size={14} /> This grievance is closed, so the chat has ended.
        </div>
      ) : canSend ? (
        <div className="flex items-end gap-2 p-3 border-t border-slate-200">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
            aria-label="Message"
            className="flex-grow px-3 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#FF7400]/20 focus:border-[#FF7400] resize-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={sending || !text.trim()}
            aria-label="Send message"
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-[#FF7400] text-white hover:bg-[#E56900] disabled:opacity-50 cursor-pointer"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      ) : (
        !loading && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm text-slate-500">
            Another responder is handling this grievance.
          </div>
        )
      )}
    </div>
  );
}
