"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, AlertCircle, Loader2, XCircle, Scale, UserX, Ban, RotateCcw } from "lucide-react";
import type { RegisteredPlayer } from "../types";
import { AGE_GROUP_NAMES } from "@/utils/tournamentCategories";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Reason = "WEIGHT" | "ABSENT";

/** The backend saves the scale weight only for a weight disqualification, so no weight = absent. */
const reasonOf = (p: RegisteredPlayer): Reason => (p.weighInWeight ? "WEIGHT" : "ABSENT");
const weightText = (p: RegisteredPlayer) => p.weightLabel || `${p.weight}`;
const districtOf = (p: RegisteredPlayer) => p.representingDistrict || p.district || "";
const genderText = (g: string) => (g === "FEMALE" ? "Girls" : g === "MALE" ? "Boys" : g);
/** "-57" → 57, "+78" → 78.5 so the open class sorts after the last limit. */
const weightSortVal = (w: string) => { const n = parseFloat(w.replace(/[^\d.]/g, "")) || 0; return w.startsWith("+") ? n + 0.5 : n; };
const ageSortVal = (a: string) => { const i = AGE_GROUP_NAMES.indexOf(a); return i === -1 ? 99 : i; };

export function DisqualifyTab({
  players,
  tournamentId,
  onSuccess,
}: {
  players: RegisteredPlayer[];
  tournamentId: string;
  onSuccess: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason>("WEIGHT");
  const [currentWeight, setCurrentWeight] = useState("");
  const [absentNote, setAbsentNote] = useState("");
  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  // Disqualified list filters
  const [fGender, setFGender] = useState("all");
  const [fAge, setFAge] = useState("all");
  const [fWeight, setFWeight] = useState("all");
  const [fDistrict, setFDistrict] = useState("all");
  const [fReason, setFReason] = useState<"all" | Reason>("all");
  const [fQuery, setFQuery] = useState("");
  const [reinstating, setReinstating] = useState<string | null>(null);

  // A player entered in two categories has two registrations, so pick by registration.
  const keyOf = (p: RegisteredPlayer) => p.regId || p.id;

  const q = searchQuery.trim().toLowerCase();
  // Exact TNJA / temp ID first; otherwise a few name / ID matches to pick from
  const exactMatches = q ? players.filter((p) => p.tnjaId?.toLowerCase() === q || p.tempId?.toLowerCase() === q) : [];
  const exact = exactMatches.length === 1 ? exactMatches[0] : undefined;
  const suggestions = q.length >= 2 && !exact
    ? players.filter((p) => p.name.toLowerCase().includes(q) || p.tnjaId?.toLowerCase().includes(q) || p.tempId?.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const matchedPlayer = (pickedKey ? players.find((p) => keyOf(p) === pickedKey) : undefined) ?? exact;

  const resetFor = () => { setMessage(null); setConfirmAbsent(false); setCurrentWeight(""); setAbsentNote(""); };

  const handleCheck = () => {
    setMessage(null);
    if (!matchedPlayer) {
      setMessage({ text: "No player found with that TNJA ID.", type: "error" });
      return;
    }

    const weightVal = parseFloat(currentWeight);
    if (isNaN(weightVal)) {
      setMessage({ text: "Please enter a valid weight.", type: "error" });
      return;
    }

    // Check against the registered category limit: "-66" means at most 66, "+78" means over 78.
    const registeredWeightLabel = matchedPlayer.weightLabel || String(matchedPlayer.weight);
    const isPlus = registeredWeightLabel.startsWith("+");
    const numMatch = registeredWeightLabel.match(/(\d+)/);
    const limit = numMatch ? parseFloat(numMatch[1]) : matchedPlayer.weight;
    const isDisqualified = isPlus ? weightVal <= limit : weightVal > limit;

    if (isDisqualified) {
      setMessage({ text: `Weight Exceeded! Player registered for ${registeredWeightLabel}kg.`, type: "error" });
    } else {
      setMessage({ text: `Weight OK for ${registeredWeightLabel}kg category!`, type: "success" });
    }
  };

  const handleDisqualify = async (why: Reason) => {
    if (!matchedPlayer) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${matchedPlayer.regId}/disqualify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(why === "ABSENT" ? { reason: "ABSENT", note: absentNote.trim() || undefined } : { reason: "WEIGHT", currentWeight }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to disqualify");
      setConfirmAbsent(false);
      setMessage({ text: `${matchedPlayer.name}: ${data.message || (why === "ABSENT" ? "disqualified as absent" : "disqualified")}.`, type: "warning" });
      onSuccess();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to disqualify", type: "error" });
      onSuccess(); // reload anyway so the status shown matches the server
    } finally {
      setLoading(false);
    }
  };

  const handleReinstate = async (p: RegisteredPlayer) => {
    if (!p.regId) return;
    if (!window.confirm(`Reinstate ${p.name}? The disqualification is removed and they must be weighed in again.`)) return;
    setReinstating(p.regId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${p.regId}/reinstate`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not reinstate the player");
      onSuccess();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not reinstate the player");
    } finally {
      setReinstating(null);
    }
  };

  // ── Disqualified players list ──
  const disqualified = useMemo(() => players.filter((p) => p.status === "DISQUALIFIED"), [players]);

  const ageOptions = useMemo(
    () => [...new Set(disqualified.filter((p) => fGender === "all" || p.gender === fGender).map((p) => p.ageGroup))].sort((a, b) => ageSortVal(a) - ageSortVal(b)),
    [disqualified, fGender]
  );
  const weightOptions = useMemo(
    () => [...new Set(disqualified
      .filter((p) => (fGender === "all" || p.gender === fGender) && (fAge === "all" || p.ageGroup === fAge))
      .map(weightText))].sort((a, b) => weightSortVal(a) - weightSortVal(b)),
    [disqualified, fGender, fAge]
  );
  const districtOptions = useMemo(
    () => [...new Set(disqualified.map(districtOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [disqualified]
  );

  const listed = useMemo(() => {
    const fq = fQuery.trim().toLowerCase();
    return disqualified
      .filter((p) =>
        (fGender === "all" || p.gender === fGender) &&
        (fAge === "all" || p.ageGroup === fAge) &&
        (fWeight === "all" || weightText(p) === fWeight) &&
        (fDistrict === "all" || districtOf(p) === fDistrict) &&
        (fReason === "all" || reasonOf(p) === fReason) &&
        (!fq || p.name.toLowerCase().includes(fq) || p.tnjaId?.toLowerCase().includes(fq) || p.tempId?.toLowerCase().includes(fq))
      )
      .sort((a, b) =>
        ageSortVal(a.ageGroup) - ageSortVal(b.ageGroup) ||
        a.gender.localeCompare(b.gender) ||
        weightSortVal(weightText(a)) - weightSortVal(weightText(b)) ||
        a.name.localeCompare(b.name)
      );
  }, [disqualified, fGender, fAge, fWeight, fDistrict, fReason, fQuery]);

  const reasonCounts = useMemo(() => ({
    all: disqualified.length,
    WEIGHT: disqualified.filter((p) => reasonOf(p) === "WEIGHT").length,
    ABSENT: disqualified.filter((p) => reasonOf(p) === "ABSENT").length,
  }), [disqualified]);

  const anyFilter = fGender !== "all" || fAge !== "all" || fWeight !== "all" || fDistrict !== "all" || fReason !== "all" || !!fQuery;
  const clearFilters = () => { setFGender("all"); setFAge("all"); setFWeight("all"); setFDistrict("all"); setFReason("all"); setFQuery(""); };
  const selectCls = "h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-orange-100";

  const reasonBtn = (r: Reason, label: string, hint: string, Icon: typeof Scale) => (
    <button
      type="button"
      onClick={() => { setReason(r); resetFor(); }}
      title={hint}
      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
        reason === r
          ? r === "ABSENT" ? "border-red-300 bg-red-50 text-red-700 ring-2 ring-red-100" : "border-orange-300 bg-orange-50 text-orange-700 ring-2 ring-orange-100"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <Icon size={18} className="shrink-0" />
      <span>
        <span className="block text-sm font-black">{label}</span>
        <span className="block text-[11px] font-semibold opacity-75">{hint}</span>
      </span>
    </button>
  );

  return (
    <div className="space-y-6">
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800">Disqualify Player</h2>
        <p className="text-slate-500 font-medium">Choose the reason, search the player, then disqualify.</p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-bold text-slate-700 mb-2">Reason</p>
          <div className="flex flex-col sm:flex-row gap-2">
            {reasonBtn("WEIGHT", "Weight limit", "Over / under the weigh-in limit", Scale)}
            {reasonBtn("ABSENT", "Absent", "Did not report for the tournament", UserX)}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Search Player (TNJA ID or name)</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="e.g. TNJA-12345 or Harikrishna"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPickedKey(null); resetFor(); }}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all font-semibold"
            />
          </div>
          {!matchedPlayer && suggestions.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {suggestions.map((p) => (
                <button
                  key={keyOf(p)}
                  onClick={() => { setPickedKey(keyOf(p)); resetFor(); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-orange-50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800 truncate">{p.name}</span>
                    <span className="block text-[11px] font-semibold text-slate-400">{p.tnjaId || p.tempId} · {p.ageGroup} · {genderText(p.gender)} · {weightText(p)} kg</span>
                  </span>
                  {p.status === "DISQUALIFIED" && <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">DISQUALIFIED</span>}
                </button>
              ))}
            </div>
          )}
          {q.length >= 2 && !matchedPlayer && suggestions.length === 0 && (
            <p className="mt-2 text-xs font-semibold text-slate-400">No player found.</p>
          )}
        </div>

        {matchedPlayer && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-slate-50 border border-slate-200"
          >
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Name</p>
                <p className="font-black text-slate-800">{matchedPlayer.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Registered Category</p>
                <p className="font-black text-orange-600">{weightText(matchedPlayer)} kg ({matchedPlayer.ageGroup} · {genderText(matchedPlayer.gender)})</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">TNJA ID</p>
                <p className="font-bold text-slate-700">{matchedPlayer.tnjaId || matchedPlayer.tempId || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                <p className={`font-bold ${matchedPlayer.status === "DISQUALIFIED" ? "text-red-600" : "text-emerald-600"}`}>
                  {matchedPlayer.status}
                </p>
              </div>
            </div>

            {matchedPlayer.status !== "DISQUALIFIED" && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {reason === "WEIGHT" ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-slate-700">Actual Weigh-in Weight (kg)</label>
                    <div className="flex gap-3">
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 66.5"
                        value={currentWeight}
                        onChange={(e) => setCurrentWeight(e.target.value)}
                        className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 font-semibold"
                      />
                      <button
                        onClick={handleCheck}
                        disabled={!currentWeight}
                        className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        Check
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={absentNote}
                      onChange={(e) => setAbsentNote(e.target.value)}
                      placeholder="Note (optional), e.g. Not present at weigh-in / roll call"
                      maxLength={300}
                      className="w-full h-16 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 text-sm font-medium resize-none"
                    />
                    {!confirmAbsent ? (
                      <button
                        onClick={() => setConfirmAbsent(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 transition-colors"
                      >
                        <UserX size={17} /> Disqualify as Absent
                      </button>
                    ) : (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3">
                        <p className="text-sm font-bold text-red-700">
                          Disqualify {matchedPlayer.name} as absent? This applies to every category they entered in this tournament, and they earn no points.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDisqualify("ABSENT")}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                          >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Yes, disqualify
                          </button>
                          <button
                            onClick={() => setConfirmAbsent(false)}
                            disabled={loading}
                            className="px-4 py-2 border border-slate-200 bg-white text-slate-600 font-bold rounded-lg hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={`p-4 rounded-xl text-sm font-bold flex items-start gap-3 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : message.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-orange-50 text-orange-700 border border-orange-200"
              }`}
            >
              {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p>{message.text}</p>
                {message.type === "error" && reason === "WEIGHT" && matchedPlayer && matchedPlayer.status !== "DISQUALIFIED" && message.text.startsWith("Weight Exceeded") && (
                  <button
                    onClick={() => handleDisqualify("WEIGHT")}
                    disabled={loading}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    Confirm Disqualification
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

    {/* ══ Disqualified players ══ */}
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Ban size={19} /></div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Disqualified players</h3>
            <p className="text-sm text-slate-500 font-medium">
              {reasonCounts.all} total · {reasonCounts.WEIGHT} weight · {reasonCounts.ABSENT} absent
            </p>
          </div>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {([["all", "All"], ["WEIGHT", "Weight"], ["ABSENT", "Absent"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFReason(k)}
              className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${fReason === k ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {label} <span className="ml-0.5 text-slate-400">{reasonCounts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 px-6 pb-4">
        <select value={fGender} onChange={(e) => { setFGender(e.target.value); setFAge("all"); setFWeight("all"); }} aria-label="Gender" className={selectCls}>
          <option value="all">All genders</option>
          <option value="MALE">Boys</option>
          <option value="FEMALE">Girls</option>
        </select>
        <select value={fAge} onChange={(e) => { setFAge(e.target.value); setFWeight("all"); }} aria-label="Age group" className={selectCls}>
          <option value="all">All age groups</option>
          {ageOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={fWeight} onChange={(e) => setFWeight(e.target.value)} aria-label="Weight category" className={selectCls}>
          <option value="all">All weights</option>
          {weightOptions.map((w) => <option key={w} value={w}>{w} kg</option>)}
        </select>
        <select value={fDistrict} onChange={(e) => setFDistrict(e.target.value)} aria-label="District" className={selectCls}>
          <option value="all">All districts</option>
          {districtOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <label className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={fQuery}
            onChange={(e) => setFQuery(e.target.value)}
            placeholder="Name or TNJA ID"
            className={`${selectCls} w-full pl-9`}
          />
        </label>
      </div>
      {anyFilter && (
        <div className="px-6 -mt-2 pb-3 flex items-center gap-3 text-xs font-semibold text-slate-500">
          Showing {listed.length} of {disqualified.length}
          <button type="button" onClick={clearFilters} className="font-bold text-[#FF7400] hover:underline">Clear filters</button>
        </div>
      )}

      <div className="px-6 pb-6">
        {listed.length === 0 ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-400 rounded-xl border border-dashed border-slate-200">
            {disqualified.length === 0 ? "No players have been disqualified." : "No disqualified players match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">District</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {listed.map((p) => {
                  const r = reasonOf(p);
                  return (
                    <tr key={keyOf(p)} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 min-w-[180px]">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400 font-semibold">{p.tnjaId || p.tempId || "—"}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                        {p.ageGroup} · {genderText(p.gender)} · <span className="font-bold text-slate-800">{weightText(p)} kg</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{districtOf(p) || "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r === "ABSENT" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold bg-red-50 text-red-700 border-red-200">
                            <UserX size={12} /> Absent
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold bg-orange-50 text-orange-700 border-orange-200">
                            <Scale size={12} /> Weight · {p.weighInWeight} kg
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleReinstate(p)}
                          disabled={reinstating === p.regId}
                          title="Remove the disqualification; the player must be weighed in again"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {reinstating === p.regId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reinstate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
