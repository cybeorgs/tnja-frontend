"use client";

import { useMemo, useState } from "react";
import { Scale, Search, Check, X, ArrowRight, Loader2, AlertCircle, Lock, RotateCcw } from "lucide-react";
import type { RegisteredPlayer } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type CheckResult = { weight: string; ageGroup: string; weightCategory: string; fits: boolean };

type Progress = { total: number; passed: number; disqualified: number };

const genderLabel = (g: string) => (g === "FEMALE" ? "Girls" : g === "MALE" ? "Boys" : g);

// Age groups in competition order (youngest first); anything else follows alphabetically
const AGE_GROUP_ORDER = [
  "Mini Sub-Junior Age Group 1",
  "Mini Sub-Junior Age Group 2",
  "Mini Sub-Junior Age Group 3",
  "Sub-Junior",
  "Cadet",
  "Junior",
  "Senior",
  "Veteran",
];
const ageGroupRank = (g: string) => {
  const i = AGE_GROUP_ORDER.indexOf(g);
  return i === -1 ? AGE_GROUP_ORDER.length : i;
};
const shortAgeGroup = (g: string) => g.replace("Mini Sub-Junior Age Group ", "Mini Sub-Jr G");

// "-60kg" < "-66kg" < "+66kg": by the number, an over-limit (+) class after the same number
const weightRank = (w: string) => {
  const n = parseFloat(w.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? Infinity : n + (w.trim().startsWith("+") ? 0.5 : 0);
};

const pendingOf = (c: Progress) => c.total - c.passed - c.disqualified;
const tally = (list: RegisteredPlayer[]): Progress => list.reduce(
  (t, p) => p.status === "DISQUALIFIED" ? { ...t, total: t.total + 1, disqualified: t.disqualified + 1 }
    : p.weighInStatus === "PASSED" ? { ...t, total: t.total + 1, passed: t.passed + 1 }
    : { ...t, total: t.total + 1 },
  { total: 0, passed: 0, disqualified: 0 }
);
// Chip colours: green when everyone is weighed, orange once weighing has begun
const chipTone = (c: Progress, active: boolean) =>
  active ? "bg-slate-800 border-slate-800 text-white"
    : pendingOf(c) === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400"
    : c.passed + c.disqualified > 0 ? "bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-400"
    : "bg-white border-slate-200 text-slate-600 hover:border-slate-400";

/**
 * Tournament-day weigh-in, one category at a time. Each approved player is weighed and then
 * confirmed in their class, moved to the class their weight fits, or disqualified. A category's
 * draw can only be generated once every player in it has passed.
 */
export function WeighInTab({
  tournamentId,
  players,
  registrationClosed,
  onChanged,
  showToast,
}: {
  tournamentId: string;
  players: RegisteredPlayer[];
  registrationClosed: boolean;
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [ageGroup, setAgeGroup] = useState("");
  const [gender, setGender] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [search, setSearch] = useState("");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [busy, setBusy] = useState<string | null>(null);

  // Approved players take part in weigh-in; disqualified ones stay listed in their category
  const weighable = useMemo(() => players.filter(p => p.status === "APPROVED" || p.status === "DISQUALIFIED"), [players]);

  // Step 1: age groups, in competition order
  const ageGroups = useMemo(() => {
    const names = [...new Set(weighable.map(p => p.ageGroup))];
    names.sort((a, b) => ageGroupRank(a) - ageGroupRank(b) || a.localeCompare(b));
    return names.map(name => ({ name, ...tally(weighable.filter(p => p.ageGroup === name)) }));
  }, [weighable]);

  // Step 2: Boys / Girls within the age group (weight classes differ between them)
  const inAgeGroup = weighable.filter(p => p.ageGroup === ageGroup);
  const genders = ["MALE", "FEMALE", "OTHER"]
    .map(g => ({ name: g, ...tally(inAgeGroup.filter(p => p.gender === g)) }))
    .filter(g => g.total > 0);
  const activeGender = genders.some(g => g.name === gender) ? gender : genders[0]?.name ?? "";

  // Step 3: weight classes, lightest first
  const inGender = inAgeGroup.filter(p => p.gender === activeGender);
  const weightClasses = [...new Set(inGender.map(p => String(p.weight)))]
    .sort((a, b) => weightRank(a) - weightRank(b))
    .map(name => ({ name, ...tally(inGender.filter(p => String(p.weight) === name)) }));
  const selected = weightClasses.find(w => w.name === weightClass);

  // Whole-tournament summary: a category is one age group + gender + weight class
  const totals = useMemo(() => {
    const cats = new Map<string, RegisteredPlayer[]>();
    for (const p of weighable) {
      const key = `${p.ageGroup}|${p.gender}|${p.weight}`;
      cats.set(key, [...(cats.get(key) ?? []), p]);
    }
    const all = tally(weighable);
    return {
      players: all.total,
      done: all.passed + all.disqualified,
      categories: cats.size,
      ready: [...cats.values()].filter(list => pendingOf(tally(list)) === 0).length,
    };
  }, [weighable]);

  const q = search.trim().toLowerCase();
  const rows = q.length >= 2
    ? weighable.filter(p => p.name.toLowerCase().includes(q) || p.tnjaId?.toLowerCase().includes(q))
    : selected ? inGender.filter(p => String(p.weight) === selected.name) : [];

  const pickAgeGroup = (name: string) => { setAgeGroup(name); setGender(""); setWeightClass(""); setSearch(""); };
  const pickGender = (name: string) => { setGender(name); setWeightClass(""); setSearch(""); };

  const clearRow = (regId: string) => {
    setWeights(w => { const n = { ...w }; delete n[regId]; return n; });
    setChecks(c => { const n = { ...c }; delete n[regId]; return n; });
  };

  const weighIn = async (p: RegisteredPlayer, action: "CHECK" | "CONFIRM" | "MOVE") => {
    if (!p.regId) return;
    const weight = weights[p.regId] ?? "";
    setBusy(p.regId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${p.regId}/weigh-in`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actualWeight: weight, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Weigh-in failed");
      if (action === "CHECK") {
        setChecks(c => ({ ...c, [p.regId!]: { weight, ageGroup: data.ageGroup, weightCategory: data.weightCategory, fits: data.fits } }));
      } else {
        showToast(action === "MOVE" ? `${p.name}: ${data.message}` : `${p.name} cleared to play`);
        clearRow(p.regId);
        onChanged();
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong", false);
    } finally {
      setBusy(null);
    }
  };

  const disqualify = async (p: RegisteredPlayer) => {
    if (!p.regId) return;
    const weight = weights[p.regId] ?? "";
    if (!window.confirm(`Disqualify ${p.name}${weight ? ` (scale weight ${weight}kg)` : ""}? This can't be undone here.`)) return;
    setBusy(p.regId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${p.regId}/disqualify`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentWeight: weight }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disqualify player");
      showToast(`${p.name} disqualified`);
      clearRow(p.regId);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Something went wrong", false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {!registrationClosed && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-amber-800">
            Weigh-in opens once the tournament is started (registration closed). Use <strong>Close Registration &amp; Start Tournament</strong> first.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Players weighed</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{totals.done} <span className="text-base text-slate-400">/ {totals.players}</span></p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Categories ready for draw</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{totals.ready} <span className="text-base text-slate-400">/ {totals.categories}</span></p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Still to weigh</p>
          <p className="text-2xl font-black text-[#FF7400] mt-1">{totals.players - totals.done}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-[#FF7400]" />
          <h3 className="font-black text-slate-800 text-base">Category Weigh-In</h3>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Or find a player by name or ID"
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
          />
        </div>

        {q.length < 2 && (
          <>
            {/* Step 1: age group */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">1 · Age group</p>
              <div className="flex flex-wrap gap-2">
                {ageGroups.map(g => (
                  <button
                    key={g.name}
                    onClick={() => pickAgeGroup(g.name)}
                    title={g.name}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-black transition-colors ${chipTone(g, g.name === ageGroup)}`}
                  >
                    {shortAgeGroup(g.name)}
                    <span className={`ml-2 text-xs font-bold ${g.name === ageGroup ? "text-slate-300" : "opacity-70"}`}>
                      {pendingOf(g) === 0 ? "✓" : `${g.passed + g.disqualified}/${g.total}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Boys / Girls */}
            {ageGroup && genders.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">2 · Boys / Girls</p>
                <div className="inline-flex bg-slate-100 rounded-xl p-1">
                  {genders.map(g => (
                    <button
                      key={g.name}
                      onClick={() => pickGender(g.name)}
                      className={`px-5 py-2 rounded-lg text-sm font-black transition-colors ${g.name === activeGender ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {genderLabel(g.name)}
                      <span className="ml-2 text-xs font-bold text-slate-400">{pendingOf(g) === 0 ? "✓" : `${g.passed + g.disqualified}/${g.total}`}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: weight class */}
            {ageGroup && activeGender && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">3 · Weight class</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2">
                  {weightClasses.map(w => (
                    <button
                      key={w.name}
                      onClick={() => { setWeightClass(w.name); setSearch(""); }}
                      className={`px-3 py-3 rounded-xl border text-center transition-colors ${chipTone(w, w.name === weightClass)}`}
                    >
                      <p className="text-base font-black">{w.name}</p>
                      <p className={`text-[11px] font-bold mt-0.5 ${w.name === weightClass ? "text-slate-300" : "opacity-70"}`}>
                        {pendingOf(w) === 0 ? "Ready ✓" : `${w.passed + w.disqualified}/${w.total} weighed`}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {selected && q.length < 2 && (
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl px-4 py-3 text-sm font-bold ${pendingOf(selected) === 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600"}`}>
            <span>{ageGroup} · {genderLabel(activeGender)} · {selected.name}</span>
            <span>
              {selected.passed} passed · {selected.disqualified} disqualified · {pendingOf(selected)} pending
              {pendingOf(selected) === 0 && " — ready for draw"}
            </span>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-10 border border-dashed border-slate-200 text-center">
            <p className="font-black text-slate-600">
              {q.length >= 2 ? `No player matches "${search}"`
                : !ageGroup ? "Choose an age group to start"
                : "Choose a weight class to weigh its players"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {rows.map(p => {
              const regId = p.regId || p.id;
              const check = checks[regId];
              const weight = weights[regId] ?? "";
              const isBusy = busy === regId;
              const disqualified = p.status === "DISQUALIFIED";
              const passed = !disqualified && p.weighInStatus === "PASSED";
              const staleCheck = check && check.weight !== weight;

              return (
                <div key={regId} className={`p-4 flex flex-col xl:flex-row xl:items-center gap-3 ${disqualified ? "bg-red-50/40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className={`font-black ${disqualified ? "text-slate-400 line-through" : "text-slate-800"}`}>{p.name}</p>
                    <p className="text-xs font-semibold text-slate-500 truncate">
                      {p.tnjaId}{p.club ? ` • ${p.club}` : ""} • {p.ageGroup} • {genderLabel(p.gender)} • <span className="text-blue-600 font-black">{p.weightLabel || p.weight}</span>
                    </p>
                  </div>

                  {disqualified ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-600 bg-red-100 px-3 py-1.5 rounded-lg self-start xl:self-auto">
                      <X size={14} /> Disqualified{p.weighInWeight ? ` · ${p.weighInWeight}kg` : ""}
                    </span>
                  ) : passed && !(regId in weights) ? (
                    <div className="flex items-center gap-2 self-start xl:self-auto">
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <Check size={14} /> Passed · {p.weighInWeight}kg
                      </span>
                      <button
                        onClick={() => setWeights(w => ({ ...w, [regId]: "" }))}
                        disabled={!registrationClosed}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 disabled:opacity-40"
                      >
                        <RotateCcw size={12} /> Re-weigh
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          value={weight}
                          onChange={(e) => setWeights(w => ({ ...w, [regId]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && weight) weighIn(p, "CHECK"); }}
                          disabled={!registrationClosed || isBusy}
                          placeholder="Scale kg"
                          className="w-28 px-3 py-2 rounded-xl border border-slate-300 font-bold text-sm focus:outline-none focus:border-[#FF7400] disabled:bg-slate-50"
                        />
                        <button
                          onClick={() => weighIn(p, "CHECK")}
                          disabled={!registrationClosed || !weight || isBusy}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-1.5"
                        >
                          {isBusy && !check ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />} Check
                        </button>
                      </div>

                      {check && !staleCheck && (
                        check.fits ? (
                          <button
                            onClick={() => weighIn(p, "CONFIRM")}
                            disabled={isBusy}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-1.5"
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm {check.weightCategory}
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                              <AlertCircle size={14} /> {check.weight}kg is {check.weightCategory}
                            </span>
                            <button
                              onClick={() => weighIn(p, "MOVE")}
                              disabled={isBusy}
                              className="px-3 py-2 rounded-xl bg-[#FF7400] hover:bg-orange-600 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <ArrowRight size={14} /> Move to {check.weightCategory}
                            </button>
                            <button
                              onClick={() => disqualify(p)}
                              disabled={isBusy}
                              className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <X size={14} /> Disqualify
                            </button>
                          </div>
                        )
                      )}
                      {passed && (
                        <button onClick={() => clearRow(regId)} className="text-xs font-bold text-slate-400 hover:text-slate-700 px-1">Cancel</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
