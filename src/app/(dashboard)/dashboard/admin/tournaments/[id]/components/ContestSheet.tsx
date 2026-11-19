"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { BracketMatch, BracketSlot, RegisteredPlayer } from "../types";
import { mainBracketRoundCount, getRoundLabel, drawNumberOrder } from "../lib/bracketEngine";
import { useDistrictCodes, representingOf } from "@/utils/districtCodes";

// ─── Layout constants (px) ────────────────────────────────────────────────────
const CW = 168;            // match card width
const CONN = 26;           // gap between columns, where connector lines run
const ROW = 22;            // one player line
const MH = ROW * 2 + 2;    // match card height (two lines + borders)
const SLOT_MIN = 58;       // vertical space per first-round match on one side
const HEAD = 24;           // round-label row
const REP_ROUND = 99;      // round index for repechage boxes: treated as a later round (hidden in the ceremony, no draw numbers)

type Reveal = { shown: Set<number>; latest: number | null } | null | undefined;

/** Pixel width of the sheet for these rounds (used to fit it on a printed page). */
export function contestSheetWidth(rounds: BracketMatch[][]): number {
  const sides = Math.max(0, mainBracketRoundCount(rounds) - 1);
  return (2 * sides + 1) * CW + 2 * sides * CONN;
}

/**
 * Single-page elimination contest sheet, laid out like the association's printed draw:
 * the top half of the draw runs in from the left, the bottom half from the right, both
 * meeting at the Final in the middle; placings sit under the Final and the repechage
 * (when the format has one) below a divider.
 */
export function ContestSheet({ rounds, players, reveal }: { rounds: BracketMatch[][]; players: RegisteredPlayer[]; reveal?: Reveal }) {
  const codes = useDistrictCodes();
  const m = mainBracketRoundCount(rounds);
  if (!rounds.length || m === 0 || !rounds[m - 1]?.[0]) return null;

  const revealing = !!reveal;
  const rep = new Map(players.map((p) => [p.id, representingOf(p, codes)]));
  const repOf = (slot: BracketSlot) => (slot.playerId ? rep.get(slot.playerId) ?? null : null);

  const finalMatch = rounds[m - 1][0];
  const mainBronze = rounds[m - 1][1];            // straight elimination's bronze match
  const hasRep = rounds.length > m;
  const sides = m - 1;                            // rounds drawn on each side of the Final
  const perSide = (r: number) => rounds[r].length / 2;
  const c0 = sides > 0 ? Math.max(1, perSide(0)) : 1;
  const H = Math.max(c0 * SLOT_MIN, MH + 40);     // height of the main bracket area
  const drawNo = sides > 0 ? drawNumberOrder(rounds[0].length * 2) : [];

  const step = CW + CONN;
  const finalX = sides * step;
  const width = (2 * sides + 1) * CW + 2 * sides * CONN;
  const xL = (r: number) => r * step;
  const xR = (r: number) => finalX + step + (sides - 1 - r) * step;
  const topOf = (r: number, i: number) => { const s = H / perSide(r); return i * s + (s - MH) / 2; };
  const cy = (r: number, i: number) => topOf(r, i) + MH / 2;
  const finalTop = H / 2 - MH / 2;

  // ── Placings (shown once decided) ──
  const loserOf = (mt?: BracketMatch) =>
    mt && mt.status === "COMPLETED" && mt.winnerId ? (mt.slotA.playerId === mt.winnerId ? mt.slotB : mt.slotA) : null;
  const winnerOf = (mt?: BracketMatch) =>
    mt && mt.status === "COMPLETED" && mt.winnerId ? (mt.slotA.playerId === mt.winnerId ? mt.slotA : mt.slotB) : null;
  const gold = winnerOf(finalMatch);
  const silver = loserOf(finalMatch);
  const bronzes: (BracketSlot | null)[] = hasRep
    ? (rounds[m + 1] ?? []).map(winnerOf)
    : mainBronze
      ? [winnerOf(mainBronze)]
      : m >= 2 ? rounds[m - 2].map(loserOf) : [];
  const placings: [string, BracketSlot | null][] = [["1", gold], ["2", silver], ...bronzes.map((b) => ["3", b] as [string, BracketSlot | null])];

  const bronzeTop = finalTop + MH + 30;
  const placingsTop = (mainBronze ? bronzeTop + MH : finalTop + MH) + 26;
  const placingsH = 22 + placings.length * 20;
  const mainH = Math.max(H, placingsTop + placingsH + 8);

  // ── One player line ──
  const line = (slot: BracketSlot, opts: { hidden: boolean; latest: boolean; win: boolean; lose: boolean; num?: number; mirror: boolean; top: boolean }) => {
    const r = repOf(slot);
    const placeholder = !slot.playerId && !slot.isBye; // "TBD" or "Loser of QF 1"
    const content = opts.hidden ? (
      <span className="h-2 w-24 rounded-full bg-slate-100" aria-hidden />
    ) : slot.isBye ? (
      <span className="text-[10px] italic text-slate-300">bye</span>
    ) : placeholder ? (
      <span className="text-[10px] italic text-slate-400 truncate">{slot.playerName === "TBD" ? "" : slot.playerName}</span>
    ) : (
      <span className={`flex items-center gap-1 min-w-0 ${opts.mirror ? "flex-row-reverse" : ""}`}>
        {r?.code && <span className="shrink-0 text-[9px] font-black text-blue-600" title={r.name}>{r.code}</span>}
        <span className={`truncate font-bold ${opts.win ? "text-emerald-700" : opts.lose ? "text-slate-400" : "text-slate-800"}`}>{slot.playerName}</span>
        {opts.win && <span className="shrink-0 text-emerald-500 text-[9px]">✓</span>}
      </span>
    );
    return (
      <div className={`flex items-center gap-1.5 px-1.5 text-[11px] ${opts.mirror ? "flex-row-reverse text-right" : ""} ${opts.top ? "border-b border-slate-200" : ""} ${opts.win ? "bg-emerald-50" : ""} ${opts.latest ? "bg-orange-50 ring-2 ring-inset ring-[#FF7400]" : ""}`} style={{ height: ROW }}>
        {opts.num !== undefined && <span className="w-4 shrink-0 text-[9px] font-bold text-slate-400 tabular-nums">{String(opts.num).padStart(2, "0")}</span>}
        <span className={`flex-1 min-w-0 flex ${opts.mirror ? "justify-end" : ""}`}>
          {opts.latest ? (
            <motion.span key="drop" initial={{ opacity: 0, y: -18, scale: 1.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 320, damping: 18 }} className="min-w-0 flex">
              {content}
            </motion.span>
          ) : content}
        </span>
      </div>
    );
  };

  // ── One match box ──
  const card = (mt: BracketMatch, r: number, gi: number, x: number, y: number, mirror: boolean, accent?: string) => {
    const hide = (place: number, s: BracketSlot) => revealing && !s.isBye && (r > 0 || !reveal!.shown.has(place));
    const isLatest = (place: number) => revealing && r === 0 && reveal!.latest === place;
    const done = !revealing && mt.status === "COMPLETED" && !!mt.winnerId;
    const winA = done && mt.winnerId === mt.slotA.playerId;
    const winB = done && mt.winnerId === mt.slotB.playerId;
    const byeMatch = r === 0 && (mt.slotA.isBye || mt.slotB.isBye);
    const live = !revealing && mt.status === "IN_PROGRESS";
    const numbered = r === 0 && sides > 0;
    return (
      <div
        key={mt.matchId}
        title={`Match ${mt.matchNumber} · Mat ${mt.matNumber}${live ? " · in progress" : ""}`}
        className={`absolute bg-white rounded-md overflow-hidden border ${live ? "border-[#FF7400] ring-2 ring-orange-200" : accent ?? "border-slate-300"} ${byeMatch ? "opacity-60" : ""}`}
        style={{ left: x, top: y, width: CW, height: MH }}
      >
        {line(mt.slotA, { hidden: hide(gi * 2, mt.slotA), latest: isLatest(gi * 2), win: winA, lose: winB, num: numbered ? drawNo[gi * 2] : undefined, mirror, top: true })}
        {line(mt.slotB, { hidden: hide(gi * 2 + 1, mt.slotB), latest: isLatest(gi * 2 + 1), win: winB, lose: winA, num: numbered ? drawNo[gi * 2 + 1] : undefined, mirror, top: false })}
      </div>
    );
  };

  // ── Connector lines (main bracket) ──
  const paths: string[] = [];
  for (let r = 0; r < sides; r++) {
    for (let i = 0; i < perSide(r); i++) {
      const toFinal = r === sides - 1;
      const y1 = cy(r, i);
      const y2 = toFinal ? H / 2 : cy(r + 1, Math.floor(i / 2));
      // left side → right
      const lx1 = xL(r) + CW, lx2 = toFinal ? finalX : xL(r + 1);
      paths.push(`M${lx1},${y1} H${lx1 + CONN / 2} V${y2} H${lx2}`);
      // right side → left
      const rx1 = xR(r), rx2 = toFinal ? finalX + CW : xR(r + 1) + CW;
      paths.push(`M${rx1},${y1} H${rx1 - CONN / 2} V${y2} H${rx2}`);
    }
  }

  const label = (text: string, x: number, w = CW, tone = "text-slate-500 bg-slate-100") => (
    <div key={`${text}-${x}`} className={`absolute text-center text-[10px] font-black uppercase tracking-wider rounded ${tone}`} style={{ left: x, width: w, top: 0, height: HEAD - 6, lineHeight: `${HEAD - 6}px` }}>
      {text}
    </div>
  );

  // ── Repechage block ──
  const repRound = hasRep ? rounds[m] : [];
  const bronzeRound = hasRep ? rounds[m + 1] ?? [] : [];
  const REP_H = MH * 2 + 24;

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto" style={{ width }}>
        {/* Round labels */}
        <div className="relative" style={{ height: HEAD }}>
          {Array.from({ length: sides }, (_, r) => label(getRoundLabel(rounds, r), xL(r)))}
          {label("Final", finalX, CW, "text-orange-700 bg-orange-100")}
          {Array.from({ length: sides }, (_, r) => label(getRoundLabel(rounds, r), xR(r)))}
        </div>

        {/* Main bracket */}
        <div className="relative" style={{ height: mainH }}>
          <svg className="absolute inset-0 pointer-events-none" width={width} height={mainH}>
            <g stroke="#94A3B8" strokeWidth={1.25} fill="none">
              {paths.map((d, i) => <path key={i} d={d} />)}
            </g>
          </svg>

          {Array.from({ length: sides }, (_, r) =>
            Array.from({ length: perSide(r) }, (_, i) => [
              card(rounds[r][i], r, i, xL(r), topOf(r, i), false),
              card(rounds[r][perSide(r) + i], r, perSide(r) + i, xR(r), topOf(r, i), true),
            ])
          )}

          {/* Final + bronze + placings in the middle column */}
          {card(finalMatch, sides, 0, finalX, finalTop, false, "border-[#FF7400] border-2")}
          {mainBronze && (
            <>
              <div className="absolute text-center text-[9px] font-black uppercase tracking-wider text-amber-700" style={{ left: finalX, width: CW, top: bronzeTop - 14 }}>Bronze</div>
              {card(mainBronze, sides, 1, finalX, bronzeTop, false, "border-amber-400")}
            </>
          )}
          <div className="absolute rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5" style={{ left: finalX, width: CW, top: placingsTop }}>
            <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5"><Trophy size={10} className="text-[#FF7400]" /> Placings</p>
            {placings.map(([place, s], i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ height: 20 }}>
                <span className={`w-4 font-black ${place === "1" ? "text-yellow-600" : place === "2" ? "text-slate-500" : "text-amber-700"}`}>{place}.</span>
                {s && !revealing && s.playerId ? (
                  <span className="flex items-center gap-1 min-w-0">
                    {repOf(s)?.code && <span className="text-[9px] font-black text-blue-600">{repOf(s)!.code}</span>}
                    <span className="font-bold text-slate-800 truncate">{s.playerName}</span>
                  </span>
                ) : <span className="flex-1 border-b border-slate-200" />}
              </div>
            ))}
          </div>
        </div>

        {/* Repechage */}
        {hasRep && repRound.length > 0 && (
          <div className="mt-4 pt-3 border-t-2 border-dashed border-slate-200">
            <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Repechage</p>
            <div className="relative" style={{ height: REP_H }}>
              <svg className="absolute inset-0 pointer-events-none" width={width} height={REP_H}>
                <g stroke="#94A3B8" strokeWidth={1.25} fill="none">
                  {repRound.map((_, i) => {
                    const left = i === 0;
                    const y1 = MH / 2, y2 = MH / 2 + 24 + ROW / 2 + 1;
                    const x1 = left ? CW : width - CW;
                    const x2 = left ? step : width - step;
                    const xm = left ? x1 + CONN / 2 : x1 - CONN / 2;
                    return <path key={i} d={`M${x1},${y1} H${xm} V${y2} H${x2}`} />;
                  })}
                </g>
              </svg>
              {repRound.map((mt, i) => card(mt, REP_ROUND, i, i === 0 ? 0 : width - CW, 0, i !== 0))}
              {bronzeRound.map((mt, i) => card(mt, REP_ROUND, i, i === 0 ? step : width - step - CW, MH / 2 + 24, i !== 0, "border-amber-400"))}
              <div className="absolute text-center text-[10px] font-black uppercase tracking-wider text-amber-700" style={{ left: finalX, width: CW, top: MH / 2 + 24 + ROW / 2 - 6 }}>3rd places</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
