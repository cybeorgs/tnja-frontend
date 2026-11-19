// ─── Pure bracket-generation & bracket-traversal helpers ─────────────────────
// No React, no side effects (besides Date.now()/Math.random() for match IDs).
// Extracted out of page.tsx so page.tsx and BracketView.tsx can both use them.

import type { BracketMatch, BracketSlot, DrawCategory, RegisteredPlayer, Seeds } from "../types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function nextPow2(n: number): number { let p = 1; while (p < n) p <<= 1; return p; }

// Auto-advance non-BYE players through any BYE match (cascades through all rounds)
export function processByeMatches(rounds: BracketMatch[][]): BracketMatch[][] {
  const r = rounds.map(row => row.map(m => ({ ...m })));
  // Repechage / bronze rounds are filled by syncRepechage: their "Loser of QF 1" placeholders
  // are players still to come, not BYEs, and the main bracket's "next round" rule doesn't apply.
  const mainCount = mainBracketRoundCount(r);
  for (let ri = 0; ri < mainCount; ri++) {
    for (let mi = 0; mi < r[ri].length; mi++) {
      const m = r[ri][mi];
      if (m.status === "COMPLETED") continue;
      const aIsBye = m.slotA.isBye || (!m.slotA.playerId && m.slotA.playerName !== "TBD");
      const bIsBye = m.slotB.isBye || (!m.slotB.playerId && m.slotB.playerName !== "TBD");
      let winner: BracketSlot | null = null;
      if (aIsBye && m.slotB.playerId) winner = m.slotB;
      else if (bIsBye && m.slotA.playerId) winner = m.slotA;
      // An empty match (two explicit BYEs, from a draw with extra first-round fights) passes a BYE on,
      // so its next-round opponent goes through. Placeholder slots ("Loser of QF 1") never count here.
      else if (m.slotA.isBye && m.slotB.isBye) winner = { playerId: null, playerName: "BYE", club: "", isBye: true, coachName: "" };
      if (!winner) continue;
      r[ri][mi] = { ...m, winnerId: winner.playerId, status: "COMPLETED", winMethod: m.winMethod || "Walkover (BYE)" };
      if (ri + 1 < mainCount) {
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

/**
 * A draw's rounds as stored by the API, made ready to use: parsed if they came as a JSON string,
 * BYE winners moved on into the next round, and semi-final losers placed in the bronze match.
 * Every page that reads a draw (admin, coach mats, scoreboard, draw view) must use this, or a
 * player who got a BYE shows as "TBD" in the next round.
 */
export function normaliseRounds(raw: unknown): BracketMatch[][] {
  let rounds = raw;
  if (typeof rounds === "string") {
    try { rounds = JSON.parse(rounds); } catch { rounds = []; }
  }
  if (!Array.isArray(rounds) || rounds.length === 0) return [];
  return backfillBronzeMatches(syncRepechage(processByeMatches(rounds as BracketMatch[][])));
}

// ─── Repechage progression ───────────────────────────────────────────────────
const BYE_SLOT: BracketSlot = { playerId: null, playerName: "BYE", club: "", isBye: true, coachName: "" };
const placeholderSlot = (label: string): BracketSlot => ({ playerId: null, playerName: label, club: "", isBye: false });
const copySlot = (s: BracketSlot): BracketSlot =>
  ({ playerId: s.playerId, playerName: s.playerName, club: s.club, isBye: !!s.isBye, coachName: s.coachName, seedNumber: s.seedNumber });
const VOID_RESULT = { winnerId: null, status: "PENDING" as const, scoreA: undefined, scoreB: undefined, winMethod: undefined, elapsedSeconds: undefined };
const winnerInMatch = (m: BracketMatch) => !m.winnerId || m.winnerId === m.slotA.playerId || m.winnerId === m.slotB.playerId;

/** Winner / loser slot of a finished match, or null while it hasn't been decided. */
function decided(m: BracketMatch | undefined, want: "winner" | "loser"): BracketSlot | null {
  if (!m || m.status !== "COMPLETED") return null;
  const aWon = m.winnerId ? m.winnerId === m.slotA.playerId : false;
  const bWon = m.winnerId ? m.winnerId === m.slotB.playerId : false;
  if (!aWon && !bWon) return m.slotA.isBye && m.slotB.isBye ? BYE_SLOT : null;
  const pick = (want === "winner") === aWon ? m.slotA : m.slotB;
  return pick.playerId ? copySlot(pick) : BYE_SLOT;
}

const sameSlot = (a: BracketSlot, b: BracketSlot) =>
  a.playerId === b.playerId && !!a.isBye === !!b.isBye && (!!a.playerId || !!a.isBye || a.playerName === b.playerName);

/** Puts a slot into a repechage / bronze match. */
function setSlot(m: BracketMatch, side: "slotA" | "slotB", want: BracketSlot): BracketMatch {
  return sameSlot(m[side], want) ? m : { ...m, [side]: want };
}

/**
 * A repechage / bronze match decided between players who are no longer in it (a wrongly routed or
 * stale result) is void; one with a BYE on one side is won by the other player once they arrive.
 */
function settle(m: BracketMatch): BracketMatch {
  if (!winnerInMatch(m)) return { ...m, ...VOID_RESULT };
  if (m.status === "COMPLETED") {
    // "completed" while a side is still a placeholder (old BYE bug) is not a real result
    const open = (x: BracketSlot) => !x.playerId && !x.isBye;
    return open(m.slotA) || open(m.slotB) ? { ...m, ...VOID_RESULT } : m;
  }
  if (m.slotA.isBye && m.slotB.playerId) return { ...m, winnerId: m.slotB.playerId, status: "COMPLETED", winMethod: "Walkover (BYE)" };
  if (m.slotB.isBye && m.slotA.playerId) return { ...m, winnerId: m.slotA.playerId, status: "COMPLETED", winMethod: "Walkover (BYE)" };
  if (m.slotA.isBye && m.slotB.isBye) return { ...m, winnerId: null, status: "COMPLETED" };
  return m;
}

/**
 * Fills the repechage and bronze rounds from the main bracket's results, so every page and every
 * writer (admin tab, referee scoreboard, coach panel) sees the same, correct progression.
 *   Double repechage: Rep k = losers of QF 2k-1 & 2k; Bronze 1 = Rep 1 winner v SF 2 loser,
 *   Bronze 2 = Rep 2 winner v SF 1 loser.
 *   Single repechage: Rep = champion's QF victim v champion's SF victim; Bronze = Rep winner v runner-up.
 * A slot whose source match isn't decided yet shows its placeholder again.
 */
export function syncRepechage(rounds: BracketMatch[][]): BracketMatch[][] {
  const kind = repechageKindOf(rounds);
  if (!kind) return rounds;
  const main = mainBracketRoundCount(rounds);
  const qfIdx = main - 3, sfIdx = main - 2, finalIdx = main - 1;
  const repIdx = main, bronzeIdx = main + 1;
  if (finalIdx < 0 || !rounds[repIdx]?.length || !rounds[bronzeIdx]?.length) return rounds;
  const r = rounds.map((row) => row.map((m) => ({ ...m })));
  const or = (s: BracketSlot | null, label: string) => s ?? placeholderSlot(label);

  if (kind === "double") {
    r[repIdx].forEach((m, k) => {
      const qfA = qfIdx >= 0 ? r[qfIdx][2 * k] : undefined, qfB = qfIdx >= 0 ? r[qfIdx][2 * k + 1] : undefined;
      let next = setSlot(m, "slotA", or(decided(qfA, "loser"), `Loser of QF ${2 * k + 1}`));
      next = setSlot(next, "slotB", or(decided(qfB, "loser"), `Loser of QF ${2 * k + 2}`));
      r[repIdx][k] = settle(next);
    });
    r[bronzeIdx].forEach((m, k) => {
      const sf = r[sfIdx]?.[k === 0 ? 1 : 0];
      let next = setSlot(m, "slotA", or(decided(r[repIdx][k], "winner"), `Winner of Rep ${k + 1}`));
      next = setSlot(next, "slotB", or(decided(sf, "loser"), `Loser of Semifinal ${k === 0 ? 2 : 1}`));
      r[bronzeIdx][k] = settle(next);
    });
  } else {
    const fin = r[finalIdx][0];
    const champ = decided(fin, "winner");
    const beatenBy = (ri: number) => {
      if (ri < 0 || !champ?.playerId) return null;
      const m = r[ri].find((x) => x.slotA.playerId === champ.playerId || x.slotB.playerId === champ.playerId);
      return decided(m, "loser");
    };
    let rep0 = setSlot(r[repIdx][0], "slotA", or(beatenBy(qfIdx), "Finalist's QF Loser"));
    rep0 = setSlot(rep0, "slotB", or(beatenBy(sfIdx), "Finalist's SF Loser"));
    r[repIdx][0] = settle(rep0);
    let br = setSlot(r[bronzeIdx][0], "slotA", or(decided(r[repIdx][0], "winner"), "Winner of Rep 1"));
    br = setSlot(br, "slotB", or(decided(fin, "loser"), "Loser of Finals (Runner-up)"));
    r[bronzeIdx][0] = settle(br);
  }
  return r;
}

/**
 * Records a result and moves players on: the winner to the next main-bracket match (a plain
 * bracket's semi-final loser to its bronze match), and the repechage / bronze rounds rebuilt.
 * Shared by the admin tab and the scoreboard so they can never disagree.
 */
export function applyMatchResult(
  raw: BracketMatch[][],
  matchId: string,
  result: Partial<BracketMatch> & { winnerId: string | null; status: BracketMatch["status"] }
): BracketMatch[][] {
  const r = raw.map((row) => row.map((m) => ({ ...m })));
  const ri = r.findIndex((row) => row.some((m) => m.matchId === matchId));
  if (ri < 0) return raw;
  const mi = r[ri].findIndex((m) => m.matchId === matchId);
  r[ri][mi] = { ...r[ri][mi], ...result };
  const m = r[ri][mi];
  const main = mainBracketRoundCount(r);
  if (m.status === "COMPLETED" && m.winnerId && ri + 1 < main && !m.matchId.startsWith("M_BRONZE_")) {
    const win = m.winnerId === m.slotA.playerId ? m.slotA : m.slotB;
    const ni = Math.floor(mi / 2);
    const target = r[ri + 1][ni];
    if (target) r[ri + 1][ni] = { ...target, [mi % 2 === 0 ? "slotA" : "slotB"]: copySlot(win) };
  }
  return backfillBronzeMatches(syncRepechage(processByeMatches(r)));
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

  // A 3-player bracket has only one semi-final loser; the other bronze side is a BYE (see
  // tagSmallRepechage), so that loser takes bronze by walkover.
  if (bronzeMatch.status !== "COMPLETED") {
    const winner = bronzeMatch.slotA.playerId && bronzeMatch.slotB.isBye ? bronzeMatch.slotA
      : bronzeMatch.slotB.playerId && bronzeMatch.slotA.isBye ? bronzeMatch.slotB : null;
    if (winner) {
      bronzeMatch.status = "COMPLETED";
      bronzeMatch.winnerId = winner.playerId;
      changed = true;
    }
  }

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

  // The association wants the opening match to be a real fight, so match 1 takes a bye last.
  // A bracket always has fewer byes than first-round matches, so in practice it never gets one.
  return M > 1 ? [...order.filter((i) => i !== 0), 0] : order;
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

  return bracketFromSlots(slots);
}

/**
 * A straight-elimination bracket from its first-round places (match 1 A, match 1 B, match 2 A, …).
 * A place is a player, or "BYE"/null for a bye. Later rounds start empty ("TBD"); with 4+ places the
 * final round also has the bronze match.
 */
export function bracketFromSlots(slots: (RegisteredPlayer | null | "BYE")[]): BracketMatch[][] {
  const N = slots.length;
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
  const hint = rounds?.[0]?.[0]?.formatHint;
  if (hint) return hint === "double-repechage" ? "Double Repechage" : "Single Repechage";
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

// ── Repechage rounds ──────────────────────────────────────────────────────────
export type RepechageKind = "single" | "double";

/** Which repechage format a saved draw uses (null for straight elimination / round robin). */
export function repechageKindOf(rounds: BracketMatch[][]): RepechageKind | null {
  if (rounds.some((r) => r.some((m) => m.matchId.startsWith("rr_rep1_m2")))) return "double";
  if (rounds.some((r) => r.some((m) => m.matchId.startsWith("rr_rep")))) return "single";
  return null;
}

/**
 * Appends the repechage round and its bronze round to a main elimination bracket. Used both
 * when a draw is generated and when an edited draw is rebuilt, so the two always match.
 * The main bracket's generic "TBD vs TBD" consolation bronze (M_BRONZE_) is dropped: these
 * formats supply their own bronze round, and the phantom match would never be filled.
 */
export function appendRepechageRounds(main: BracketMatch[][], kind: RepechageKind): BracketMatch[][] {
  const rounds = main.map((r) => [...r]);
  const finalIdx = rounds.length - 1;
  rounds[finalIdx] = rounds[finalIdx].filter((m) => !m.matchId.startsWith("M_BRONZE_"));
  const total = rounds.length;
  const stamp = Date.now();
  const slot = (playerName: string): BracketSlot => ({ playerId: null, playerName, club: "", isBye: false });
  const match = (matchId: string, round: number, matchNumber: number, a: string, b: string): BracketMatch => ({
    matchId, round, matchNumber, matNumber: 1, status: "PENDING", winnerId: null, slotA: slot(a), slotB: slot(b),
  });

  if (kind === "double") {
    rounds.push([
      match(`rr_rep1_m1_${stamp}`, total + 1, 1, "Loser of QF 1", "Loser of QF 2"),
      match(`rr_rep1_m2_${stamp}`, total + 1, 2, "Loser of QF 3", "Loser of QF 4"),
    ]);
    rounds.push([
      match(`rr_bronze1_${stamp}`, total + 2, 1, "Winner of Rep 1", "Loser of Semifinal 2"),
      match(`rr_bronze2_${stamp}`, total + 2, 2, "Winner of Rep 2", "Loser of Semifinal 1"),
    ]);
  } else {
    rounds.push([match(`rr_rep1_m1_${stamp}`, total + 1, 1, "Finalist's QF Loser", "Finalist's SF Loser")]);
    rounds.push([match(`rr_bronze1_${stamp}`, total + 2, 1, "Winner of Rep 1", "Loser of Finals (Runner-up)")]);
  }
  return rounds;
}

/**
 * A 3–4 player bracket has no quarter-final, so a repechage format can't add a repechage round.
 * Double repechage: both semi-final losers get bronze (no bronze match). Single repechage: one
 * bronze match between the semi-final losers. Tagged with the chosen format so the draw keeps
 * its name (and keeps it when edited).
 */
export function tagSmallRepechage(rounds: BracketMatch[][], method: "single-repechage" | "double-repechage"): BracketMatch[][] {
  if (!rounds[0]?.[0]) return rounds;
  const copy = rounds.map((r) => [...r]);
  copy[0][0] = { ...copy[0][0], formatHint: method };

  const last = copy.length - 1;
  const bronzeIdx = copy[last].findIndex((m) => m.matchId.startsWith("M_BRONZE_"));

  // Double repechage awards two bronze medals: with no quarter-finals, both semi-final losers take
  // 3rd place directly, so there is no bronze match (placements treat a bracket without one that way).
  if (method === "double-repechage") {
    if (bronzeIdx >= 0) copy[last] = copy[last].filter((_, i) => i !== bronzeIdx);
    return copy;
  }

  // Single repechage: one bronze match between the semi-final losers. A semi-final that is a bye
  // produces no loser, so that side is a BYE and the other loser takes bronze by walkover.
  if (copy.length === 2 && bronzeIdx >= 0) {
    const bronze = { ...copy[last][bronzeIdx] };
    copy[0].forEach((semi, mi) => {
      if (mi > 1 || !(semi.slotA.isBye || semi.slotB.isBye)) return;
      const bye: BracketSlot = { playerId: null, playerName: "BYE", club: "", isBye: true, coachName: "" };
      if (mi === 0) bronze.slotA = bye; else bronze.slotB = bye;
    });
    copy[last][bronzeIdx] = bronze;
  }
  return copy;
}

// ── Draw setup: draw numbers, byes chosen by the organiser ────────────────────
/** Smallest elimination bracket (power of two) that holds n players. */
export const bracketSizeFor = (n: number) => { let s = 2; while (s < n) s *= 2; return s; };

/**
 * Draw number of each bracket place, top to bottom. 8 places → 01,05,03,07 | 02,06,04,08:
 * 01 and 02 can only meet in the final, 03 and 04 sit in the other quarters, and number k
 * fights number k + size/2 in round 1 (the layout used on the association's draw sheets).
 */
export function drawNumberOrder(size: number): number[] {
  if (size <= 2) return [1, 2].slice(0, Math.max(size, 1));
  return drawNumberOrder(size / 2).flatMap((k) => [k, k + size / 2]);
}

/**
 * How an n-player category is laid out: bracket size, first-round fights and byes. Unused high
 * draw numbers are byes, so the players holding the matching low numbers go straight to round 2.
 */
export function drawSetupFor(n: number, fights?: number) {
  const size = bracketSizeFor(n);
  const half = size / 2;
  // Fewest first-round fights the bracket allows (the standard draw), and the most possible.
  const minFights = Math.max(0, n - half);
  const maxFights = Math.floor(n / 2);
  const f = Math.min(maxFights, Math.max(minFights, fights ?? minFights));
  const byes = n - 2 * f;
  // First-round match k pairs number k with k + half: fights take k = 1..f, byes the next numbers,
  // and any left over are empty (no players) — their bye carries into round 2.
  const empties = half - f - byes;
  const byeNumbers = Array.from({ length: byes }, (_, i) => f + i + 1);
  const fightNumbers = [
    ...Array.from({ length: f }, (_, i) => i + 1),
    ...Array.from({ length: f }, (_, i) => half + i + 1),
  ];
  return { size, byes, firstRoundFights: f, minFights, maxFights, empties, byeNumbers, fightNumbers };
}

const shuffled = <T,>(a: T[]) => { const c = [...a]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; };

/**
 * Bracket places for a draw: `byeIds` (exactly the number of byes) go straight to round 2; pass null
 * to pick them at random. Everyone else is drawn at random into the fight numbers, re-drawing a few
 * times to keep players of the same club apart in round 1 where possible.
 */
export function slotsFromDrawSetup(players: RegisteredPlayer[], byeIds: string[] | null, fights?: number): (RegisteredPlayer | "BYE")[] {
  const { size, byes, byeNumbers, fightNumbers } = drawSetupFor(players.length, fights);
  const half = size / 2;
  const chosen = byeIds && byeIds.length === byes ? new Set(byeIds) : new Set(shuffled(players).slice(0, byes).map((p) => p.id));
  const byePlayers = shuffled(players.filter((p) => chosen.has(p.id)));
  const fighters = players.filter((p) => !chosen.has(p.id));

  const byNumber = new Map<number, RegisteredPlayer>();
  byeNumbers.forEach((num, i) => { if (byePlayers[i]) byNumber.set(num, byePlayers[i]); });

  // Random fighter order, keeping the arrangement with the fewest same-club first-round pairs.
  let best: RegisteredPlayer[] = fighters;
  let bestClash = Infinity;
  for (let attempt = 0; attempt < 60 && bestClash > 0; attempt++) {
    const order = shuffled(fighters);
    const at = new Map(fightNumbers.map((num, i) => [num, order[i]]));
    let clash = 0;
    for (const num of fightNumbers) {
      if (num > half) continue;
      const a = at.get(num), b = at.get(num + half);
      if (a?.club && b?.club && a.club === b.club) clash++;
    }
    if (clash < bestClash) { bestClash = clash; best = order; }
  }
  fightNumbers.forEach((num, i) => byNumber.set(num, best[i]));

  return drawNumberOrder(size).map((num) => byNumber.get(num) ?? "BYE");
}
