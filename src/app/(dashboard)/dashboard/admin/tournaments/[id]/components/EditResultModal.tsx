"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Loader2, Pencil, Trophy, X } from "lucide-react";
import type { BracketMatch } from "../types";
import { changeMatchResult } from "../lib/bracketEngine";

const METHODS = [
  "Ippon", "Waza-ari", "Yuko", "Decision (Hantei)", "Golden Score (Waza-ari)", "Golden Score (Decision)",
  "Hansoku-make (3× Shido)", "Hansoku-make (Direct)", "Fusen-gachi (No show)", "Kiken-gachi (Withdrawal)", "Result corrected",
];

/**
 * Organiser correction of a finished match from the draw sheet: pick the right winner and method.
 * The new winner takes the old winner's place further on; later matches that depended on the old
 * result are listed and go back to "to be played" with their new fighters.
 */
export function EditResultModal({ match, rounds, title, onClose, onSave }: {
  match: BracketMatch; rounds: BracketMatch[][]; title: string;
  onClose: () => void; onSave: (rounds: BracketMatch[][]) => Promise<void>;
}) {
  const [winnerId, setWinnerId] = useState<string>(match.winnerId ?? "");
  const [method, setMethod] = useState(match.winMethod && METHODS.includes(match.winMethod) ? match.winMethod : "Result corrected");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const changedWinner = !!winnerId && winnerId !== match.winnerId;
  const changed = changedWinner || method !== (match.winMethod ?? "");
  const preview = useMemo(
    () => (winnerId ? changeMatchResult(rounds, match.matchId, winnerId, method) : null),
    [rounds, match.matchId, winnerId, method]
  );

  const save = async () => {
    if (!preview) return;
    setSaving(true); setError("");
    try {
      await onSave(preview.rounds);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the result");
    } finally {
      setSaving(false);
    }
  };

  const side = (s: BracketMatch["slotA"], label: string) => {
    const on = !!s.playerId && winnerId === s.playerId;
    const wasWinner = s.playerId === match.winnerId;
    return (
      <button
        type="button"
        disabled={!s.playerId}
        onClick={() => s.playerId && setWinnerId(s.playerId)}
        className={`flex-1 min-w-0 text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
          on ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300 bg-white"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black tracking-wider text-slate-400">{label}</span>
          {on ? <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700"><Trophy size={11} /> WINNER</span>
            : wasWinner ? <span className="text-[10px] font-bold text-slate-400">was winner</span> : null}
        </div>
        <p className="font-black text-slate-800 truncate">{s.playerName}</p>
        <p className="text-[11px] font-semibold text-slate-400 truncate">{s.club || "---"}</p>
      </button>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-[#FF7400] to-amber-400" />
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7400] flex items-center justify-center shrink-0"><Pencil size={18} /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800">Edit match result</h3>
            <p className="text-xs font-semibold text-slate-400 truncate">{title} · Match #{match.matchNumber}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 pb-4 space-y-4">
          <div>
            <label className="block text-xs font-black tracking-wider text-slate-500 mb-1.5">WINNER</label>
            <div className="flex gap-2">
              {side(match.slotA, "WHITE")}
              {side(match.slotB, "BLUE")}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black tracking-wider text-slate-500 mb-1.5">WIN METHOD</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-semibold outline-none focus:border-[#FF7400] bg-white"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {changedWinner && preview && (
            preview.reset.length > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="flex items-center gap-1.5 text-sm font-black text-amber-800">
                  <AlertTriangle size={15} /> {preview.reset.length} later match{preview.reset.length === 1 ? "" : "es"} will be reset
                </p>
                <p className="text-xs text-amber-700 mt-0.5 mb-2">They were decided with the old winner. They go back to <b>to be played</b> with the new fighters.</p>
                <ul className="text-xs font-semibold text-slate-700 space-y-0.5 max-h-32 overflow-y-auto">
                  {preview.reset.map((m) => (
                    <li key={m.matchId}>• #{m.matchNumber}: {m.slotA.playerName} v {m.slotB.playerName}{m.status === "IN_PROGRESS" ? " (in progress)" : ""}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5">
                No later match has been played with the old winner: the new winner simply moves on.
              </p>
            )
          )}
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose} className="ml-auto h-10 px-4 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={!changed || !preview || saving}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save result
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
