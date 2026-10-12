"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, MapPin, Calendar, Loader2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function AdminDashboard() {
  const [statsData,  setStatsData]  = useState<any>(null);
  const [userData,   setUserData]   = useState<any>(null);
  const [grievances, setGrievances] = useState<any[]>([]);
  const [events,     setEvents]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const H = { Authorization: `Bearer ${token}` };

        const [statsRes, profileRes, grievRes, evRes] = await Promise.all([
          fetch(`${API_BASE}/admin/stats`,  { headers: H }),
          fetch(`${API_BASE}/auth/profile`, { headers: H }),
          fetch(`${API_BASE}/grievances`,   { headers: H }).catch(() => null),
          fetch(`${API_BASE}/events`,       { headers: H }).catch(() => null),
        ]);

        if (!statsRes.ok || !profileRes.ok) throw new Error("Server error");

        const stats   = await statsRes.json();
        const profile = await profileRes.json();
        setStatsData(stats);
        setUserData(profile.user);

        if (grievRes?.ok) {
          const gd = await grievRes.json();
          setGrievances((Array.isArray(gd) ? gd : gd.grievances || []).slice(0, 6));
        }
        if (evRes?.ok) {
          const ed = await evRes.json();
          setEvents((Array.isArray(ed) ? ed : ed.events || []).slice(0, 4));
        }
      } catch (e: any) {
        setError(e.message || "Failed to connect");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-400">
      <Loader2 size={36} className="animate-spin text-[#FF7400]" />
      <span className="font-semibold text-sm">Loading dashboard...</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-5">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
        <ShieldCheck size={28} className="text-red-500" />
      </div>
      <p className="text-slate-500 text-sm font-semibold">{error}</p>
      <button onClick={() => window.location.reload()}
        className="px-6 py-2.5 bg-[#FF7400] text-white font-bold rounded-xl text-sm">
        Retry
      </button>
    </div>
  );

  const role    = userData?.role || "";
  const districtName = userData?.assignedDistrict?.name || userData?.district?.name || userData?.state?.name || "Tamil Nadu";
  const isSuper = role === "SUPER_ADMIN" || role === "CEO";
  const canSeeGrievances =
    role === "STATE_PRESIDENT" || role === "STATE_SECRETARY" ||
    role === "SUPER_ADMIN"     || role === "CEO";

  const statCards = [
    { label: "MEMBERS", value: statsData?.counts?.MEMBER  ?? 0, dot: "bg-[#FF7400]", border: "border-[#FF7400]" },
    { label: "PLAYERS", value: statsData?.counts?.STUDENT ?? 0, dot: "bg-yellow-400",  border: "border-yellow-400" },
    { label: "COACHES", value: statsData?.counts?.COACH   ?? 0, dot: "bg-slate-800",   border: "border-slate-800" },
  ];

  // Placeholder events when API returns nothing
  const displayEvents = events.length > 0 ? events : [
    { id: "e1", title: "National Tournament", date: "2026-06-09", location: "Chennai",    imageUrl: "" },
    { id: "e2", title: "State Championship",  date: "2026-07-15", location: "Coimbatore", imageUrl: "" },
    { id: "e3", title: "District Open",       date: "2026-08-01", location: "Madurai",    imageUrl: "" },
  ];

  return (
    <div className="space-y-6">

      {/* Breadcrumb */}
      <p className="text-xs text-slate-400 font-semibold">
        <span className="text-slate-700 font-bold">{roleLabel(role)} Dashboard</span>
        {" / "}Overview
      </p>

      {/* Page title */}
      <h1 className="text-3xl font-black text-[#FF7400]">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-[1000px]">
        {statCards.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`bg-white rounded-2xl border-2 ${s.border} p-6 relative overflow-hidden shadow-sm`}>
            <span className={`absolute top-4 right-4 w-3 h-3 rounded-full ${s.dot}`} />
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-5xl font-black text-slate-900">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main two-column layout */}
      <div className="flex flex-col xl:flex-row gap-8 justify-between items-start">

        {/* ── LEFT: Grievances / Approvals ─────────────────────────────── */}
        <div className="flex-1 w-full max-w-[1000px] bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#FF7400] uppercase tracking-widest">
              {canSeeGrievances ? "Grievances" : "Pending Approvals"}
            </h2>
            <Link
              href={canSeeGrievances ? "/dashboard/admin/grievances" : "/dashboard/admin/approvals"}
              className="text-xs font-bold text-slate-400 hover:text-[#FF7400] flex items-center gap-1 transition-colors">
              View All <ArrowUpRight size={13} />
            </Link>
          </div>

          {canSeeGrievances ? (
            /* ── Grievance cards (State/Super only) ── */
            <div className="space-y-2">
              {grievances.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
                  <p className="text-slate-400 font-bold text-sm">No grievances yet</p>
                </div>
              ) : grievances.map((g: any, i: number) => (
                <motion.div key={g.id || i}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 hover:shadow-md transition-shadow">

                  {/* Row 1: Avatar + Name + Badge + Status */}
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white font-black text-lg shrink-0 overflow-hidden shadow-sm">
                      {g.userPhoto
                        ? <img src={g.userPhoto} alt="" className="w-full h-full object-cover" />
                        : (g.userName || "U").charAt(0).toUpperCase()}
                    </div>

                    {/* Name + Badge */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-black text-slate-900">{g.userName || "Unknown"}</p>
                        {g.role && (
                          <span className="text-[9px] font-black px-3 py-1 rounded-full bg-slate-900 uppercase tracking-widest text-[#FFDA00]">
                            {g.role}
                          </span>
                        )}
                      </div>
                      {g.userId && (
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{g.userId}</p>
                      )}
                    </div>

                    {/* Status — top right */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        g.status === "CLOSED" ? "bg-emerald-500" :
                        g.status === "REPLAY" ? "bg-blue-400" : "bg-red-500"
                      }`} />
                      <span className={`text-xs font-bold ${
                        g.status === "CLOSED" ? "text-emerald-600" :
                        g.status === "REPLAY" ? "text-blue-500" : "text-[#FF7400]"
                      }`}>
                        {g.status === "CLOSED" ? "Closed" : g.status === "REPLAY" ? "Replied" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Italic message */}
                  <p className="text-xs text-slate-500 italic leading-relaxed mt-3 line-clamp-2">
                    {g.subject || "No subject"}
                  </p>

                  {/* Row 3: Date — bottom right */}
                  <div className="flex justify-end mt-2">
                    <p className="text-[10px] font-bold text-[#FF7400] flex items-center gap-1">
                      <Calendar size={9} />
                      {fmtDate(g.createdAt || new Date().toISOString())}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* ── Pending Approvals (District) ── */
            <div className="space-y-3">
              {(statsData?.recentApprovals || []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center">
                  <ShieldCheck size={36} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 font-bold text-sm">No pending approvals</p>
                </div>
              ) : (statsData?.recentApprovals || []).map((item: any, i: number) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 ${
                    item.type === "Club"   ? "bg-purple-100 text-purple-600" :
                    item.type === "Player" ? "bg-orange-100 text-[#FF7400]"  : "bg-amber-100 text-amber-600"
                  }`}>
                    {(item.name || "?").charAt(0)}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-black text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{item.type} · {fmtDate(item.createdAt)}</p>
                  </div>
                  <Link href={`/dashboard/admin/approvals?type=${item.type === "Player" ? "STUDENT" : item.type.toUpperCase()}&id=${item.id}`}
                    className="shrink-0 px-4 py-2 bg-[#FF7400] text-white text-[10px] font-black rounded-xl shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
                    Review
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Events ────────────────────────────────────────────── */}
        <div className="w-full xl:w-[400px] shrink-0 bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 xl:mr-12">
          
          {/* Jurisdiction card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Your Jurisdiction</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-orange-400" />
              </div>
              <div>
                <p className="font-black text-base">{districtName}</p>
                <p className="text-slate-400 text-xs font-semibold">{roleLabel(role)}</p>
              </div>
            </div>
            {!isSuper && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <Link href="/dashboard/admin/members"
                  className="text-center py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-black transition-colors">
                  Members
                </Link>
                <Link href="/dashboard/admin/approvals"
                  className="text-center py-2 bg-[#FF7400]/80 hover:bg-[#FF7400] rounded-xl text-[10px] font-black transition-colors">
                  Approvals
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#FF7400] uppercase tracking-widest">Events</h2>
            <Link href="/dashboard/admin/events"
              className="text-xs font-bold text-slate-400 hover:text-[#FF7400] flex items-center gap-1 transition-colors">
              View All <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="space-y-4">
            {displayEvents.map((ev: any, i: number) => (
              <motion.div key={ev.id || i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">

                {/* Event image with yellow bottom accent */}
                <div className="relative h-40 overflow-hidden">
                  {ev.imageUrl ? (
                    <img src={ev.imageUrl} alt={ev.title || ev.name}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-purple-700 to-slate-900 flex items-center justify-center">
                      {/* Judo silhouette placeholder */}
                      <svg viewBox="0 0 120 100" className="w-20 h-20 opacity-20 fill-white">
                        <ellipse cx="60" cy="30" rx="12" ry="14" />
                        <rect x="48" y="42" width="24" height="30" rx="4" />
                        <rect x="30" y="48" width="20" height="6" rx="3" />
                        <rect x="70" y="48" width="20" height="6" rx="3" />
                        <rect x="50" y="70" width="8" height="22" rx="3" />
                        <rect x="62" y="70" width="8" height="22" rx="3" />
                      </svg>
                    </div>
                  )}
                  {/* Yellow bottom accent bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-yellow-400" />
                </div>

                {/* Event details */}
                <div className="p-4 space-y-2">
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {ev.title || ev.name || "Event"}
                  </h3>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                      <Calendar size={12} className="text-[#FF7400] shrink-0" />
                      {ev.date ? fmtDate(ev.date) : "TBD"}
                    </div>
                    {(ev.location || ev.venue) && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                        <MapPin size={12} className="text-[#FF7400] shrink-0" />
                        {ev.location || ev.venue}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>


        </div>
      </div>
    </div>
  );
}
