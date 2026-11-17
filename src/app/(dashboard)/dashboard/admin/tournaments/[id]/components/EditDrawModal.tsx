"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, Pencil, Save, X } from "lucide-react";
import type { BracketMatch, RegisteredPlayer } from "../types";
import { mainBracketRoundCount } from "../lib/bracketEngine";

/** First-round places: match 1 A, match 1 B, match 2 A, … (player id, or null for a BYE) */
type Slots = (string | null)[];

/** The current first-round places of a straight-elimination bracket. */
export const slotsFromRounds = (rounds: BracketMatch[][]): Slots =>
  (rounds[0] ?? []).flatMap((m) => [m.slotA.isBye ? null : m.slotA.playerId, m.slotB.isBye ? null : m.slotB.playerId]);

/** True for an elimination bracket (straight or repechage) that hasn't been played yet (can be edited). */
export function canEditBracket(rounds: BracketMatch[][]): boolean {
  const first = rounds[0] ?? [];
  if (!first.length || first[0]!.matchId.startsWith("rr_")) return false;
  const size = first.length * 2;
  // Repechage formats add a repechage + bronze round after the main bracket; those are rebuilt on save.
  if (mainBracketRoundCount(rounds) !== Math.log2(size)) return false;
  return !rounds.some((r) => r.some((m) => m.status === "IN_PROGRESS" || (m.status === "COMPLETED" && !m.slotA.isBye && !m.slotB.isBye)));
}

/**
 * Edit who fights whom in the first round of a straight-elimination draw, BYEs included. Picking a
 * player who is already placed swaps the two. Only before the category is started.
 */
export function EditDrawModal({
  title,
  players,
  rounds,
  onClose,
  onSave,
}: {
  title: string;
  players: RegisteredPlayer[];
  rounds: BracketMatch[][];
  onClose: () => void;
  onSave: (slots: Slots) => Promise<void>;
}) {
  const [slots, setSlots] = useState<Slots>(() => slotsFromRounds(rounds));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byId = new Map(players.map((p) => [p.id, p]));
  const byes = slots.filter((s) => s === null).length;
  const matchOf = (id: string) => Math.floor(slots.indexOf(id) / 2) + 1;
  const doubleBye = Array.from({ length: slots.length / 2 }, (_, m) => m).find((m) => slots[m * 2] === null && slots[m * 2 + 1] === null);
  const missing = players.filter((p) => !slots.includes(p.id));

  // Put `id` (a player, or null for a BYE) at place i; whoever was there moves to where `id` was.
  const place = (i: number, id: string | null) => {
    const next = [...slots];
    const from = id === null ? -1 : next.indexOf(id);
    if (from >= 0) next[from] = next[i]!;
    else if (id === null) {
      const bye = next.findIndex((x, j) => x === null && j !== i);
      if (bye < 0) return;
      next[bye] = next[i]!;
    }
    next[i] = id;
    setSlots(next);
  };

  const save = async () => {
    if (doubleBye !== undefined) return setError(`Match ${doubleBye + 1} has two BYEs. Every first-round match needs at least one player.`);
    if (missing.length) return setError(`${missing.map((p) => p.name).join(", ")} ${missing.length === 1 ? "is" : "are"} not in the draw.`);
    setSaving(true);
    setError("");
    try {
      await onSave(slots);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the draw");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="tnja-dashboard fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="edit-draw-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-orange-100 text-[#FF7400] rounded-xl"><Pencil size={18} /></div>
            <div className="min-w-0">
              <h3 id="edit-draw-title" className="text-lg font-black text-slate-800">Edit draw</h3>
              <p className="text-xs font-semibold text-slate-500 truncate">{title} · {players.length} players · {slots.length / 2} first-round matches{byes ? ` · ${byes} BYE${byes === 1 ? "" : "s"}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} className="text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500">
            Choose who fights whom in each first-round match. Picking a player who is already placed swaps the two.
            {byes > 0 && " To give a player a BYE, choose BYE for their opponent's spot — that opponent moves into the BYE's old place. A player drawn against a BYE goes straight to the next round."}
          </p>
          {error && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: slots.length / 2 }, (_, m) => {
              const pair = [slots[m * 2]!, slots[m * 2 + 1]!] as const;
              const bad = pair[0] === null && pair[1] === null;
              const sameClub = pair[0] && pair[1] && byId.get(pair[0])?.club && byId.get(pair[0])?.club === byId.get(pair[1])?.club;
              return (
                <div key={m} className={`rounded-xl border bg-white p-2.5 ${bad ? "border-red-300" : "border-slate-200"}`}>
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-400">Match {m + 1}</p>
                  {pair.map((id, side) => (
                    <div key={side} className="flex items-center gap-2 py-0.5">
                      <span className={`w-4 shrink-0 text-center text-[11px] font-black ${side === 0 ? "text-slate-500" : "text-blue-600"}`}>{side === 0 ? "A" : "B"}</span>
                      <select
                        value={id ?? ""}
                        onChange={(e) => place(m * 2 + side, e.target.value || null)}
                        aria-label={`Match ${m + 1} player ${side === 0 ? "A" : "B"}`}
                        className={`w-full px-2.5 py-1.5 rounded-lg border text-sm font-semibold focus:outline-none focus:border-[#FF7400] ${id === null ? "border-dashed border-slate-300 text-slate-400 bg-slate-50" : "border-slate-200 text-slate-800 bg-white"}`}
                      >
                        {byes > 0 && <option value="">BYE</option>}
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.club ? ` · ${p.club}` : ""}{p.id !== id && slots.includes(p.id) ? ` (match ${matchOf(p.id)})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {sameClub && <p className="mt-1 text-[11px] font-bold text-amber-700">Same club</p>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save draw
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
