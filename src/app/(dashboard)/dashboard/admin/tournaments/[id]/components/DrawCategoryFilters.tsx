"use client";

import { useEffect } from "react";
import { Users } from "lucide-react";
import { FaMale, FaFemale } from "react-icons/fa";
import type { DrawCategory, RegisteredPlayer } from "../types";
import { getDrawsStats } from "../lib/matchStats";
import { MatchStatusBadges } from "./MatchStatusBadges";

const GENDERS = ["BOTH", "MALE", "FEMALE"];

export function DrawCategoryFilters({
  genderFilter,
  setGenderFilter,
  ageFilter,
  setAgeFilter,
  weightFilter,
  setWeightFilter,
  setExactAgeFilter,
  availableAgeGroups,
  groupPlayers,
  availableWeights,
  eligiblePlayersCount,
  draws,
  variant = "full",
  trailing,
}: {
  /** "compact": one row of dropdowns (Gender · Category · Weight) instead of button groups. */
  variant?: "full" | "compact";
  /** Extra controls shown at the right end of the compact row (e.g. a report button). */
  trailing?: React.ReactNode;
  genderFilter: string;
  setGenderFilter: (g: string) => void;
  ageFilter: string;
  setAgeFilter: (a: string) => void;
  weightFilter: string;
  setWeightFilter: (w: string) => void;
  setExactAgeFilter: (e: string) => void;
  availableAgeGroups: string[];
  groupPlayers: RegisteredPlayer[];
  availableWeights: string[];
  eligiblePlayersCount: number;
  draws: Record<string, DrawCategory>;
}) {
  useEffect(() => {
    if (!GENDERS.includes(genderFilter)) setGenderFilter("BOTH");
  }, [genderFilter, setGenderFilter]);

  if (variant === "compact") {
    const genderOk = (d: DrawCategory) => genderFilter === "BOTH" || d.gender === genderFilter;
    const selectionStats = getDrawsStats(draws, (d) =>
      genderOk(d) && (ageFilter === "ALL" || d.ageGroup === ageFilter) && (weightFilter === "ALL" || d.weightCategory === weightFilter));
    const weightLabel = (w: string) => {
      const label = groupPlayers.find((p) => String(p.weight) === w)?.weightLabel || w;
      return /kg/i.test(label) ? label : `${label} kg`;
    };
    const hasWeights = ageFilter !== "ALL" && availableWeights.length > 0 && availableWeights[0] !== "0";
    const selectCls =
      "h-10 w-full pl-3 pr-9 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 appearance-none cursor-pointer outline-none hover:border-slate-300 focus:border-[#FF7400] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed";
    const Chevron = () => (
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
    );

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex flex-wrap items-end gap-3">
        <label className="w-full sm:w-40">
          <span className="block text-[11px] font-bold text-slate-500 mb-1">Gender</span>
          <span className="relative block">
            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className={selectCls}>
              <option value="BOTH">Boys &amp; Girls</option>
              <option value="MALE">Boys</option>
              <option value="FEMALE">Girls</option>
            </select>
            <Chevron />
          </span>
        </label>

        <label className="w-full sm:w-48">
          <span className="block text-[11px] font-bold text-slate-500 mb-1">Category</span>
          <span className="relative block">
            <select
              value={ageFilter}
              onChange={(e) => { setAgeFilter(e.target.value); setWeightFilter("ALL"); setExactAgeFilter("ALL"); }}
              disabled={availableAgeGroups.length === 0}
              className={selectCls}
            >
              <option value="ALL">All categories</option>
              {availableAgeGroups.map((age) => <option key={age} value={age}>{age}</option>)}
            </select>
            <Chevron />
          </span>
        </label>

        <label className="w-full sm:w-48">
          <span className="block text-[11px] font-bold text-slate-500 mb-1">Weight</span>
          <span className="relative block">
            <select
              value={hasWeights ? weightFilter : "ALL"}
              onChange={(e) => setWeightFilter(e.target.value)}
              disabled={!hasWeights}
              title={!hasWeights ? "Choose a category first" : undefined}
              className={selectCls}
            >
              <option value="ALL">{ageFilter === "ALL" ? "Choose a category first" : "All weights"}</option>
              {hasWeights && availableWeights.map((w) => {
                const count = groupPlayers.filter((p) => String(p.weight) === w).length;
                return <option key={w} value={w}>{weightLabel(w)} ({count} {count === 1 ? "player" : "players"})</option>;
              })}
            </select>
            <Chevron />
          </span>
        </label>

        <div className="flex items-center gap-2 h-10 text-xs font-semibold text-slate-500">
          {ageFilter !== "ALL" && (
            <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 font-bold">
              {eligiblePlayersCount} {eligiblePlayersCount === 1 ? "player" : "players"}
            </span>
          )}
          <MatchStatusBadges stats={selectionStats} />
        </div>

        {trailing && <div className="ml-auto flex items-center gap-2 h-10">{trailing}</div>}
        {availableAgeGroups.length === 0 && (
          <p className="w-full text-sm font-semibold text-slate-400">No categories found for {genderFilter === "FEMALE" ? "girls" : genderFilter === "MALE" ? "boys" : "this tournament"}.</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
      {/* Gender Toggle */}
      <div className="flex justify-start">
        <div className="bg-slate-100 p-1.5 rounded-xl flex gap-1">
          <button
            onClick={() => setGenderFilter("BOTH")}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${
              genderFilter === "BOTH"
                ? "bg-slate-800 text-white shadow-sm shadow-slate-800/20"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Users size={14} /> BOTH
            </div>
          </button>
          <button
            onClick={() => setGenderFilter("MALE")}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${
              genderFilter === "MALE"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FaMale size={14} /> BOYS (MALE)
            </div>
          </button>
          <button
            onClick={() => setGenderFilter("FEMALE")}
            className={`px-4 py-2 rounded-lg font-black text-xs transition-all ${
              genderFilter === "FEMALE"
                ? "bg-pink-600 text-white shadow-sm shadow-pink-600/20"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FaFemale size={14} /> GIRLS (FEMALE)
            </div>
          </button>
        </div>
      </div>

      {/* Age Group Tabs */}
      {availableAgeGroups.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-left">Select Category</p>
            <div className="flex items-center gap-2.5 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Not Started</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Live</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-start">
            <button
              onClick={() => {
                setAgeFilter("ALL");
                setWeightFilter("ALL");
                setExactAgeFilter("ALL");
              }}
              className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                ageFilter === "ALL"
                  ? "bg-slate-800 text-white border-slate-800 shadow-lg"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
              }`}
            >
              All Categories
              <MatchStatusBadges stats={getDrawsStats(draws, (d) => genderFilter === "BOTH" || d.gender === genderFilter)} />
            </button>
            {availableAgeGroups.map((age) => (
              <button
                key={age}
                onClick={() => {
                  setAgeFilter(age);
                  setWeightFilter("ALL");
                  setExactAgeFilter("ALL");
                }}
                className={`flex items-center px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                  ageFilter === age
                    ? "bg-slate-800 text-white border-slate-800 shadow-lg"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                {age}
                <MatchStatusBadges stats={getDrawsStats(draws, (d) => d.ageGroup === age && (genderFilter === "BOTH" || d.gender === genderFilter))} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-500 font-bold py-4">No categories found for {genderFilter}</p>
      )}

      {/* Weight Flow */}
      {ageFilter !== "ALL" && (
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Weight / Age Sub-categories</p>
            <span className="text-xs font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full">
              {eligiblePlayersCount} eligible / {weightFilter === "ALL" ? groupPlayers.length : groupPlayers.filter((p) => String(p.weight) === weightFilter).length} total in this category
            </span>
          </div>

          {availableWeights.length > 0 && availableWeights[0] !== "0" && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">Weights</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setWeightFilter("ALL")}
                  className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                    weightFilter === "ALL"
                      ? "bg-[#FF7400] text-white border-[#FF7400] shadow-md shadow-orange-500/20"
                      : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
                  }`}
                >
                  All Weights
                  <MatchStatusBadges stats={getDrawsStats(draws, (d) => d.ageGroup === ageFilter && (genderFilter === "BOTH" || d.gender === genderFilter))} />
                </button>
                {availableWeights.map((w) => {
                  const label = groupPlayers.find((p) => String(p.weight) === w)?.weightLabel || `${w} kg`;
                  const count = groupPlayers.filter((p) => String(p.weight) === w).length;
                  const approvedCount = groupPlayers.filter((p) => String(p.weight) === w && p.status === "APPROVED").length;
                  const weightStats = getDrawsStats(draws, (d) => d.ageGroup === ageFilter && d.weightCategory === w && (genderFilter === "BOTH" || d.gender === genderFilter));

                  return (
                    <button
                      key={w}
                      onClick={() => setWeightFilter(w)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        weightFilter === w
                          ? "bg-[#FF7400] text-white border-[#FF7400] shadow-md shadow-orange-500/20"
                          : "bg-white text-slate-600 border-slate-200 hover:border-orange-300 hover:-translate-y-0.5"
                      }`}
                    >
                      {label}
                      <span className={`px-1.5 py-0.5 rounded-sm text-[10px] ${weightFilter === w ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                        {approvedCount}/{count}
                      </span>
                      <MatchStatusBadges stats={weightStats} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
