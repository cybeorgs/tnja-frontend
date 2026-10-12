"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";
import type { RegisteredPlayer } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

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
  const [currentWeight, setCurrentWeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  const matchedPlayer = players.find(
    (p) =>
      p.tnjaId?.toLowerCase() === searchQuery.toLowerCase() ||
      p.tempId?.toLowerCase() === searchQuery.toLowerCase()
  );

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

    // Logic: check against registered category limits.
    // e.g., if registered for "-66", weightVal must be <= 66.
    // if registered for "+78", weightVal must be > 78.
    const registeredWeightLabel = matchedPlayer.weightLabel || String(matchedPlayer.weight);
    
    // Parse weight label
    const isPlus = registeredWeightLabel.startsWith("+");
    const numMatch = registeredWeightLabel.match(/(\d+)/);
    const limit = numMatch ? parseFloat(numMatch[1]) : matchedPlayer.weight;

    let isDisqualified = false;
    
    if (isPlus) {
      if (weightVal <= limit) isDisqualified = true;
    } else {
      if (weightVal > limit) isDisqualified = true;
    }

    if (isDisqualified) {
      setMessage({ text: `Weight Exceeded! Player registered for ${registeredWeightLabel}kg.`, type: "error" });
    } else {
      setMessage({ text: `Weight OK for ${registeredWeightLabel}kg category!`, type: "success" });
    }
  };

  const handleDisqualify = async () => {
    if (!matchedPlayer) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${matchedPlayer.regId}/disqualify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentWeight })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to disqualify");
      }
      setMessage({ text: "Player successfully disqualified.", type: "warning" });
      onSuccess();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800">Disqualify Player</h2>
        <p className="text-slate-500 font-medium">Search by TNJA ID to verify weigh-in limits.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Search Player (TNJA ID)</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="e.g. TNJA-12345"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all font-semibold"
            />
          </div>
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
                <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                <p className={`font-bold ${matchedPlayer.status === "DISQUALIFIED" ? "text-red-600" : "text-emerald-600"}`}>
                  {matchedPlayer.status}
                </p>
              </div>
            </div>

            {matchedPlayer.status !== "DISQUALIFIED" && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
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
                {message.type === "error" && matchedPlayer && matchedPlayer.status !== "DISQUALIFIED" && (
                  <button
                    onClick={handleDisqualify}
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
