// ─── Pure bracket-generation & bracket-traversal helpers ─────────────────────
// No React, no side effects (besides Date.now()/Math.random() for match IDs).
// Extracted out of page.tsx so page.tsx and BracketView.tsx can both use them.

import type { BracketMatch, BracketSlot, DrawCategory, RegisteredPlayer, Seeds } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function nextPow2(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }

// Auto-advance non-BYE players through any BYE match (cascades through all rounds)
export function processByeMatches(rounds: BracketMatch[][]): BracketMatch[][] {
  const r = rounds.map(row => row.map(m => ({ ...m })));
  for (let ri = 0; ri < r.length; ri++) {
    for (let mi = 0; mi < r[ri].length; mi++) {
      const m = r[ri][mi];
      if (m.status === "COMPLETED") continue;
      const aIsBye = m.slotA.isBye || (!m.slotA.playerId && m.slotA.playerName !== "TBD");
      const bIsBye = m.slotB.isBye || (!m.slotB.playerId && m.slotB.playerName !== "TBD");
      let winner: BracketSlot | null = null;
      if (aIsBye && m.slotB.playerId) winner = m.slotB;
      else if (bIsBye && m.slotA.playerId) winner = m.slotA;
      if (!winner) continue;
      r[ri][mi] = { ...m, winnerId: winner.playerId, status: "COMPLETED" };
      if (ri + 1 < r.length) {
        const nextIdx = Math.floor(mi / 2);
        const next = { ...r[ri + 1][nextIdx] };
        if (mi % 2 === 0) next.slotA = { ...winner };
        else next.slotB = { ...winner };
        r[ri + 1][nextIdx] = next;
      }
    }
  }
  return r;
}

// Backfill the auto-generated Bronze (3rd place) match with semifinal losers.
// Plain elimination brackets append this match as the 2nd match of the Final round
// (see generateIJFBracket), but nothing ever wired the semifinal losers into it —
// this repairs already-saved draws where completed semifinals left it stuck at "TBD vs TBD".
export function backfillBronzeMatches(rounds: BracketMatch[][]): BracketMatch[][] {
  const hasDoubleRepechage = rounds.some(r => r.some(m => m.matchId.startsWith("rr_rep1_m2")));
  const hasSingleRepechage = !hasDoubleRepechage && rounds.some(r => r.some(m => m.matchId.startsWith("rr_rep")));
  if (hasDoubleRepechage || hasSingleRepechage) return rounds; // these formats fill their own dedicated bronze round

  const finalRoundIdx = rounds.length - 1;
  const semiRoundIdx = finalRoundIdx - 1;
  if (semiRoundIdx < 0) return rounds;
  if (rounds[finalRoundIdx].length !== 2 || rounds[semiRoundIdx].length !== 2) return rounds;

  const r = rounds.map(row => row.map(m => ({ ...m })));
  const bronzeMatch = { ...r[finalRoundIdx][1] };
  let changed = false;

  [0, 1].forEach((mi) => {
    const semi = r[semiRoundIdx][mi];
    if (semi.status !== "COMPLETED" || !semi.winnerId) return;
    const loserIsA = semi.winnerId !== semi.slotA.playerId;
    const loser = loserIsA ? semi.slotA : semi.slotB;
    if (!loser.playerId) return;

    const targetSlot = mi === 0 ? "slotA" : "slotB";
    if (bronzeMatch[targetSlot].playerId !== loser.playerId) {
      bronzeMatch[targetSlot] = { playerId: loser.playerId, playerName: loser.playerName, club: loser.club, isBye: false, coachName: loser.coachName };
      changed = true;
    }
  });

  if (changed) r[finalRoundIdx][1] = bronzeMatch;
  return r;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clubSeparatedShuffle(players: RegisteredPlayer[]): RegisteredPlayer[] {
  const shuffled = shuffleArray(players);
  const clubGroups: Record<string, RegisteredPlayer[]> = {};
  for (const p of shuffled) {
    if (!clubGroups[p.club]) clubGroups[p.club] = [];
    clubGroups[p.club].push(p);
  }
  
  const sortedClubs = Object.values(clubGroups).sort((a, b) => b.length - a.length);
  const result: RegisteredPlayer[] = [];
  
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const group of sortedClubs) {
      if (group.length > 0) {
        result.push(group.shift()!);
        hasMore = true;
      }
    }
  }
  return result;
}

export function isDrawRoundRobin(draw: DrawCategory | undefined) {
  if (!draw || !draw.rounds || draw.rounds.length === 0) return false;
  const firstRound = draw.rounds[0];
  if (!firstRound || firstRound.length === 0) return false;
  const firstMatch = firstRound[0];
  return firstMatch.matchId.startsWith("rr_");
}

// ─── Round Robin Bracket Generator (For <= 5 Players) ───────────────────────────
export function generateRoundRobin(players: RegisteredPlayer[]): BracketMatch[][] {
  const n = players.length;
  if (n < 2) return [];

  // Special Case for exactly 3 players to enforce standard IJF schedule order:
  // Round 1: 1 vs 2, Round 2: 2 vs 3, Round 3: 3 vs 1
  if (n === 3) {
    const p1 = players[0];
    const p2 = players[1];
    const p3 = players[2];
    return [
      [
        {
          matchId: `rr_r1_m1_${Date.now()}`,
          round: 1,
          matchNumber: 1,
          matNumber: 1,
          status: "PENDING",
          winnerId: null,
          slotA: { playerId: p1.id, playerName: p1.name, club: p1.club, isBye: false },
          slotB: { playerId: p2.id, playerName: p2.name, club: p2.club, isBye: false },
        }
      ],
      [
        {
          matchId: `rr_r2_m1_${Date.now()}`,
          round: 2,
          matchNumber: 1,
          matNumber: 1,
          status: "PENDING",
          winnerId: null,
          slotA: { playerId: p2.id, playerName: p2.name, club: p2.club, isBye: false },
          slotB: { playerId: p3.id, playerName: p3.name, club: p3.club, isBye: false },
        }
      ],
      [
        {
          matchId: `rr_r3_m1_${Date.now()}`,
          round: 3,
          matchNumber: 1,
          matNumber: 1,
          status: "PENDING",
          winnerId: null,
          slotA: { playerId: p3.id, playerName: p3.name, club: p3.club, isBye: false },
          slotB: { playerId: p1.id, playerName: p1.name, club: p1.club, isBye: false },
        }
      ]
    ];
  }
  
  // If odd number of players, add a dummy BYE player
  const pList = [...players];
  if (n % 2 !== 0) {
    pList.push({ id: "BYE", name: "BYE" } as any);
  }
  
  const totalRounds = pList.length - 1;
  const matchesPerRound = pList.length / 2;
  const rounds: BracketMatch[][] = [];
  
  for (let r = 0; r < totalRounds; r++) {
    const roundMatches: BracketMatch[] = [];
    for (let m = 0; m < matchesPerRound; m++) {
      const p1 = pList[m];
      const p2 = pList[pList.length - 1 - m];
      
      // Skip if it's a BYE match
      if (p1.id !== "BYE" && p2.id !== "BYE") {
        roundMatches.push({
          matchId: `rr_r${r + 1}_m${m + 1}_${Date.now()}`,
          round: r + 1,
          matchNumber: m + 1,
          matNumber: 1,
          status: "PENDING",
          winnerId: null,
          slotA: { playerId: p1.id, playerName: p1.name, club: p1.club, isBye: false },
          slotB: { playerId: p2.id, playerName: p2.name, club: p2.club, isBye: false },
        });
      }
    }
    // Only push if the round has matches
    if (roundMatches.length > 0) {
      rounds.push(roundMatches);
    }
    
    // Rotate players for next round (keep first player fixed)
    const last = pList.pop()!;
    pList.splice(1, 0, last);
  }
  
  return rounds;
}

// ─── IJF BYE Distribution Order ───────────────────────────────────────────────
// Standard IJF BYE allocation order:
// For odd BYE count B, (B+1)/2 BYEs go to the lower half and (B-1)/2 BYEs go to the upper half.
// For even BYE count B, B/2 BYEs go to each half.
// Priority order:
// 1. lower half - last lower
// 2. upper half - first upper
// 3. lower half - first upper
// 4. upper half - last lower
// 5. lower half - second last lower
// 6. upper half - second upper
// 7. lower half - second upper
// 8. upper half - second last lower
export function getByeMatchOrder(M: number): number[] {
  const order: number[] = [];
  const added = new Set<number>();

  const add = (idx: number) => {
    if (idx >= 0 && idx < M && !added.has(idx)) {
      order.push(idx);
      added.add(idx);
    }
  };

  const half = Math.floor(M / 2);
  const steps = Math.max(1, half);
  for (let k = 0; k < steps; k++) {
    // 1. lower half - last lower
    add(M - 1 - k);
    // 2. upper half - first upper
    add(k);
    // 3. lower half - first upper
    add(half + k);
    // 4. upper half - last lower
    add(half - 1 - k);
  }

  for (let i = 0; i < M; i++) {
    add(i);
  }

  return order;
}

// ─── IJF Bracket Generator ────────────────────────────────────────────────────
export function generateIJFBracket(players: RegisteredPlayer[], seeds: Seeds, shuffleMethod: "random" | "club-separated" = "club-separated"): BracketMatch[][] {
  const N = nextPow2(Math.max(players.length, 2));
  const M = N / 2; // Number of matches in Round 1
  const B = N - players.length; // Number of BYEs
  const slots: (RegisteredPlayer | null | "BYE")[] = new Array(N).fill(null);

  // Seeding positions based on previous tournament ranking:
  // 1st place (Seed 1) -> second half (bottom, N - 1)
  // 2nd place (Seed 2) -> first half (top, 0)
  // 3rd place (Seed 3) -> second half (3rd quarter, floor((3 * N) / 4))
  // 4th place (Seed 4) -> first half (2nd quarter, floor(N / 4))
  if (seeds[1]) slots[N - 1] = { ...seeds[1], seedNumber: 1 };
  if (seeds[2]) slots[0] = { ...seeds[2], seedNumber: 2 };
  if (seeds[3]) slots[Math.floor((3 * N) / 4)] = { ...seeds[3], seedNumber: 3 };
  if (seeds[4]) slots[Math.floor(N / 4)] = { ...seeds[4], seedNumber: 4 };

  const seededIds = new Set(
    [seeds[1], seeds[2], seeds[3], seeds[4]].filter(Boolean).map((p) => p!.id)
  );
  const nonSeeded = shuffleMethod === "club-separated"
    ? clubSeparatedShuffle(players.filter((p) => !seededIds.has(p.id)))
    : shuffleArray(players.filter((p) => !seededIds.has(p.id)));

  // Determine which matches get a BYE following standard IJF distribution order
  const byeMatches = new Set<number>();
  if (B > 0) {
    const byeOrder = getByeMatchOrder(M);
    for (let i = 0; i < Math.min(B, byeOrder.length); i++) {
      byeMatches.add(byeOrder[i]);
    }
  }


  // Assign BYEs to the slots of those matches
  for (const matchIdx of byeMatches) {
    const slotA = matchIdx * 2;
    const slotB = matchIdx * 2 + 1;
    if (slots[slotA] !== null) slots[slotB] = "BYE";
    else if (slots[slotB] !== null) slots[slotA] = "BYE";
    else slots[slotB] = "BYE"; // Default to bottom slot
  }

  // Fill remaining slots with unseeded players
  let ni = 0;
  for (let i = 0; i < N; i++) {
    if (slots[i] === null) {
      slots[i] = nonSeeded[ni++] || null;
    }
  }

  const toSlot = (p: RegisteredPlayer | null | "BYE"): BracketSlot => {
    if (p === "BYE" || p === null) return { playerId: null, playerName: "BYE", club: "", isBye: true, coachName: "" };
    return { playerId: p.id, playerName: p.name, club: p.club, isBye: false, seedNumber: p.seedNumber, coachName: p.coachName };
  };

  const rounds: BracketMatch[][] = [];
  const r1: BracketMatch[] = [];
  for (let i = 0; i < N; i += 2) {
    r1.push({
      matchId: `M_1_${i / 2 + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      round: 1, matchNumber: i / 2 + 1, matNumber: (i / 2 % 3) + 1,
      slotA: toSlot(slots[i]), slotB: toSlot(slots[i + 1]),
      winnerId: null, status: "PENDING",
    });
  }
  rounds.push(r1);

  let count = N / 2;
  let rNum = 2;
  while (count > 1) {
    count = Math.floor(count / 2);
    const round: BracketMatch[] = [];
    for (let i = 0; i < count; i++) {
      round.push({
        matchId: `M_${rNum}_${i + 1}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        round: rNum, matchNumber: i + 1, matNumber: (i % 3) + 1,
        slotA: { playerId: null, playerName: "TBD", club: "", isBye: false, coachName: "" },
        slotB: { playerId: null, playerName: "TBD", club: "", isBye: false, coachName: "" },
        winnerId: null, status: "PENDING",
      });
    }

    if (count === 1 && N >= 4) {
      round.push({
        matchId: `M_BRONZE_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        round: rNum, matchNumber: 2, matNumber: 1, // Bronze match gets matchNumber 2 in the final round
        slotA: { playerId: null, playerName: "TBD", club: "", isBye: false, coachName: "" },
        slotB: { playerId: null, playerName: "TBD", club: "", isBye: false, coachName: "" },
        winnerId: null, status: "PENDING",
      });
    }

    rounds.push(round);
    rNum++;
  }
  return rounds;
}


export function roundName(ri: number, total: number, isRoundRobin = false): string {
  if (isRoundRobin) return `Round ${ri + 1}`;
  const fromEnd = total - ri;
  if (fromEnd === 1) return "🏆 Final";
  if (fromEnd === 2) return "Semi-Final";
  if (fromEnd === 3) return "Quarter-Final";
  return `Round ${ri + 1}`;
}

// Single/double-repechage formats append 2 extra rounds (a repechage round, then a
// bronze round) after the main elimination bracket. Those trailing rounds don't follow
// the main bracket's power-of-2 halving pattern, so callers need to treat them separately
// for both round-name labeling and vertical layout.
export function hasRepechageRounds(rounds: BracketMatch[][]): boolean {
  return rounds.some(r => r.some(m => m.matchId.startsWith("rr_rep") || m.matchId.startsWith("rr_bronze")));
}

export function mainBracketRoundCount(rounds: BracketMatch[][]): number {
  return hasRepechageRounds(rounds) ? rounds.length - 2 : rounds.length;
}

export function getEliminationFormatLabel(rounds: BracketMatch[][]): string {
  if (!rounds || !hasRepechageRounds(rounds)) {
    return "Straight Elimination";
  }
  const mainCount = mainBracketRoundCount(rounds);
  const repRound = rounds[mainCount];
  if (repRound) {
    if (repRound.length === 1 || repRound.some(m => m.slotA?.playerName?.includes("Finalist") || m.slotB?.playerName?.includes("Finalist"))) {
      return "Single Repechage";
    }
    if (repRound.length >= 2 || repRound.some(m => m.slotA?.playerName?.includes("QF") || m.slotB?.playerName?.includes("QF"))) {
      return "Double Repechage";
    }
  }
  return "Repechage";
}


// Repechage-aware replacement for roundName: labels the main bracket rounds normally
// (Quarter-Final/Semi-Final/Final relative to the true main-bracket size, not inflated
// by the trailing repechage/bronze rounds), then labels the two trailing rounds explicitly.
export function getRoundLabel(rounds: BracketMatch[][], ri: number, isRoundRobin = false): string {
  if (isRoundRobin) return `Round ${ri + 1}`;
  const mainCount = mainBracketRoundCount(rounds);
  if (ri < mainCount) return roundName(ri, mainCount, false);
  return ri === mainCount ? "Repechage" : "🥉 Bronze Medal";
}

export function findNextMatch(rounds: BracketMatch[][], currentRoundIndex: number, matchIndex: number, winner: BracketSlot) {
  if (currentRoundIndex >= rounds.length - 1) return null;

  const nextRound = rounds[currentRoundIndex + 1];
  const nextMatchIndex = Math.floor(matchIndex / 2);
  const nextMatch = nextRound[nextMatchIndex];

  if (!nextMatch) return null;

  const isSlotA = matchIndex % 2 === 0;
  const opponent = isSlotA ? nextMatch.slotB.playerName : nextMatch.slotA.playerName;

  return {
    roundIndex: currentRoundIndex + 1,
    matchNumber: nextMatch.matchNumber,
    matNumber: nextMatch.matNumber,
    opponent: opponent === "TBD" ? null : opponent,
  };
}


export const categoryKey = (age: string, exactAge: string, gender: string, weight: string) =>
  `${age}_${exactAge}_${gender}_${weight}`;
