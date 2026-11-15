"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Play, Radio, Square, Trophy } from "lucide-react";
import type { DrawCategory } from "../types";
import { AGE_GROUP_NAMES } from "@/utils/tournamentCategories";

type Status = "READY" | "LIVE" | "DONE";

const played = (d: DrawCategory) =>
  d.rounds.some((r) => r.some((m) => m.status === "IN_PROGRESS" || (m.status === "COMPLETED" && !m.slotA?.isBye && !m.slotB?.isBye)));

const statusOf = (d: DrawCategory): Status => (d.isConcluded ? "DONE" : d.startedAt ? "LIVE" : "READY");

const weightRank = (w: string) => {
  const n = parseFloat(w.replace(/[^\d.]/g, ""));
  return Number.isNaN(n) ? Infinity : n + (w.trim().startsWith("+") ? 0.5 : 0);
};
const groupRank = (g: string) => {
  const i = AGE_GROUP_NAMES.indexOf(g);
  return i === -1 ? AGE_GROUP_NAMES.length : i;
};

/**
 * The organiser decides which categories run, and when: every category with a draw is listed with
 * its mat and a Start button. Only started categories can be scored.
 */
export function CategoryStartBoard({
  draws,
  registrationClosed,
  busyKey,
  onToggle,
}: {
  draws: Record<string, DrawCategory>;
  registrationClosed: boolean;
  busyKey: string | null;
  onToggle: (key: string, draw: DrawCategory, started: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");

  const list = useMemo(
    () =>
      Object.entries(draws)
        .filter(([, d]) => d.generated && d.saved)
        .sort(([, a], [, b]) =>
          groupRank(a.ageGroup) - groupRank(b.ageGroup) || a.gender.localeCompare(b.gender) || weightRank(a.weightCategory) - weightRank(b.weightCategory)),
    [draws],
  );
  const counts = list.reduce((c, [, d]) => ({ ...c, [statusOf(d)]: c[statusOf(d)] + 1 }), { READY: 0, LIVE: 0, DONE: 0 } as Record<Status, number>);
  const shown = filter === "ALL" ? list : list.filter(([, d]) => statusOf(d) === filter);

  if (list.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-5 py-3.5" aria-expanded={open}>
        <span className="flex items-center gap-2">
          <Radio size={16} className="text-[#FF7400]" />
          <span className="font-black text-slate-800 text-sm">Category start board</span>
          <span className="text-xs font-semibold text-slate-400">
            {counts.LIVE} live · {counts.READY} ready to start · {counts.DONE} finished
          </span>
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
              {(["ALL", "READY", "LIVE", "DONE"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${filter === f ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {f === "ALL" ? `All ${list.length}` : f === "READY" ? `Ready ${counts.READY}` : f === "LIVE" ? `Live ${counts.LIVE}` : `Finished ${counts.DONE}`}
                </button>
              ))}
            </div>
            {!registrationClosed && <p className="text-xs font-bold text-amber-700">Close registration to start categories.</p>}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {shown.length === 0 && <p className="px-4 py-3 text-sm font-semibold text-slate-400">Nothing here.</p>}
            {shown.map(([key, d]) => {
              const status = statusOf(d);
              const busy = busyKey === key;
              const hasPlayed = played(d);
              return (
                <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800 truncate">
                      {d.ageGroup.replace("Mini Sub-Junior Age Group ", "Mini Sub-Jr G")} · {d.gender === "FEMALE" ? "Girls" : "Boys"} · {d.weightCategory}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">Mat {d.matNumber || 1}</p>
                  </div>
                  {status === "DONE" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg"><Trophy size={12} /> Finished</span>
                  ) : status === "LIVE" ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs font-black text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Live
                      </span>
                      {!hasPlayed && (
                        <button
                          type="button"
                          onClick={() => onToggle(key, d, false)}
                          disabled={busy}
                          title="Stop — no match has been played yet"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label="Stop category"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <Square size={14} />}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggle(key, d, true)}
                      disabled={busy || !registrationClosed}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-40"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Start
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
