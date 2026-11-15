// Mirror of the backend's src/modules/tournaments/categories.ts (ported from the standalone tournament app).
// Age = tournament year − birth year: the month and day of birth never count, and nothing is tied to one season.

export type Gender = "MALE" | "FEMALE";

export interface AgeGroupDef {
  name: string;
  minAge: number;
  maxAge: number;
  /** Younger players may "play up" into this group from this age. Defaults to minAge. */
  playUpFrom?: number;
  /** Upper limits in kg; the last class is "+<last limit>kg". */
  weights: Record<Gender, number[]>;
}

export const AGE_GROUPS: AgeGroupDef[] = [
  { name: "Mini Sub-Junior Age Group 1", minAge: 6, maxAge: 7, weights: { MALE: [20, 25, 30], FEMALE: [18, 22, 26] } },
  { name: "Mini Sub-Junior Age Group 2", minAge: 8, maxAge: 9, weights: { MALE: [25, 30, 35], FEMALE: [22, 26, 30] } },
  { name: "Mini Sub-Junior Age Group 3", minAge: 10, maxAge: 11, weights: { MALE: [30, 35, 40, 45], FEMALE: [28, 32, 36, 40] } },
  { name: "Sub-Junior", minAge: 12, maxAge: 14, weights: { MALE: [30, 35, 40, 45, 50, 55, 60, 66], FEMALE: [28, 32, 36, 40, 44, 48, 52, 57] } },
  { name: "Cadet", minAge: 14, maxAge: 16, weights: { MALE: [50, 55, 60, 66, 73, 81, 90], FEMALE: [40, 44, 48, 52, 57, 63, 70] } },
  { name: "Junior", minAge: 17, maxAge: 19, playUpFrom: 14, weights: { MALE: [55, 60, 66, 73, 81, 90, 100], FEMALE: [44, 48, 52, 57, 63, 70, 78] } },
  { name: "Senior", minAge: 20, maxAge: 120, playUpFrom: 15, weights: { MALE: [60, 66, 73, 81, 90, 100], FEMALE: [48, 52, 57, 63, 70, 78] } },
];

export const AGE_GROUP_NAMES = AGE_GROUPS.map((g) => g.name);

/** Birth year from a date of birth ("2010-05-14" or an ISO date-time): the year as written, whatever the time zone. */
export const birthYear = (dob: string) => Number(String(dob).slice(0, 4));

/** The calendar year of a moment in India (the tournament's time zone). A plain "YYYY-MM-DD" is that year. */
export const yearInIndia = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? Number(iso.slice(0, 4))
    : Number(new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }));

/** Tournament year − birth year. */
export function competitionAge(dob: string, tournamentDate: string): number {
  return yearInIndia(tournamentDate) - birthYear(dob);
}

const LEGACY_NAMES: Record<string, string[]> = {
  "mini sub junior": AGE_GROUP_NAMES.filter((n) => n.startsWith("Mini Sub-Junior")),
  "sub junior": ["Sub-Junior"],
  veteran: ["Senior"],
};
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function resolveName(label: string): string[] {
  const k = key(label);
  const exact = AGE_GROUPS.find((g) => key(g.name) === k);
  if (exact) return [exact.name];
  return LEGACY_NAMES[k] ?? [];
}

/** Age groups stored on a tournament ("Cadet, Junior"; old labels like "Sub Junior" are mapped). Empty = no restriction. */
export function tournamentAgeGroups(category: string | string[] | null | undefined): string[] {
  const labels = Array.isArray(category) ? category : (category ?? "").split(",");
  const picked = new Set(labels.flatMap((l) => resolveName(String(l))));
  return AGE_GROUP_NAMES.filter((n) => picked.has(n));
}

/** Age groups a player may enter for a tournament: their own plus the older ones they may play up into,
 *  limited to the tournament's age groups when it set any. */
export function eligibleAgeGroups(dob: string | null | undefined, tournamentDate: string, tournamentCategory?: string | null): string[] {
  if (!dob || !tournamentDate) return [];
  const age = competitionAge(dob, tournamentDate);
  const allowed = tournamentAgeGroups(tournamentCategory);
  return AGE_GROUPS
    .filter((g) => (!allowed.length || allowed.includes(g.name)) && age >= (g.playUpFrom ?? g.minAge) && age <= g.maxAge)
    .map((g) => g.name);
}

export function weightClasses(ageGroup: string, gender: Gender): string[] {
  const def = AGE_GROUPS.find((g) => g.name === ageGroup) ?? AGE_GROUPS[AGE_GROUPS.length - 1]!;
  const limits = def.weights[gender];
  return [...limits.map((l) => `-${l}kg`), `+${limits[limits.length - 1]}kg`];
}

export function weightCategoryFor(weightKg: number, gender: Gender, ageGroup: string): string {
  const classes = weightClasses(ageGroup, gender);
  return classes.find((c) => c.startsWith("-") && weightKg <= parseFloat(c.slice(1))) ?? classes[classes.length - 1]!;
}
