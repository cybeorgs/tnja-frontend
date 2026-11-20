"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Lock, Save, X } from "lucide-react";
import type { BracketMatch, BracketSlot, RegisteredPlayer } from "../types";
import { isPlayedMatch } from "./RoundRobinEditModal";

type Side = "slotA" | "slotB";

/**
 * Correct a live elimination draw: change the players of first-round matches that haven't been
 * played. Played or running matches and BYEs stay locked; later rounds fill from results as usual.
 * Picking a player already placed in another open slot swaps the two.
 */
export function CorrectBracketModal({
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
  onSave: (rounds: BracketMatch[][]) => Promise<void>;
}) {
  const first = rounds[0] ?? [];
  const editable = (m: BracketMatch) => !isPlayedMatch(m) && m.status === "PENDING" && !m.slotA.isBye && !m.slotB.isBye;
  const [ids, setIds] = useState<Record<string, { slotA: string; slotB: string }>>(() =>
    Object.fromEntries(first.map((m) => [m.matchId, { slotA: m.slotA.playerId || "", slotB: m.slotB.playerId || "" }])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const byId = new Map(players.map((p) => [p.id, p]));
  const name = (id: string | null | undefined) => (id ? byId.get(id)?.name ?? "—" : "BYE");

  const pick = (matchId: string, side: Side, id: string) => {
    setIds((cur) => {
      const next = Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, { ...v }]));
      const old = next[matchId][side];
      // already in another open slot → swap
      for (const m of first) {
        if (!editable(m)) continue;
        for (const s of ["slotA", "slotB"] as Side[]) {
          if ((m.matchId !== matchId || s !== side) && next[m.matchId][s] === id) next[m.matchId][s] = old;
        }
      }
      next[matchId][side] = id;
      return next;
    });
  };

  // players fighting in a played / running first-round match can't be moved into another slot
  const busy = new Set(first.filter((m) => !editable(m)).flatMap((m) => [m.slotA.playerId, m.slotB.playerId]).filter(Boolean) as string[]);
  const choices = players.filter((p) => !busy.has(p.id));
  const bad = first.some((m) => editable(m) && (!ids[m.matchId].slotA || !ids[m.matchId].slotB || ids[m.matchId].slotA === ids[m.matchId].slotB));

  const save = async () => {
    if (bad) return setError("Every open match needs two different players.");
    setSaving(true); setError("");
    const slot = (id: string): BracketSlot => {
      const p = byId.get(id)!;
      return { playerId: p.id, playerName: p.name, club: p.club || "", isBye: false, coachName: p.coachName || "" };
    };
    const next = rounds.map((r) => r.map((m) => ({ ...m })));
    next[0] = next[0].map((m) => {
      if (!editable(m)) return m;
      const want = ids[m.matchId];
      if (want.slotA === m.slotA.playerId && want.slotB === m.slotB.playerId) return m;
      return { ...m, slotA: slot(want.slotA), slotB: slot(want.slotB), scoreA: undefined, scoreB: undefined, winMethod: undefined, elapsedSeconds: undefined };
    });
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the draw");
    } finally {
      setSaving(false);
    }
  };

  const select = "flex-1 min-w-0 h-9 px-2 text-sm font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-[#FF7400]";

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800">Correct live draw</h3>
            <p className="text-xs font-semibold text-slate-400 truncate">{title} · change the players of first-round matches not played yet</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-1.5">
          {first.map((m) => editable(m) ? (
            <div key={m.matchId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-200 bg-white">
              <span className="w-12 text-[11px] font-black text-slate-400 shrink-0">#{m.matchNumber}</span>
              {(["slotA", "slotB"] as Side[]).map((side, i) => (
                <span key={side} className="contents">
                  {i === 1 && <span className="text-[10px] font-black text-slate-300">VS</span>}
                  <select value={ids[m.matchId][side]} onChange={(e) => pick(m.matchId, side, e.target.value)} className={select} aria-label={side === "slotA" ? "White" : "Blue"}>
                    <option value="">Choose player…</option>
                    {choices.map((p) => <option key={p.id} value={p.id}>{p.name}{p.club ? ` · ${p.club}` : ""}</option>)}
                  </select>
                </span>
              ))}
            </div>
          ) : (
            <div key={m.matchId} title="Played, in progress or a BYE: can't be changed" className="flex items-center gap-2 px-2 py-2 rounded-lg border border-slate-200 bg-slate-50">
              <Lock size={14} className="text-slate-400 shrink-0" />
              <span className="w-10 text-[11px] font-black text-slate-400 shrink-0">#{m.matchNumber}</span>
              <span className={`flex-1 min-w-0 truncate text-sm font-bold ${m.winnerId && m.winnerId === m.slotA.playerId ? "text-emerald-700" : "text-slate-600"}`}>{m.slotA.isBye ? "BYE" : name(m.slotA.playerId)}</span>
              <span className="text-[10px] font-black text-slate-300">VS</span>
              <span className={`flex-1 min-w-0 truncate text-sm font-bold ${m.winnerId && m.winnerId === m.slotB.playerId ? "text-emerald-700" : "text-slate-600"}`}>{m.slotB.isBye ? "BYE" : name(m.slotB.playerId)}</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                {m.status === "IN_PROGRESS" ? "LIVE" : m.slotA.isBye || m.slotB.isBye ? "BYE" : "DONE"}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          {error ? <p className="text-sm font-bold text-red-600 flex-1">{error}</p>
            : <p className="text-xs font-semibold text-slate-400 flex-1">Played matches and their results are kept.</p>}
          <button onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button onClick={save} disabled={saving || bad} className="h-10 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save correction
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
