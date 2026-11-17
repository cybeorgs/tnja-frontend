"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Shuffle, Swords, Users, X } from "lucide-react";
import type { RegisteredPlayer } from "../types";
import { drawSetupFor } from "../lib/bracketEngine";

export interface DrawSetupChoice {
  /** Players who go straight to round 2, or null to pick them at random. */
  byeIds: string[] | null;
}

/**
 * Asked before an elimination draw is made: shows how many first-round fights and byes the
 * category needs, and lets the organiser choose who gets the byes (or leave it to the draw).
 */
export function DrawSetupModal({
  title,
  formatLabel,
  players,
  isRedraw,
  onCancel,
  onConfirm,
}: {
  title: string;
  formatLabel: string;
  players: RegisteredPlayer[];
  isRedraw: boolean;
  onCancel: () => void;
  onConfirm: (choice: DrawSetupChoice) => void;
}) {
  const setup = drawSetupFor(players.length);
  const [mode, setMode] = useState<"auto" | "choose">("auto");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const toggle = (id: string) => {
    setError("");
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < setup.byes) next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (mode === "choose" && setup.byes > 0 && picked.size !== setup.byes) {
      setError(`Choose exactly ${setup.byes} player${setup.byes === 1 ? "" : "s"} for the byes (${picked.size} chosen).`);
      return;
    }
    onConfirm({ byeIds: mode === "choose" && setup.byes > 0 ? [...picked] : null });
  };

  const stat = (icon: React.ReactNode, value: number | string, label: string) => (
    <div className="flex-1 min-w-[110px] rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
      <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-[11px] font-bold uppercase tracking-wide">{label}</span></div>
      <p className="mt-1 text-2xl font-black text-slate-800">{value}</p>
    </div>
  );

  return createPortal(
    <div className="tnja-dashboard fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-labelledby="draw-setup-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="draw-setup-title" className="text-lg font-black text-slate-800">{isRedraw ? "Redraw" : "Draw setup"}</h3>
            <p className="text-xs font-semibold text-slate-500 truncate">{title} · {formatLabel}</p>
          </div>
          <button onClick={onCancel} aria-label="Close" className="p-2 -m-1 hover:bg-slate-100 rounded-lg"><X size={18} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex flex-wrap gap-3">
            {stat(<Users size={13} />, players.length, "Players")}
            {stat(<Swords size={13} />, setup.firstRoundFights, "1st-round fights")}
            {stat(<Shuffle size={13} />, setup.byes, "Byes")}
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            {setup.size}-place bracket. {setup.byes > 0
              ? `${setup.byes} player${setup.byes === 1 ? " goes" : "s go"} straight to round 2; ${setup.firstRoundFights * 2} player${setup.firstRoundFights === 1 ? "" : "s"} fight in round 1.`
              : "No byes — every player fights in round 1."}
          </p>

          {setup.byes > 0 && (
            <div>
              <p className="text-sm font-black text-slate-800 mb-2">Who gets the byes?</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {(["auto", "choose"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(""); }}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${mode === m ? "border-[#FF7400] bg-orange-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <p className={`text-sm font-bold ${mode === m ? "text-[#FF7400]" : "text-slate-700"}`}>{m === "auto" ? "Automatic" : "I'll choose"}</p>
                    <p className="text-[11px] text-slate-500">{m === "auto" ? "Picked at random in the draw" : `Tick ${setup.byes} player${setup.byes === 1 ? "" : "s"} below`}</p>
                  </button>
                ))}
              </div>

              {mode === "choose" && (
                <>
                  <p className="text-xs font-semibold text-slate-500 mb-2">{picked.size} of {setup.byes} chosen</p>
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    {players.map((p) => {
                      const on = picked.has(p.id);
                      const full = !on && picked.size >= setup.byes;
                      return (
                        <label key={p.id} className={`flex items-center gap-3 px-3 py-2 ${full ? "opacity-50" : "cursor-pointer hover:bg-orange-50/40"}`}>
                          <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(p.id)} className="w-4 h-4 accent-[#FF7400]" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-slate-800 truncate">{p.name}</span>
                            <span className="block text-xs text-slate-500 truncate">{p.club || p.district}</span>
                          </span>
                          {on && <span className="text-[11px] font-black text-[#FF7400]">BYE</span>}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Everyone else is drawn at random, keeping players from the same club apart in round 1 where possible. You can still adjust the draw by hand before pressing Start.
          </p>
          {isRedraw && (
            <p className="flex items-center gap-2 text-xs font-semibold text-amber-700"><AlertCircle size={14} /> This replaces the current draw for this category.</p>
          )}
          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"><AlertCircle size={15} /> {error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onCancel} className="h-10 px-5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100">Cancel</button>
          <button onClick={confirm} className="h-10 inline-flex items-center gap-2 px-5 rounded-xl text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600">
            <Shuffle size={15} /> {isRedraw ? "Redraw" : "Generate draw"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
