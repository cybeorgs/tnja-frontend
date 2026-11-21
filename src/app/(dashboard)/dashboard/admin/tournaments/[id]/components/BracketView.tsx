"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Monitor, Printer, Download, GripVertical } from "lucide-react";
import type { BracketMatch, DrawCategory, RegisteredPlayer, Tournament } from "../types";
import { getRoundLabel, mainBracketRoundCount, isMatchReady, compareWeights, getEliminationFormatLabel, detectDrawPlacements, PLACEMENT_ORDER, type Placement } from "../lib/bracketEngine";
import { exportRoundRobinPoolSheet, exportCategoryReport, exportCategoryChartPDF } from "../lib/pdfExport";
import { useDistrictCodes, representingOf } from "@/utils/districtCodes";

// Abbreviates a club name to its first 3 uppercase letters for compact match cards.
function clubCode(name: string): string {
  if (!name || name === "BYE" || name === "TBD") return name || "---";
  // Take first 3 uppercase letters (consonants preferred)
  const upper = name.toUpperCase().replace(/[^A-Z]/g, "");
  return upper.slice(0, 3) || "---";
}

const MEDAL_STYLE: Record<string, { title: string; icon: string; card: string; label: string }> = {
  FIRST:  { title: "Gold",   icon: "🥇", card: "bg-gradient-to-r from-yellow-50 to-amber-100 border-yellow-300", label: "text-yellow-700" },
  SECOND: { title: "Silver", icon: "🥈", card: "bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300",   label: "text-slate-600" },
  THIRD:  { title: "Bronze", icon: "🥉", card: "bg-gradient-to-r from-orange-50 to-orange-100 border-orange-300", label: "text-orange-700" },
};

// ─── Bracket View Component (reference-style with SVG connectors) ─────────────
const MATCH_H = 84;
const MATCH_W = 210;
const CONN_W  = 44;
const G0      = 28;

export function BracketView({
  rounds,
  onOpenScoreboard,
  players,
  tournament,
  currentKey,
  currentDraw,
  onSwapFirstRound,
  reveal,
  hideHeader,
}: {
  rounds: BracketMatch[][];
  /** Draw-ceremony mode: only the first-round places in `shown` show their name (BYEs always show);
   *  `latest` is animated dropping into its box. Later rounds and results stay hidden meanwhile. */
  reveal?: { shown: Set<number>; latest: number | null } | null;
  /** Leave out the format / competitors bar (when the page header already shows it). */
  hideHeader?: boolean;
  /** Omit for a view-only bracket (no Scoreboard buttons). */
  onOpenScoreboard?: (match: BracketMatch) => void;
  /** When given, first-round places can be dragged onto each other to swap them (BYEs included).
   *  Places are numbered match 1 A = 0, match 1 B = 1, match 2 A = 2, … */
  onSwapFirstRound?: (from: number, to: number) => void;
  players: RegisteredPlayer[];
  tournament?: Tournament | null;
  currentKey?: string;
  currentDraw?: DrawCategory;
}) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const districtCodes = useDistrictCodes();
  if (!rounds || rounds.length === 0) return null;

  const isRoundRobin = rounds[0].length > 0 && rounds[0][0].matchId.startsWith("rr_");
  const numR1   = rounds[0].length;
  // Single/double-repechage formats append 2 trailing rounds (repechage, then bronze)
  // after the main elimination bracket. Those don't follow the main bracket's
  // power-of-2 halving pattern, so they need their own simple layout below.
  const mainRoundsCount = mainBracketRoundCount(rounds);
  const hasBronze = !isRoundRobin && mainRoundsCount > 0 && rounds[mainRoundsCount - 1].length > 1;
  const rowsH   = Math.max(numR1 * (MATCH_H + G0) - G0, MATCH_H);
  const BRONZE_CARD_H = 100;
  const BRONZE_GAP    = 40;

  const totalH  = isRoundRobin
    // Round-robin: match cards sit at the same y per column, so the bronze
    // card's forced offset (mTop(last,0)=0) is just MATCH_H + gap + its own height.
    ? Math.max(rowsH + 24, hasBronze ? MATCH_H + BRONZE_GAP + BRONZE_CARD_H + 24 : 0)
    : rowsH + 160 + (hasBronze ? 140 : 0);

  const totalW  = rounds.length * MATCH_W + rounds.length * CONN_W + (isRoundRobin ? 0 : (MATCH_W - 20));

  const slotH   = (ri: number) => totalH / (numR1 / Math.pow(2, ri));
  const mTop    = (ri: number, mi: number) => {
    if (isRoundRobin) return mi * (MATCH_H + G0);
    // Trailing repechage/bronze rounds have a handful of unrelated matches, not a
    // halved subset of round 1 — stack them plainly instead of feeding them through
    // the power-of-2 slot formula (which blows up to a huge offset for these).
    if (ri >= mainRoundsCount) return mi * (MATCH_H + G0);
    const s = slotH(ri); return mi * s + (s - MATCH_H) / 2;
  };
  const mCenterY = (ri: number, mi: number) => mTop(ri, mi) + MATCH_H / 2;

  const canDrag = !!onSwapFirstRound;
  const dnd = (ri: number, place: number) => {
    if (!canDrag || ri !== 0) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setDragFrom(place); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(place)); },
      onDragEnd: () => { setDragFrom(null); setDragOver(null); },
      onDragOver: (e: React.DragEvent) => { if (dragFrom !== null && dragFrom !== place) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOver !== place) setDragOver(place); } },
      onDragLeave: () => { if (dragOver === place) setDragOver(null); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const from = dragFrom ?? Number(e.dataTransfer.getData("text/plain"));
        setDragFrom(null); setDragOver(null);
        if (Number.isInteger(from) && from !== place) onSwapFirstRound!(from, place);
      },
    };
  };
  // Left player list: a name can be dragged too; it picks up that player's first-round place,
  // so dropping it on a slot swaps the two (or moves the player onto a BYE).
  const placeOf = new Map<string, number>();
  (rounds[0] ?? []).forEach((m, mi) => {
    if (m.slotA.playerId && !m.slotA.isBye) placeOf.set(m.slotA.playerId, mi * 2);
    if (m.slotB.playerId && !m.slotB.isBye) placeOf.set(m.slotB.playerId, mi * 2 + 1);
  });
  const listDnd = (playerId: string) => {
    const place = placeOf.get(playerId);
    if (!canDrag || place === undefined) return {};
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => { setDragFrom(place); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(place)); },
      onDragEnd: () => { setDragFrom(null); setDragOver(null); },
    };
  };
  const dndCls = (ri: number, place: number) => {
    if (!canDrag || ri !== 0) return "";
    if (dragOver === place) return " cursor-grab ring-2 ring-inset ring-[#FF7400] bg-orange-50";
    if (dragFrom === place) return " cursor-grabbing opacity-40";
    return " cursor-grab";
  };

  const weightGroups = Array.from(new Set(players.map(p => p.weight))).sort(compareWeights);

  /** Representing district (or unit) per player, shown as e.g. "[CBE] HARIKRISHNA G". */
  const repById = new Map(players.map((p) => [p.id, representingOf(p, districtCodes)]));
  const slotCode = (slot: BracketMatch["slotA"]) =>
    (slot.playerId && repById.get(slot.playerId)?.code) || (slot.club ? clubCode(slot.club) : "");

  /** Everyone in this bracket with their placement, Gold → Silver → Bronze → Participants.
   *  Uses the saved placements once the category is concluded, else what the results so far give.
   *  Null until at least one medal is decided. */
  const placementList = (): { id: string; name: string; from: string; placement: Placement }[] | null => {
    const slotById = new Map<string, BracketMatch["slotA"]>();
    rounds.forEach((r) => r.forEach((m) => [m.slotA, m.slotB].forEach((s) => {
      if (s.playerId && !s.isBye && !slotById.has(s.playerId)) slotById.set(s.playerId, s);
    })));
    const ids = [...slotById.keys()];
    const playerById = new Map(players.map((p) => [p.id, p]));
    const saved = ids.some((id) => ["FIRST", "SECOND", "THIRD"].includes(playerById.get(id)?.placement || ""));
    const detected = saved ? null : detectDrawPlacements(rounds, ids);
    const list = ids.map((id) => {
      const p = playerById.get(id);
      const slot = slotById.get(id)!;
      const placement = (saved ? (p?.placement as Placement) || "PARTICIPATION" : detected![id]) ?? "PARTICIPATION";
      return { id, name: p?.name || slot.playerName, from: repById.get(id)?.name || p?.club || slot.club || "", placement };
    });
    if (!list.some((r) => r.placement !== "PARTICIPATION")) return null;
    return list.sort((a, b) => (PLACEMENT_ORDER[a.placement] ?? 99) - (PLACEMENT_ORDER[b.placement] ?? 99));
  };

  // ── Draw-ceremony reveal ──
  const revealing = !!reveal;
  const isHidden = (ri: number, place: number, slot: BracketMatch["slotA"]) =>
    revealing && !slot.isBye && (ri > 0 || !reveal!.shown.has(place));
  const isLatest = (ri: number, place: number) => revealing && ri === 0 && reveal!.latest === place;
  /** Players already drawn into a box (the rest are still "in the pot"). */
  const drawnIds = new Set<string>();
  if (revealing) {
    rounds[0].forEach((m, mi) => {
      if (reveal!.shown.has(mi * 2) && m.slotA.playerId) drawnIds.add(m.slotA.playerId);
      if (reveal!.shown.has(mi * 2 + 1) && m.slotB.playerId) drawnIds.add(m.slotB.playerId);
    });
  }

  /** One player line inside a match box. */
  const slotContent = (ri: number, place: number, slot: BracketMatch["slotA"], isWinner: boolean) => {
    if (isHidden(ri, place, slot)) {
      return <span className="h-2.5 w-28 rounded-full bg-slate-100" aria-hidden />;
    }
    const inner = (
      <>
        {slot.seedNumber && (
          <span className="shrink-0 text-[8px] font-black text-amber-600 bg-amber-100 w-4 h-4 rounded-sm flex items-center justify-center">
            {slot.seedNumber}
          </span>
        )}
        {!slot.isBye && slotCode(slot) && (
          <span className="shrink-0 text-[9px] font-black text-blue-600" title={(slot.playerId && repById.get(slot.playerId)?.name) || slot.club}>[{slotCode(slot)}]</span>
        )}
        <span className={`text-[11px] font-bold truncate leading-tight ${slot.isBye ? "text-slate-300 italic" : isWinner ? "text-emerald-700" : "text-slate-800"}`}>
          {slot.playerName}
        </span>
        {isWinner && <span className="ml-auto text-emerald-500 text-[9px] shrink-0">✓</span>}
      </>
    );
    if (!isLatest(ri, place)) return inner;
    return (
      <motion.span
        key={`drop-${place}`}
        initial={{ opacity: 0, y: -26, scale: 1.7 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="flex items-center gap-1.5 min-w-0 origin-left"
      >
        {inner}
      </motion.span>
    );
  };
  const latestRowCls = (ri: number, place: number) => (isLatest(ri, place) ? " ring-2 ring-inset ring-[#FF7400] bg-orange-50" : "");

  return (
    <div className="space-y-4">
      {!hideHeader && (
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center font-black text-[#FF7400] text-[10px]">
            IJF
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
              {isRoundRobin ? "Round Robin Bracket" : `${getEliminationFormatLabel(rounds)} Bracket`}
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold">
              {players.length} Competitors {currentDraw?.matNumber ? `• MAT ${currentDraw.matNumber}` : ""}
            </p>
          </div>
        </div>
      </div>
      )}
      {canDrag && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <GripVertical size={14} className="text-[#FF7400]" /> Drag a player (from the list on the left or in the first round) onto another place to swap them — drop onto a BYE to move the BYE. Saves straight away; locked once the category starts.
        </p>
      )}
      <div className="flex gap-6">
      {/* ── Left: Player List ────────────────────────────────────────────── */}
      <div className="w-56 shrink-0">
        {weightGroups.map((w) => {
          const wPlayers = players.filter(p => p.weight === w);
          return (
            <div key={w} className="mb-4">
              <p className="text-xs font-black text-blue-600 mb-2 pb-1 border-b border-slate-100">
                {/kg/i.test(String(w)) ? w : `${w} kg`} <span className="text-slate-400 font-semibold">({wPlayers.length} players)</span>
              </p>
              <div className="space-y-1">
                {wPlayers.map((p) => (
                  <div
                    key={p.id}
                    {...listDnd(p.id)}
                    title={canDrag && placeOf.has(p.id) ? "Drag onto a first-round place to move this player there (swaps with whoever is there)" : undefined}
                    className={`flex items-center gap-2 py-1 px-1 -mx-1 rounded-lg transition-all duration-300 ${revealing && !drawnIds.has(p.id) ? "opacity-25" : ""} ${
                      canDrag && placeOf.has(p.id)
                        ? `cursor-grab active:cursor-grabbing hover:bg-orange-50 ${dragFrom === placeOf.get(p.id) ? "bg-orange-100 ring-1 ring-[#FF7400]" : ""}`
                        : ""
                    }`}
                  >
                    {canDrag && placeOf.has(p.id) && <GripVertical size={11} className="shrink-0 -mr-1 text-slate-300" />}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black text-white ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{p.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">{p.gender === "FEMALE" ? "Female" : "Male"} · {repById.get(p.id) ? `${repById.get(p.id)!.code} · ${repById.get(p.id)!.name}` : p.club}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Right: Bracket ───────────────────────────────────────────────── */}
      <div id="bracket-print-area" className="flex-grow min-w-0 overflow-x-auto">
        <div style={{ minWidth: totalW + 24, userSelect: "none" }}>

          {/* Round headers */}
          <div className="flex mb-3">
            {rounds.map((_, ri) => (
              <div key={ri} className="flex shrink-0" style={{ width: MATCH_W + CONN_W }}>
                <div style={{ width: MATCH_W }}
                  className="text-center text-[10px] font-black text-slate-500 uppercase tracking-wider py-1 bg-slate-100 rounded-lg mr-0">
                  {getRoundLabel(rounds, ri, isRoundRobin)}
                </div>
              </div>
            ))}
            {/* Champion Header */}
            {rounds.length > 0 && !isRoundRobin && (
              <div className="flex shrink-0" style={{ width: MATCH_W - 20 }}>
                <div style={{ width: "100%" }}
                  className="text-center text-[10px] font-black text-orange-600 uppercase tracking-wider py-1 bg-orange-100 border border-orange-200 rounded-lg shadow-sm">
                  🏆 Winner
                </div>
              </div>
            )}
          </div>

          {/* Bracket area */}
          <div className="relative" style={{ height: totalH, width: totalW }}>

            {/* SVG connector lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={totalW} height={totalH}
              style={{ zIndex: 0 }}
            >
              {!isRoundRobin && rounds.map((round, ri) => {
                // Only draw winner-merge connectors within the main bracket — the
                // repechage/bronze rounds are fed by losers via a different crossover
                // pattern, not a simple pairwise winner merge, so no line here.
                if (ri >= mainRoundsCount - 1) return null;
                const xBase = ri * (MATCH_W + CONN_W) + MATCH_W;
                const xMid  = xBase + CONN_W / 2;
                const xNext = xBase + CONN_W;

                return round.map((_, mi) => {
                  if (mi % 2 !== 0) return null;
                  const y1   = mCenterY(ri, mi);
                  const y2   = mi + 1 < round.length ? mCenterY(ri, mi + 1) : y1;
                  const midY = (y1 + y2) / 2;

                  return (
                    <motion.g
                      key={`${ri}-${mi}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: ri * 0.18 + mi * 0.07 + 0.3 }}
                      stroke="#CBD5E1" strokeWidth={1.5} fill="none"
                    >
                      <line x1={xBase} y1={y1}   x2={xMid}  y2={y1} />
                      {mi + 1 < round.length && (
                        <>
                          <line x1={xBase} y1={y2}   x2={xMid}  y2={y2} />
                          <line x1={xMid}  y1={y1}   x2={xMid}  y2={y2} />
                        </>
                      )}
                      <line x1={xMid} y1={midY} x2={xNext} y2={midY} />
                    </motion.g>
                  );
                });
              })}

            </svg>

            {/* Match cards */}
            {rounds.map((round, ri) => {
              const xOffset = ri * (MATCH_W + CONN_W);
              return round.map((match, mi) => {
                let top = mTop(ri, mi);
                const isBronzeMatch = !isRoundRobin && ri === rounds.length - 1 && mi === 1;
                // every bronze match looks the same: the plain bracket's 3rd-place match and both repechage bronze matches
                const bronzeStyle = !isRoundRobin && (isBronzeMatch || match.matchId.startsWith("rr_bronze") || match.matchId.startsWith("M_BRONZE_"));
                
                if (isBronzeMatch) {
                  // Position the bronze match visually below the gold match
                  top = mTop(ri, 0) + MATCH_H + 40; // 40px gap
                }

                const isWinnerA = !revealing && match.winnerId && match.winnerId === match.slotA.playerId;
                const isWinnerB = !revealing && match.winnerId && match.winnerId === match.slotB.playerId;
                const staggerDelay = ri * 0.18 + mi * 0.07;

                return (
                  <motion.div
                    key={match.matchId}
                    style={{ position: "absolute", top, left: xOffset, width: MATCH_W, zIndex: 1 }}
                    initial={{ opacity: 0, x: -60, scale: 0.8, rotateY: -25 }}
                    animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                    transition={{ delay: staggerDelay, type: "spring", stiffness: 280, damping: 22 }}
                    className={`group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow ${
                      bronzeStyle ? "border-amber-400 border-2" : "border-slate-200"
                    }`}
                  >
                    {bronzeStyle && (
                      <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[9px] font-black uppercase text-center py-0.5 tracking-wider">
                        🥉 Bronze Match
                      </div>
                    )}
                    {/* Player A row */}
                    <div {...dnd(ri, mi * 2)} title={canDrag && ri === 0 ? "Drag onto another place to swap" : undefined} className={`flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 min-h-[34px] ${match.slotA.isBye && dragOver !== mi * 2 ? "opacity-25" : ""} ${isWinnerA ? "bg-emerald-50" : "hover:bg-blue-50/50"} transition-colors${dndCls(ri, mi * 2)}${latestRowCls(ri, mi * 2)}`}>
                      {canDrag && ri === 0 && <GripVertical size={11} className="shrink-0 -ml-1.5 text-slate-300" />}
                      {slotContent(ri, mi * 2, match.slotA, !!isWinnerA)}
                    </div>

                    {/* Player B row */}
                    <div {...dnd(ri, mi * 2 + 1)} title={canDrag && ri === 0 ? "Drag onto another place to swap" : undefined} className={`flex items-center gap-1.5 px-3 py-2 min-h-[34px] ${match.slotB.isBye && dragOver !== mi * 2 + 1 ? "opacity-25" : ""} ${isWinnerB ? "bg-emerald-50" : "hover:bg-blue-50/50"} transition-colors${dndCls(ri, mi * 2 + 1)}${latestRowCls(ri, mi * 2 + 1)}`}>
                      {canDrag && ri === 0 && <GripVertical size={11} className="shrink-0 -ml-1.5 text-slate-300" />}
                      {slotContent(ri, mi * 2 + 1, match.slotB, !!isWinnerB)}
                    </div>

                    {/* Match info + Scoreboard button */}
                    <div className="flex items-center justify-between px-2 py-0.5 bg-slate-50 border-t border-slate-100">
                      <span className="text-[8px] text-slate-400 font-semibold">
                        {match.status === "COMPLETED" && !revealing ? "✓ Done" : `Mat ${match.matNumber} · #${match.matchNumber}`}
                      </span>
                      {onOpenScoreboard && isMatchReady(match) && (
                        <button
                          onClick={() => onOpenScoreboard(match)}
                          title="Open the scoreboard for this match"
                          className="text-[8px] font-black transition-colors flex items-center gap-0.5 text-orange-500 hover:text-orange-700"
                        >
                          <Monitor size={8} /> Scoreboard ↗
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              });
            })}

            {/* Winner column: Gold, Silver, Bronze (Merit), then Participants — same placements as the Results tab */}
            {!isRoundRobin && !revealing && (() => {
              const results = placementList();
              if (!results) return null;
              const medals = results.filter((r) => r.placement !== "PARTICIPATION");
              const participants = results.filter((r) => r.placement === "PARTICIPATION");
              const xOffset = rounds.length * (MATCH_W + CONN_W);

              return (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200, damping: 18 }}
                  style={{ position: "absolute", top: 0, left: xOffset, width: MATCH_W - 20, maxHeight: totalH, zIndex: 2 }}
                  className="flex flex-col gap-1.5 overflow-y-auto pr-0.5"
                >
                  {medals.map((r) => {
                    const s = MEDAL_STYLE[r.placement];
                    return (
                      <div key={r.id} className={`rounded-xl border px-3 py-2 shadow-sm ${s.card}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${s.label}`}>{s.icon} {s.title}</span>
                          <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/70 text-amber-700 border border-amber-200">Merit</span>
                        </div>
                        <p className="text-[12px] font-black text-slate-800 truncate leading-tight mt-0.5" title={r.name}>{r.name}</p>
                        <p className="text-[9px] font-semibold text-slate-500 truncate">{r.from || "---"}</p>
                      </div>
                    );
                  })}
                  {participants.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-600">Participants</span>
                        <span className="text-[9px] font-bold text-slate-400">{participants.length}</span>
                      </div>
                      {participants.map((r) => (
                        <div key={r.id} className="px-3 py-1 border-b border-slate-50 last:border-0">
                          <p className="text-[11px] font-bold text-slate-700 truncate leading-tight" title={r.name}>{r.name}</p>
                          <p className="text-[9px] text-slate-400 truncate">{r.from || "---"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })()}

          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Round Robin Leaderboard (standalone — shown via its own view-mode tab) ───
export function RoundRobinLeaderboard({
  rounds,
  players,
  tournament,
  currentKey,
  currentDraw,
}: {
  rounds: BracketMatch[][];
  players: RegisteredPlayer[];
  tournament?: Tournament | null;
  currentKey?: string;
  currentDraw?: DrawCategory;
}) {
  interface PlayerStanding {
    playerId: string;
    name: string;
    club: string;
    wins: number;
    points: number;
    totalWinningTime: number; // in seconds
    matchesPlayed: number;
  }

  const standingsMap: Record<string, PlayerStanding> = {};
  players.forEach(p => {
    standingsMap[p.id] = { playerId: p.id, name: p.name, club: p.club, wins: 0, points: 0, totalWinningTime: 0, matchesPlayed: 0 };
  });

  const allMatches: BracketMatch[] = [];
  rounds.forEach(r => {
    r.forEach(m => {
      allMatches.push(m);
      if (m.status === "COMPLETED") {
        const elapsed = m.elapsedSeconds || 0;

        // Increment matches played
        if (m.slotA.playerId && standingsMap[m.slotA.playerId]) standingsMap[m.slotA.playerId].matchesPlayed += 1;
        if (m.slotB.playerId && standingsMap[m.slotB.playerId]) standingsMap[m.slotB.playerId].matchesPlayed += 1;

        // Calculate and add points achieved in this match
        const ptsA = m.scoreA ? ( (m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0) * 1 ) : 0;
        const ptsB = m.scoreB ? ( (m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0) * 1 ) : 0;

        if (m.slotA.playerId && standingsMap[m.slotA.playerId]) {
          // Points are capped at 100 per match
          standingsMap[m.slotA.playerId].points += Math.min(ptsA, 100);
        }
        if (m.slotB.playerId && standingsMap[m.slotB.playerId]) {
          standingsMap[m.slotB.playerId].points += Math.min(ptsB, 100);
        }

        // Increment wins and winning time
        if (m.winnerId && standingsMap[m.winnerId]) {
          standingsMap[m.winnerId].wins += 1;
          standingsMap[m.winnerId].totalWinningTime += elapsed;
        }
      }
    });
  });

  const sortedPlayers = Object.values(standingsMap).sort((a, b) => {
    // Rule 1: Contests Won
    if (b.wins !== a.wins) return b.wins - a.wins;

    // Rule 2: Sum of all points
    if (b.points !== a.points) return b.points - a.points;

    // Rule 3: Direct comparison (head-to-head) - only if exactly 2 players are tied on wins and points
    const tiedGroup = Object.values(standingsMap).filter(p => p.wins === a.wins && p.points === a.points);
    if (tiedGroup.length === 2) {
      const headToHead = allMatches.find(m =>
        m.status === "COMPLETED" &&
        ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
         (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
      );
      if (headToHead && headToHead.winnerId) {
        return headToHead.winnerId === a.playerId ? -1 : 1;
      }
    }

    // Rule 4: Shortest accumulated winning time (smaller is better)
    if (a.totalWinningTime !== b.totalWinningTime) {
      return a.totalWinningTime - b.totalWinningTime;
    }

    // Fallback Head-to-Head: If still tied, check the direct match between these two players
    const headToHead = allMatches.find(m =>
      m.status === "COMPLETED" &&
      ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
       (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
    );
    if (headToHead && headToHead.winnerId) {
      return headToHead.winnerId === a.playerId ? -1 : 1;
    }

    // Rule 5: Decision contests (exact tie)
    return 0;
  });

  const formatTime = (sec: number) => {
    if (!sec) return "0s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 border-b border-emerald-700 px-4 py-3 flex items-center justify-between text-white">
        <h4 className="text-sm font-black uppercase tracking-wider">Round Robin Standings</h4>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCategoryChartPDF(tournament || null, currentKey || "", currentDraw as DrawCategory, players)}
            className="text-xs bg-white text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-sm font-bold transition-all flex items-center gap-1 shadow-sm"
            title="Download Official Visual Pool Chart as PDF"
          >
            <Download size={12} /> Download Chart (PDF)
          </button>
          <button
            onClick={() => exportRoundRobinPoolSheet(tournament || null, currentKey || "", currentDraw as DrawCategory, players)}
            className="text-xs bg-white/20 hover:bg-white/35 px-2.5 py-1 rounded-sm font-bold transition-all flex items-center gap-1 text-white border border-white/10"
            title="Print Official IJF Round Robin Pool Sheet"
          >
            <Printer size={12} /> Print Sheet
          </button>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-bold cursor-help" title="Rules: 1. Wins | 2. Points (Ippon=100, Waza-ari=10, Yuko=1) | 3. Head-to-Head | 4. Shortest winning time">Rules ℹ️</span>
        </div>
      </div>

      <div className="p-2">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-100 font-bold">
              <th className="py-2 px-2 text-center w-10">Rk</th>
              <th className="py-2 px-2">Athlete</th>
              <th className="py-2 px-2 text-center w-10" title="Wins">W</th>
              <th className="py-2 px-2 text-center w-12" title="Points (Ippon=100, Waza-ari=10, Yuko=1)">Pts</th>
              <th className="py-2 px-2 text-center w-16" title="Total Winning Time">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sortedPlayers.map((p, idx) => {
              const rankColor = idx === 0 ? "bg-amber-100 text-amber-800 font-black border border-amber-300" :
                                idx === 1 ? "bg-slate-100 text-slate-800 font-black border border-slate-300" :
                                idx === 2 ? "bg-orange-100 text-orange-800 font-black border border-orange-300" :
                                "bg-slate-50 text-slate-600 border border-slate-200";

              return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-2 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${rankColor}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 min-w-0">
                    <p className="font-bold text-slate-800 truncate max-w-[220px]" title={p.name}>{p.name}</p>
                    <p className="text-xs text-slate-400 truncate max-w-[220px]" title={p.club}>{p.club || "---"}</p>
                  </td>
                  <td className="py-2.5 px-2 text-center font-black text-emerald-600">{p.wins}</td>
                  <td className="py-2.5 px-2 text-center font-black text-blue-600">{p.points}</td>
                  <td className="py-2.5 px-2 text-center font-semibold text-slate-500">{formatTime(p.totalWinningTime)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
