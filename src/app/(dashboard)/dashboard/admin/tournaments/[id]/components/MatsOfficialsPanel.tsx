"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Edit2, Loader2, Search, X,
} from "lucide-react";
import type { Tab, Tournament } from "../types";

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

export function MatsOfficialsPanel({
  tournament,
  tournamentId,
  tournamentMats,
  setTournamentMats,
  matsCountInput,
  setMatsCountInput,
  matsConfirmed,
  setMatsConfirmed,
  wizardStep,
  setWizardStep,
  selectedMatForAssignment,
  setSelectedMatForAssignment,
  refSearchQuery,
  setRefSearchQuery,
  refSearchResults,
  refSearching,
  refreshRefSearch,
  assignRefereeToMat,
  savingMats,
  setSavingMats,
  showToast,
  setConfirmModal,
  fetchTournament,
  fetchPlayers,
  setActiveTab,
}: {
  tournament: Tournament;
  tournamentId: string;
  tournamentMats: TournamentMatAssignment[];
  setTournamentMats: (updater: (prev: TournamentMatAssignment[]) => TournamentMatAssignment[]) => void;
  matsCountInput: string;
  setMatsCountInput: (v: string) => void;
  matsConfirmed: boolean;
  setMatsConfirmed: (v: boolean) => void;
  wizardStep: 0 | 1 | 2 | 3;
  setWizardStep: (v: 0 | 1 | 2 | 3) => void;
  selectedMatForAssignment: number | null;
  setSelectedMatForAssignment: (v: number | null) => void;
  refSearchQuery: string;
  setRefSearchQuery: (v: string) => void;
  refSearchResults: RefereeSearchResult[];
  refSearching: boolean;
  refreshRefSearch: () => void;
  assignRefereeToMat: (matNum: number, ref: { id: string; name: string; refId?: string }) => void;
  savingMats: boolean;
  setSavingMats: (v: boolean) => void;
  showToast: (msg: string, ok?: boolean) => void;
  setConfirmModal: (v: { isOpen: boolean; title: string; message: string; action?: () => void }) => void;
  fetchTournament: () => void;
  fetchPlayers: () => void;
  setActiveTab: (t: Tab) => void;
}) {
  // Mat currently being re-assigned to a different referee — UI-only, doesn't
  // touch tournamentMats until a replacement is actually picked, so navigating
  // away or hitting "Save Changes" mid-change can't wipe the existing referee.
  const [reassigningMat, setReassigningMat] = useState<number | null>(null);

  const totalMats = parseInt(matsCountInput) || 0;
  const matsConfigured = totalMats > 0 && matsConfirmed;
  const officialsAssigned = matsConfigured && tournamentMats.length === totalMats && tournamentMats.every((m) => m.refereeName);
  const readyCount = (matsConfigured ? 1 : 0) + (officialsAssigned ? 1 : 0);

  // Referees already assigned to a different mat shouldn't be offered again —
  // one referee can't officiate two mats at once.
  const refereeIdsAssignedElsewhere = new Set(
    tournamentMats.filter((m) => m.matNumber !== selectedMatForAssignment && m.refereeId).map((m) => m.refereeId)
  );
  const availableRefSearchResults = refSearchResults.filter((r) => !refereeIdsAssignedElsewhere.has(r.id));
  // Only a genuinely closed/concluded tournament should skip the setup wizard —
  // "APPROVED" just means registration is open and mats haven't been configured yet.
  const isStarted = tournament.registrationClosed || tournament.status === "CLOSED";

  const saveMatAssignments = async (onDone?: () => void) => {
    setSavingMats(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/mats`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ assignments: tournamentMats }),
      });
      if (res.ok) {
        onDone?.();
      } else {
        showToast("Failed to save assignments", false);
      }
    } catch {
      showToast("Error saving assignments", false);
    } finally {
      setSavingMats(false);
    }
  };

  const selectMat = (matNum: number) => {
    setSelectedMatForAssignment(matNum);
    setReassigningMat(null);
    setRefSearchQuery("");
  };

  const startChangingReferee = (assigned: TournamentMatAssignment) => {
    setReassigningMat(selectedMatForAssignment);
    setRefSearchQuery(assigned.refereeName || "");
  };

  const cancelChangingReferee = () => {
    setReassigningMat(null);
    setRefSearchQuery("");
  };

  const removeAssignment = () => {
    if (!window.confirm("Remove this referee assignment?")) return;
    setTournamentMats((prev) => prev.filter((m) => m.matNumber !== selectedMatForAssignment));
    setReassigningMat(null);
    setRefSearchQuery("");
    refreshRefSearch();
  };

  const pickReferee = (r: { id: string; name: string; refId?: string }) => {
    assignRefereeToMat(selectedMatForAssignment!, r);
    setReassigningMat(null);
    setRefSearchQuery("");
  };

  const MatsManagementGrid = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6 border-t border-slate-100">
      {/* LEFT SIDE: MATS LIST */}
      <div className="col-span-1 md:border-r border-slate-100 md:pr-6 space-y-2">
        <h4 className="font-black text-slate-400 uppercase tracking-widest text-xs mb-4">Mats</h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {Array.from({ length: totalMats }).map((_, i) => {
            const matNum = i + 1;
            const isSelected = selectedMatForAssignment === matNum;
            const assigned = tournamentMats.find((m) => m.matNumber === matNum && m.refereeName);
            return (
              <button
                key={matNum}
                onClick={() => selectMat(matNum)}
                className={`w-full text-left px-5 py-3.5 rounded-2xl font-black transition-all flex items-center gap-3 border ${
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

      {/* RIGHT SIDE: REFEREE ASSIGNMENT */}
      <div className="col-span-1 md:col-span-2 md:pl-2">
        {selectedMatForAssignment ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-orange-50 text-[#FF7400] font-black text-sm">Mat {selectedMatForAssignment}</span>
              <h4 className="font-black text-slate-800 text-lg">Assign Referee</h4>
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
                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                      <button
                        onClick={() => startChangingReferee(assigned)}
                        className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white text-slate-600 hover:text-[#FF7400] border border-slate-200 rounded-xl transition-colors font-bold text-sm"
                      >
                        <Edit2 size={14} /> Change
                      </button>
                      <button
                        onClick={removeAssignment}
                        className="flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 py-2.5 bg-white text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-colors font-bold text-sm"
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {assigned && isReassigning && (
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                      <span className="font-bold text-slate-600">
                        Currently: <span className="text-slate-900 font-black">{assigned.refereeName}</span> — pick a replacement below
                      </span>
                      <button onClick={cancelChangingReferee} className="text-xs font-black text-slate-400 hover:text-slate-600 shrink-0">
                        Cancel
                      </button>
                    </div>
                  )}
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Registered Coaches / Referees</label>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={refSearchQuery}
                      onChange={(e) => setRefSearchQuery(e.target.value)}
                      placeholder="Filter by name or ID... e.g. Priya or COA-20"
                      autoComplete="off"
                      className="w-full pl-11 pr-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 focus:border-[#FF7400]/40 text-slate-800"
                    />
                    {refSearching && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />}
                  </div>

                  {/* Always-visible roster list — shows registered coach name + ID pairs
                      for easy mat mapping, narrowed down as the admin types above.
                      Referees already assigned to a *different* mat are excluded — one
                      referee can't officiate two mats at once. */}
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
                          className="w-full flex items-center gap-3 px-5 py-3 hover:bg-orange-50 transition-colors text-left border-b border-slate-50 last:border-0"
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
                  <p className="text-xs font-bold text-slate-400 pt-1">Only referees approved for tournament duty appear here.</p>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 font-bold p-8 bg-orange-50/30 rounded-3xl border-2 border-dashed border-orange-100 text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <AlertCircle size={28} className="text-[#FF7400]/50" />
            </div>
            <p className="text-base text-slate-500">Select a mat from the left</p>
            <p className="text-sm font-normal mt-1">to search and assign a referee</p>
          </div>
        )}
      </div>
    </div>
  );

  if (isStarted) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-2">
          <h3 className="font-black text-slate-800 text-xl">Mats & Officials Management</h3>
          <button
            onClick={() => saveMatAssignments(() => showToast("Assignments saved!", true))}
            disabled={savingMats}
            className="bg-[#FF7400] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-black transition-all flex items-center gap-2 shadow-md shadow-orange-500/20 disabled:opacity-60"
          >
            {savingMats && <Loader2 className="animate-spin" size={16} />}
            Save Changes
          </button>
        </div>
        {MatsManagementGrid}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Stepper — visible once the wizard has started */}
      {wizardStep > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4">
          {([[1, "Mats"], [2, "Officials"], [3, "Review & Start"]] as const).map(([n, label], idx) => {
            const isDone = wizardStep > n;
            const isActive = wizardStep === n;
            return (
              <div key={n} className="flex items-center gap-2.5 flex-1 last:flex-initial">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                    isDone ? "bg-emerald-500 text-white" : isActive ? "bg-[#FF7400] text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isDone ? <CheckCircle2 size={16} /> : n}
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wide hidden sm:inline ${isDone || isActive ? "text-slate-700" : "text-slate-400"}`}>
                    {label}
                  </span>
                </div>
                {idx < 2 && <div className={`flex-1 h-0.5 mx-3 rounded-full ${wizardStep > n ? "bg-emerald-400" : "bg-slate-100"}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Step 0: Readiness overview */}
      {wizardStep === 0 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-slate-800 text-xl mb-1">Let&apos;s get {tournament?.title || "this tournament"} ready</h3>
              <p className="text-slate-500 font-bold text-sm">
                Set up mats and assign match officials to get this tournament match-ready.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF7400] rounded-full transition-all" style={{ width: `${(readyCount / 2) * 100}%` }} />
              </div>
              <span className="text-xs font-black text-slate-500 whitespace-nowrap">{readyCount} of 2 ready</span>
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3">
              {matsConfigured ? (
                <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
              ) : (
                <div className="w-[22px] h-[22px] rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[11px] font-black shrink-0">1</div>
              )}
              <span className="font-black text-base text-slate-700">
                {matsConfigured ? `Mats — ${totalMats} configured` : "Mats — not set up yet"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {officialsAssigned ? (
                <CheckCircle2 size={22} className="text-emerald-500 shrink-0" />
              ) : (
                <div className="w-[22px] h-[22px] rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[11px] font-black shrink-0">2</div>
              )}
              <span className="font-black text-base text-slate-700">
                {officialsAssigned ? "Match officials — all assigned" : "Match officials — not assigned yet"}
              </span>
            </div>
          </div>

          <div className="pt-4">
            <button onClick={() => setWizardStep(1)} className="py-4 px-10 bg-[#FF7400] text-white font-black rounded-xl shadow-lg hover:scale-[1.02] transition-all">
              {matsConfigured ? "Update setup →" : "Continue setup →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Configure Mats */}
      {wizardStep === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-8"
        >
          <div>
            <h3 className="font-black text-slate-800 text-xl mb-1">How many mats will run today?</h3>
            <p className="text-slate-500 font-bold text-sm max-w-xl">
              Each mat runs matches in parallel. This decides how many matches can happen at once and how many officials you&apos;ll need.
            </p>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Total Mats</label>
            <div className="flex items-center gap-3 max-w-xs">
              <button
                onClick={() => setMatsCountInput(Math.max(1, parseInt(matsCountInput || "1") - 1).toString())}
                className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <input
                type="number"
                min="1"
                value={matsCountInput}
                onChange={(e) => setMatsCountInput(e.target.value)}
                className="w-full h-11 border border-slate-200 rounded-xl font-black text-lg text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 focus:border-[#FF7400]"
              />
              <button
                onClick={() => setMatsCountInput((parseInt(matsCountInput || "0") + 1).toString())}
                className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-4">
              {[1, 2, 3, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setMatsCountInput(n.toString())}
                  className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
                    matsCountInput === n.toString()
                      ? "bg-slate-900 text-white"
                      : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {n} Mats
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-4 items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setWizardStep(0)}
              className="w-full sm:w-auto px-8 py-3 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-colors"
            >
              Back to Overview
            </button>
            <button
              onClick={() => {
                if (parseInt(matsCountInput) > 0) {
                  setMatsConfirmed(true);
                  if (!selectedMatForAssignment) setSelectedMatForAssignment(1);
                  setWizardStep(2);
                } else {
                  showToast("Please enter a valid number of mats.", false);
                }
              }}
              disabled={!matsCountInput || parseInt(matsCountInput) < 1}
              className="w-full sm:w-auto px-10 py-3 bg-[#FF7400] hover:bg-orange-600 text-white font-black rounded-xl shadow-md shadow-orange-500/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              Continue to Officials <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Assign Officials */}
      {wizardStep === 2 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-2">
            <div>
              <h3 className="font-black text-slate-800 text-xl">Assign a referee to each mat</h3>
              <p className="text-slate-500 font-bold text-sm mt-1">Search by name or referee ID — you can change any assignment later from this screen.</p>
            </div>
            <button onClick={() => setWizardStep(1)} className="text-sm text-[#FF7400] font-black hover:underline w-fit shrink-0">Edit Total Mats</button>
          </div>

          {MatsManagementGrid}

          {!officialsAssigned && (
            <p className="text-xs font-bold text-slate-400 pt-2">
              Not all referees confirmed yet? That&apos;s fine — you can leave mats open and assign them later, before matches start on that mat.
            </p>
          )}

          <div className="pt-8 flex gap-4 border-t border-slate-100 mt-8">
            <button onClick={() => setWizardStep(1)} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-colors">Back</button>
            <button
              onClick={() => saveMatAssignments(() => setWizardStep(3))}
              disabled={savingMats}
              className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
            >
              {savingMats && <Loader2 className="animate-spin" size={20} />}
              Continue to Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Start */}
      {wizardStep === 3 && (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="font-black text-slate-800 text-xl mb-1">Review before you start</h3>
            <p className="text-slate-500 font-bold text-sm">Double-check mat count and referees — you can still edit anything below.</p>
          </div>

          <div className="pt-6 border-t border-slate-100 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3">Mat</th>
                  <th className="text-[11px] font-black text-slate-400 uppercase tracking-widest pb-3">Referee</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: totalMats }, (_, i) => i + 1).map((matNum) => {
                  const assigned = tournamentMats.find((m) => m.matNumber === matNum && m.refereeName);
                  return (
                    <tr key={matNum} className="border-t border-slate-100">
                      <td className="py-3 font-black text-slate-800">Mat {matNum}</td>
                      <td className="py-3 font-bold text-slate-700">
                        {assigned ? assigned.refereeName : (
                          <span className="text-[11px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-100 text-amber-700">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => { setSelectedMatForAssignment(matNum); setWizardStep(2); }}
                          className="text-xs font-black text-[#FF7400] hover:underline"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-bold text-amber-800 leading-relaxed">
              Starting closes registration and locks today&apos;s bracket draw. Players can no longer register, and the draw can&apos;t be regenerated once matches begin.
            </p>
          </div>

          <div className="pt-4 flex gap-4">
            <button onClick={() => setWizardStep(2)} className="px-8 py-4 bg-slate-100 text-slate-600 font-black rounded-xl hover:bg-slate-200 transition-colors">Back</button>
            <button
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: "Close Registration & Start Tournament",
                  message: "This closes registration and locks today's bracket draw.\nPlayers will no longer be able to register, and the draw can't be regenerated once matches begin.\n\nAre you sure you want to proceed?",
                  action: async () => {
                    try {
                      const token = localStorage.getItem("token");
                      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/start`, {
                        method: "PUT",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        showToast("Tournament started! Registrations closed.", true);
                        fetchTournament();
                        fetchPlayers();
                        setActiveTab("overview");
                        setWizardStep(0);
                      } else {
                        const err = await res.json();
                        showToast(err.error || "Failed to start", false);
                      }
                    } catch {
                      showToast("Failed to start", false);
                    }
                  },
                });
              }}
              className="flex-1 py-4 bg-[#10B981] hover:bg-[#059669] text-white font-black text-lg rounded-xl shadow-xl shadow-emerald-500/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              Start Tournament
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
