"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  Gauge,
  ArrowUp,
  ArrowDown,
  MinusCircle,
  CalendarDays,
  MapPin,
  Swords,
  Pencil,
  X,
  Save,
  Medal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type ActivityStatus = "APPROVED" | "PENDING" | "REJECTED";
type MembershipState = "ACTIVE" | "EXPIRED" | "PAYMENT_DUE" | "AWAITING_ID" | "UNDER_REVIEW";

/** Response of GET /players/me/dashboard. */
interface Dashboard {
  player: {
    id: string;
    fullName: string;
    profilePhoto: string | null;
    status: string;
    playerId: string;
    isPermanentId: boolean;
    validUntil: string | null;
    category: string | null;
    hasCoach: boolean;
  };
  membership: { state: MembershipState; fee: number; isBPL: boolean };
  stats: { matches: number; wins: number; losses: number; draws: number };
  points: { season: number; points: number; breakdown: Record<PointSource, number>; rank: number | null; rankedPlayers: number };
  recentActivity: { title: string; detail: string; status: ActivityStatus; date: string }[];
  upcoming: {
    tournamentId: string;
    title: string;
    category: string;
    date: string;
    dateTo: string | null;
    location: string;
    status: ActivityStatus;
    nextMatch: { round: number; matNumber: number | null; matchNumber: number | null; opponent: string | null } | null;
  } | null;
}

type EditRequest = { id: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null;

type PointSource = "PLACEMENT" | "SPORTSMANSHIP" | "VOLUNTEER" | "ATTENDANCE" | "DISCIPLINE";

const POINT_SOURCES: { id: PointSource; label: string }[] = [
  { id: "PLACEMENT", label: "Tournaments" },
  { id: "SPORTSMANSHIP", label: "Sportsmanship" },
  { id: "VOLUNTEER", label: "Volunteering" },
  { id: "ATTENDANCE", label: "Attendance" },
  { id: "DISCIPLINE", label: "Discipline" },
];

const PLACEMENT_LABEL: Record<string, string> = { FIRST: "Gold", SECOND: "Silver", THIRD: "Bronze", PARTICIPATION: "Participant" };

interface PointHistoryEntry {
  source: PointSource;
  points: number;
  reason: string | null;
  month: string | null;
  updatedAt: string;
  tournament: { title: string; level: string; date: string } | null;
}

/** Fields a player may change once their coach approves an edit request. */
const EDIT_FIELDS: { key: string; label: string; type?: string; readOnly?: boolean }[] = [
  { key: "fullName", label: "Full Name" },
  { key: "fatherName", label: "Father's Name" },
  { key: "bloodGroup", label: "Blood Group" },
  { key: "gender", label: "Gender" },
  { key: "height", label: "Height (cm)", type: "number" },
  { key: "weight", label: "Weight (kg)", type: "number" },
  { key: "mobileNumber", label: "Mobile Number" },
  { key: "dob", label: "Date of Birth", type: "date", readOnly: true },
  { key: "email", label: "Email Address", readOnly: true },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "addressPincode", label: "Pincode" },
];

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

const authHeaders = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const STATUS_PILL: Record<ActivityStatus, { label: string; className: string }> = {
  APPROVED: { label: "Approved", className: "bg-emerald-50 text-emerald-600" },
  PENDING: { label: "Pending", className: "bg-orange-50 text-[#FF7400]" },
  REJECTED: { label: "Rejected", className: "bg-red-50 text-red-600" },
};

const STATUS_ICON: Record<ActivityStatus, React.ReactNode> = {
  APPROVED: <CheckCircle2 size={18} className="text-emerald-500" />,
  PENDING: <Clock size={18} className="text-[#FF7400]" />,
  REJECTED: <XCircle size={18} className="text-red-500" />,
};

const StatusPill = ({ status }: { status: ActivityStatus }) => (
  <span className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_PILL[status].className}`}>{STATUS_PILL[status].label}</span>
);

const Card = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-6 ${className}`}
  >
    {children}
  </motion.section>
);

async function fetchDashboard(): Promise<{ dashboard: Dashboard; editRequest: EditRequest }> {
  const [dashRes, editRes] = await Promise.all([
    fetch(`${API_BASE}/players/me/dashboard`, { headers: authHeaders() }),
    fetch(`${API_BASE}/profile-edit-requests/my`, { headers: authHeaders() }),
  ]);
  const dashboard = await dashRes.json();
  if (!dashRes.ok) throw new Error(dashboard.error || "Could not load your dashboard");
  const req = editRes.ok ? await editRes.json() : null;
  return { dashboard, editRequest: req?.id ? { id: req.id, status: req.status } : null };
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PlayerDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [editRequest, setEditRequest] = useState<EditRequest>(null);
  const [requestingEdit, setRequestingEdit] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<PointHistoryEntry[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const openHistory = async () => {
    setHistoryOpen(true);
    if (history) return;
    try {
      const res = await fetch(`${API_BASE}/players/me/points`, { headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load your points");
      setHistory(body.entries);
    } catch (err) {
      setHistoryOpen(false);
      setNotice({ text: (err as Error).message, type: "error" });
    }
  };

  const load = useCallback(
    () =>
      fetchDashboard()
        .then(({ dashboard, editRequest }) => {
          setData(dashboard);
          setEditRequest(editRequest);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const handlePayment = async () => {
    if (!data) return;
    setPaying(true);
    setNotice(null);
    try {
      if (!(await loadRazorpayScript())) throw new Error("Razorpay SDK failed to load.");
      // The backend derives the applicant from the token and the fee from settings.
      const orderRes = await fetch(`${API_BASE}/application/create-order`, { method: "POST", headers: authHeaders() });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Failed to create order");

      const checkout = new (window as unknown as { Razorpay: new (o: object) => { open: () => void } }).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Tamil Nadu Judo Association",
        description: "Membership Registration Fee",
        order_id: order.orderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/application/verify-payment`, {
              method: "POST",
              headers: { ...authHeaders(), "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });
            const verify = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verify.error || "Verification failed");
            if (verify.status === "PENDING") {
              setNotice({ text: "Payment received and awaiting confirmation from the bank. Your Player ID will be issued and emailed to you shortly.", type: "success" });
              load();
              return;
            }
            alert("Payment successful! Your Player ID has been issued. You will now be logged out. Log in with your new Player ID to change your password.");
            localStorage.clear();
            window.location.href = "/login";
          } catch (err) {
            setNotice({ text: `Payment verification failed: ${(err as Error).message}`, type: "error" });
          }
        },
        theme: { color: "#FF7400" },
      });
      checkout.open();
    } catch (err) {
      setNotice({ text: (err as Error).message || "Payment initialization failed", type: "error" });
    } finally {
      setPaying(false);
    }
  };

  const requestEdit = async () => {
    setRequestingEdit(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/profile-edit-requests`, { method: "POST", headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to send request");
      setEditRequest({ id: body.id, status: "PENDING" });
      setNotice({ text: "Edit request sent to your coach. You can edit your profile once they approve it.", type: "success" });
    } catch (err) {
      setNotice({ text: (err as Error).message, type: "error" });
    } finally {
      setRequestingEdit(false);
    }
  };

  const openEditor = async () => {
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, { headers: authHeaders() });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not load your profile");
      const u = body.user ?? {};
      setForm(Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, f.key === "dob" && u.dob ? String(u.dob).split("T")[0] : String(u[f.key] ?? "")])));
      setEditOpen(true);
    } catch (err) {
      setNotice({ text: (err as Error).message, type: "error" });
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update profile");
      setEditOpen(false);
      setEditRequest(null);
      setNotice({ text: "Profile updated successfully.", type: "success" });
      load();
    } catch (err) {
      setNotice({ text: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
        <p className="text-slate-500 font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center gap-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-full"><AlertCircle size={32} /></div>
        <h2 className="text-xl font-bold text-slate-800">Unable to load dashboard</h2>
        <p className="text-slate-500">{error}</p>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-[#FF7400] text-white rounded-lg font-bold">Try Again</button>
      </div>
    );
  }

  const { player, membership, stats, points, recentActivity, upcoming } = data;
  const firstName = player.fullName.split(" ")[0];
  const pct = (n: number) => (stats.matches ? `${Math.round((n / stats.matches) * 100)}%` : "—");

  const statTiles = [
    { label: "Matches", value: stats.matches, side: <Gauge size={20} className="text-slate-500" />, labelClass: "text-slate-500" },
    { label: "Wins", value: stats.wins, side: <span className="flex flex-col items-end gap-2 text-emerald-600"><ArrowUp size={20} /><span className="text-sm font-bold">{pct(stats.wins)}</span></span>, labelClass: "text-emerald-600" },
    { label: "Losses", value: stats.losses, side: <span className="flex flex-col items-end gap-2 text-red-500"><ArrowDown size={20} /><span className="text-sm font-bold">{pct(stats.losses)}</span></span>, labelClass: "text-red-500" },
    { label: "Draws", value: stats.draws, side: <span className="flex flex-col items-end gap-2 text-slate-500"><MinusCircle size={20} /><span className="text-sm font-bold">{pct(stats.draws)}</span></span>, labelClass: "text-slate-500" },
  ];

  return (
    <div className="max-w-6xl space-y-6 pb-12">
      <header>
        <h1 className="text-3xl font-black text-slate-900">Player Dashboard</h1>
        <p className="text-slate-500 mt-1">Welcome back, {firstName}!</p>
      </header>

      {notice && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm font-semibold ${notice.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          {notice.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Player card */}
        <Card className="lg:col-span-7 flex flex-col sm:flex-row gap-6">
          <div className="w-28 h-28 shrink-0 rounded-2xl bg-orange-50 text-[#FF7400] flex items-center justify-center text-5xl font-black overflow-hidden">
            {player.profilePhoto
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={player.profilePhoto} alt="" className="w-full h-full object-cover" />
              : player.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 truncate">{player.fullName}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${player.status === "APPROVED" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-[#FF7400]"}`}>
                {player.status.replace(/_/g, " ")}
              </span>
            </div>
            {player.category && <p className="text-slate-600">{player.category}</p>}
            <p className="text-slate-600">
              <span className="font-bold text-slate-800">{player.isPermanentId ? "Player ID" : "Temporary ID"}:</span>{" "}
              <span className="font-mono">{player.playerId}</span>
            </p>
            {player.validUntil && <p className="text-slate-600">TNJA Membership Valid Till: {fmtDate(player.validUntil)}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link href="/dashboard/profile" className="px-4 py-2 rounded-lg border border-orange-200 text-[#FF7400] text-sm font-bold hover:bg-orange-50 transition-colors">
                View Profile
              </Link>
              {editRequest?.status === "APPROVED" ? (
                <button onClick={openEditor} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF7400] text-white text-sm font-bold hover:bg-[#E56900]">
                  <Pencil size={14} /> Edit Profile
                </button>
              ) : editRequest?.status === "PENDING" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">
                  <Clock size={14} /> Edit request awaiting coach approval
                </span>
              ) : player.hasCoach ? (
                <button onClick={requestEdit} disabled={requestingEdit} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 disabled:opacity-60">
                  {requestingEdit ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Request Edit
                </button>
              ) : null}
            </div>
            {editRequest?.status === "REJECTED" && <p className="text-xs font-semibold text-red-500">Your last edit request was rejected. You may send a new one.</p>}
          </div>
        </Card>

        {/* Membership */}
        <Card className="lg:col-span-5 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4">Membership Status</h3>
          {membership.state === "ACTIVE" && (
            <MembershipLine icon={<ShieldCheck size={24} />} tone="emerald" title="Active Membership"
              text={player.validUntil ? `Your membership is active until ${fmtDate(player.validUntil)}. You can take part in all TNJA sanctioned events.` : "Your membership is active. You can take part in all TNJA sanctioned events."} />
          )}
          {membership.state === "EXPIRED" && (
            <MembershipLine icon={<ShieldAlert size={24} />} tone="red" title="Membership Expired"
              text={`Your membership ended on ${fmtDate(player.validUntil)}. Contact the TNJA office to renew it.`} />
          )}
          {membership.state === "UNDER_REVIEW" && (
            <MembershipLine icon={<Clock size={24} />} tone="orange" title="Application Under Review"
              text="Your application is being reviewed. You can pay the membership fee once it is approved." />
          )}
          {membership.state === "AWAITING_ID" && (
            <MembershipLine icon={<Clock size={24} />} tone="orange" title={membership.isBPL ? "Fee Exempt (BPL)" : "Payment Received"}
              text="Your Player ID is being issued and will be emailed to you." />
          )}
          {membership.state === "PAYMENT_DUE" && (
            <>
              <MembershipLine icon={<Clock size={24} />} tone="orange" title="Verification Pending"
                text="Complete your payment to activate your permanent membership." />
              <button onClick={handlePayment} disabled={paying}
                className="mt-auto w-full py-3.5 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-70 transition-colors">
                {paying ? <><Loader2 size={20} className="animate-spin" /> Processing…</> : <><CreditCard size={20} /> Pay Membership Fee · ₹{membership.fee}</>}
              </button>
            </>
          )}
        </Card>
      </div>

      {/* Performance */}
      <Card>
        <h3 className="font-bold text-slate-800 mb-4">Performance Overview</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statTiles.map((t) => (
            <div key={t.label} className="flex items-start justify-between p-5 rounded-xl border border-slate-200">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wide ${t.labelClass}`}>{t.label}</p>
                <p className="text-3xl font-black text-slate-900 mt-3">{t.value}</p>
              </div>
              {t.side}
            </div>
          ))}
        </div>
        {stats.matches === 0 && <p className="text-sm text-slate-400 mt-4">Your record fills in as you compete in tournament matches.</p>}
      </Card>

      {/* Ranking points */}
      <Card className="flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4 md:pr-6 md:border-r border-slate-100">
          <span className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF7400] flex items-center justify-center"><Medal size={28} /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ranking Points · {points.season}</p>
            <p className="text-3xl font-black text-slate-900">{points.points}</p>
            <p className="text-sm font-semibold text-slate-500">
              {points.rank ? <>Rank <span className="text-[#FF7400]">#{points.rank}</span> of {points.rankedPlayers}</> : "Not ranked yet"}
            </p>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3">
          {POINT_SOURCES.map((s) => (
            <div key={s.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
              <p className="text-lg font-black text-slate-800 tabular-nums">{points.breakdown[s.id] ?? 0}</p>
            </div>
          ))}
        </div>
        <div className="flex md:flex-col gap-2 shrink-0">
          <button onClick={openHistory} className="px-4 py-2 rounded-lg border border-orange-200 text-[#FF7400] text-sm font-bold hover:bg-orange-50">Points History</button>
          <Link href="/dashboard/rankings" className="px-4 py-2 rounded-lg text-center text-slate-600 text-sm font-bold hover:bg-slate-50">Rankings</Link>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent activity */}
        <Card className="lg:col-span-7">
          <h3 className="font-bold text-slate-800 mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">No activity yet.</p>
          ) : (
            <ul className="border border-slate-100 rounded-xl divide-y divide-slate-100">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex items-center gap-3 p-3">
                  <span className="w-9 h-9 shrink-0 rounded-lg bg-slate-50 flex items-center justify-center">{STATUS_ICON[a.status]}</span>
                  <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-x-4">
                    <p className="text-sm font-semibold text-slate-700 truncate">{a.title}</p>
                    <p className="text-sm text-slate-500 truncate" title={a.detail}>{a.detail}</p>
                  </div>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Upcoming tournament */}
        <Card className="lg:col-span-5 flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4">Upcoming Event</h3>
          {upcoming ? (
            <div className="flex flex-col flex-1 gap-3">
              <h4 className="text-lg font-black text-slate-900">{upcoming.title}</h4>
              <p className="text-slate-600">{upcoming.category}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={16} className="text-[#FF7400]" />
                  {fmtDate(upcoming.date)}{upcoming.dateTo && upcoming.dateTo !== upcoming.date ? ` – ${fmtDate(upcoming.dateTo)}` : ""}
                </span>
                <span className="inline-flex items-center gap-1.5"><MapPin size={16} className="text-[#FF7400]" />{upcoming.location}</span>
              </div>
              {upcoming.nextMatch && (
                <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-3 py-2 w-fit">
                  <Swords size={15} className="text-[#FF7400]" />
                  Round {upcoming.nextMatch.round}
                  {upcoming.nextMatch.matNumber ? ` · Mat ${upcoming.nextMatch.matNumber}` : ""}
                  {upcoming.nextMatch.matchNumber ? ` · Match ${upcoming.nextMatch.matchNumber}` : ""}
                  {` · vs ${upcoming.nextMatch.opponent || "TBD"}`}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 mt-auto pt-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${STATUS_PILL[upcoming.status].className}`}>
                  {STATUS_ICON[upcoming.status]} {STATUS_PILL[upcoming.status].label}
                </span>
                <Link href="/dashboard/player/tournaments" className="px-4 py-2 rounded-lg border border-orange-200 text-[#FF7400] text-sm font-bold hover:bg-orange-50">
                  View Details
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-6">
              <CalendarDays size={32} className="text-slate-300" />
              <p className="text-sm text-slate-500">You are not registered for any upcoming tournament.</p>
              <Link href="/dashboard/player/tournaments" className="px-4 py-2 rounded-lg border border-orange-200 text-[#FF7400] text-sm font-bold hover:bg-orange-50">
                Browse Tournaments
              </Link>
            </div>
          )}
        </Card>
      </div>

      {/* Points history */}
      <AnimatePresence>
        {historyOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryOpen(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-800">Points History · {points.season}</h3>
                <button onClick={() => setHistoryOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X size={20} /></button>
              </div>
              <div className="overflow-y-auto">
                {!history ? (
                  <div className="py-12 flex justify-center"><Loader2 className="w-7 h-7 text-[#FF7400] animate-spin" /></div>
                ) : history.length === 0 ? (
                  <p className="py-12 text-center text-sm text-slate-400">No points yet this season.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {history.map((e, i) => (
                      <li key={i} className="flex items-start gap-3 px-5 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">
                            {POINT_SOURCES.find((s) => s.id === e.source)?.label}
                            {e.source === "PLACEMENT" && e.reason ? ` · ${PLACEMENT_LABEL[e.reason] ?? e.reason}` : ""}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {e.tournament ? `${e.tournament.title} · ${fmtDate(e.tournament.date)}` : e.month ? new Date(`${e.month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : ""}
                          </p>
                          {e.source !== "PLACEMENT" && e.reason && <p className="text-xs text-amber-600 mt-0.5">{e.reason}</p>}
                        </div>
                        <span className="font-black text-[#FF7400] tabular-nums">+{e.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit profile (after the coach approves an edit request) */}
      <AnimatePresence>
        {editOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-800">Edit Profile</h3>
                <button onClick={() => setEditOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close"><X size={20} /></button>
              </div>
              <div className="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
                {EDIT_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="text-xs font-semibold text-slate-500">{f.label}</span>
                    <input type={f.type || "text"} value={form[f.key] ?? ""} readOnly={f.readOnly}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className={`mt-1 w-full px-3 py-2.5 border rounded-lg text-sm font-medium focus:outline-none ${f.readOnly ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" : "bg-white border-slate-200 text-slate-700 focus:border-[#FF7400]"}`} />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
                <button onClick={() => setEditOpen(false)} disabled={saving} className="px-5 py-2.5 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={saveProfile} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF7400] text-white rounded-lg font-bold hover:bg-[#E56900] disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TONES = {
  emerald: "bg-emerald-50 text-emerald-600",
  orange: "bg-orange-50 text-[#FF7400]",
  red: "bg-red-50 text-red-600",
};

function MembershipLine({ icon, tone, title, text }: { icon: React.ReactNode; tone: keyof typeof TONES; title: string; text: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-4 mb-3">
        <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${TONES[tone]}`}>{icon}</span>
        <p className="font-bold text-slate-800">{title}</p>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
