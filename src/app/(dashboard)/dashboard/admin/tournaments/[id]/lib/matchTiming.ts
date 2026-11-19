// ─── Scoreboard timing per category ──────────────────────────────────────────
// Each category's draw can carry its own regular match time and golden score limit (set from the
// admin panel). Without one, the age group's usual time applies.

/** Usual regular match time (seconds) for an age group. */
export function defaultMatchSeconds(ageGroup: string | undefined | null): number {
  const a = (ageGroup || "").toLowerCase();
  if (/senior|junior|cadet/.test(a) && !/sub|mini/.test(a)) return 240; // senior, junior, cadet: 4:00
  if (/mini/.test(a)) return 120;                                      // mini sub-junior: 2:00
  if (/sub/.test(a)) return 180;                                       // sub-junior: 3:00
  if (/\d/.test(a)) return 120;                                        // "7-8 years" etc: 2:00
  return 240;
}

export type MatchTiming = {
  /** Regular match time in seconds. */
  duration: number;
  /** Golden score limit in seconds; null = unlimited. */
  goldenLimit: number | null;
  /** True when set by the organiser (not the age group's default). */
  custom: boolean;
};

export function timingOf(draw: { ageGroup?: string; matchDuration?: number | null; goldenScoreLimit?: number | null } | null | undefined): MatchTiming {
  const custom = typeof draw?.matchDuration === "number" && draw.matchDuration > 0;
  return {
    duration: custom ? draw!.matchDuration! : defaultMatchSeconds(draw?.ageGroup),
    goldenLimit: typeof draw?.goldenScoreLimit === "number" && draw.goldenScoreLimit > 0 ? draw.goldenScoreLimit : null,
    custom,
  };
}

/** 240 → "4:00" */
export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
