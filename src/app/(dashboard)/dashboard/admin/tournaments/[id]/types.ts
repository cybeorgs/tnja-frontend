// ─── Shared types for the tournament detail page and its components ──────────

export type Tab = "overview" | "players" | "mats" | "draws" | "matches" | "results" | "points" | "weigh-in" | "disqualify" | "certificate" | "best-performance";
/** "sheet" = the compact left/right contest sheet (elimination draws only). */
export type ViewMode = "list" | "bracket" | "sheet" | "leaderboard";

export interface Tournament {
  id: string; title: string; date: string; dateTo?: string;
  location: string; level: string; levelOther?: string | null; entryFee: number; totalSlots: number;
  ageFrom: number; ageTo: number; category?: string; gender: string; beltEligibility?: string;
  allowBPL: boolean; status: string; rejectionRemark?: string;
  numberOfMats?: number;
  districtApproval: string; stateApproval: string;
  superAdminApproval: string; ceoApproval: string;
  registrationCount?: number; registrationClosed?: boolean;
  club?: { name: string; district?: { name: string } };
}

export interface RegisteredPlayer {
  id: string; name: string; club: string; district: string;
  weight: number; weightLabel?: string; ageGroup: string; exactAge?: number; gender: string; belt: string;
  seedNumber?: number; coachName?: string; placement?: string; status?: string;
  regId?: string;
  /** Merit certificate number typed by the organiser (1st–3rd) */
  meritCertificateNo?: string;
  /** Participation certificate number, assigned automatically, e.g. "SUB-JUNIOR 001" */
  participationCertificateNo?: string;
  permanentId?: string; tempId?: string; tnjaId?: string;
  clubId?: string | null; coachId?: string | null; isPaid?: boolean; registeredAt?: string;
  rawWeight?: string | null; rawHeight?: string | null;
  /** Tournament-day weigh-in: scale weight (kg) and PASSED / DISQUALIFIED (null until weighed) */
  weighInWeight?: string | null; weighInStatus?: string | null;
  /** Who they play for in this tournament: DISTRICT | UNIT ("" until confirmed at weigh-in) */
  representing?: string; representingDistrict?: string; representingUnit?: string;
}

export interface BracketSlot {
  playerId: string | null; playerName: string;
  club: string; isBye: boolean; seedNumber?: number;
  coachName?: string;
}

export interface BracketMatch {
  matchId: string; round: number; matchNumber: number; matNumber: number;
  slotA: BracketSlot; slotB: BracketSlot;
  winnerId: string | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  scoreA?: any; scoreB?: any; winMethod?: string; elapsedSeconds?: number;
  /** Set when the organiser changed this match's winner after it finished: the previous winner. */
  correctedFrom?: string | null;
  /** Set on the first match of a 3–4 player draw made as a repechage format: such a bracket has no
   *  quarter-final, so the repechage collapses to the semi-final losers' bronze match. */
  formatHint?: "single-repechage" | "double-repechage";
}

export interface DrawCategory {
  ageGroup: string; exactAge?: number; gender: string; weightCategory: string; matNumber?: number;
  rounds: BracketMatch[][]; generated: boolean; saved: boolean;
  isConcluded?: boolean;
  /** Scoreboard regular match time in seconds (null = age group default) */
  matchDuration?: number | null;
  /** Golden score limit in seconds (null = unlimited) */
  goldenScoreLimit?: number | null;
  /** When the organiser started this category (its matches can be played); null = not started */
  startedAt?: string | null;
}

export interface Seeds {
  1: RegisteredPlayer | null; 2: RegisteredPlayer | null;
  3: RegisteredPlayer | null; 4: RegisteredPlayer | null;
}

export interface StudentSearchResult {
  id: string;
  refId?: string;
  name: string;
  gender: string;
  age: number;
  weight?: string | null;
  height?: string | null;
  belt?: string | null;
  district: string;
  club: string;
}
