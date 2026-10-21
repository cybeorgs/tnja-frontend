"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  MapPin,
  Loader2,
  ArrowUpRight,
  Users,
  UserCheck,
  Award,
  Building2,
  MessageSquare,
  CalendarDays,
  Trophy,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const STATE_ROLES = ["SUPER_ADMIN", "CEO", "STATE_PRESIDENT", "STATE_SECRETARY"];

interface Stats {
  counts: Record<"STUDENT" | "COACH" | "MEMBER" | "CLUB", number>;
  pending: Record<"STUDENT" | "COACH" | "MEMBER" | "CLUB" | "total", number>;
  recentApprovals: { id: string; name: string; type: "Player" | "Coach" | "Member" | "Club"; isBPL?: boolean; createdAt: string }[];
}

interface Grievance {
  id: string;
  userName: string;
  role?: string;
  subject?: string;
  status: string;
  createdAt: string;
}

interface DashboardEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  level?: string;
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const APPROVAL_TYPE: Record<string, string> = { Player: "STUDENT", Coach: "COACH", Member: "MEMBER", Club: "CLUB" };

const GRIEVANCE_STATUS: Record<string, { label: string; dot: string; text: string }> = {
  CLOSED: { label: "Closed", dot: "bg-emerald-500", text: "text-emerald-700" },
  REPLAY: { label: "Replied", dot: "bg-sky-500", text: "text-sky-700" },
  PENDING: { label: "Open", dot: "bg-amber-500", text: "text-amber-700" },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [role, setRole] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [grievances, setGrievances] = useState<Grievance[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const H = { Authorization: `Bearer ${localStorage.getItem("token")}` };
        const [statsRes, profileRes, grievRes, evRes] = await Promise.all([
          fetch(`${API_BASE}/admin/stats`, { headers: H }),
          fetch(`${API_BASE}/auth/profile`, { headers: H }),
          fetch(`${API_BASE}/grievances`, { headers: H }).catch(() => null),
          fetch(`${API_BASE}/events/admin`, { headers: H }).catch(() => null),
        ]);
        if (!statsRes.ok || !profileRes.ok) throw new Error("Could not load the dashboard. Please try again.");

        const profile = await profileRes.json();
        // The profile sends the role at the top level (the Super Admin has no user.role).
        const userRole: string = profile.role || profile.user?.role || localStorage.getItem("userRole") || "";
        setRole(userRole);
        setJurisdiction(
          STATE_ROLES.includes(userRole)
            ? "Tamil Nadu"
            : profile.user?.assignedDistrict?.name || profile.user?.district?.name || "District not assigned"
        );
        setStats(await statsRes.json());

        if (grievRes?.ok) {
          const gd = await grievRes.json();
          setGrievances((Array.isArray(gd) ? gd : gd.grievances || []).slice(0, 5));
        }
        if (evRes?.ok) {
          const ed = await evRes.json();
          // Soonest upcoming events first; past and rejected events are not shown here.
          const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
          const upcoming = (Array.isArray(ed) ? ed : ed.data || ed.events || [])
            .filter((ev: DashboardEvent & { status?: string }) => ev.date && new Date(ev.date).getTime() >= startOfToday && ev.status !== "REJECTED")
            .sort((a: DashboardEvent, b: DashboardEvent) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setEvents(upcoming.slice(0, 4));
        }
      } catch (e) {
        setError((e as Error).message || "Failed to connect");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh] gap-3 text-slate-400">
      <Loader2 size={28} className="animate-spin text-[#FF7400]" />
      <span className="font-semibold text-sm">Loading dashboard…</span>
    </div>
  );

  if (error || !stats) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <ShieldCheck size={32} className="text-red-400" />
      <p className="text-slate-500 text-sm font-semibold">{error}</p>
      <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#FF7400] text-white font-bold rounded-lg text-sm">
        Retry
      </button>
    </div>
  );

  const canSeeGrievances = STATE_ROLES.includes(role);
  const tiles = [
    { label: "Players", key: "STUDENT" as const, icon: Users },
    { label: "Coaches & Referees", key: "COACH" as const, icon: UserCheck },
    { label: "Members", key: "MEMBER" as const, icon: Award },
    { label: "Clubs", key: "CLUB" as const, icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      {/* Context: whose data this is, and the most-used shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin size={15} className="text-[#FF7400]" />
          <span className="font-bold text-slate-800">{jurisdiction}</span>
          <span className="text-slate-300">·</span>
          {roleLabel(role)}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/admin/approvals?type=STUDENT"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-bold rounded-lg transition-colors">
            <ShieldCheck size={16} /> Review approvals
            {stats.pending.total > 0 && (
              <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-white text-[#FF7400] text-[11px] font-black text-center">{stats.pending.total}</span>
            )}
          </Link>
          <Link href="/dashboard/admin/tournaments"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 text-sm font-bold rounded-lg transition-colors">
            <Trophy size={16} /> Tournaments
          </Link>
          {/* Super Admin / CEO use User Management; other officials have the read-only members list. */}
          <Link href={role === "SUPER_ADMIN" || role === "CEO" ? "/dashboard/admin/users" : "/dashboard/admin/members"}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 text-sm font-bold rounded-lg transition-colors">
            <Users size={16} /> {role === "SUPER_ADMIN" || role === "CEO" ? "Users" : "Members"}
          </Link>
        </div>
      </div>

      {/* Headline counts — each opens its approvals list */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map(({ label, key, icon: Icon }) => {
          const pending = stats.pending[key] ?? 0;
          return (
            <Link key={key} href={`/dashboard/admin/approvals?type=${key}`}
              className="group bg-white border border-slate-200 rounded-xl p-5 hover:border-[#FF7400] hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">{label}</span>
                <span className="w-8 h-8 rounded-lg bg-orange-50 text-[#FF7400] flex items-center justify-center">
                  <Icon size={16} />
                </span>
              </div>
              <p className="text-3xl font-black text-slate-900 mt-3 tracking-tight">{(stats.counts[key] ?? 0).toLocaleString("en-IN")}</p>
              <p className={`text-xs font-semibold mt-1 ${pending > 0 ? "text-[#FF7400]" : "text-slate-400"}`}>
                {pending > 0 ? `${pending} awaiting approval` : "Nothing pending"}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">
          {/* Pending approvals */}
          <Panel title="Awaiting approval" count={stats.pending.total} href="/dashboard/admin/approvals" icon={<ShieldCheck size={16} />}>
            {stats.recentApprovals.length === 0 ? (
              <Empty icon={<ShieldCheck size={26} />} text="No applications waiting — you're all caught up." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recentApprovals.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center gap-3 py-3">
                    <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-black shrink-0">
                      {(item.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">
                        {item.type}{item.isBPL ? " · BPL" : ""} · applied {shortDate(item.createdAt)}
                      </p>
                    </div>
                    <Link href={`/dashboard/admin/approvals?type=${APPROVAL_TYPE[item.type]}&id=${item.id}`}
                      className="shrink-0 px-3 py-1.5 text-xs font-bold text-[#FF7400] border border-orange-200 hover:bg-orange-50 rounded-lg transition-colors">
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Grievances (state-level roles) */}
          {canSeeGrievances && (
            <Panel title="Recent grievances" href="/dashboard/admin/grievances" icon={<MessageSquare size={16} />}>
              {grievances.length === 0 ? (
                <Empty icon={<MessageSquare size={26} />} text="No grievances have been raised." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {grievances.map((g) => {
                    const st = GRIEVANCE_STATUS[g.status] ?? GRIEVANCE_STATUS.PENDING;
                    return (
                      <li key={g.id} className="py-3 flex items-start gap-3">
                        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-black shrink-0">
                          {(g.userName || "U").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800">{g.userName || "Unknown"}</p>
                            {g.role && <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{roleLabel(g.role)}</span>}
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{g.subject || "No subject"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`inline-flex items-center gap-1.5 text-xs font-bold ${st.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{shortDate(g.createdAt)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </div>

        {/* Upcoming events */}
        <Panel title="Upcoming events" href="/dashboard/admin/events" icon={<CalendarDays size={16} />}>
          {events.length === 0 ? (
            <Empty icon={<CalendarDays size={26} />} text="No upcoming events.">
              <Link href="/dashboard/admin/events" className="text-xs font-bold text-[#FF7400] hover:underline">Create an event</Link>
            </Empty>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => {
                const d = new Date(ev.date);
                return (
                  <li key={ev.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50">
                    <div className="w-12 shrink-0 text-center border border-orange-200 rounded-lg overflow-hidden">
                      <p className="bg-[#FF7400] text-white text-[10px] font-black uppercase py-0.5">
                        {d.toLocaleDateString("en-IN", { month: "short" })}
                      </p>
                      <p className="text-lg font-black text-slate-800 py-0.5">{d.getDate()}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{ev.title}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {[ev.location, ev.level && roleLabel(ev.level)].filter(Boolean).join(" · ") || shortDate(ev.date)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

interface PanelProps {
  title: string;
  href: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}

function Panel({ title, href, icon, count, children }: PanelProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
          <span className="text-[#FF7400]">{icon}</span>
          {title}
          {!!count && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-[#FF7400] text-[11px] font-black">{count}</span>}
        </h2>
        <Link href={href} className="text-xs font-bold text-slate-400 hover:text-[#FF7400] inline-flex items-center gap-1 transition-colors">
          View all <ArrowUpRight size={13} />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-slate-300 flex flex-col items-center gap-2">
      {icon}
      <p className="text-sm font-semibold text-slate-400">{text}</p>
      {children}
    </div>
  );
}
