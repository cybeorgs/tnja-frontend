"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, Check, CheckCheck, Loader2, Scale, X } from "lucide-react";
import type { RegisteredPlayer } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const regWeight = (p: RegisteredPlayer) => {
  const n = parseFloat(String(p.rawWeight ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? String(n) : "";
};

/**
 * Weigh-in for the players of one category who haven't been weighed yet, right where the draw is
 * made (no trip to the Weigh-In tab). Confirm each at the scale weight, or all at their registered
 * weight; a weight that belongs to another class can move the player there.
 * Reports the category's players back with the result (cleared = PASSED, moved = removed).
 */
export function PendingWeighIn({ tournamentId, players, onPlayersChange, onChanged }: {
  tournamentId: string;
  players: RegisteredPlayer[];
  onPlayersChange: (players: RegisteredPlayer[]) => void;
  /** Something was saved: refresh the page's registrations. */
  onChanged?: () => void;
}) {
  const pending = players.filter((p) => p.weighInStatus !== "PASSED");
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, { msg: string; canMove: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);

  if (pending.length === 0) return null;
  const weightOf = (p: RegisteredPlayer) => weights[p.id] ?? regWeight(p);

  /** Returns the players after this weigh-in (or null if it failed). */
  const send = async (list: RegisteredPlayer[], p: RegisteredPlayer, action: "CONFIRM" | "MOVE"): Promise<RegisteredPlayer[] | null> => {
    const weight = weightOf(p);
    if (!p.regId) return null;
    if (!weight) { setErrors((e) => ({ ...e, [p.id]: { msg: "Enter the scale weight", canMove: false } })); return null; }
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${p.regId}/weigh-in`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ actualWeight: weight, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = String(data.error || "Weigh-in failed");
        setErrors((e) => ({ ...e, [p.id]: { msg, canMove: action === "CONFIRM" && /not the registered/i.test(msg) } }));
        return null;
      }
      setErrors((e) => { const n = { ...e }; delete n[p.id]; return n; });
      return action === "MOVE"
        ? list.filter((x) => x.id !== p.id) // now in another weight class: not part of this draw
        : list.map((x) => (x.id === p.id ? { ...x, weighInStatus: "PASSED", weighInWeight: weight } : x));
    } catch {
      setErrors((e) => ({ ...e, [p.id]: { msg: "Network error, try again", canMove: false } }));
      return null;
    }
  };

  const one = async (p: RegisteredPlayer, action: "CONFIRM" | "MOVE") => {
    setBusy(p.id);
    const next = await send(players, p, action);
    setBusy(null);
    if (next) { onPlayersChange(next); onChanged?.(); }
  };

  const all = async () => {
    setBulk(true);
    let list = players;
    for (const p of pending) {
      if (!weightOf(p)) continue;
      setBusy(p.id);
      list = (await send(list, p, "CONFIRM")) ?? list;
    }
    setBusy(null); setBulk(false);
    onPlayersChange(list); onChanged?.();
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-amber-200/70">
        <p className="flex items-center gap-1.5 text-sm font-black text-amber-800">
          <Scale size={15} /> {pending.length} of {players.length} not weighed in yet
        </p>
        <button
          type="button"
          onClick={all}
          disabled={bulk || !!busy}
          title="Confirm every player below at the weight in the box (their registered weight unless you changed it)"
          className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          {bulk ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Confirm all
        </button>
      </div>
      <p className="px-4 pt-2 text-[11px] text-amber-700">Weigh them in here: check the scale weight and confirm. The draw can be made once everyone is cleared.</p>
      <div className="divide-y divide-amber-100 max-h-60 overflow-y-auto">
        {pending.map((p) => {
          const err = errors[p.id];
          const isBusy = busy === p.id;
          return (
            <div key={p.id} className="px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800 truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {p.club || p.district}{regWeight(p) ? ` · registered ${regWeight(p)} kg` : ""}
                  </span>
                </span>
                <div className="relative">
                  <input
                    value={weightOf(p)}
                    onChange={(e) => { setWeights((w) => ({ ...w, [p.id]: e.target.value })); setErrors((x) => { const n = { ...x }; delete n[p.id]; return n; }); }}
                    onKeyDown={(e) => { if (e.key === "Enter") one(p, "CONFIRM"); }}
                    inputMode="decimal"
                    placeholder="kg"
                    aria-label={`Scale weight of ${p.name}`}
                    className="w-20 h-8 pl-2 pr-7 text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:border-[#FF7400]"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">kg</span>
                </div>
                <button
                  type="button"
                  onClick={() => one(p, "CONFIRM")}
                  disabled={isBusy || bulk}
                  title="Weight fits this class: clear the player to play"
                  className="h-8 inline-flex items-center gap-1 px-2.5 rounded-lg text-xs font-black text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                >
                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Confirm
                </button>
              </div>
              {err && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-red-600">
                  <AlertCircle size={12} /> <span className="min-w-0 flex-1">{err.msg}</span>
                  {err.canMove && (
                    <button
                      type="button"
                      onClick={() => one(p, "MOVE")}
                      disabled={isBusy || bulk}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-black text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Move to that class <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Stand-alone version, shown when a draw is asked for (round robin / small category) while some
 * players still need weigh-in. "Make the draw" continues as soon as everyone is cleared.
 */
export function WeighInGateModal({ tournamentId, title, players, onClose, onChanged, onReady }: {
  tournamentId: string; title: string; players: RegisteredPlayer[];
  onClose: () => void; onChanged?: () => void; onReady: (players: RegisteredPlayer[]) => void;
}) {
  const [list, setList] = useState(players);
  const done = list.length > 0 && list.every((p) => p.weighInStatus === "PASSED");
  return createPortal(
    <div className="tnja-dashboard fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800">Weigh-in before the draw</h3>
            <p className="text-xs font-semibold text-slate-500 truncate">{title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 -m-1 hover:bg-slate-100 rounded-lg"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="px-6 py-5">
          {done
            ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700"><Check size={16} /> All {list.length} players are weighed in.</p>
            : list.length === 0
              ? <p className="text-sm font-semibold text-slate-500">No players left in this category.</p>
              : <PendingWeighIn tournamentId={tournamentId} players={list} onPlayersChange={setList} onChanged={onChanged} />}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100">Cancel</button>
          <button onClick={() => onReady(list)} disabled={!done}
            className="h-10 px-5 rounded-xl text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
            Make the draw
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
