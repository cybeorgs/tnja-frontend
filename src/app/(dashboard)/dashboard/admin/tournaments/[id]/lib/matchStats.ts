// ─── Match status stats (Not Started / Live / Completed) ─────────────────────
// Pure — no React, no closures over component state. `draws` is passed in.

import type { BracketMatch, DrawCategory } from "../types";

export type MatchStats = { notStarted: number; live: number; completed: number; total: number };

export function getRoundsStats(rounds: BracketMatch[][] | undefined): MatchStats {
  let notStarted = 0, live = 0, completed = 0;
  (rounds || []).forEach((round) => round.forEach((m) => {
    if (m.status === "COMPLETED") completed++;
    else if (m.status === "IN_PROGRESS") live++;
    else notStarted++;
  }));
  return { notStarted, live, completed, total: notStarted + live + completed };
}

export function getDrawsStats(
  draws: Record<string, DrawCategory>,
  predicate: (d: DrawCategory) => boolean
): MatchStats {
  const stats: MatchStats = { notStarted: 0, live: 0, completed: 0, total: 0 };
  Object.values(draws).forEach((d) => {
    if (!d.generated || !predicate(d)) return;
    const s = getRoundsStats(d.rounds);
    stats.notStarted += s.notStarted;
    stats.live += s.live;
    stats.completed += s.completed;
    stats.total += s.total;
  });
  return stats;
}
