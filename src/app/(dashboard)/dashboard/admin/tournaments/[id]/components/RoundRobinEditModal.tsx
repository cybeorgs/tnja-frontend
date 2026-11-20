"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, GripVertical, Loader2, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import type { BracketMatch, RegisteredPlayer } from "../types";
import { generateRoundRobin } from "../lib/bracketEngine";

/** One editable match: who fights whom (player ids; "" = not chosen yet). */
type EditMatch = { key: string; matchId?: string; a: string; b: string };
type DragItem = { kind: "player"; index: number } | { kind: "match"; round: number; index: number };

/** True for a round robin draw that hasn't been played yet (can be edited). */
export function canEditRoundRobin(rounds: BracketMatch[][]): boolean {
  const first = rounds[0]?.[0];
  if (!first || !first.matchId.startsWith("rr_") || first.matchId.startsWith("rr_rep")) return false;
  return !rounds.some((r) => r.some((m) => m.status === "IN_PROGRESS" || m.status === "COMPLETED"));
}

let seq = 0;
const newKey = () => `k${Date.now()}_${seq++}`;

/** Pool order: players in the order they first appear in the schedule. */
function poolOrderOf(rounds: BracketMatch[][], players: RegisteredPlayer[]): string[] {
  const order: string[] = [];
  for (const r of rounds) for (const m of r) for (const s of [m.slotA, m.slotB]) {
    if (s.playerId && !s.isBye && !order.includes(s.playerId)) order.push(s.playerId);
  }
  for (const p of players) if (!order.includes(p.id)) order.push(p.id);
  return order;
}

const toEditRounds = (rounds: BracketMatch[][]): EditMatch[][] =>
  rounds.map((r) => r.map((m) => ({ key: newKey(), matchId: m.matchId, a: m.slotA.playerId || "", b: m.slotB.playerId || "" })));

/**
 * Hand-edit a round robin draw: drag players to set the pool order (and rebuild the standard
 * schedule from it), drag matches to set the play order and round, and pick who fights whom.
 * Only before the category is started.
 */
export function RoundRobinEditModal({
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
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [order, setOrder] = useState<string[]>(() => poolOrderOf(rounds, players));
  const [sched, setSched] = useState<EditMatch[][]>(() => toEditRounds(rounds));
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const poolNo = (id: string) => order.indexOf(id) + 1;
  const name = (id: string) => byId.get(id)?.name ?? "—";

  // ── checks ──
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const all = sched.flat();
  const counts = new Map<string, number>();
  for (const m of all) if (m.a && m.b && m.a !== m.b) counts.set(pairKey(m.a, m.b), (counts.get(pairKey(m.a, m.b)) ?? 0) + 1);
  const pool = order.filter((id) => byId.has(id));
  const allPairs: [string, string][] = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) allPairs.push([pool[i], pool[j]]);
  const missingPairs = allPairs.filter(([a, b]) => !counts.has(pairKey(a, b)));
  const incomplete = all.filter((m) => !m.a || !m.b).length;
  const selfMatches = all.filter((m) => m.a && m.a === m.b).length;
  const duplicates = [...counts.values()].filter((c) => c > 1).length;
  // a player fighting twice in the same round
  const doubleBooked = sched.reduce((n, r) => {
    const seen = new Set<string>(); let d = 0;
    for (const m of r) for (const id of [m.a, m.b]) { if (!id) continue; if (seen.has(id)) d++; seen.add(id); }
    return n + d;
  }, 0);
  const blocking = incomplete > 0 || selfMatches > 0 || all.length === 0;

  // ── edits ──
  const setMatch = (ri: number, mi: number, side: "a" | "b", id: string) =>
    setSched((s) => s.map((r, i) => (i !== ri ? r : r.map((m, j) => (j !== mi ? m : { ...m, [side]: id })))));
  const removeMatch = (ri: number, mi: number) =>
    setSched((s) => s.map((r, i) => (i !== ri ? r : r.filter((_, j) => j !== mi))).filter((r, i) => r.length > 0 || i === s.length - 1 || s.length === 1));
  const addMatch = (ri: number, a = "", b = "") =>
    setSched((s) => s.map((r, i) => (i !== ri ? r : [...r, { key: newKey(), a, b }])));
  const addRound = () => setSched((s) => [...s, []]);
  const addMissing = () => {
    // each missing pairing goes into the first round where neither player already fights
    setSched((s) => {
      const next = s.map((r) => [...r]);
      for (const [a, b] of missingPairs) {
        let ri = next.findIndex((r) => !r.some((m) => [m.a, m.b].includes(a) || [m.a, m.b].includes(b)));
        if (ri < 0) { next.push([]); ri = next.length - 1; }
        next[ri].push({ key: newKey(), a, b });
      }
      return next;
    });
  };
  const rebuildFromOrder = () => {
    const ps = pool.map((id) => byId.get(id)!).filter(Boolean);
    setSched(toEditRounds(generateRoundRobin(ps)).map((r) => r.map((m) => ({ ...m, matchId: undefined }))));
  };

  // ── drag and drop ──
  const dropPlayer = (to: number) => {
    if (drag?.kind !== "player" || drag.index === to) return;
    setOrder((o) => { const n = [...o]; const [x] = n.splice(drag.index, 1); n.splice(to, 0, x); return n; });
  };
  /** Drop a match before match `toIndex` of round `toRound` (toIndex = length → at the end). */
  const dropMatch = (toRound: number, toIndex: number) => {
    if (drag?.kind !== "match") return;
    setSched((s) => {
      const next = s.map((r) => [...r]);
      const [m] = next[drag.round].splice(drag.index, 1);
      let idx = toIndex;
      if (drag.round === toRound && drag.index < toIndex) idx--;
      next[toRound].splice(idx, 0, m);
      return next;
    });
  };
  const endDrag = () => { setDrag(null); setOver(null); };

  // ── save ──
  const save = async () => {
    if (blocking) return setError("Every match needs two different players.");
    setSaving(true); setError("");
    const stamp = Date.now();
    let number = 0;
    const slot = (id: string) => {
      const p = byId.get(id)!;
      return { playerId: p.id, playerName: p.name, club: p.club || "", isBye: false, coachName: p.coachName || "" };
    };
    const built: BracketMatch[][] = sched
      .filter((r) => r.length > 0)
      .map((r, ri) =>
        r.map((m, mi) => {
          number += 1;
          return {
            matchId: m.matchId ?? `rr_r${ri + 1}_m${mi + 1}_${stamp}_${number}`,
            round: ri + 1,
            matchNumber: number, // play order across the whole pool
            matNumber: rounds[0]?.[0]?.matNumber ?? 1,
            status: "PENDING" as const,
            winnerId: null,
            slotA: slot(m.a),
            slotB: slot(m.b),
          };
        }));
    try {
      await onSave(built);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the draw");
    } finally {
      setSaving(false);
    }
  };

  const select = "flex-1 min-w-0 h-9 px-2 text-sm font-bold bg-white border border-slate-200 rounded-lg outline-none focus:border-[#FF7400]";
  // match number of each round's first match (numbers run across the whole pool)
  const roundStart = sched.map((_, i) => sched.slice(0, i).reduce((n, r) => n + r.length, 0));

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[min(90vh,860px)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-slate-800">Edit round robin</h3>
            <p className="text-xs font-semibold text-slate-400 truncate">{title} · drag to reorder, pick who fights whom</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr]">
          {/* Pool order */}
          <div className="border-b md:border-b-0 md:border-r border-slate-100 p-4 overflow-y-auto">
            <p className="text-[11px] font-black tracking-wider text-slate-400 mb-2">POOL ORDER</p>
            <div className="space-y-1.5">
              {order.map((id, i) => (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDrag({ kind: "player", index: i })}
                  onDragOver={(e) => { if (drag?.kind === "player") { e.preventDefault(); setOver(`p${i}`); } }}
                  onDrop={(e) => { e.preventDefault(); dropPlayer(i); endDrag(); }}
                  onDragEnd={endDrag}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg border bg-white cursor-grab active:cursor-grabbing transition-colors ${
                    over === `p${i}` ? "border-[#FF7400] bg-orange-50" : drag?.kind === "player" && drag.index === i ? "opacity-40 border-slate-200" : "border-slate-200 hover:border-slate-300"
                  }`}
                  title="Drag to change the pool number"
                >
                  <GripVertical size={14} className="text-slate-300 shrink-0" />
                  <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-black flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-800 truncate">{name(id)}</span>
                    <span className="block text-[10px] font-semibold text-slate-400 truncate">{byId.get(id)?.club || byId.get(id)?.district || ""}</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={rebuildFromOrder}
              title="Replace the schedule with the standard round robin for this pool order"
              className="mt-3 w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-black hover:bg-amber-100"
            >
              <RefreshCw size={13} /> Rebuild schedule from order
            </button>
          </div>

          {/* Schedule */}
          <div className="p-4 overflow-y-auto">
            {/* Checks */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-black tracking-wider text-slate-400 mr-1">SCHEDULE · {all.length} MATCHES</span>
              {missingPairs.length === 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700"><CheckCircle2 size={12} /> Everyone meets everyone</span>
              ) : (
                <button onClick={addMissing} title="Add the missing pairings to the schedule" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100">
                  <AlertCircle size={12} /> {missingPairs.length} pairing{missingPairs.length > 1 ? "s" : ""} missing · add
                </button>
              )}
              {duplicates > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">{duplicates} repeated pairing{duplicates > 1 ? "s" : ""}</span>}
              {doubleBooked > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">A player fights twice in one round</span>}
              {selfMatches > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">Player against themselves</span>}
              {incomplete > 0 && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">{incomplete} match{incomplete > 1 ? "es" : ""} without two players</span>}
            </div>

            <div className="space-y-4">
              {sched.map((round, ri) => (
                <div key={ri}>
                  <div
                    onDragOver={(e) => { if (drag?.kind === "match") { e.preventDefault(); setOver(`r${ri}`); } }}
                    onDrop={(e) => { e.preventDefault(); dropMatch(ri, round.length); endDrag(); }}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg mb-1.5 ${over === `r${ri}` ? "bg-orange-100" : "bg-slate-100"}`}
                  >
                    <span className="text-xs font-black text-slate-600">ROUND {ri + 1}</span>
                    <button onClick={() => addMatch(ri)} title="Add a match to this round" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-[#FF7400]">
                      <Plus size={12} /> Match
                    </button>
                  </div>
                  {round.length === 0 && (
                    <p
                      onDragOver={(e) => { if (drag?.kind === "match") { e.preventDefault(); setOver(`r${ri}`); } }}
                      onDrop={(e) => { e.preventDefault(); dropMatch(ri, 0); endDrag(); }}
                      className="text-xs font-semibold text-slate-400 px-3 py-3 border border-dashed border-slate-200 rounded-lg text-center"
                    >
                      Drag a match here, or add one
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {round.map((m, mi) => {
                      const id = `m${ri}_${mi}`;
                      const bad = !m.a || !m.b || m.a === m.b;
                      return (
                        <div
                          key={m.key}
                          draggable
                          onDragStart={(e) => { if ((e.target as HTMLElement).tagName === "SELECT") { e.preventDefault(); return; } setDrag({ kind: "match", round: ri, index: mi }); }}
                          onDragOver={(e) => { if (drag?.kind === "match") { e.preventDefault(); setOver(id); } }}
                          onDrop={(e) => { e.preventDefault(); dropMatch(ri, mi); endDrag(); }}
                          onDragEnd={endDrag}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-white transition-colors ${
                            over === id ? "border-[#FF7400] border-t-4" : drag?.kind === "match" && drag.round === ri && drag.index === mi ? "opacity-40 border-slate-200" : bad ? "border-red-200" : "border-slate-200"
                          }`}
                        >
                          <span title="Drag to change the play order or round" className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"><GripVertical size={15} /></span>
                          <span className="w-12 text-[11px] font-black text-slate-400 shrink-0">#{roundStart[ri] + mi + 1}</span>
                          <select value={m.a} onChange={(e) => setMatch(ri, mi, "a", e.target.value)} className={select} aria-label="White">
                            <option value="">Choose player…</option>
                            {order.map((pid) => <option key={pid} value={pid}>{poolNo(pid)}. {name(pid)}</option>)}
                          </select>
                          <span className="text-[10px] font-black text-slate-300">VS</span>
                          <select value={m.b} onChange={(e) => setMatch(ri, mi, "b", e.target.value)} className={select} aria-label="Blue">
                            <option value="">Choose player…</option>
                            {order.map((pid) => <option key={pid} value={pid}>{poolNo(pid)}. {name(pid)}</option>)}
                          </select>
                          <button onClick={() => removeMatch(ri, mi)} title="Remove this match" className="p-1.5 rounded-md text-slate-300 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={addRound} className="w-full h-9 inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-xs font-bold text-slate-500 hover:border-[#FF7400] hover:text-[#FF7400]">
                <Plus size={13} /> Add round
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          {error ? <p className="text-sm font-bold text-red-600 flex-1">{error}</p>
            : <p className="text-xs font-semibold text-slate-400 flex-1">Match numbers follow this order. Only before the category starts.</p>}
          <button onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving || blocking}
            className="h-10 px-5 inline-flex items-center gap-2 rounded-lg text-sm font-black text-white bg-[#FF7400] hover:bg-[#e66800] disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save draw
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
