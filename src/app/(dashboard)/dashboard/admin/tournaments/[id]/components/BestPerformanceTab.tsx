"use client";

import { useMemo, useState } from "react";
import { Trophy, Info } from "lucide-react";
import type { RegisteredPlayer } from "../types";

/** Championship points per medal. */
const MEDAL_POINTS = { FIRST: 5, SECOND: 3, THIRD: 1 } as const;
type Medal = keyof typeof MEDAL_POINTS;

interface DistrictRow {
  district: string;
  gold: number;
  silver: number;
  bronze: number;
  points: number;
}

type View = "overall" | "FEMALE" | "MALE";

const VIEWS: { key: View; label: string; title: string }[] = [
  { key: "overall", label: "Overall", title: "Overall Championship — District" },
  { key: "FEMALE", label: "Girls", title: "Girls Overall Championship — District" },
  { key: "MALE", label: "Boys", title: "Boys Overall Championship — District" },
];

/**
 * The district a medal counts for: the district confirmed at weigh-in, or the player's home
 * district while that is still unconfirmed. A player representing a unit counts for no district.
 */
function districtFor(p: RegisteredPlayer): string | null {
  if (p.representing === "UNIT") return null;
  const d = (p.representing === "DISTRICT" ? p.representingDistrict : p.representingDistrict || p.district) || "";
  return d.trim() || null;
}

function standings(players: RegisteredPlayer[], gender: View): DistrictRow[] {
  const rows = new Map<string, DistrictRow>();
  for (const p of players) {
    if (gender !== "overall" && p.gender !== gender) continue;
    if (p.status === "DISQUALIFIED" || p.status === "REJECTED" || p.status === "PENDING") continue;
    const medal = p.placement as Medal;
    if (!(medal in MEDAL_POINTS)) continue;
    const district = districtFor(p);
    if (!district) continue;
    const key = district.toUpperCase();
    const row = rows.get(key) ?? { district, gold: 0, silver: 0, bronze: 0, points: 0 };
    if (medal === "FIRST") row.gold++;
    else if (medal === "SECOND") row.silver++;
    else row.bronze++;
    row.points += MEDAL_POINTS[medal];
    rows.set(key, row);
  }
  // Points first; ties broken by golds, then silvers, then bronzes (medal-table order).
  return [...rows.values()].sort(
    (a, b) => b.points - a.points || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.district.localeCompare(b.district)
  );
}

/** Rank with ties sharing a position (1, 2, 2, 4). */
function ranks(rows: DistrictRow[]): number[] {
  const same = (a: DistrictRow, b: DistrictRow) => a.points === b.points && a.gold === b.gold && a.silver === b.silver && a.bronze === b.bronze;
  return rows.map((r, i) => {
    let j = i;
    while (j > 0 && same(rows[j - 1], r)) j--;
    return j + 1;
  });
}

const RANK_STYLE: Record<number, string> = {
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-slate-200 text-slate-700",
  3: "bg-amber-100 text-amber-800",
};

/** Tournament → Best Performance: district championship tables (overall, girls, boys). */
export function BestPerformanceTab({ players }: { players: RegisteredPlayer[] }) {
  const [view, setView] = useState<View>("overall");
  const tables = useMemo(
    () => ({ overall: standings(players, "overall"), FEMALE: standings(players, "FEMALE"), MALE: standings(players, "MALE") }),
    [players]
  );
  const rows = tables[view];
  const rowRanks = ranks(rows);
  const meta = VIEWS.find((v) => v.key === view)!;
  const unitMedals = players.filter((p) => p.representing === "UNIT" && p.placement && p.placement in MEDAL_POINTS).length;

  return (
    <div className="space-y-6">
      {/* Champions at a glance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {VIEWS.map((v) => {
          const top = tables[v.key][0];
          const active = view === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              aria-pressed={active}
              className={`text-left p-5 rounded-2xl border shadow-sm transition-colors ${active ? "bg-orange-50 border-[#FF7400]" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{v.label} championship</p>
              {top ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-lg font-black text-slate-800">
                    <Trophy size={18} className="text-yellow-500 shrink-0" />
                    <span className="truncate">{top.district}</span>
                  </p>
                  <p className="text-sm text-slate-500 tabular-nums">
                    {top.points} pts · {top.gold}G {top.silver}S {top.bronze}B
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No medals yet</p>
              )}
            </button>
          );
        })}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 text-[#FF7400] rounded-lg"><Trophy size={20} /></div>
            <div>
              <h3 className="font-black text-slate-800">{meta.title}</h3>
              <p className="text-xs text-slate-500">
                Gold {MEDAL_POINTS.FIRST} · Silver {MEDAL_POINTS.SECOND} · Bronze {MEDAL_POINTS.THIRD} points, counted for the district each player represents
              </p>
            </div>
          </div>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5 self-start" role="tablist" aria-label="Championship">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-black transition-colors ${view === v.key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-12 text-center text-slate-400 text-sm">No medals awarded yet. Standings appear once category results are submitted.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-5 text-left w-16">Rank</th>
                  <th className="py-3 px-3 text-left">District</th>
                  <th className="py-3 px-3 text-right">Gold</th>
                  <th className="py-3 px-3 text-right">Silver</th>
                  <th className="py-3 px-3 text-right">Bronze</th>
                  <th className="py-3 px-5 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.district}>
                    <td className="py-3 px-5">
                      <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-xs font-black ${RANK_STYLE[rowRanks[i]] ?? "text-slate-500"}`}>{rowRanks[i]}</span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">{r.district}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">{r.gold}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">{r.silver}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-700">{r.bronze}</td>
                    <td className="py-3 px-5 text-right font-black text-[#FF7400] tabular-nums">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-start gap-2 m-5 p-3 rounded-lg bg-blue-50 text-blue-700 text-xs">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Ties are broken by golds, then silvers, then bronzes. Players whose representing district is not yet confirmed count for their home district.
            {unitMedals > 0 && ` ${unitMedals} medal${unitMedals === 1 ? "" : "s"} won by players representing a unit ${unitMedals === 1 ? "is" : "are"} not counted.`}
          </span>
        </p>
      </section>
    </div>
  );
}
