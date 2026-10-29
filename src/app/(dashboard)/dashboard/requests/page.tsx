"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Inbox, CheckCircle2, XCircle, Clock, AlertCircle, UserPlus, LogOut, MapPin, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "NOT_REQUIRED";

interface Req {
  id: string;
  kind: "JOIN" | "RELEASE";
  target: "COACH" | "CLUB" | "BOTH";
  message: string | null;
  status: Status;
  coachDecision: Status;
  clubDecision: Status;
  coachRemark: string | null;
  clubRemark: string | null;
  decidedByAdmin: string | null;
  createdAt: string;
  awaitingMe: boolean;
  player: {
    fullName: string; permanentId: string | null; tempId: string; profilePhoto: string | null; gender: string; dob: string; belt: string | null;
    district: { name: string }; coach: { fullName: string } | null; club: { name: string } | null;
  };
  coach: { fullName: string } | null;
  club: { name: string } | null;
}

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
  NOT_REQUIRED: "bg-slate-50 text-slate-400",
};
const STATUS_LABEL: Record<Status, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled", NOT_REQUIRED: "Not needed" };

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const ageOf = (dob: string) => Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));

const title = (r: Req) =>
  r.kind === "JOIN"
    ? `Wants to join ${r.target === "COACH" ? `coach ${r.coach?.fullName ?? ""}` : `club ${r.club?.name ?? ""}`}`
    : `Asks to be released from ${r.target === "BOTH" ? "coach & club" : r.target === "COACH" ? "coach" : "club"}`;

async function fetchInbox(scope: "pending" | "history"): Promise<Req[]> {
  const res = await fetch(`${API_BASE}/affiliations/inbox?scope=${scope}`, { headers: auth() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load requests");
  return data;
}

/** Coach / club (and Super Admin / CEO): decide players' join and release requests. */
export default function StudentRequestsPage() {
  const [scope, setScope] = useState<"pending" | "history">("pending");
  const [items, setItems] = useState<Req[] | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; remark: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInbox(scope)
      .then((d) => !cancelled && setItems(d))
      .catch((err: Error) => !cancelled && setMessage({ text: err.message, type: "error" }));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const changeScope = (s: "pending" | "history") => {
    setItems(null);
    setScope(s);
  };

  const decide = async (id: string, decision: "APPROVE" | "REJECT", remark = "") => {
    setBusy(id);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/affiliations/${id}/decide`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ decision, remark }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Could not save your decision");
      setMessage({ text: out.message, type: "success" });
      setRejecting(null);
      setItems(await fetchInbox(scope));
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Inbox className="text-[#FF7400]" /> Student Requests</h1>
        <p className="text-slate-500 mt-1">Players applying to join you, or asking to be released. A release needs both the coach and the club to approve.</p>
      </header>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-fit">
        {(["pending", "history"] as const).map((s) => (
          <button key={s} onClick={() => changeScope(s)}
            className={`px-5 py-2 rounded-xl text-sm font-bold ${scope === s ? "bg-[#FF7400] text-white" : "text-slate-500 hover:bg-slate-50"}`}>
            {s === "pending" ? "Pending" : "History"}
          </button>
        ))}
      </div>

      {message && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm font-semibold ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          {message.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {!items ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200">
          <Inbox size={36} className="mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 font-semibold">{scope === "pending" ? "No pending requests." : "No decided requests yet."}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-orange-50 text-[#FF7400] flex items-center justify-center font-black text-lg overflow-hidden">
                  {r.player.profilePhoto
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={r.player.profilePhoto} alt="" className="w-full h-full object-cover" />
                    : r.player.fullName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900">{r.player.fullName} <span className="font-mono text-xs text-slate-400">{r.player.permanentId || r.player.tempId}</span></p>
                  <p className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                    <span>{r.player.gender.charAt(0) + r.player.gender.slice(1).toLowerCase()}, {ageOf(r.player.dob)} yrs</span>
                    {r.player.belt && <span>{r.player.belt} belt</span>}
                    <span className="inline-flex items-center gap-1"><MapPin size={11} />{r.player.district.name}</span>
                    <span>Coach: {r.player.coach?.fullName ?? "none"}</span>
                    <span>Club: {r.player.club?.name ?? "none"}</span>
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-700 inline-flex items-center gap-1.5">
                    {r.kind === "JOIN" ? <UserPlus size={15} className="text-emerald-600" /> : <LogOut size={15} className="text-red-500" />}
                    {title(r)} · <span className="font-normal text-slate-400">{fmtDate(r.createdAt)}</span>
                  </p>
                  {r.message && <p className="mt-1 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">“{r.message}”</p>}
                </div>
                <div className="flex sm:flex-col items-start sm:items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {r.decidedByAdmin && <span className="text-[11px] text-slate-400">Decided by admin</span>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DecisionChip label="Coach" status={r.coachDecision} remark={r.coachRemark} />
                <DecisionChip label="Club" status={r.clubDecision} remark={r.clubRemark} />
                {r.status === "PENDING" && !r.awaitingMe && (
                  <span className="text-xs text-slate-500 inline-flex items-center gap-1"><Clock size={12} /> Waiting for the other side</span>
                )}
              </div>

              {r.awaitingMe && (
                rejecting?.id === r.id ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input value={rejecting.remark} onChange={(e) => setRejecting({ id: r.id, remark: e.target.value })} placeholder="Reason for rejecting (required)"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-red-400" autoFocus />
                    <button onClick={() => decide(r.id, "REJECT", rejecting.remark)} disabled={busy === r.id || !rejecting.remark.trim()}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-bold disabled:opacity-50">Reject</button>
                    <button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600">Back</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => decide(r.id, "APPROVE")} disabled={busy === r.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50">
                      {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {r.kind === "JOIN" ? "Accept" : "Approve release"}
                    </button>
                    <button onClick={() => setRejecting({ id: r.id, remark: "" })} disabled={busy === r.id}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionChip({ label, status, remark }: { label: string; status: Status; remark: string | null }) {
  if (status === "NOT_REQUIRED") return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${STATUS_STYLE[status]}`} title={remark ?? undefined}>
      {label}: {STATUS_LABEL[status]}{remark ? ` — ${remark}` : ""}
    </span>
  );
}
