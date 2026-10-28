"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Trophy, Medal, User, UserCheck, Building2, MapPin, Map as MapIcon, AlertCircle, Search, ChevronDown } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type RankingType = "student" | "coach" | "club" | "district" | "zone";
type Source = "PLACEMENT" | "SPORTSMANSHIP" | "VOLUNTEER" | "ATTENDANCE" | "DISCIPLINE";

interface Row {
  rank: number;
  id: string;
  name: string;
  subtitle: string | null;
  points: number;
  breakdown: Record<Source, number>;
  players?: number;
}

const TABS: { id: RankingType; label: string; icon: typeof User }[] = [
  { id: "student", label: "Best Student", icon: User },
  { id: "coach", label: "Best Coach", icon: UserCheck },
  { id: "club", label: "Best Club", icon: Building2 },
  { id: "district", label: "Best District", icon: MapPin },
  { id: "zone", label: "Best Zone", icon: MapIcon },
];

const SOURCE_LABEL: Record<Source, string> = {
  PLACEMENT: "Tournaments",
  SPORTSMANSHIP: "Sportsmanship",
  VOLUNTEER: "Volunteering",
  ATTENDANCE: "Attendance",
  DISCIPLINE: "Discipline",
};
const SOURCES = Object.keys(SOURCE_LABEL) as Source[];

const MEDAL = ["text-yellow-500", "text-slate-400", "text-amber-700"];

export default function RankingsPage() {
  const [type, setType] = useState<RankingType>("student");
  const [season, setSeason] = useState<string>(String(new Date().getFullYear()));
  const [seasons, setSeasons] = useState<number[]>([new Date().getFullYear()]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/rankings?type=${type}&season=${season}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load rankings");
        if (cancelled) return;
        setRows(data.rows);
        setSeasons(data.seasons);
        setError("");
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [type, season]);

  const changeType = (t: RankingType) => {
    setLoading(true);
    setType(t);
  };
  const changeSeason = (s: string) => {
    setLoading(true);
    setSeason(s);
  };

  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.subtitle?.toLowerCase().includes(q)) : rows;
  const unit = type === "student" ? null : type === "zone" || type === "district" ? "players" : "students";

  return (
    <div className="max-w-6xl space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><Trophy className="text-[#FF7400]" /> Rankings</h1>
          <p className="text-slate-500 mt-1">Ranking points from tournaments, sportsmanship, volunteering, attendance and discipline.</p>
        </div>
        <div className="relative w-40">
          <select value={season} onChange={(e) => changeSeason(e.target.value)} aria-label="Season"
            className="w-full appearance-none pl-3 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-[#FF7400]">
            {seasons.map((s) => <option key={s} value={s}>Season {s}</option>)}
            <option value="all">All time</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
      </header>

      <div role="tablist" className="flex bg-white p-1 rounded-2xl border border-slate-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={type === id} onClick={() => changeType(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${type === id ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name…"
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
        ) : error ? (
          <p className="py-16 text-center text-red-500 font-semibold flex items-center justify-center gap-2"><AlertCircle size={18} /> {error}</p>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Medal size={36} className="mx-auto text-slate-300" />
            <p className="text-slate-500 font-semibold">No ranking points yet for this season.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4 text-left w-16">Rank</th>
                  <th className="py-3 px-4 text-left">Name</th>
                  {SOURCES.map((s) => <th key={s} className="py-3 px-3 text-right hidden lg:table-cell">{SOURCE_LABEL[s]}</th>)}
                  <th className="py-3 px-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} className={r.rank <= 3 ? "bg-orange-50/30" : ""}>
                    <td className="py-3 px-4 font-black text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        {r.rank <= 3 && <Medal size={16} className={MEDAL[r.rank - 1]} />}#{r.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400">
                        {[r.subtitle, unit && r.players !== undefined ? `${r.players} ${unit}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    {SOURCES.map((s) => <td key={s} className="py-3 px-3 text-right text-slate-500 tabular-nums hidden lg:table-cell">{r.breakdown[s] || "—"}</td>)}
                    <td className="py-3 px-4 text-right font-black text-[#FF7400] text-base tabular-nums">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-slate-400">
        Coaches, clubs, districts and zones are ranked by the total points of their players, counted where each player trained when the points were earned.
      </p>
    </div>
  );
}
