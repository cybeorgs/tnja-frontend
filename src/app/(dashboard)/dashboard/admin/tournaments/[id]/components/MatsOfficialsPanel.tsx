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

  const allAssigned = totalMats > 0 && assignedCount === totalMats;
  const stepBtn =
    "w-9 h-9 flex items-center justify-center text-slate-500 hover:text-[#FF7400] hover:bg-orange-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header: title · mat count · status · save state */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 lg:px-6 py-4 border-b border-slate-100">
        <h3 className="font-black text-slate-800 text-lg mr-auto">Mats &amp; Officials</h3>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Mats</span>
          <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => changeCount(Math.max(1, totalMats - 1))}
              disabled={isCompleted || savingMats || totalMats <= 1}
              aria-label="One mat fewer"
              className={stepBtn}
            >
              <ChevronLeft size={16} />
            </button>
            <input
              type="number"
              min={1}
              max={50}
              value={matsCountInput}
              disabled={isCompleted}
              placeholder="0"
              aria-label="Number of mats"
              onChange={(e) => {
                const n = parseInt(e.target.value);
                if (e.target.value === "") return setMatsCountInput("");
                changeCount(n, true);
              }}
              className="w-12 h-9 border-x border-slate-200 font-black text-base text-center text-slate-800 focus:outline-none focus:bg-orange-50/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              onClick={() => changeCount(totalMats + 1)}
              disabled={isCompleted || savingMats || totalMats >= 50}
              aria-label="One more mat"
              className={stepBtn}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {totalMats > 0 && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black ${allAssigned ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {allAssigned ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {assignedCount}/{totalMats} referees assigned
          </span>
        )}

        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 min-w-[90px] justify-end" aria-live="polite">
          {savingMats ? (
            <><Loader2 size={13} className="animate-spin" /> Saving…</>
          ) : savedAt ? (
            <><CheckCircle2 size={13} className="text-emerald-500" /> Saved {savedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</>
          ) : null}
        </span>
      </div>

      {totalMats === 0 ? (
        <div className="py-14 text-center">
          <p className="font-black text-slate-500">No mats yet</p>
          <p className="text-sm text-slate-400 mt-1">Add mats with the arrows above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
          {/* Mats list */}
          <div className="p-3 md:border-r border-b md:border-b-0 border-slate-100 bg-slate-50/40">
            <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible md:max-h-[460px] md:overflow-y-auto custom-scrollbar">
              {Array.from({ length: totalMats }).map((_, i) => {
                const matNum = i + 1;
                const isSelected = selectedMatForAssignment === matNum;
                const assigned = tournamentMats.find((m) => m.matNumber === matNum && m.refereeName);
                return (
                  <button
                    key={matNum}
                    onClick={() => selectMat(matNum)}
                    className={`shrink-0 md:w-full min-w-[160px] text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3 border ${
                      isSelected
                        ? "bg-white border-[#FF7400] shadow-sm"
                        : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                      isSelected ? "bg-[#FF7400] text-white" : assigned ? "bg-orange-100 text-[#FF7400]" : "bg-slate-100 text-slate-400"
                    }`}>
                      {matNum}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-black ${isSelected ? "text-slate-900" : "text-slate-700"}`}>Mat {matNum}</p>
                      <p className={`text-xs font-semibold truncate ${assigned ? "text-slate-500" : "text-slate-400 italic"}`}>
                        {assigned ? assigned.refereeName : "No referee"}
                      </p>
                    </div>
                    {assigned && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Referee for the selected mat */}
          <div className="p-5 lg:p-6 min-w-0">
            {selectedMatForAssignment ? (
              <div className="space-y-4">
                <h4 className="font-black text-slate-800">Mat {selectedMatForAssignment} referee</h4>

                {(() => {
                  const assigned = tournamentMats.find((m) => m.matNumber === selectedMatForAssignment && m.refereeName);
                  const isReassigning = reassigningMat === selectedMatForAssignment;

                  if (assigned && !isReassigning) {
                    return (
                      <div className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-[#FF7400] text-white flex items-center justify-center font-black shrink-0">
                            {assigned.refereeName!.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-800 truncate">{assigned.refereeName}</p>
                            {assigned.refereeCoachId && (
                              <p className="text-xs font-bold text-slate-400 font-mono mt-0.5">{assigned.refereeCoachId}</p>
                            )}
                          </div>
                        </div>
                        {!isCompleted && (
                          <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <button
                              onClick={() => { setReassigningMat(selectedMatForAssignment); setRefSearchQuery(""); }}
                              disabled={savingMats}
                              className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-3.5 py-2 text-slate-600 hover:text-[#FF7400] border border-slate-200 rounded-xl transition-colors font-bold text-sm disabled:opacity-50"
                            >
                              <Edit2 size={14} /> Change
                            </button>
                            <button
                              onClick={removeAssignment}
                              disabled={savingMats}
                              className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-3.5 py-2 text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-colors font-bold text-sm disabled:opacity-50"
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
                    <div className="space-y-3">
                      {assigned && isReassigning && (
                        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-slate-50 rounded-xl text-sm">
                          <span className="font-semibold text-slate-500 truncate">
                            Replacing <span className="text-slate-800 font-black">{assigned.refereeName}</span>
                          </span>
                          <button onClick={() => { setReassigningMat(null); setRefSearchQuery(""); }} className="text-xs font-black text-slate-400 hover:text-slate-700 shrink-0">
                            Cancel
                          </button>
                        </div>
                      )}
                      <div className="relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={refSearchQuery}
                          onChange={(e) => setRefSearchQuery(e.target.value)}
                          placeholder="Search referee by name or ID"
                          autoComplete="off"
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 focus:border-[#FF7400]/50 text-slate-800 placeholder:text-slate-400 placeholder:font-medium"
                        />
                        {refSearching && <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                      </div>

                      {availableRefSearchResults.length === 0 ? (
                        <div className="py-8 text-center rounded-xl border border-dashed border-slate-200">
                          <p className="text-sm font-bold text-slate-500">
                            {refSearching ? "Loading…" : refSearchQuery.trim() ? `No referee matches "${refSearchQuery}"` : "No referees available"}
                          </p>
                        </div>
                      ) : (
                        <div className="border border-slate-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-50">
                          {availableRefSearchResults.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => pickReferee(r)}
                              disabled={savingMats}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50/60 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF7400] flex items-center justify-center font-black text-[11px] shrink-0">
                                {r.name.split(" ").map((p) => p[0]).slice(-2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-slate-800 text-sm truncate">{r.name}</p>
                                <p className="text-xs font-semibold text-slate-400 truncate">{[r.club, r.district].filter(Boolean).join(", ")}</p>
                              </div>
                              {r.refId && <span className="text-[11px] font-bold text-slate-500 font-mono shrink-0">{r.refId}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center">
                <p className="font-black text-slate-500">Select a mat</p>
                <p className="text-sm text-slate-400 mt-1">to assign its referee</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
