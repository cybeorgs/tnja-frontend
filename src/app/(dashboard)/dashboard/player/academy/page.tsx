"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, UserCheck, Building2, Search, X, Send, LogOut, Clock, CheckCircle2, XCircle, AlertCircle, MapPin, Users, Phone, Mail, Ban,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Target = "COACH" | "CLUB" | "BOTH";
type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "NOT_REQUIRED";

interface Request {
  id: string;
  kind: "JOIN" | "RELEASE";
  target: Target;
  message: string | null;
  status: Status;
  coachDecision: Status;
  clubDecision: Status;
  coachRemark: string | null;
  clubRemark: string | null;
  createdAt: string;
  decidedAt: string | null;
  coach: { id: string; fullName: string } | null;
  club: { id: string; name: string } | null;
}

interface Mine {
  districtId: string;
  coach: { id: string; fullName: string; permanentId: string | null; presentGradeInJudo: string; mobileNumber: string; email: string; district: { name: string }; club: { name: string } | null } | null;
  club: { id: string; name: string; mobileNumber: string; email: string; district: { name: string } | null; taluk: { name: string } | null } | null;
  requests: Request[];
}

interface Option {
  id: string;
  fullName?: string;
  name?: string;
  permanentId: string | null;
  presentGradeInJudo?: string;
  district: { name: string } | null;
  taluk: { name: string } | null;
  club?: { name: string } | null;
  _count: { students: number; coaches?: number };
}

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
  NOT_REQUIRED: "bg-slate-50 text-slate-400",
};
const STATUS_LABEL: Record<Status, string> = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected", CANCELLED: "Cancelled", NOT_REQUIRED: "Not needed" };

const describe = (r: Request) =>
  r.kind === "JOIN"
    ? `Applied to ${r.target === "COACH" ? `coach ${r.coach?.fullName ?? ""}` : `club ${r.club?.name ?? ""}`}`
    : `Release from ${r.target === "BOTH" ? "coach & club" : r.target === "COACH" ? "coach" : "club"}`;

async function fetchMine(): Promise<Mine> {
  const res = await fetch(`${API_BASE}/affiliations/me`, { headers: auth() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load your coach and club");
  return data;
}

/** Player: see their coach and club, apply to join one, or ask to be released. */
export default function MyCoachAndClubPage() {
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [finder, setFinder] = useState<"COACH" | "CLUB" | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => fetchMine().then(setMine).catch((err: Error) => setError(err.message)), []);
  useEffect(() => {
    reload();
  }, [reload]);

  const post = async (url: string, body?: object) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { ...auth(), "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Request failed");
      setNotice({ text: out.message, type: "success" });
      await reload();
      return true;
    } catch (err) {
      setNotice({ text: (err as Error).message, type: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="py-20 text-center text-red-500 font-semibold">{error}</p>;
  if (!mine) return <div className="py-24 flex justify-center"><Loader2 className="w-9 h-9 text-[#FF7400] animate-spin" /></div>;

  const pendingJoin = (t: "COACH" | "CLUB") => mine.requests.find((r) => r.kind === "JOIN" && r.target === t && r.status === "PENDING");
  const pendingRelease = mine.requests.find((r) => r.kind === "RELEASE" && r.status === "PENDING");
  const leaving = (t: "COACH" | "CLUB") => !!pendingRelease && (pendingRelease.target === t || pendingRelease.target === "BOTH");

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">My Coach & Club</h1>
          <p className="text-slate-500 mt-1">Apply to a coach or club. Leaving needs approval from both your coach and your club.</p>
        </div>
        {(mine.coach || mine.club) && !pendingRelease && (
          <button onClick={() => setReleaseOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-200 text-red-600 text-sm font-bold hover:bg-red-50">
            <LogOut size={16} /> Request Release
          </button>
        )}
      </header>

      {notice && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm font-semibold ${notice.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          {notice.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {pendingRelease && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-sm">
          <Clock size={18} className="text-amber-600" />
          <span className="font-bold text-amber-800">{describe(pendingRelease)} is awaiting approval</span>
          <Decision label="Coach" status={pendingRelease.coachDecision} />
          <Decision label="Club" status={pendingRelease.clubDecision} />
          <button onClick={() => post(`${API_BASE}/affiliations/${pendingRelease.id}/cancel`)} disabled={busy} className="ml-auto text-xs font-bold text-amber-800 hover:underline">Cancel request</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Slot
          title="Coach" icon={<UserCheck size={20} />} leaving={leaving("COACH")}
          current={mine.coach && {
            name: mine.coach.fullName,
            lines: [mine.coach.permanentId, mine.coach.presentGradeInJudo, mine.coach.club ? `Club: ${mine.coach.club.name}` : null, mine.coach.district.name].filter(Boolean) as string[],
            phone: mine.coach.mobileNumber, email: mine.coach.email,
          }}
          pending={pendingJoin("COACH")} busy={busy}
          onFind={() => setFinder("COACH")}
          onCancel={(id) => post(`${API_BASE}/affiliations/${id}/cancel`)}
        />
        <Slot
          title="Club" icon={<Building2 size={20} />} leaving={leaving("CLUB")}
          current={mine.club && {
            name: mine.club.name,
            lines: [mine.club.taluk?.name, mine.club.district?.name].filter(Boolean) as string[],
            phone: mine.club.mobileNumber, email: mine.club.email,
          }}
          pending={pendingJoin("CLUB")} busy={busy}
          onFind={() => setFinder("CLUB")}
          onCancel={(id) => post(`${API_BASE}/affiliations/${id}/cancel`)}
        />
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 p-5 border-b border-slate-100">Request history</h3>
        {mine.requests.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {mine.requests.map((r) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800">{describe(r)}</p>
                  <p className="text-xs text-slate-400">{fmtDate(r.createdAt)}{r.message ? ` · "${r.message}"` : ""}</p>
                  {[r.coachRemark && `Coach: ${r.coachRemark}`, r.clubRemark && `Club: ${r.clubRemark}`].filter(Boolean).map((t) => (
                    <p key={t as string} className="text-xs text-slate-500 mt-0.5">{t}</p>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {r.kind === "RELEASE" && <><Decision label="Coach" status={r.coachDecision} /><Decision label="Club" status={r.clubDecision} /></>}
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AnimatePresence>
        {finder && (
          <Finder type={finder} defaultDistrictId={mine.districtId} busy={busy} onClose={() => setFinder(null)}
            onApply={async (targetId, message) => {
              if (await post(`${API_BASE}/affiliations/join`, { target: finder, targetId, message })) setFinder(null);
            }} />
        )}
        {releaseOpen && (
          <ReleaseDialog hasCoach={!!mine.coach} hasClub={!!mine.club} busy={busy} onClose={() => setReleaseOpen(false)}
            onSubmit={async (target, message) => {
              if (await post(`${API_BASE}/affiliations/release`, { target, message })) setReleaseOpen(false);
            }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Decision({ label, status }: { label: string; status: Status }) {
  if (status === "NOT_REQUIRED") return null;
  const Icon = status === "APPROVED" ? CheckCircle2 : status === "REJECTED" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${STATUS_STYLE[status]}`}>
      <Icon size={12} /> {label}: {STATUS_LABEL[status]}
    </span>
  );
}

function Slot({ title, icon, current, pending, leaving, busy, onFind, onCancel }: {
  title: string;
  icon: React.ReactNode;
  current: { name: string; lines: string[]; phone: string; email: string } | null;
  pending: Request | undefined;
  leaving: boolean;
  busy: boolean;
  onFind: () => void;
  onCancel: (id: string) => void;
}) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="p-2 rounded-lg bg-orange-50 text-[#FF7400]">{icon}</span>
        <h2 className="font-bold text-slate-800">{title}</h2>
        {leaving && <span className="ml-auto px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-xs font-bold">Release pending</span>}
      </div>
      {current ? (
        <div className="space-y-1.5">
          <p className="text-lg font-black text-slate-900">{current.name}</p>
          {current.lines.map((l) => <p key={l} className="text-sm text-slate-500">{l}</p>)}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Phone size={14} className="text-slate-400" />{current.phone}</span>
            <span className="inline-flex items-center gap-1.5"><Mail size={14} className="text-slate-400" />{current.email}</span>
          </div>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Application to <b>{pending.coach?.fullName ?? pending.club?.name}</b> sent on {fmtDate(pending.createdAt)} is awaiting their decision.
          </p>
          <button onClick={() => onCancel(pending.id)} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-600">
            <Ban size={14} /> Cancel application
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">You don&apos;t have a {title.toLowerCase()} yet.</p>
          <button onClick={onFind} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-bold">
            <Search size={15} /> Find a {title.toLowerCase()}
          </button>
        </div>
      )}
    </section>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Finder({ type, defaultDistrictId, busy, onClose, onApply }: {
  type: "COACH" | "CLUB";
  defaultDistrictId: string;
  busy: boolean;
  onClose: () => void;
  onApply: (targetId: string, message: string) => void;
}) {
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [districtId, setDistrictId] = useState(defaultDistrictId);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [chosen, setChosen] = useState<Option | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/districts`).then((r) => (r.ok ? r.json() : [])).then((d) => setDistricts(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch(`${API_BASE}/affiliations/options?type=${type}&districtId=${districtId}&q=${encodeURIComponent(q.trim())}`, { headers: auth() })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => !cancelled && setOptions(Array.isArray(d) ? d : []))
        .catch(() => !cancelled && setOptions([]));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [type, districtId, q]);

  const label = type === "COACH" ? "coach" : "club";

  return (
    <Modal title={chosen ? `Apply to ${chosen.fullName ?? chosen.name}` : `Find a ${label}`} onClose={onClose}>
      {chosen ? (
        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">Message (optional)</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))} rows={4}
              placeholder={`Introduce yourself to the ${label}…`}
              className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
          </label>
          <div className="flex justify-end gap-3">
            <button onClick={() => setChosen(null)} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">Back</button>
            <button onClick={() => onApply(chosen.id, message)} disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-lg text-sm font-bold disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send Application
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 p-5 border-b border-slate-100">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label} by name…`}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
            </div>
            <select value={districtId} onChange={(e) => setDistrictId(e.target.value)} aria-label="District"
              className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700">
              <option value="">All districts</option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="overflow-y-auto">
            {!options ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-7 h-7 text-[#FF7400] animate-spin" /></div>
            ) : options.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">No {label}s found. Try another district.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {options.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{o.fullName ?? o.name}</p>
                      <p className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1"><MapPin size={11} />{[o.taluk?.name, o.district?.name].filter(Boolean).join(", ")}</span>
                        <span className="inline-flex items-center gap-1"><Users size={11} />{o._count.students} students{o._count.coaches !== undefined ? ` · ${o._count.coaches} coaches` : ""}</span>
                        {o.club && <span>Club: {o.club.name}</span>}
                        {o.presentGradeInJudo && <span>{o.presentGradeInJudo}</span>}
                      </p>
                    </div>
                    <button onClick={() => setChosen(o)} className="px-4 py-2 rounded-lg border border-orange-200 text-[#FF7400] text-sm font-bold hover:bg-orange-50">Apply</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function ReleaseDialog({ hasCoach, hasClub, busy, onClose, onSubmit }: {
  hasCoach: boolean;
  hasClub: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (target: Target, message: string) => void;
}) {
  const choices: { id: Target; label: string }[] = [
    ...(hasCoach ? [{ id: "COACH" as Target, label: "Leave my coach" }] : []),
    ...(hasClub ? [{ id: "CLUB" as Target, label: "Leave my club" }] : []),
    ...(hasCoach && hasClub ? [{ id: "BOTH" as Target, label: "Leave both" }] : []),
  ];
  const [target, setTarget] = useState<Target>(choices[0].id);
  const [message, setMessage] = useState("");
  const approvers = [hasCoach && "your coach", hasClub && "your club"].filter(Boolean).join(" and ");

  return (
    <Modal title="Request release" onClose={onClose}>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <button key={c.id} onClick={() => setTarget(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border ${target === c.id ? "bg-[#FF7400] text-white border-[#FF7400]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <p className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#FF7400]" />
          This must be approved by {approvers}. Until then you stay with them.
        </p>
        <label className="block">
          <span className="text-xs font-bold text-slate-500">Reason (optional)</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 500))} rows={3}
            className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
        </label>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-600">Cancel</button>
          <button onClick={() => onSubmit(target, message)} disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />} Send Release Request
          </button>
        </div>
      </div>
    </Modal>
  );
}
