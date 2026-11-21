"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import type { DrawCategory } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

/**
 * Reset a started category (organiser only): stops it and clears its draw and all its results so
 * it can be drawn and started again. Asks for a reason and a typed confirmation.
 */
export function ResetCategoryModal({ tournamentId, token, draw, title, onClose, onDone }: {
  tournamentId: string; token: string | null; draw: DrawCategory; title: string;
  onClose: () => void; onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const played = draw.rounds.flat().filter((m) => m.status === "IN_PROGRESS" || (m.status === "COMPLETED" && !m.slotA.isBye && !m.slotB.isBye)).length;
  const ok = reason.trim().length >= 5 && typed.trim().toUpperCase() === "RESET";

  const reset = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws/reset`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ageGroup: draw.ageGroup, exactAge: draw.exactAge ?? 0, gender: draw.gender, weightCategory: draw.weightCategory, reason: reason.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not reset the category");
      onDone(data?.message || "Category reset");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset the category");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-1.5 bg-gradient-to-r from-red-500 to-rose-600" />
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><AlertTriangle size={20} /></div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800">Reset this category?</h3>
            <p className="text-xs font-semibold text-slate-400 truncate">{title}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 pb-4 space-y-4">
          <ul className="text-sm text-slate-600 space-y-1.5 bg-red-50/60 border border-red-100 rounded-xl px-4 py-3">
            <li>• The category stops (back to <b>Not started</b>).</li>
            <li>• The draw is cleared{played > 0 && <> and <b className="text-red-700">{played} played match{played === 1 ? "" : "es"}</b> with their results are deleted</>}.</li>
            <li>• Then make the draw again and press <b>Start</b>. Mat and timing are kept.</li>
          </ul>

          <div>
            <label className="block text-xs font-black tracking-wider text-slate-500 mb-1.5">REASON</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong players in the draw, redraw needed"
              maxLength={300}
              className="w-full h-16 px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium outline-none focus:border-red-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-black tracking-wider text-slate-500 mb-1.5">TYPE <span className="text-red-600">RESET</span> TO CONFIRM</label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="RESET"
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-black tracking-widest outline-none focus:border-red-400"
            />
          </div>
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <button onClick={onClose} className="ml-auto h-10 px-4 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button onClick={reset} disabled={!ok || saving}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-black text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />} Reset category
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
