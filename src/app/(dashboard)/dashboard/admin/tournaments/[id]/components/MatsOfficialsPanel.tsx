"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Edit2, Loader2, Search, X,
} from "lucide-react";
import type { Tournament } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export interface TournamentMatAssignment {
  matNumber: number;
  refereeId: string;
  refereeName?: string;
  refereeCoachId?: string;
}

export interface RefereeSearchResult {
  id: string;
  refId?: string;
  name: string;
  district: string;
  club: string;
}

/** Shape of a mat row from GET/POST /tournaments/:id/mats. */
export const matFromApi = (m: any): TournamentMatAssignment => ({
  matNumber: m.matNumber,
  refereeId: m.refereeId || "",
  refereeName: m.referee?.fullName || "",
  refereeCoachId: m.referee?.permanentId || m.referee?.tempId || "",
});

/**
 * Mats & officials. Works at any time — before the tournament starts or while it runs — and saves
 * after every change (mat count, assigning, changing or removing a referee). A referee can score
 * matches on their mat from their next action after the change.
 */
export function MatsOfficialsPanel({
  tournament,
  tournamentId,
  tournamentMats,
  setTournamentMats,
  matsCountInput,
  setMatsCountInput,
  selectedMatForAssignment,
  setSelectedMatForAssignment,
  refSearchQuery,
  setRefSearchQuery,
  refSearchResults,
  refSearching,
  refreshRefSearch,
  savingMats,
  setSavingMats,
  showToast,
}: {
  tournament: Tournament;
  tournamentId: string;
  tournamentMats: TournamentMatAssignment[];
  setTournamentMats: (updater: TournamentMatAssignment[] | ((prev: TournamentMatAssignment[]) => TournamentMatAssignment[])) => void;
  matsCountInput: string;
  setMatsCountInput: (v: string) => void;
  selectedMatForAssignment: number | null;
  setSelectedMatForAssignment: (v: number | null) => void;
  refSearchQuery: string;
  setRefSearchQuery: (v: string) => void;
  refSearchResults: RefereeSearchResult[];
  refSearching: boolean;
  refreshRefSearch: () => void;
  savingMats: boolean;
  setSavingMats: (v: boolean) => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [reassigningMat, setReassigningMat] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const countDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (countDebounce.current) clearTimeout(countDebounce.current); }, []);

  const totalMats = parseInt(matsCountInput) || 0;
  const isCompleted = tournament.status === "CLOSED";
  const assignedCount = Array.from({ length: totalMats }, (_, i) => i + 1)
    .filter((n) => tournamentMats.some((m) => m.matNumber === n && m.refereeName)).length;

  const refereeIdsAssignedElsewhere = new Set(
    tournamentMats.filter((m) => m.matNumber !== selectedMatForAssignment && m.refereeId && m.matNumber <= totalMats).map((m) => m.refereeId)
  );
  const availableRefSearchResults = refSearchResults.filter((r) => !refereeIdsAssignedElsewhere.has(r.id));

  /** Saves the whole line-up; on failure puts the previous one back. */
  const persist = async (nextMats: TournamentMatAssignment[], nextCount: number, okMsg?: string) => {
    const prevMats = tournamentMats;
    const prevCount = matsCountInput;
    setTournamentMats(nextMats);
    setMatsCountInput(String(nextCount));
    setSavingMats(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/mats`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          totalMats: nextCount,
          assignments: nextMats.filter((m) => m.matNumber <= nextCount).map((m) => ({ matNumber: m.matNumber, refereeId: m.refereeId || null })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save mats");
      if (Array.isArray(data?.mats)) setTournamentMats(data.mats.map(matFromApi));
      setSavedAt(new Date());
      if (okMsg) showToast(okMsg, true);
    } catch (err) {
      setTournamentMats(prevMats);
      setMatsCountInput(prevCount);
      showToast(err instanceof Error ? err.message : "Could not save mats", false);
    } finally {
      setSavingMats(false);
    }
  };

  const changeCount = (next: number, debounce = false) => {
    if (!Number.isInteger(next) || next < 1 || next > 50) return;
    const losing = tournamentMats.filter((m) => m.matNumber > next && m.refereeName);
    const run = () => {
      if (losing.length && !window.confirm(`Remove ${losing.map((m) => `Mat ${m.matNumber} (${m.refereeName})`).join(", ")}?`)) {
        setMatsCountInput(String(Math.max(totalMats, 1)));
        return;
      }
      if (selectedMatForAssignment && selectedMatForAssignment > next) setSelectedMatForAssignment(null);
      persist(tournamentMats.filter((m) => m.matNumber <= next), next);
    };
    if (countDebounce.current) clearTimeout(countDebounce.current);
    if (debounce) {
      setMatsCountInput(String(next));
      countDebounce.current = setTimeout(run, 700);
    } else run();
  };

  const selectMat = (matNum: number) => {
    setSelectedMatForAssignment(matNum);
    setReassigningMat(null);
    setRefSearchQuery("");
  };

  const pickReferee = (r: { id: string; name: string; refId?: string }) => {
    const mat = selectedMatForAssignment!;
    const next = [
      ...tournamentMats.filter((m) => m.matNumber !== mat),
      { matNumber: mat, refereeId: r.id, refereeName: r.name, refereeCoachId: r.refId || "" },
    ].sort((a, b) => a.matNumber - b.matNumber);
    setReassigningMat(null);
    setRefSearchQuery("");
    persist(next, totalMats, `${r.name} assigned to Mat ${mat}`);
  };

  const removeAssignment = () => {
    const mat = selectedMatForAssignment!;
    if (!window.confirm(`Remove the referee from Mat ${mat}?`)) return;
    setReassigningMat(null);
    setRefSearchQuery("");
    persist(tournamentMats.map((m) => (m.matNumber === mat ? { ...m, refereeId: "", refereeName: "", refereeCoachId: "" } : m)), totalMats, `Mat ${mat} is now unassigned`);
    refreshRefSearch();
  };

  return (
    <div className="bg-white rounded-2xl p-5 lg:p-6 border border-slate-100 shadow-sm space-y-5">
      {/* Header: title, save status */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
        <div>
          <h3 className="font-black text-slate-800 text-lg">Mats &amp; Officials</h3>
          <p className="text-slate-500 font-semibold text-sm mt-0.5">
            Change mats or referees any time — every change saves straight away.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-black text-slate-500 shrink-0" aria-live="polite">
          {savingMats ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : savedAt ? (
            <><CheckCircle2 size={14} className="text-emerald-500" /> Saved {savedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>
          ) : null}
        </span>
      </div>

      {/* Mat count + status */}
      <div className="flex flex-col md:flex-row md:items-end gap-4 pt-5 border-t border-slate-100">
        <div>
          <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Number of Mats</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeCount(Math.max(1, totalMats - 1))}
              disabled={isCompleted || savingMats || totalMats <= 1}
              aria-label="One mat fewer"
              className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <input
              type="number"
              min={1}
              max={50}
              value={matsCountInput}
              disabled={isCompleted}
              placeholder="0"
              onChange={(e) => {
                const n = parseInt(e.target.value);
                if (e.target.value === "") return setMatsCountInput("");
                changeCount(n, true);
              }}
              className="w-24 h-10 border border-slate-200 rounded-xl font-black text-lg text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 focus:border-[#FF7400]"
            />
            <button
              onClick={() => changeCount(totalMats + 1)}
              disabled={isCompleted || savingMats || totalMats >= 50}
              aria-label="One more mat"
              className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        {totalMats > 0 && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${assignedCount === totalMats ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
            {assignedCount === totalMats ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {assignedCount} of {totalMats} mats have a referee
            {assignedCount < totalMats && <span className="font-semibold"> — assign the rest whenever they&apos;re confirmed</span>}
          </div>
        )}
      </div>

      {totalMats === 0 ? (
        <div className="min-h-[200px] flex flex-col items-center justify-center text-slate-400 font-bold p-8 bg-orange-50/30 rounded-3xl border-2 border-dashed border-orange-100 text-center">
          <p className="text-base text-slate-500">No mats yet</p>
          <p className="text-sm font-normal mt-1">Use the arrows above to add mats, then assign a referee to each.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5 border-t border-slate-100">
          {/* Mats list */}
          <div className="col-span-1 md:border-r border-slate-100 md:pr-6 space-y-2">
            <h4 className="font-black text-slate-400 uppercase tracking-widest text-xs mb-4">Mats</h4>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.from({ length: totalMats }).map((_, i) => {
                const matNum = i + 1;
                const isSelected = selectedMatForAssignment === matNum;
                const assigned = tournamentMats.find((m) => m.matNumber === matNum && m.refereeName);
                return (
                  <button
                    key={matNum}
                    onClick={() => selectMat(matNum)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl font-black transition-all flex items-center gap-3 border ${
                      isSelected
                        ? "bg-[#FF7400] border-[#FF7400] text-white shadow-md shadow-orange-500/20"
                        : "bg-white border-slate-100 text-slate-700 hover:border-orange-200 hover:bg-orange-50/40"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${assigned ? (isSelected ? "bg-white" : "bg-[#FF7400]") : (isSelected ? "bg-white/40" : "bg-slate-200")}`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">Mat {matNum}</span>
                      <p className={`text-[11px] font-bold truncate ${isSelected ? "text-white/80" : assigned ? "text-slate-400" : "text-slate-300"}`}>
                        {assigned ? assigned.refereeName : "Not assigned"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Referee for the selected mat */}
          <div className="col-span-1 md:col-span-2 md:pl-2">
            {selectedMatForAssignment ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-lg bg-orange-50 text-[#FF7400] font-black text-sm">Mat {selectedMatForAssignment}</span>
                  <h4 className="font-black text-slate-800 text-lg">Referee</h4>
                </div>

                {(() => {
                  const assigned = tournamentMats.find((m) => m.matNumber === selectedMatForAssignment && m.refereeName);
                  const isReassigning = reassigningMat === selectedMatForAssignment;

                  if (assigned && !isReassigning) {
                    return (
                      <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-[#FF7400] text-white flex items-center justify-center font-black text-lg shrink-0">
                            {assigned.refereeName!.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 text-lg truncate">{assigned.refereeName}</p>
                            {assigned.refereeCoachId && (
                              <span className="inline-block mt-1 text-[11px] font-black text-[#FF7400] bg-white px-2.5 py-0.5 rounded-md border border-orange-200 font-mono">
                                {assigned.refereeCoachId}
                              </span>
                            )}
                          </div>
                        </div>
                        {!isCompleted && (
                          <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <button
                              onClick={() => { setReassigningMat(selectedMatForAssignment); setRefSearchQuery(""); }}
                              disabled={savingMats}
                              className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white text-slate-600 hover:text-[#FF7400] border border-slate-200 rounded-xl transition-colors font-bold text-sm disabled:opacity-50"
                            >
                              <Edit2 size={14} /> Change
                            </button>
                            <button
                              onClick={removeAssignment}
                              disabled={savingMats}
                              className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-colors font-bold text-sm disabled:opacity-50"
                            >
                              <X size={14} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (isCompleted) {
                    return <p className="text-sm font-bold text-slate-400">No referee was assigned to this mat.</p>;
                  }

                  return (
                    <div className="space-y-2">
                      {assigned && isReassigning && (
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                          <span className="font-bold text-slate-600">
                            Currently: <span className="text-slate-900 font-black">{assigned.refereeName}</span> — pick a replacement below
                          </span>
                          <button onClick={() => { setReassigningMat(null); setRefSearchQuery(""); }} className="text-xs font-black text-slate-400 hover:text-slate-600 shrink-0">
                            Cancel
                          </button>
                        </div>
                      )}
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Registered Referees</label>
                      <div className="relative">
                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={refSearchQuery}
                          onChange={(e) => setRefSearchQuery(e.target.value)}
                          placeholder="Filter by name or ID... e.g. Priya or CBE-COH-A001"
                          autoComplete="off"
                          className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 focus:border-[#FF7400]/40 text-slate-800"
                        />
                        {refSearching && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                      </div>

                      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                        {availableRefSearchResults.length === 0 ? (
                          <div className="px-5 py-4 text-sm font-bold text-slate-400">
                            {refSearching ? "Loading…" : refSearchQuery.trim() ? `No referee matches "${refSearchQuery}"` : "No approved referees found."}
                          </div>
                        ) : (
                          availableRefSearchResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => pickReferee(r)}
                              disabled={savingMats}
                              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-orange-50 transition-colors text-left border-b border-slate-50 last:border-0 disabled:opacity-50"
                            >
                              <div className="w-9 h-9 rounded-full bg-orange-100 text-[#FF7400] flex items-center justify-center font-black text-xs shrink-0">
                                {r.name.split(" ").map((p) => p[0]).slice(-2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-sm truncate">{r.name}</p>
                                <p className="text-[11px] font-bold text-slate-400 truncate">{r.club}, {r.district}</p>
                              </div>
                              <span className="text-[11px] font-black text-[#FF7400] bg-orange-50 px-2.5 py-1 rounded-md shrink-0 font-mono">{r.refId}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-400 pt-1">
                        Only referees approved for tournament duty appear here. A referee already on another mat is hidden.
                      </p>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-400 font-bold p-8 bg-orange-50/30 rounded-3xl border-2 border-dashed border-orange-100 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <AlertCircle size={28} className="text-[#FF7400]/50" />
                </div>
                <p className="text-base text-slate-500">Select a mat from the left</p>
                <p className="text-sm font-normal mt-1">to assign or change its referee</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
