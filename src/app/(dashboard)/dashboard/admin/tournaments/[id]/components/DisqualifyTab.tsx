"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, AlertCircle, Loader2, XCircle, Scale, UserX } from "lucide-react";
import type { RegisteredPlayer } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Reason = "WEIGHT" | "ABSENT";

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
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason>("WEIGHT");
  const [currentWeight, setCurrentWeight] = useState("");
  const [absentNote, setAbsentNote] = useState("");
  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  const q = searchQuery.trim().toLowerCase();
  // Exact TNJA / temp ID first; otherwise a few name / ID matches to pick from
  const exact = q ? players.find((p) => p.tnjaId?.toLowerCase() === q || p.tempId?.toLowerCase() === q) : undefined;
  const suggestions = q.length >= 2 && !exact
    ? players.filter((p) => p.name.toLowerCase().includes(q) || p.tnjaId?.toLowerCase().includes(q) || p.tempId?.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const matchedPlayer = (pickedId ? players.find((p) => p.id === pickedId) : undefined) ?? exact;

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
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to disqualify");
      }
      setConfirmAbsent(false);
      setMessage({ text: why === "ABSENT" ? `${matchedPlayer.name} disqualified as absent.` : "Player successfully disqualified.", type: "warning" });
      onSuccess();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to disqualify", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const reasonBtn = (r: Reason, label: string, hint: string, Icon: typeof Scale) => (
    <button
      type="button"
      onClick={() => { setReason(r); resetFor(); }}
      title={hint}
      className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
        reason === r
          ? r === "ABSENT" ? "border-red-300 bg-red-50 text-red-700" : "border-orange-300 bg-orange-50 text-orange-700"
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
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800">Disqualify Player</h2>
        <p className="text-slate-500 font-medium">Search a player, then disqualify for the weigh-in limit or as absent.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Search Player (TNJA ID or name)</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="e.g. TNJA-12345 or Harikrishna"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPickedId(null); resetFor(); }}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all font-semibold"
            />
          </div>
          {!matchedPlayer && suggestions.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {suggestions.map((p) => (
                <button
                  key={p.regId || p.id}
                  onClick={() => { setPickedId(p.id); resetFor(); }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-orange-50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800 truncate">{p.name}</span>
                    <span className="block text-[11px] font-semibold text-slate-400">{p.tnjaId || p.tempId} · {p.ageGroup} · {p.weightLabel || `${p.weight} kg`}</span>
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
                <p className="font-black text-orange-600">{matchedPlayer.weightLabel || `${matchedPlayer.weight} kg`} ({matchedPlayer.ageGroup})</p>
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
                <div>
                  <p className="text-sm font-bold text-slate-700 mb-2">Reason</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {reasonBtn("WEIGHT", "Weight limit", "Check the weigh-in weight", Scale)}
                    {reasonBtn("ABSENT", "Absent", "Did not report for the tournament", UserX)}
                  </div>
                </div>

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
                          Disqualify {matchedPlayer.name} as absent? They will be removed from the category and earn no points. This can&apos;t be undone here.
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
  );
}
