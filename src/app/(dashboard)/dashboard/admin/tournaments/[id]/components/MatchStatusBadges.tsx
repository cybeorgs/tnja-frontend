import type { MatchStats } from "../lib/matchStats";

export function MatchStatusBadges({ stats }: { stats: MatchStats }) {
  if (stats.total === 0) return null;
  return (
    <span className="flex items-center gap-1 ml-1.5">
      {stats.notStarted > 0 && (
        <span title="Not Started" className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{stats.notStarted}</span>
      )}
      {stats.live > 0 && (
        <span title="Live" className="text-[9px] font-black px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 animate-pulse">{stats.live}</span>
      )}
      {stats.completed > 0 && (
        <span title="Completed" className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{stats.completed}</span>
      )}
    </span>
  );
}
