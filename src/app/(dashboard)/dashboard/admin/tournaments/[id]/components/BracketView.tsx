"use client";

import { motion } from "framer-motion";
import { Monitor, Printer, Trophy, Download } from "lucide-react";
import type { BracketMatch, DrawCategory, RegisteredPlayer, Tournament } from "../types";
import { getRoundLabel, mainBracketRoundCount, getEliminationFormatLabel } from "../lib/bracketEngine";
import { exportRoundRobinPoolSheet, exportCategoryReport, exportCategoryChartPDF } from "../lib/pdfExport";

// Abbreviates a club name to its first 3 uppercase letters for compact match cards.
function clubCode(name: string): string {
  if (!name || name === "BYE" || name === "TBD") return name || "---";
  // Take first 3 uppercase letters (consonants preferred)
  const upper = name.toUpperCase().replace(/[^A-Z]/g, "");
  return upper.slice(0, 3) || "---";
}

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
}: {
  rounds: BracketMatch[][];
  onOpenScoreboard: (match: BracketMatch) => void;
  players: RegisteredPlayer[];
  tournament?: Tournament | null;
  currentKey?: string;
  currentDraw?: DrawCategory;
}) {
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

  const weightGroups = Array.from(new Set(players.map(p => p.weight))).sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 rounded-2xl shadow-sm border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black text-orange-400 text-xs">
            IJF
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-white">
              {isRoundRobin ? "Round Robin Bracket" : `${getEliminationFormatLabel(rounds)} Bracket`}
            </h4>
            <p className="text-[10px] text-slate-300 font-semibold">
              {players.length} Competitors {currentDraw?.matNumber ? `• MAT ${currentDraw.matNumber}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCategoryChartPDF(tournament || null, currentKey || "", currentDraw || ({ rounds } as DrawCategory), players)}
            className="text-xs bg-[#FF7400] hover:bg-[#e66800] text-white px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm border border-orange-400/30"
            title="Download Official Visual Competition Bracket Chart as PDF"
          >
            <Download size={13} /> Download Chart (PDF)
          </button>
          <button
            onClick={() => exportCategoryReport(tournament || null, currentKey || "", currentDraw || ({ rounds } as DrawCategory), players)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shadow-sm border border-slate-700"
            title="Print Entire Match Result Report for this Category"
          >
            <Printer size={13} /> Print Match Report
          </button>
        </div>
      </div>
      <div className="flex gap-6">
      {/* ── Left: Player List ────────────────────────────────────────────── */}
      <div className="w-56 shrink-0">
        {weightGroups.map((w) => {
          const wPlayers = players.filter(p => p.weight === w);
          return (
            <div key={w} className="mb-4">
              <p className="text-xs font-black text-blue-600 mb-2 pb-1 border-b border-slate-100">
                {w} kg <span className="text-slate-400 font-semibold">({wPlayers.length} players)</span>
              </p>
              <div className="space-y-1">
                {wPlayers.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 py-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black text-white ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                      {p.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[11px] font-bold text-slate-800 truncate leading-tight">{p.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">{p.gender === "FEMALE" ? "Female" : "Male"} · {p.district || p.club}</p>
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

              {/* Final Winner Connector */}
              {!isRoundRobin && (() => {
                if (mainRoundsCount === 0) return null;
                const finalMatch = rounds[mainRoundsCount - 1][0];
                if (finalMatch && finalMatch.status === "COMPLETED" && finalMatch.winnerId) {
                  const xBase = (mainRoundsCount - 1) * (MATCH_W + CONN_W) + MATCH_W;
                  const y1 = mCenterY(mainRoundsCount - 1, 0);
                  return (
                    <motion.g key="winner-line" initial={{ opacity: 0, pathLength: 0 }} animate={{ opacity: 1, pathLength: 1 }} transition={{ delay: 0.5, duration: 0.8 }} stroke="#FF7400" strokeWidth={2.5} fill="none">
                      <line x1={xBase} y1={y1} x2={xBase + CONN_W} y2={y1} />
                    </motion.g>
                  );
                }
                return null;
              })()}
            </svg>

            {/* Match cards */}
            {rounds.map((round, ri) => {
              const xOffset = ri * (MATCH_W + CONN_W);
              return round.map((match, mi) => {
                let top = mTop(ri, mi);
                const isBronzeMatch = !isRoundRobin && ri === rounds.length - 1 && mi === 1;
                
                if (isBronzeMatch) {
                  // Position the bronze match visually below the gold match
                  top = mTop(ri, 0) + MATCH_H + 40; // 40px gap
                }

                const isWinnerA = match.winnerId && match.winnerId === match.slotA.playerId;
                const isWinnerB = match.winnerId && match.winnerId === match.slotB.playerId;
                const staggerDelay = ri * 0.18 + mi * 0.07;

                return (
                  <motion.div
                    key={match.matchId}
                    style={{ position: "absolute", top, left: xOffset, width: MATCH_W, zIndex: 1 }}
                    initial={{ opacity: 0, x: -60, scale: 0.8, rotateY: -25 }}
                    animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                    transition={{ delay: staggerDelay, type: "spring", stiffness: 280, damping: 22 }}
                    className={`group bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-shadow ${
                      isBronzeMatch ? "border-amber-400 border-2" : "border-slate-200"
                    }`}
                  >
                    {isBronzeMatch && (
                      <div className="bg-gradient-to-r from-amber-500 to-amber-400 text-white text-[9px] font-black uppercase text-center py-0.5 tracking-wider">
                        🥉 Bronze Match
                      </div>
                    )}
                    {/* Player A row */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 min-h-[34px] ${match.slotA.isBye ? "opacity-25" : ""} ${isWinnerA ? "bg-emerald-50" : "hover:bg-blue-50/50"} transition-colors`}>
                      {match.slotA.seedNumber && (
                        <span className="shrink-0 text-[8px] font-black text-amber-600 bg-amber-100 w-4 h-4 rounded flex items-center justify-center">
                          {match.slotA.seedNumber}
                        </span>
                      )}
                      {!match.slotA.isBye && match.slotA.club && (
                        <span className="shrink-0 text-[9px] font-black text-blue-600">[{clubCode(match.slotA.club)}]</span>
                      )}
                      <span className={`text-[11px] font-bold truncate leading-tight ${match.slotA.isBye ? "text-slate-300 italic" : isWinnerA ? "text-emerald-700" : "text-slate-800"}`}>
                        {match.slotA.playerName}
                      </span>
                      {isWinnerA && <span className="ml-auto text-emerald-500 text-[9px] shrink-0">✓</span>}
                    </div>

                    {/* Player B row */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 min-h-[34px] ${match.slotB.isBye ? "opacity-25" : ""} ${isWinnerB ? "bg-emerald-50" : "hover:bg-blue-50/50"} transition-colors`}>
                      {match.slotB.seedNumber && (
                        <span className="shrink-0 text-[8px] font-black text-amber-600 bg-amber-100 w-4 h-4 rounded flex items-center justify-center">
                          {match.slotB.seedNumber}
                        </span>
                      )}
                      {!match.slotB.isBye && match.slotB.club && (
                        <span className="shrink-0 text-[9px] font-black text-blue-600">[{clubCode(match.slotB.club)}]</span>
                      )}
                      <span className={`text-[11px] font-bold truncate leading-tight ${match.slotB.isBye ? "text-slate-300 italic" : isWinnerB ? "text-emerald-700" : "text-slate-800"}`}>
                        {match.slotB.playerName}
                      </span>
                      {isWinnerB && <span className="ml-auto text-emerald-500 text-[9px] shrink-0">✓</span>}
                    </div>

                    {/* Match info + Scoreboard button */}
                    <div className="flex items-center justify-between px-2 py-0.5 bg-slate-50 border-t border-slate-100">
                      <span className="text-[8px] text-slate-400 font-semibold">
                        {match.status === "COMPLETED" ? "✓ Done" : `Mat ${match.matNumber} · #${match.matchNumber}`}
                      </span>
                      {!match.slotA.isBye && !match.slotB.isBye &&
                       match.slotA.playerName !== "TBD" && match.slotB.playerName !== "TBD" &&
                       match.status !== "COMPLETED" && (
                        <button
                          onClick={() => onOpenScoreboard(match)}
                          disabled={!(ri === 0 || rounds[ri - 1].every(m => m.status === "COMPLETED"))}
                          title={!(ri === 0 || rounds[ri - 1].every(m => m.status === "COMPLETED")) ? "Previous round must be completed first" : ""}
                          className={`text-[8px] font-black transition-colors flex items-center gap-0.5 opacity-0 group-hover:opacity-100 ${
                            (ri === 0 || rounds[ri - 1].every(m => m.status === "COMPLETED"))
                              ? "text-orange-500 hover:text-orange-700"
                              : "text-slate-400 cursor-not-allowed"
                          }`}>
                          <Monitor size={8} /> Scoreboard ↗
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              });
            })}

            {/* Champion Node */}
            {!isRoundRobin && (() => {
              if (mainRoundsCount === 0) return null;
              const finalMatch = rounds[mainRoundsCount - 1][0];
              if (!finalMatch || finalMatch.status !== "COMPLETED" || !finalMatch.winnerId) return null;

              const isSlotAWinner = finalMatch.winnerId === finalMatch.slotA.playerId;
              const championName = isSlotAWinner ? finalMatch.slotA.playerName : finalMatch.slotB.playerName;
              const championClub = isSlotAWinner ? finalMatch.slotA.club : finalMatch.slotB.club;
              const top = mCenterY(mainRoundsCount - 1, 0) - MATCH_H / 2;
              const xOffset = rounds.length * (MATCH_W + CONN_W);

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, x: -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: 0.7, type: "spring", stiffness: 200, damping: 15 }}
                  style={{ position: "absolute", top, left: xOffset, width: MATCH_W - 20, height: MATCH_H, zIndex: 2 }}
                  className="bg-gradient-to-r from-orange-500 to-[#FF7400] rounded-xl shadow-xl shadow-orange-500/30 overflow-hidden flex items-center justify-center border border-white"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-white opacity-10 rounded-bl-full" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 bg-white opacity-10 rounded-tr-full" />
                  
                  <div className="flex items-center gap-3 w-full px-4 relative z-10">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shrink-0 shadow-inner">
                      <Trophy size={20} className="text-[#FF7400]" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-grow">
                      <span className="text-[9px] font-black text-orange-100 uppercase tracking-widest leading-none mb-0.5">Gold Medalist</span>
                      <span className="text-sm font-black text-white truncate leading-tight">{championName}</span>
                      <span className="text-[10px] font-bold text-orange-200 truncate leading-tight">{championClub || "---"}</span>
                    </div>
                  </div>
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
            className="text-xs bg-white text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1 shadow-sm"
            title="Download Official Visual Pool Chart as PDF"
          >
            <Download size={12} /> Download Chart (PDF)
          </button>
          <button
            onClick={() => exportRoundRobinPoolSheet(tournament || null, currentKey || "", currentDraw as DrawCategory, players)}
            className="text-xs bg-white/20 hover:bg-white/35 px-2.5 py-1 rounded font-bold transition-all flex items-center gap-1 text-white border border-white/10"
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
