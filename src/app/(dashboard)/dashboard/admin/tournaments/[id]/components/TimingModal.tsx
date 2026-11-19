"use client";

import { useState } from "react";
import { Timer, X } from "lucide-react";
import type { DrawCategory } from "../types";
import { defaultMatchSeconds, fmtClock, timingOf } from "../lib/matchTiming";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Saved = { ageGroup: string; exactAge: number; gender: string; weightCategory: string; matchDuration: number | null; goldenScoreLimit: number | null };

/**
 * Scoreboard timing for one category: regular match time and golden score limit, optionally for
 * every weight of the same age group. Scoreboards pick it up for matches that haven't begun.
 */
export default function TimingModal({ tournamentId, token, draw, title, onClose, onSaved }: {
  tournamentId: string; token: string | null; draw: DrawCategory; title: string;
  onClose: () => void; onSaved: (draws: Saved[], message: string) => void;
}) {
  const t = timingOf(draw);
  const [min, setMin] = useState(Math.floor(t.duration / 60));
  const [sec, setSec] = useState(t.duration % 60);
  const [gsUnlimited, setGsUnlimited] = useState(t.goldenLimit === null);
  const [gsMin, setGsMin] = useState(t.goldenLimit ? Math.floor(t.goldenLimit / 60) : 2);
  const [gsSec, setGsSec] = useState(t.goldenLimit ? t.goldenLimit % 60 : 0);
  const [allWeights, setAllWeights] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const duration = min * 60 + sec;
  const gsLimit = gsUnlimited ? null : gsMin * 60 + gsSec;
  const fallback = defaultMatchSeconds(draw.ageGroup);

  const save = async (useDefault = false) => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws/timing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ageGroup: draw.ageGroup, exactAge: draw.exactAge ?? 0, gender: draw.gender, weightCategory: draw.weightCategory,
          matchDuration: useDefault ? null : duration, goldenScoreLimit: useDefault ? null : gsLimit, applyToAgeGroup: allWeights,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save the timing");
      onSaved(data.draws || [], data.message || "Timing saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the timing");
    } finally {
      setSaving(false);
    }
  };

  const num = "w-16 h-10 text-center text-lg font-black tabular-nums border border-slate-200 rounded-lg outline-none focus:border-[#FF7400]";
  const clampInt = (v: string, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const presets = [120, 180, 240, 300];

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7400] flex items-center justify-center shrink-0"><Timer size={20} /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800">Scoreboard timing</h3>
            <p className="text-xs font-semibold text-slate-400 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Regular time */}
          <div>
            <p className="text-xs font-black tracking-wider text-slate-500 mb-2">MATCH TIME</p>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={15} value={min} onChange={(e) => setMin(clampInt(e.target.value, 15))} className={num} aria-label="Minutes" />
              <span className="font-black text-slate-400">:</span>
              <input type="number" min={0} max={59} step={5} value={String(sec).padStart(2, "0")} onChange={(e) => setSec(clampInt(e.target.value, 59))} className={num} aria-label="Seconds" />
              <div className="flex gap-1 ml-auto">
                {presets.map((p) => (
                  <button key={p} type="button" onClick={() => { setMin(Math.floor(p / 60)); setSec(p % 60); }}
                    className={`px-2 h-8 rounded-md text-xs font-bold border ${duration === p ? "bg-[#FF7400] text-white border-[#FF7400]" : "border-slate-200 text-slate-600 hover:border-orange-300"}`}>
                    {fmtClock(p)}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">Usual for {draw.ageGroup}: {fmtClock(fallback)}</p>
          </div>

          {/* Golden score */}
          <div>
            <p className="text-xs font-black tracking-wider text-slate-500 mb-2">GOLDEN SCORE LIMIT</p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600 mr-2">
                <input type="checkbox" checked={gsUnlimited} onChange={(e) => setGsUnlimited(e.target.checked)} className="accent-[#FF7400] w-4 h-4" />
                Unlimited
              </label>
              {!gsUnlimited && (
                <>
                  <input type="number" min={0} max={15} value={gsMin} onChange={(e) => setGsMin(clampInt(e.target.value, 15))} className={num} aria-label="Golden score minutes" />
                  <span className="font-black text-slate-400">:</span>
                  <input type="number" min={0} max={59} step={5} value={String(gsSec).padStart(2, "0")} onChange={(e) => setGsSec(clampInt(e.target.value, 59))} className={num} aria-label="Golden score seconds" />
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">When the limit is reached the clock stops and the referees decide (hantei).</p>
          </div>

          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={allWeights} onChange={(e) => setAllWeights(e.target.checked)} className="accent-[#FF7400] w-4 h-4" />
            Apply to every weight in {draw.ageGroup} ({draw.gender === "FEMALE" ? "Girls" : "Boys"})
          </label>

          <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
            Open scoreboards update automatically for matches that haven&apos;t started. A match already running keeps its clock.
          </p>
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          {t.custom && (
            <button onClick={() => save(true)} disabled={saving} className="h-10 px-3 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50">
              Use default
            </button>
          )}
          <button onClick={onClose} className="ml-auto h-10 px-4 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button onClick={() => save()} disabled={saving || duration < 30 || (gsLimit !== null && gsLimit < 10)}
            className="h-10 px-5 rounded-lg text-sm font-black text-white bg-[#FF7400] hover:bg-[#e66800] disabled:opacity-50">
            {saving ? "Saving…" : "Save timing"}
          </button>
        </div>
      </div>
    </div>
  );
}
