"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Minus, Plus, Shuffle, Swords, Users, X } from "lucide-react";
import type { RegisteredPlayer } from "../types";
import { drawSetupFor } from "../lib/bracketEngine";

export interface DrawSetupChoice {
  /** Players who go straight to round 2, or null to pick them at random. */
  byeIds: string[] | null;
  /** First-round fights chosen by the organiser (byes = players − 2 × fights). */
  fights: number;
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
  const [fights, setFights] = useState(() => drawSetupFor(players.length).minFights);
  const setup = drawSetupFor(players.length, fights);
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

  const changeFights = (next: number) => {
    const s = drawSetupFor(players.length, next);
    setFights(s.firstRoundFights);
    setError("");
    setPicked((prev) => (prev.size > s.byes ? new Set([...prev].slice(0, s.byes)) : prev));
  };

  const confirm = () => {
    if (mode === "choose" && setup.byes > 0 && picked.size !== setup.byes) {
      setError(`Choose exactly ${setup.byes} player${setup.byes === 1 ? "" : "s"} for the byes (${picked.size} chosen).`);
      return;
    }
    onConfirm({ byeIds: mode === "choose" && setup.byes > 0 ? [...picked] : null, fights: setup.firstRoundFights });
  };

  const stat = (icon: React.ReactNode, value: number | string, label: string, step?: { down: () => void; up: () => void; canDown: boolean; canUp: boolean }) => (
    <div className={`flex-1 min-w-[130px] rounded-xl border px-4 py-3 ${step ? "border-orange-200 bg-orange-50/40" : "border-slate-200 bg-slate-50/60"}`}>
      <div className="flex items-center gap-1.5 text-slate-400">{icon}<span className="text-[11px] font-bold uppercase tracking-wide">{label}</span></div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-2xl font-black text-slate-800">{value}</p>
        {step && (
          <span className="flex items-center gap-1">
            <button type="button" onClick={step.down} disabled={!step.canDown} aria-label={`Fewer ${label.toLowerCase()}`} className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-600"><Minus size={13} /></button>
            <button type="button" onClick={step.up} disabled={!step.canUp} aria-label={`More ${label.toLowerCase()}`} className="w-7 h-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-600"><Plus size={13} /></button>
          </span>
        )}
      </div>
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
            {stat(<Swords size={13} />, setup.firstRoundFights, "1st-round fights", {
              down: () => changeFights(setup.firstRoundFights - 1), up: () => changeFights(setup.firstRoundFights + 1),
              canDown: setup.firstRoundFights > setup.minFights, canUp: setup.firstRoundFights < setup.maxFights,
            })}
            {stat(<Shuffle size={13} />, setup.byes, "Byes", {
              // Each bye fewer pairs two more players into a fight, so byes move in steps of 2.
              down: () => changeFights(setup.firstRoundFights + 1), up: () => changeFights(setup.firstRoundFights - 1),
              canDown: setup.firstRoundFights < setup.maxFights, canUp: setup.firstRoundFights > setup.minFights,
            })}
          </div>
          <p className="text-xs text-slate-500 -mt-2">
            {setup.size}-place bracket. {setup.byes > 0
              ? `${setup.byes} player${setup.byes === 1 ? " goes" : "s go"} straight to round 2; ${setup.firstRoundFights * 2} player${setup.firstRoundFights === 1 ? "" : "s"} fight in round 1.`
              : "No byes — every player fights in round 1."}
            {setup.empties > 0 && ` With ${setup.firstRoundFights} fights, round 2 is uneven: ${setup.empties === 1 ? "one player goes" : `${setup.empties} players go`} through it without an opponent.`}
            {setup.minFights < setup.maxFights && " Use − / + to change the fights and byes."}
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
