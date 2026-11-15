/** Display name of a tournament level; "Other" shows the name typed in for it (Tournament.levelOther). */
export function levelLabel(level: string | null | undefined, levelOther?: string | null): string {
  if (!level) return "";
  if (level === "OTHER") return levelOther?.trim() || "Other";
  return level.charAt(0) + level.slice(1).toLowerCase();
}
