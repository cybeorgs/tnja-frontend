"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Trophy,
  Calendar,
  MapPin,
  Hash,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
  Loader2,
  Scale,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { exportMatchToPDF } from "@/utils/pdfExport";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function MatchHistoryPage() {
  const [playerData, setPlayerData] = useState<any>(null);
  const [completedMatches, setCompletedMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterResult, setFilterResult] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please login again.");
        setLoading(false);
        return;
      }

      // Fetch profile
      const profileRes = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();

      if (!profileRes.ok) throw new Error(profileData.error || "Failed to fetch profile");
      setPlayerData(profileData.user);

      // Fetch tournaments
      const trnRes = await fetch(`${API_BASE}/tournaments/player`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pubRes = await fetch(`${API_BASE}/tournaments/player/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let allTournaments: any[] = [];
      
      if (trnRes.ok) {
        const clubTournaments = await trnRes.json();
        allTournaments = [...allTournaments, ...clubTournaments];
      }
      
      if (pubRes.ok) {
        const pubData = await pubRes.json();
        allTournaments = [
          ...allTournaments,
          ...(pubData.district || []),
          ...(pubData.zonal || []),
          ...(pubData.stateAndNational || [])
        ];
      }
      
      const completed: any[] = [];

      for (const trn of allTournaments) {
        if (trn.myRegistration && (trn.myRegistration.status === "APPROVED" || trn.myRegistration.status === "PENDING")) {
          const drawRes = await fetch(`${API_BASE}/tournaments/${trn.id}/draws`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          if (drawRes.ok) {
            const draws = await drawRes.json();
            for (const draw of draws) {
              if (draw.rounds) {
                let roundsArr = draw.rounds;
                if (typeof roundsArr === "string") {
                  try { roundsArr = JSON.parse(roundsArr); } catch { continue; }
                }
                if (!Array.isArray(roundsArr)) continue;

                for (let rIdx = 0; rIdx < roundsArr.length; rIdx++) {
                  const round = roundsArr[rIdx];
                  if (!Array.isArray(round)) continue;
                  
                  for (const match of round) {
                    const isPlayerInvolved = match.slotA?.playerId === profileData.user.id || match.slotB?.playerId === profileData.user.id;
                    if (!isPlayerInvolved) continue;

                    if (match.status === "COMPLETED") {
                      const opponent = match.slotA.playerId === profileData.user.id ? match.slotB : match.slotA;
                      
                      completed.push({
                        tournamentId: trn.id,
                        tournamentName: trn.title,
                        tournamentDate: trn.date,
                        tournamentLocation: trn.location,
                        tournamentLevel: trn.level || "CLUB",
                        opponent,
                        roundNum: rIdx + 1,
                        matNumber: match.matNumber,
                        matchNumber: match.matchNumber,
                        rawMatch: match,
                        winnerSlot: match.winnerId === match.slotA.playerId ? match.slotA : match.slotB,
                        loserSlot: match.winnerId === match.slotA.playerId ? match.slotB : match.slotA,
                        nextMatchInfo: null,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      setCompletedMatches(completed.sort((a, b) => new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique years from history for filter dropdown
  const availableYears = useMemo(() => {
    const years = new Set(completedMatches.map(m => new Date(m.tournamentDate).getFullYear().toString()));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [completedMatches]);

  // Apply filters
  const filteredMatches = useMemo(() => {
    return completedMatches.filter(match => {
      // Search
      const searchMatch = !searchQuery || 
        match.tournamentName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (match.opponent?.playerName && match.opponent.playerName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Level
      const levelMatch = filterLevel === "ALL" || match.tournamentLevel === filterLevel;
      
      // Result
      let resultMatch = true;
      if (filterResult !== "ALL" && playerData?.id) {
        const isWin = match.rawMatch.winnerId === playerData.id;
        const isDraw = !match.rawMatch.winnerId;
        
        if (filterResult === "WIN") resultMatch = isWin;
        if (filterResult === "LOSS") resultMatch = !isWin && !isDraw;
        if (filterResult === "DRAW") resultMatch = isDraw;
      }
      
      // Year
      const yearMatch = filterYear === "ALL" || new Date(match.tournamentDate).getFullYear().toString() === filterYear;
      
      return searchMatch && levelMatch && resultMatch && yearMatch;
    });
  }, [completedMatches, searchQuery, filterLevel, filterResult, filterYear, playerData]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / itemsPerPage));
  const currentMatches = filteredMatches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    
    if (playerData?.id) {
      completedMatches.forEach(match => {
        const isWin = match.rawMatch.winnerId === playerData.id;
        const isDraw = !match.rawMatch.winnerId; // Depending on how draws are stored, adapt this if necessary
        
        if (isDraw) draws++;
        else if (isWin) wins++;
        else losses++;
      });
    }
    
    return { wins, losses, draws, total: wins + losses + draws };
  }, [completedMatches, playerData]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterLevel, filterResult, filterYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
        <p className="text-slate-500 font-medium">Loading match history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center gap-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-full">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Unable to load history</h2>
        <p className="text-slate-500">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-2 px-6 py-2 bg-[#FF7400] text-white rounded-full font-bold">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Match History</h1>
          <p className="text-slate-500 mt-1">Review your past performances and download match reports</p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Matches</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
            <Hash size={24} className="text-slate-200 mb-1" />
          </div>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 shadow-sm">
          <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-wider mb-1">Wins</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-emerald-700">{stats.wins}</h3>
            <Trophy size={24} className="text-emerald-200 mb-1" />
          </div>
        </div>
        <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100 shadow-sm">
          <p className="text-xs font-bold text-rose-600/80 uppercase tracking-wider mb-1">Losses</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-rose-700">{stats.losses}</h3>
            <XCircle size={24} className="text-rose-200 mb-1" />
          </div>
        </div>
        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Draws</p>
          <div className="flex items-end justify-between">
            <h3 className="text-3xl font-black text-slate-700">{stats.draws}</h3>
            <Scale size={24} className="text-slate-200 mb-1" />
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search tournament or opponent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 transition-all"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          <select 
            value={filterLevel} 
            onChange={(e) => setFilterLevel(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30"
          >
            <option value="ALL">All Levels</option>
            <option value="CLUB">Club</option>
            <option value="DISTRICT">District</option>
            <option value="ZONE">Zonal</option>
            <option value="STATE">State</option>
            <option value="NATIONAL">National</option>
          </select>
          
          <select 
            value={filterResult} 
            onChange={(e) => setFilterResult(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30"
          >
            <option value="ALL">All Results</option>
            <option value="WIN">Wins</option>
            <option value="LOSS">Losses</option>
            <option value="DRAW">Draws</option>
          </select>

          {availableYears.length > 0 && (
            <select 
              value={filterYear} 
              onChange={(e) => setFilterYear(e.target.value)}
              className="flex-1 md:flex-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30"
            >
              <option value="ALL">All Years</option>
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Match List */}
      <div className="space-y-4">
        {filteredMatches.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
            <Trophy size={48} className="mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-slate-500">No matches found</h3>
            <p className="text-slate-400 mt-2">Try adjusting your filters or search query.</p>
          </div>
        ) : (
          <AnimatePresence>
            {currentMatches.map((match, idx) => {
              const isWin = match.rawMatch.winnerId === playerData?.id;
              const isDraw = !match.rawMatch.winnerId;

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  key={`${match.tournamentId}-${match.matchNumber}-${idx}`} 
                  className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      {isWin ? (
                        <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">WIN</span>
                      ) : isDraw ? (
                        <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">DRAW</span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider">LOSS</span>
                      )}
                      <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {match.tournamentLevel} Level
                      </span>
                    </div>
                    
                    <h4 className="font-bold text-slate-800 text-lg leading-tight">{match.tournamentName}</h4>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5"><Calendar size={14} className="text-[#FF7400]"/> {new Date(match.tournamentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#FF7400]" /> {match.tournamentLocation}</span>
                      <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-bold"><Hash size={14} /> Round {match.roundNum}</span>
                    </div>
                  </div>

                  <div className="hidden lg:block w-px h-16 bg-slate-200" />

                  <div className="flex-1 flex flex-col lg:items-end space-y-3 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0">
                    <div className="lg:text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Opponent</span>
                      <span className="font-bold text-slate-800 text-[15px]">{match.opponent?.playerName || "Unknown"}</span>
                      {match.opponent?.club && <span className="block text-xs font-medium text-slate-500">{match.opponent.club}</span>}
                    </div>
                    
                    <button
                      onClick={() => {
                        exportMatchToPDF(
                          match.rawMatch,
                          match.winnerSlot,
                          match.loserSlot,
                          { title: match.tournamentName, date: match.tournamentDate, level: match.tournamentLevel, location: match.tournamentLocation },
                          match.roundNum - 1,
                          match.nextMatchInfo
                        );
                      }}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-50 border border-slate-200 hover:bg-[#FF7400] hover:border-[#FF7400] text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-all w-full lg:w-fit"
                    >
                      <Download size={15} /> Download Match Report
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
