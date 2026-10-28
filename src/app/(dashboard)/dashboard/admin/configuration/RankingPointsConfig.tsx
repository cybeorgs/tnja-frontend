"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save, RefreshCw, CheckCircle2, AlertCircle, HeartHandshake, CalendarCheck, Medal } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const LEVELS = ["CLUB", "DISTRICT", "ZONE", "STATE", "NATIONAL"] as const;
const PLACEMENTS = [
  { id: "PARTICIPATION", label: "Participant" },
  { id: "THIRD", label: "Bronze" },
  { id: "SECOND", label: "Silver" },
  { id: "FIRST", label: "Gold" },
] as const;

type Level = (typeof LEVELS)[number];
type PlacementId = (typeof PLACEMENTS)[number]["id"];
type Rules = Record<Level, Record<PlacementId, number>>;
interface Settings {
  sportsmanshipPoints: number;
  volunteerPoints: number;
  volunteerFullHours: number;
  attendanceMaxPoints: number;
  disciplineMaxPoints: number;
  disciplineMinPoints: number;
}

const SETTING_FIELDS: { key: keyof Settings; label: string; hint: string; step?: number; group: "tournament" | "monthly" }[] = [
  { key: "sportsmanshipPoints", label: "Sportsmanship (per tournament)", hint: "Every participant starts with this; officials can lower it for one tournament.", group: "tournament" },
  { key: "volunteerPoints", label: "Volunteer points", hint: "Earned for a full volunteer shift at a tournament.", group: "tournament" },
  { key: "volunteerFullHours", label: "Full shift (hours)", hint: "Shorter shifts earn points pro rata.", step: 0.5, group: "tournament" },
  { key: "attendanceMaxPoints", label: "Attendance (per month)", hint: "At 100% attendance; scaled by sessions attended ÷ held.", group: "monthly" },
  { key: "disciplineMaxPoints", label: "Discipline maximum", hint: "Coaches score discipline from 0 to this each month.", group: "monthly" },
  { key: "disciplineMinPoints", label: "Discipline if not updated", hint: "Given automatically for a month the coach did not update.", group: "monthly" },
];

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

/** Admin → Configuration → Ranking Points: every value the points system uses. */
export function RankingPointsConfig() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [season, setSeason] = useState(new Date().getFullYear());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/points/config`, { headers: auth() })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load ranking points");
        setRules(data.rules);
        setSettings(data.settings);
      })
      .catch((err: Error) => setMessage({ text: err.message, type: "error" }));
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/points/config`, {
        method: "PUT",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ rules, settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setMessage({ text: data.message, type: "success" });
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    if (!confirm(`Re-apply the current tournament values to every tournament in ${season}? Sportsmanship reductions are kept.`)) return;
    setRecalculating(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/points/recalculate`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ season }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not recalculate");
      setMessage({ text: data.message, type: "success" });
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setRecalculating(false);
    }
  };

  if (!rules || !settings) {
    return message ? <Banner {...message} /> : (
      <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
    );
  }

  const setRule = (level: Level, placement: PlacementId, value: string) =>
    setRules({ ...rules, [level]: { ...rules[level], [placement]: Math.max(0, Math.floor(Number(value) || 0)) } });
  const setSetting = (key: keyof Settings, value: string) =>
    setSettings({ ...settings, [key]: key === "volunteerFullHours" ? Math.max(0, Number(value) || 0) : Math.max(0, Math.floor(Number(value) || 0)) });

  const settingGroup = (group: "tournament" | "monthly") => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {SETTING_FIELDS.filter((f) => f.group === group).map((f) => (
        <label key={f.key} className="block">
          <span className="text-xs font-bold text-slate-600">{f.label}</span>
          <input type="number" min={0} step={f.step ?? 1} value={settings[f.key]} onChange={(e) => setSetting(f.key, e.target.value)}
            className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400]" />
          <span className="block mt-1 text-[11px] text-slate-400 leading-snug">{f.hint}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {message && <Banner {...message} />}

      <section className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200 space-y-5">
        <Heading icon={<Medal size={20} />} title="Tournament results" text="Points for each player's best result in a tournament, by tournament level." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-xs font-black uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-3">Level</th>
                {PLACEMENTS.map((p) => <th key={p.id} className="py-2 px-2">{p.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {LEVELS.map((level) => (
                <tr key={level}>
                  <td className="py-2 pr-3 font-bold text-slate-700">{level.charAt(0) + level.slice(1).toLowerCase()}</td>
                  {PLACEMENTS.map((p) => (
                    <td key={p.id} className="py-2 px-2">
                      <input type="number" min={0} value={rules[level][p.id]} onChange={(e) => setRule(level, p.id, e.target.value)}
                        aria-label={`${level} ${p.label}`}
                        className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200 space-y-5">
        <Heading icon={<HeartHandshake size={20} />} title="Sportsmanship & volunteering" text="Awarded per tournament." />
        {settingGroup("tournament")}
      </section>

      <section className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200 space-y-5">
        <Heading icon={<CalendarCheck size={20} />} title="Monthly attendance & discipline" text="Coaches update these for their students every month." />
        {settingGroup("monthly")}
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-5 border border-slate-200">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <RefreshCw size={16} className="text-slate-400" />
          New values apply to points awarded from now on. To re-apply tournament values to
          <select value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Season"
            className="px-2 py-1 border border-slate-200 rounded-lg font-bold text-slate-700">
            {[0, 1, 2].map((i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={recalculate} disabled={recalculating} className="font-bold text-[#FF7400] hover:underline disabled:opacity-50">
            {recalculating ? "Recalculating…" : "recalculate"}
          </button>
        </div>
        <button onClick={save} disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-xl font-bold disabled:opacity-60">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Ranking Points
        </button>
      </div>
    </div>
  );
}

function Heading({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
      <div className="p-2 bg-[#FF7400]/10 text-[#FF7400] rounded-lg">{icon}</div>
      <div>
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">{title}</h2>
        <p className="text-slate-500 text-sm">{text}</p>
      </div>
    </div>
  );
}

function Banner({ text, type }: { text: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium border ${type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-600 border-red-100"}`}>
      {type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      {text}
    </div>
  );
}
