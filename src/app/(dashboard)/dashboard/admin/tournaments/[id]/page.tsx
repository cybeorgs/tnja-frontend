"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Users, Shuffle, Swords, Monitor, ArrowLeft,
  Grid, List, X, Check, Loader2, Calendar, MapPin,
  Target, Award, Medal, Edit2,
  AlertCircle, Clock, Download, BarChart3,
  PlayCircle, Lock, Search, XCircle, Printer,
  ChevronLeft, ChevronRight, ChevronDown, Eye, FilterX,
  LayoutList, Upload,
} from "lucide-react";
import type { BracketMatch, BracketSlot, DrawCategory, RegisteredPlayer, Seeds, Tab, Tournament, ViewMode } from "./types";
import {
  categoryKey, clubSeparatedShuffle, findNextMatch, generateIJFBracket, generateRoundRobin,
  isDrawRoundRobin, processByeMatches, backfillBronzeMatches, getRoundLabel, shuffleArray,
} from "./lib/bracketEngine";
import { exportAllMatchesToPDF, exportMatchToPDF, exportOverallTournamentReport, printRegistrationSlip, exportCategoryReport, exportCategoryChartPDF } from "./lib/pdfExport";
import { getRoundsStats } from "./lib/matchStats";
import { ExpiredBlock } from "./components/ExpiredBlock";
import { BracketView, RoundRobinLeaderboard } from "./components/BracketView";
import { ImportPlayersWizard } from "./components/ImportPlayersWizard";
import { AddPlayerModal } from "./components/AddPlayerModal";
import { DisqualifyTab } from "./components/DisqualifyTab";
import { DrawCategoryFilters } from "./components/DrawCategoryFilters";
import { MatsOfficialsPanel } from "./components/MatsOfficialsPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function TournamentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<RegisteredPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("players");
  const [viewMode, setViewMode] = useState<ViewMode>("bracket"); // default bracket

  const [ageFilter, setAgeFilter] = useState("ALL");
  const [exactAgeFilter, setExactAgeFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("MALE");
  const [weightFilter, setWeightFilter] = useState("ALL");
  const [matchStatusFilter, setMatchStatusFilter] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED">("ALL");

  const [draws, setDraws] = useState<Record<string, DrawCategory>>({});
  const drawsRef = useRef<Record<string, DrawCategory>>({});
  const [seeds, setSeeds] = useState<Seeds>({ 1: null, 2: null, 3: null, 4: null });
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [assigningSeed, setAssigningSeed] = useState<1 | 2 | 3 | 4 | null>(null);
  const [champion, setChampion] = useState<{
    name: string;
    club: string;
    categoryKey: string;
    secondPlaceName?: string;
    secondPlaceClub?: string;
    thirdPlaceName?: string;
    thirdPlaceClub?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [drawPhase, setDrawPhase] = useState<"idle" | "shuffling" | "dealing" | "done">("idle");
  const [shuffleKey, setShuffleKey] = useState(0);
  type DrawMethodType = "round-robin" | "straight-elimination" | "single-repechage" | "double-repechage";
  const [categoryDrawMethod, setCategoryDrawMethod] = useState<Record<string, DrawMethodType>>({});
  const [categoryViewMode, setCategoryViewMode] = useState<Record<string, ViewMode>>({});
  const [detailDrawMethod, setDetailDrawMethod] = useState<DrawMethodType>("round-robin");
  const [pendingMatByKey, setPendingMatByKey] = useState<Record<string, number>>({});
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [autoGenProgress, setAutoGenProgress] = useState("");

  // ── Result Submission State ─────────────────────────────────────────────────
  const [placements, setPlacements] = useState<Record<string, "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION">>({});
  const [submittingResults, setSubmittingResults] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // ── Modals State ────────────────────────────────────────────────────────────
  const [editingMetrics, setEditingMetrics] = useState<{ regId: string, weight: string, height: string, belt: string, clubId: string, coachId: string, ageGroup: string } | null>(null);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [clubOptions, setClubOptions] = useState<{ id: string; name: string }[]>([]);
  const [coachOptions, setCoachOptions] = useState<{ id: string; fullName: string }[]>([]);
  const [isConcludeModalOpen, setIsConcludeModalOpen] = useState(false);
  const [concludingCategoryKey, setConcludingCategoryKey] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; action?: () => void }>({ isOpen: false, title: "", message: "" });

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // ── Weigh-in State ────────────────────────────────────────────────────────
  const [weighInSearch, setWeighInSearch] = useState("");
  const [selectedWeighInPlayer, setSelectedWeighInPlayer] = useState<RegisteredPlayer | null>(null);
  const [actualWeight, setActualWeight] = useState("");
  const [isDisqualifying, setIsDisqualifying] = useState(false);

  // ── Mats & Referees State ──────────────────────────────────────────────────
  const [tournamentMats, setTournamentMats] = useState<{matNumber: number, refereeId: string, refereeName?: string, refereeCoachId?: string}[]>([]);
  const [savingMats, setSavingMats] = useState(false);
  const [loadingMats, setLoadingMats] = useState(false);
  const [matsCountInput, setMatsCountInput] = useState<string>("");
  const [matsConfirmed, setMatsConfirmed] = useState(false);
  const [wizardStep, setWizardStep] = useState<0|1|2|3>(0);
  const [selectedMatForAssignment, setSelectedMatForAssignment] = useState<number | null>(null);
  const [refSearchQuery, setRefSearchQuery] = useState("");
  const [refSearchResults, setRefSearchResults] = useState<{ id: string; refId?: string; name: string; district: string; club: string }[]>([]);
  const [refSearching, setRefSearching] = useState(false);
  const [refSearchRefreshKey, setRefSearchRefreshKey] = useState(0);
  const refSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Registrations Tab State ────────────────────────────────────────────────
  const [regSearchQuery, setRegSearchQuery] = useState("");
  const [regDistrictFilter, setRegDistrictFilter] = useState("All Districts");
  const [regClubFilter, setRegClubFilter] = useState("All Clubs");
  const [regGenderFilter, setRegGenderFilter] = useState("All Genders");
  const [regCategoryFilter, setRegCategoryFilter] = useState("All Categories");
  const [regBeltFilter, setRegBeltFilter] = useState("All Belts");
  const [regPaymentFilter, setRegPaymentFilter] = useState("All Payment Status");
  const [regStatusFilter, setRegStatusFilter] = useState("All Approval Status");
  const [regCurrentPage, setRegCurrentPage] = useState(1);
  const [regItemsPerPage, setRegItemsPerPage] = useState(10);
  const [regFiltersExpanded, setRegFiltersExpanded] = useState(false);

  const fetchMats = useCallback(async () => {
    if (!tournamentId) return;
    setLoadingMats(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/mats`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTournamentMats(data.mats.map((m: any) => ({
          matNumber: m.matNumber,
          refereeId: m.refereeId || "",
          refereeName: m.referee?.fullName || "",
          refereeCoachId: m.referee?.permanentId || m.referee?.tempId || ""
        })));
        if (data.mats.length > 0) {
          setMatsCountInput(data.mats.length.toString());
          setMatsConfirmed(true);
        }
      }
    } catch (error) {
      console.error("Error fetching mats:", error);
    } finally {
      setLoadingMats(false);
    }
  }, [tournamentId]);

  // Debounced referee autocomplete for mat assignment. An empty query still
  // fetches — it returns the full approved roster — so admins always see a
  // browsable list of registered coaches (name + ID) instead of an empty box
  // until they start typing.
  useEffect(() => {
    if (!selectedMatForAssignment) return;
    if (refSearchDebounceRef.current) clearTimeout(refSearchDebounceRef.current);
    const query = refSearchQuery.trim();
    refSearchDebounceRef.current = setTimeout(async () => {
      setRefSearching(true);
      try {
        const res = await fetch(`${API_BASE}/referees/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setRefSearchResults(res.ok ? (data.referees || []) : []);
      } catch (e) {
        setRefSearchResults([]);
      } finally {
        setRefSearching(false);
      }
    }, query ? 300 : 0);
    return () => {
      if (refSearchDebounceRef.current) clearTimeout(refSearchDebounceRef.current);
    };
  }, [refSearchQuery, selectedMatForAssignment, refSearchRefreshKey]);

  const assignRefereeToMat = (matNum: number, ref: { id: string; name: string; refId?: string }) => {
    setTournamentMats(prev => {
      const filtered = prev.filter(m => m.matNumber !== matNum);
      return [...filtered, { matNumber: matNum, refereeId: ref.id, refereeName: ref.name, refereeCoachId: ref.refId || "" }];
    });
    setRefSearchQuery("");
    setRefSearchResults([]);
  };

  // ── Auto-detect placements from draw results ─────────────────────────────────
  // Runs whenever the draws or players change (e.g. when Results tab is opened)
  const autoDetectPlacements = useCallback(() => {
    if (Object.keys(draws).length === 0 || players.length === 0) return;

    const detected: Record<string, "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION"> = {};

    // Start everyone as PARTICIPATION
    players.forEach((p) => { detected[p.id] = "PARTICIPATION"; });

    // Iterate over every draw category to find final + semi-final losers/winners
    for (const draw of Object.values(draws)) {
      const rounds = draw.rounds;
      if (!rounds || rounds.length === 0) continue;

      const catPlayers = players.filter(p => 
        p.status === "APPROVED" &&
        p.ageGroup === draw.ageGroup &&
        (draw.exactAge === 0 || p.exactAge === draw.exactAge) &&
        p.gender === draw.gender &&
        String(p.weight) === draw.weightCategory
      );

      const isRR = isDrawRoundRobin(draw);

      if (isRR) {
        // Calculate Round Robin standings to detect Gold, Silver, Bronze
        const standingsMap: Record<string, {
          playerId: string;
          name: string;
          wins: number;
          points: number;
          totalWinningTime: number;
        }> = {};

        catPlayers.forEach(p => {
          standingsMap[p.id] = { playerId: p.id, name: p.name, wins: 0, points: 0, totalWinningTime: 0 };
        });

        const allMatches: BracketMatch[] = [];
        rounds.forEach(r => {
          r.forEach(m => {
            allMatches.push(m);
            if (m.status === "COMPLETED") {
              const elapsed = m.elapsedSeconds || 0;
              const ptsA = m.scoreA ? ( (m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0) * 1 ) : 0;
              const ptsB = m.scoreB ? ( (m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0) * 1 ) : 0;

              if (m.slotA.playerId && standingsMap[m.slotA.playerId]) standingsMap[m.slotA.playerId].points += Math.min(ptsA, 100);
              if (m.slotB.playerId && standingsMap[m.slotB.playerId]) standingsMap[m.slotB.playerId].points += Math.min(ptsB, 100);

              if (m.winnerId && standingsMap[m.winnerId]) {
                standingsMap[m.winnerId].wins += 1;
                standingsMap[m.winnerId].totalWinningTime += elapsed;
              }
            }
          });
        });

        const sortedPlayers = Object.values(standingsMap).sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.points !== a.points) return b.points - a.points;

          const tiedGroup = Object.values(standingsMap).filter(p => p.wins === a.wins && p.points === a.points);
          if (tiedGroup.length === 2) {
            const headToHead = allMatches.find(m => 
              m.status === "COMPLETED" && 
              ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
               (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
            );
            if (headToHead && headToHead.winnerId) {
              return headToHead.winnerId === a.playerId ? -1 : 1;
            }
          }

          if (a.totalWinningTime !== b.totalWinningTime) {
            return a.totalWinningTime - b.totalWinningTime;
          }

          const headToHead = allMatches.find(m => 
            m.status === "COMPLETED" && 
            ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
             (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
          );
          if (headToHead && headToHead.winnerId) {
            return headToHead.winnerId === a.playerId ? -1 : 1;
          }

          return 0;
        });

        if (sortedPlayers.length > 0 && sortedPlayers[0].playerId) detected[sortedPlayers[0].playerId] = "FIRST";
        if (sortedPlayers.length > 1 && sortedPlayers[1].playerId) detected[sortedPlayers[1].playerId] = "SECOND";
        if (sortedPlayers.length > 2 && sortedPlayers[2].playerId) detected[sortedPlayers[2].playerId] = "THIRD";
      } else {
        const hasDoubleRepechage = rounds.some(r => r.some(m => m.matchId.startsWith("rr_rep1_m2")));
        const hasSingleRepechage = !hasDoubleRepechage && rounds.some(r => r.some(m => m.matchId.startsWith("rr_rep")));
        const totalMainRounds = (hasDoubleRepechage || hasSingleRepechage) ? rounds.length - 2 : rounds.length;

        // Gold & Silver from the final match
        if (totalMainRounds >= 1) {
          const finalRound = rounds[totalMainRounds - 1];
          if (finalRound && finalRound.length > 0) {
            const finalMatch = finalRound[0];
            if (finalMatch.status === "COMPLETED" && finalMatch.winnerId) {
              detected[finalMatch.winnerId] = "FIRST";
              const silverId = finalMatch.winnerId === finalMatch.slotA.playerId ? finalMatch.slotB.playerId : finalMatch.slotA.playerId;
              if (silverId) detected[silverId] = "SECOND";
            }
          }
        }

        if (hasDoubleRepechage) {
          // Both winners of the two Bronze Matches in the last round get 3rd place (Bronze)
          const bronzeRound = rounds[rounds.length - 1];
          if (bronzeRound && bronzeRound.length >= 2) {
            bronzeRound.forEach(m => {
              if (m.status === "COMPLETED" && m.winnerId) {
                detected[m.winnerId] = "THIRD";
              }
            });
          }
        } else if (hasSingleRepechage) {
          // Winner of the single Bronze Match in the last round gets 3rd place (Bronze)
          const bronzeRound = rounds[rounds.length - 1];
          if (bronzeRound && bronzeRound.length >= 1) {
            const bronzeMatch = bronzeRound[0];
            if (bronzeMatch.status === "COMPLETED" && bronzeMatch.winnerId) {
              detected[bronzeMatch.winnerId] = "THIRD";
            }
          }
        } else {
          // Standard Single Elimination (final + semi logic)
          const totalRounds = rounds.length;
          const finalRound = rounds[totalRounds - 1];
          let hasBronzeMatch = false;

          if (finalRound && finalRound.length > 0) {
            const finalMatch = finalRound[0];
            if (finalMatch.status === "COMPLETED" && finalMatch.winnerId) {
              detected[finalMatch.winnerId] = "FIRST";
              const silverPlayerId =
                finalMatch.winnerId === finalMatch.slotA.playerId
                  ? finalMatch.slotB.playerId
                  : finalMatch.slotA.playerId;
              if (silverPlayerId) detected[silverPlayerId] = "SECOND";
            }

            if (finalRound.length > 1) {
              hasBronzeMatch = true;
              const bronzeMatch = finalRound[1];
              if (bronzeMatch.status === "COMPLETED" && bronzeMatch.winnerId) {
                detected[bronzeMatch.winnerId] = "THIRD";
              }
            }
          }

          if (totalRounds >= 2 && !hasBronzeMatch) {
            const semiRound = rounds[totalRounds - 2];
            for (const match of semiRound) {
              if (match.status === "COMPLETED" && match.winnerId) {
                const bronzePlayerId =
                  match.winnerId === match.slotA.playerId
                    ? match.slotB.playerId
                    : match.slotA.playerId;
                if (bronzePlayerId && detected[bronzePlayerId] === "PARTICIPATION") {
                  detected[bronzePlayerId] = "THIRD";
                }
              }
            }
          }
        }
      }
    }

    setPlacements(detected);
  }, [draws, players]);

  const handleConcludeCategory = async (key: string, catPlayers: RegisteredPlayer[]) => {
    setConcludingCategoryKey(null);
    setIsConcludeModalOpen(false);

    const draw = draws[key];
    if (!draw) return;

    const results = catPlayers.map((p) => ({
      regId: p.regId,
      playerId: p.id,
      placement: placements[p.id] || "PARTICIPATION",
    }));

    setSubmittingResults(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/results`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          results,
          ageGroup: draw.ageGroup,
          exactAge: draw.exactAge || 0,
          gender: draw.gender,
          weightCategory: draw.weightCategory,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Category concluded successfully! Certificates are now available for download. 🏆");
        setDraws(prev => ({
          ...prev,
          [key]: {
            ...prev[key]!,
            isConcluded: true
          }
        }));
        fetchTournament();
        fetchDraws();
      } else {
        showToast(data.error || "Failed to submit category results", false);
      }
    } catch (err) {
      console.error(err);
      showToast("Error submitting category results", false);
    } finally {
      setSubmittingResults(false);
    }
  };

  const handleDownloadCertificate = async (player: RegisteredPlayer) => {
    if (!player.regId) return;
    try {
      showToast("Generating certificate...");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate?regId=${player.regId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to generate certificate", false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${player.name.replace(/\s+/g, "_")}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      showToast("Error downloading certificate", false);
    }
  };

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };


  const currentKey = categoryKey(ageFilter, exactAgeFilter, genderFilter, weightFilter);


  // ── Fetch tournament ────────────────────────────────────────────────────────
  const fetchTournament = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setTournament(await res.json());
    } catch (e) { console.error(e); }
  }, [tournamentId, token]);

  const openEditMetricsModal = (p: RegisteredPlayer) => {
    setEditingMetrics({
      regId: p.regId || "",
      weight: p.rawWeight || "",
      height: p.rawHeight || "",
      belt: p.belt || "",
      clubId: p.clubId || "",
      coachId: p.coachId || "",
      ageGroup: p.ageGroup || "",
    });
    if (clubOptions.length === 0) {
      fetch(`${API_BASE}/clubs`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => setClubOptions(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
    if (coachOptions.length === 0) {
      fetch(`${API_BASE}/coaches`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => setCoachOptions(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  };

  const handleUpdateMetrics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMetrics?.regId) return;
    setSavingMetrics(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${editingMetrics.regId}/metrics`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          weight: editingMetrics.weight,
          height: editingMetrics.height,
          belt: editingMetrics.belt,
          clubId: editingMetrics.clubId,
          coachId: editingMetrics.coachId,
          ageGroup: editingMetrics.ageGroup,
        }),
      });
      if (res.ok) {
        setToast({ msg: "Metrics updated successfully", ok: true });
        setEditingMetrics(null);
        fetchPlayers(); // Refresh the players list
      } else {
        const data = await res.json();
        setToast({ msg: data.error || "Failed to update metrics", ok: false });
      }
    } catch {
      setToast({ msg: "Error updating metrics", ok: false });
    } finally {
      setSavingMetrics(false);
    }
  };

  // ── Fetch registered players ────────────────────────────────────────────────
  const fetchPlayers = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const raw = await res.json();
        // normalise: backend may return nested player objects
        const normalised: RegisteredPlayer[] = (Array.isArray(raw) ? raw : raw.registrations || []).map(
          (r: any) => {
            const exactWeightStr = r.weightCategory || r.weight || "";
            const exactWeight = Number(exactWeightStr);
            let bucketWeight: number | string = exactWeightStr;
            let weightLabel = exactWeightStr;

            if (!isNaN(exactWeight) && exactWeight > 0) {
              if (exactWeight <= 50) {
                bucketWeight = "Under 50";
                weightLabel = "Under 50";
              } else {
                bucketWeight = `${Math.ceil(exactWeight / 5) * 5}`;
                weightLabel = `${Math.ceil(exactWeight / 5) * 5 - 4}-${Math.ceil(exactWeight / 5) * 5}`;
              }
            }
            
            return {
              id: r.playerId || r.player?.id || r.id,
              name: r.player?.fullName || r.playerName || r.name || "Unknown",
              club: r.player?.club?.name || r.club || "",
              district: r.player?.district?.name || r.district || "",
              weight: bucketWeight,
              weightLabel: weightLabel,
              ageGroup: r.ageGroup || "SENIOR",
              exactAge: Number(r.player?.age || 0),
              gender: r.gender || r.player?.gender || "MALE",
              belt: r.belt || r.player?.belt || "",
              placement: r.placement || "PARTICIPATION",
              status: r.status || "APPROVED",
              regId: r.id,
              permanentId: r.player?.permanentId,
              tempId: r.player?.tempId,
              tnjaId: r.player?.permanentId || r.player?.tempId || "N/A",
              clubId: r.player?.club?.id || null,
              coachId: r.coachId || null,
              coachName: r.coach?.fullName || "",
              isPaid: !!r.isPaid,
              registeredAt: r.createdAt,
              rawWeight: r.weight || r.player?.weight || null,
              rawHeight: r.height || r.player?.height || null,
            };
          }
        );
        setPlayers(normalised);
      }
    } catch (e) { console.error(e); }
  }, [tournamentId, token]);

  // ── Handle Registration Status Update ─────────────────────────────────────────
  const handleUpdatePlayerStatus = async (regId: string, status: "APPROVED" | "REJECTED") => {
    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} this registration?`)) return;
    
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${regId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Registration ${status.toLowerCase()} successfully`);
        fetchPlayers(); // Refresh the players list
      } else {
        showToast("Failed to update registration status", false);
      }
    } catch (e) {
      console.error(e);
      showToast("Error updating registration", false);
    }
  };

  const handleDisqualifyPlayer = async (regId: string, currentWeight: string) => {
    if (!window.confirm(`Are you sure you want to disqualify this player due to weight mismatch?`)) return;
    
    setIsDisqualifying(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${regId}/disqualify`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentWeight })
      });
      if (res.ok) {
        showToast(`Player disqualified successfully`);
        setSelectedWeighInPlayer(null);
        setActualWeight("");
        setWeighInSearch("");
        fetchPlayers(); // Refresh the players list
      } else {
        showToast("Failed to disqualify player", false);
      }
    } catch (e) {
      console.error(e);
      showToast("Error disqualifying player", false);
    } finally {
      setIsDisqualifying(false);
    }
  };

  // ── Fetch existing draws ────────────────────────────────────────────────────
  const fetchDraws = useCallback(async () => {
    if (!tournamentId) return;
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const drawMap: Record<string, DrawCategory> = {};
        (Array.isArray(data) ? data : []).forEach((d: DrawCategory) => {
          let roundsArr = d.rounds;
          if (typeof roundsArr === "string") {
            try { roundsArr = JSON.parse(roundsArr); } catch (err) {}
          }
          if (!Array.isArray(roundsArr)) roundsArr = [];
          
          const ageStr = d.exactAge === 0 ? "ALL" : String(d.exactAge);
          drawMap[categoryKey(d.ageGroup, ageStr, d.gender, d.weightCategory)] = {
            ...d,
            rounds: backfillBronzeMatches(processByeMatches(roundsArr)),
            generated: roundsArr.length > 0,
            saved: true,
          };
        });
        setDraws(drawMap);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tournamentId, token]);

  useEffect(() => {
    fetchTournament();
    fetchPlayers();
    fetchDraws();
    fetchMats();
  }, [fetchTournament, fetchPlayers, fetchDraws, fetchMats]);

  // Auto-detect placements whenever the Results tab becomes active or draws/players update
  useEffect(() => {
    if (activeTab === "results") {
      autoDetectPlacements();
    }
  }, [activeTab, autoDetectPlacements]);

  // Polling for live bracket updates from the scoreboards
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (activeTab === "draws" && drawPhase === "idle" && !autoGenerating) {
      interval = setInterval(() => {
        fetchDraws();
      }, 10000); // 10 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, drawPhase, autoGenerating, fetchDraws]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const hasPendingPlayers = players.some((p) => p.status === "PENDING");
  const isMultiCategory = genderFilter === "BOTH" || weightFilter === "ALL" || ageFilter === "ALL";

  const filteredPlayers = players.filter((p) => {
    if (ageFilter !== "ALL" && p.ageGroup !== ageFilter) return false;
    if (exactAgeFilter !== "ALL" && String(p.exactAge) !== exactAgeFilter) return false;
    if (genderFilter !== "BOTH" && p.gender !== genderFilter) return false;
    if (weightFilter !== "ALL" && String(p.weight) !== weightFilter) return false;
    return true;
  });

  const eligiblePlayers = filteredPlayers.filter((p) => p.status === "APPROVED");
  // Only approved players should be shown in the draw generation tab's cards
  const drawPlayers = eligiblePlayers;

  const currentDraw = draws[currentKey];
  const isCurrentRoundRobin = !!currentDraw?.rounds[0]?.[0]?.matchId.startsWith("rr_");
  const effectiveViewMode: ViewMode = viewMode === "leaderboard" && !isCurrentRoundRobin ? "bracket" : viewMode;

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleAssignSeed = (seedNum: 1 | 2 | 3 | 4, player: RegisteredPlayer) => {
    setSeeds((prev) => {
      const n = { ...prev };
      (Object.keys(n) as unknown as (1 | 2 | 3 | 4)[]).forEach((k) => {
        if (n[k]?.id === player.id) n[k] = null;
      });
      n[seedNum] = { ...player, seedNumber: seedNum };
      return n;
    });
    setAssigningSeed(null);
  };

  const handleGenerateAndSaveDraw = async (
    isShuffle = false,
    isConfirmed = false,
    explicitCat?: { ageGroup: string; exactAge: string; gender: string; weightCategory: string; players: RegisteredPlayer[]; key: string; draw: DrawCategory | undefined },
    drawMethod?: DrawMethodType
  ) => {
    const activeKey = explicitCat ? explicitCat.key : currentKey;
    const activeDraw = explicitCat ? explicitCat.draw : currentDraw;
    const activePlayers = explicitCat ? explicitCat.players : eligiblePlayers;
    const activeAgeGrp = explicitCat ? explicitCat.ageGroup : ageFilter;
    const activeExactAge = explicitCat ? explicitCat.exactAge : exactAgeFilter;
    const activeGender = explicitCat ? explicitCat.gender : genderFilter;
    const activeWeight = explicitCat ? explicitCat.weightCategory : weightFilter;

    if (activePlayers.length < 1) {
      showToast("Need at least 1 approved player to generate a draw", false);
      return;
    }

    if (!explicitCat && isMultiCategory) {
      showToast("Please select a specific category (Age, Gender, Weight) to Generate or Shuffle the draw.", false);
      return;
    }

    const hasActive = activeDraw?.rounds?.some(r => r.some(m => m.status === "COMPLETED" || m.status === "IN_PROGRESS"));
    if (hasActive) {
      showToast("Cannot shuffle or re-generate because matches have already started or completed in this category!", false);
      return;
    }

    const defaultMethod = activePlayers.length <= 5 ? "round-robin" : "straight-elimination";
    const selectedMethod = drawMethod || (explicitCat ? (categoryDrawMethod[activeKey] || defaultMethod) : (detailDrawMethod || defaultMethod));

    if (isShuffle && activeDraw?.generated) {
      if (!isConfirmed) {
        setConfirmModal({
          isOpen: true,
          title: "Re-shuffle Bracket",
          message: "Are you sure you want to completely re-shuffle this bracket? All unsaved matches will be lost.",
          action: () => handleGenerateAndSaveDraw(isShuffle, true, explicitCat, selectedMethod)
        });
        return;
      }
    }

    setDrawPhase(isShuffle ? "shuffling" : "dealing");
    if (isShuffle) setShuffleKey(k => k + 1);
    
    let rounds;
    if (activePlayers.length === 1) {
      // Single-player category — no opponent to pair against, so just declare
      // a direct win. generateIJFBracket pairs the lone player against a BYE
      // slot, and processByeMatches auto-completes that as a walkover.
      rounds = processByeMatches(generateIJFBracket(activePlayers, seeds, "club-separated"));
    } else if (selectedMethod === "round-robin") {
      const shuffledPlayers = isShuffle ? shuffleArray(activePlayers) : activePlayers;
      rounds = generateRoundRobin(shuffledPlayers);
    } else {
      const shuffledPlayers = isShuffle ? clubSeparatedShuffle(activePlayers) : activePlayers;
      const rawRounds = generateIJFBracket(shuffledPlayers, seeds, "club-separated");
      rounds = processByeMatches(rawRounds);

      if ((selectedMethod === "single-repechage" || selectedMethod === "double-repechage") && rounds.length >= 2) {
        // generateIJFBracket always appends a generic "TBD vs TBD" consolation-bronze
        // match to the final round for plain straight-elimination brackets. Repechage
        // formats supply their own dedicated bronze round below, so drop that phantom
        // match here — otherwise it's left stranded, unpopulated, forever.
        const finalRoundIdx = rounds.length - 1;
        rounds[finalRoundIdx] = rounds[finalRoundIdx].filter(m => !m.matchId.startsWith("M_BRONZE_"));

        const totalRounds = rounds.length;

        if (selectedMethod === "double-repechage") {
          // Append Repechage Round 1 (2 matches)
          const repRound: BracketMatch[] = [
            {
              matchId: `rr_rep1_m1_${Date.now()}`,
              round: totalRounds + 1,
              matchNumber: 1,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Loser of QF 1", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Loser of QF 2", club: "", isBye: false }
            },
            {
              matchId: `rr_rep1_m2_${Date.now()}`,
              round: totalRounds + 1,
              matchNumber: 2,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Loser of QF 3", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Loser of QF 4", club: "", isBye: false }
            }
          ];

          // Append Bronze Matches (2 matches)
          const bronzeRound: BracketMatch[] = [
            {
              matchId: `rr_bronze1_${Date.now()}`,
              round: totalRounds + 2,
              matchNumber: 1,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Winner of Rep 1", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Loser of Semifinal 2", club: "", isBye: false }
            },
            {
              matchId: `rr_bronze2_${Date.now()}`,
              round: totalRounds + 2,
              matchNumber: 2,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Winner of Rep 2", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Loser of Semifinal 1", club: "", isBye: false }
            }
          ];

          rounds.push(repRound);
          rounds.push(bronzeRound);
        } else if (selectedMethod === "single-repechage") {
          // Append Repechage Round 1 (1 match)
          const repRound: BracketMatch[] = [
            {
              matchId: `rr_rep1_m1_${Date.now()}`,
              round: totalRounds + 1,
              matchNumber: 1,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Finalist's QF Loser", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Finalist's SF Loser", club: "", isBye: false }
            }
          ];

          // Append Bronze Match (1 match)
          const bronzeRound: BracketMatch[] = [
            {
              matchId: `rr_bronze1_${Date.now()}`,
              round: totalRounds + 2,
              matchNumber: 1,
              matNumber: 1,
              status: "PENDING",
              winnerId: null,
              slotA: { playerId: null, playerName: "Winner of Rep 1", club: "", isBye: false },
              slotB: { playerId: null, playerName: "Loser of Finals (Runner-up)", club: "", isBye: false }
            }
          ];

          rounds.push(repRound);
          rounds.push(bronzeRound);
        }
      }
    }
    
    setTimeout(async () => {
      const newDraw = {
        ageGroup: activeAgeGrp,
        exactAge: activeDraw?.exactAge !== undefined ? activeDraw.exactAge : (activeExactAge === "ALL" ? 0 : Number(activeExactAge)),
        gender: activeGender,
        weightCategory: activeWeight,
        matNumber: activeDraw?.matNumber !== undefined ? activeDraw.matNumber : (pendingMatByKey[activeKey] ?? 1),
        rounds,
        generated: true,
        saved: false,
      };

      setDraws((prev) => ({ ...prev, [activeKey]: newDraw }));
      setDrawPhase("done");
      
      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ageGroup: newDraw.ageGroup, 
            exactAge: newDraw.exactAge,
            gender: newDraw.gender,
            weightCategory: newDraw.weightCategory, 
            matNumber: newDraw.matNumber,
            rounds: newDraw.rounds,
          }),
        });
        if (res.ok) {
          const updatedDraw = await res.json();
          let backendRounds = updatedDraw.draw?.rounds || newDraw.rounds;
          if (typeof backendRounds === "string") {
            try { backendRounds = JSON.parse(backendRounds); } catch (err) {}
          }
          if (!Array.isArray(backendRounds)) backendRounds = newDraw.rounds;

          setDraws((prev) => ({
            ...prev,
            [activeKey]: {
              ...newDraw,
              rounds: backendRounds,
              saved: true
            }
          }));
          showToast(isShuffle ? "Bracket re-shuffled and auto-saved! 🏆" : "Draw generated and auto-saved! 🏆");
        } else {
          showToast("Failed to auto-save draw", false);
        }
      } catch { showToast("Error auto-saving draw", false); }
      finally { setSaving(false); }
    }, isShuffle ? 900 : 700);
  };

  const handleShuffle = () => handleGenerateAndSaveDraw(true);
  const handleGenerateDraw = () => handleGenerateAndSaveDraw(false);



  const openScoreboard = (match: BracketMatch) => {
    const p = new URLSearchParams({
      matchId: match.matchId,
      fighterAId:   match.slotA.playerId || "",
      fighterBId:   match.slotB.playerId || "",
      fighterAName: match.slotA.playerName,
      fighterBName: match.slotB.playerName,
      fighterAClub: match.slotA.club,
      fighterBClub: match.slotB.club,
      fighterACoach: match.slotA.coachName || "",
      fighterBCoach: match.slotB.coachName || "",
      weightCategory: weightFilter === "ALL" ? "" : `${weightFilter} kg`,
      ageGroup: ageFilter === "ALL" ? "" : ageFilter,
      gender: genderFilter === "ALL" ? "" : genderFilter,
      matchNumber: String(match.matchNumber),
      matNumber: String(match.matNumber),
      tournamentTitle: tournament?.title || "TNJA Championship",
      round: String(match.round),
    });
    window.open(
      `/dashboard/admin/tournaments/${tournamentId}/scoreboard?${p.toString()}`,
      "_blank"
    );
  };

  // ── Handle match result from scoreboard tab ──────────────────────────────────
  const handleMatchResult = useCallback((
    matchId: string, 
    winnerId: string, 
    winnerName: string, 
    winnerClub: string,
    scoreA?: any,
    scoreB?: any,
    winMethod?: string,
    elapsedSeconds?: number
  ) => {
    const prev = drawsRef.current;
    const newDraws = { ...prev };
    let affectedCatKey = "";

    for (const catKey of Object.keys(newDraws)) {
      const cat = newDraws[catKey];
      const newRounds: BracketMatch[][] = cat.rounds.map(r => r.map(m => ({ ...m })));

      let foundRi = -1, foundMi = -1;
      for (let ri = 0; ri < newRounds.length; ri++) {
        for (let mi = 0; mi < newRounds[ri].length; mi++) {
          if (newRounds[ri][mi].matchId === matchId) { foundRi = ri; foundMi = mi; break; }
        }
        if (foundRi !== -1) break;
      }
      if (foundRi === -1) continue;

      if (newRounds[foundRi][foundMi].status === "COMPLETED") {
        alert("This match is already completed and locked. You cannot change the winner.");
        return;
      }

      newRounds[foundRi][foundMi] = { 
        ...newRounds[foundRi][foundMi], 
        winnerId, 
        status: "COMPLETED",
        scoreA: scoreA || newRounds[foundRi][foundMi].scoreA,
        scoreB: scoreB || newRounds[foundRi][foundMi].scoreB,
        winMethod: winMethod || newRounds[foundRi][foundMi].winMethod,
        elapsedSeconds: elapsedSeconds !== undefined ? elapsedSeconds : newRounds[foundRi][foundMi].elapsedSeconds
      };

      // Determine if this is a Round Robin category or single-elimination category
      const isRR = isDrawRoundRobin(cat);
      const allRoundsCompleted = newRounds.every(r => r.every(m => m.status === "COMPLETED"));

      const hasDoubleRepechage = newRounds.some(r => r.some(m => m.matchId.startsWith("rr_rep1_m2")));
      const hasSingleRepechage = !hasDoubleRepechage && newRounds.some(r => r.some(m => m.matchId.startsWith("rr_rep")));
      const totalMainRounds = (hasDoubleRepechage || hasSingleRepechage) ? newRounds.length - 2 : newRounds.length;

      if (!isRR) {
        // Main single-elimination bracket progression:
        if (foundRi + 1 < totalMainRounds) {
          const nextMatchIdx = Math.floor(foundMi / 2);
          const winnerSlot: BracketSlot = { playerId: winnerId, playerName: winnerName, club: winnerClub, isBye: false, coachName: "" };
          const nextMatch = { ...newRounds[foundRi + 1][nextMatchIdx] };
          if (foundMi % 2 === 0) nextMatch.slotA = winnerSlot;
          else                   nextMatch.slotB = winnerSlot;
          newRounds[foundRi + 1][nextMatchIdx] = nextMatch;

          // Semifinal losers feed the auto-generated Bronze (3rd place) match,
          // which sits as the 2nd match of the Final round in plain elimination brackets.
          if (
            !hasDoubleRepechage && !hasSingleRepechage &&
            foundRi + 2 === totalMainRounds &&
            newRounds[foundRi + 1].length === 2
          ) {
            const currentMatch = newRounds[foundRi][foundMi];
            const loserId = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerId : currentMatch.slotA.playerId;
            const loserName = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerName : currentMatch.slotA.playerName;
            const loserClub = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.club : currentMatch.slotA.club;

            if (loserId) {
              const loserSlot: BracketSlot = { playerId: loserId, playerName: loserName, club: loserClub, isBye: false, coachName: "" };
              const bronzeMatch = { ...newRounds[foundRi + 1][1] };
              if (foundMi % 2 === 0) bronzeMatch.slotA = loserSlot;
              else                   bronzeMatch.slotB = loserSlot;
              newRounds[foundRi + 1][1] = bronzeMatch;
            }
          }
        }

        // --- Double Repechage Progressions ---
        if (hasDoubleRepechage) {
          // Quarterfinals Loser -> Repechage Match
          if (foundRi === totalMainRounds - 3) {
            const repRoundIdx = totalMainRounds;
            const repMatchIdx = Math.floor(foundMi / 2);
            const currentMatch = newRounds[foundRi][foundMi];
            const loserId = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerId : currentMatch.slotA.playerId;
            const loserName = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerName : currentMatch.slotA.playerName;
            const loserClub = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.club : currentMatch.slotA.club;

            if (loserId) {
              const loserSlot = { playerId: loserId, playerName: loserName, club: loserClub, isBye: false };
              const targetMatch = { ...newRounds[repRoundIdx][repMatchIdx] };
              if (foundMi % 2 === 0) targetMatch.slotA = loserSlot;
              else                   targetMatch.slotB = loserSlot;
              newRounds[repRoundIdx][repMatchIdx] = targetMatch;
            }
          }

          // Semifinals Loser -> Crossover Bronze Match
          if (foundRi === totalMainRounds - 2) {
            const bronzeRoundIdx = totalMainRounds + 1;
            const targetBronzeMatchIdx = foundMi === 0 ? 1 : 0;
            const currentMatch = newRounds[foundRi][foundMi];
            const loserId = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerId : currentMatch.slotA.playerId;
            const loserName = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerName : currentMatch.slotA.playerName;
            const loserClub = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.club : currentMatch.slotA.club;

            if (loserId) {
              const loserSlot = { playerId: loserId, playerName: loserName, club: loserClub, isBye: false };
              const targetMatch = { ...newRounds[bronzeRoundIdx][targetBronzeMatchIdx] };
              targetMatch.slotB = loserSlot;
              newRounds[bronzeRoundIdx][targetBronzeMatchIdx] = targetMatch;
            }
          }

          // Repechage Round 1 Winner -> Bronze Match slotA
          if (foundRi === totalMainRounds) {
            const bronzeRoundIdx = totalMainRounds + 1;
            const targetBronzeMatchIdx = foundMi;
            const winnerSlot = { playerId: winnerId, playerName: winnerName, club: winnerClub, isBye: false };
            const targetMatch = { ...newRounds[bronzeRoundIdx][targetBronzeMatchIdx] };
            targetMatch.slotA = winnerSlot;
            newRounds[bronzeRoundIdx][targetBronzeMatchIdx] = targetMatch;
          }
        }

        // --- Single Repechage Progressions ---
        if (hasSingleRepechage) {
          // Finals Completed -> Traces Champion's path for Repechage and runner-up for Bronze slotB
          if (foundRi === totalMainRounds - 1) {
            const currentMatch = newRounds[foundRi][foundMi];
            const runnerUpId = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerId : currentMatch.slotA.playerId;
            const runnerUpName = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.playerName : currentMatch.slotA.playerName;
            const runnerUpClub = winnerId === currentMatch.slotA.playerId ? currentMatch.slotB.club : currentMatch.slotA.club;

            const bronzeRoundIdx = totalMainRounds + 1;
            const bronzeMatch = { ...newRounds[bronzeRoundIdx][0] };
            bronzeMatch.slotB = { playerId: runnerUpId, playerName: runnerUpName, club: runnerUpClub, isBye: false };
            newRounds[bronzeRoundIdx][0] = bronzeMatch;

            // Trace SF Loser
            const sfRoundIdx = totalMainRounds - 2;
            const sfMatch = newRounds[sfRoundIdx].find(m => m.slotA.playerId === winnerId || m.slotB.playerId === winnerId);
            if (sfMatch) {
              const sfLoserId = winnerId === sfMatch.slotA.playerId ? sfMatch.slotB.playerId : sfMatch.slotA.playerId;
              const sfLoserName = winnerId === sfMatch.slotA.playerId ? sfMatch.slotB.playerName : sfMatch.slotA.playerName;
              const sfLoserClub = winnerId === sfMatch.slotA.playerId ? sfMatch.slotB.club : sfMatch.slotA.club;

              const repRoundIdx = totalMainRounds;
              const repMatch = { ...newRounds[repRoundIdx][0] };
              repMatch.slotB = { playerId: sfLoserId, playerName: sfLoserName, club: sfLoserClub, isBye: false };
              newRounds[repRoundIdx][0] = repMatch;
            }

            // Trace QF Loser
            const qfRoundIdx = totalMainRounds - 3;
            if (qfRoundIdx >= 0) {
              const qfMatch = newRounds[qfRoundIdx].find(m => m.slotA.playerId === winnerId || m.slotB.playerId === winnerId);
              if (qfMatch) {
                const qfLoserId = winnerId === qfMatch.slotA.playerId ? qfMatch.slotB.playerId : qfMatch.slotA.playerId;
                const qfLoserName = winnerId === qfMatch.slotA.playerId ? qfMatch.slotB.playerName : qfMatch.slotA.playerName;
                const qfLoserClub = winnerId === qfMatch.slotA.playerId ? qfMatch.slotB.club : qfMatch.slotA.club;

                const repRoundIdx = totalMainRounds;
                const repMatch = { ...newRounds[repRoundIdx][0] };
                repMatch.slotA = { playerId: qfLoserId, playerName: qfLoserName, club: qfLoserClub, isBye: false };
                newRounds[repRoundIdx][0] = repMatch;
              }
            }
          }

          // Repechage Round 1 Winner -> Bronze Match slotA
          if (foundRi === totalMainRounds) {
            const bronzeRoundIdx = totalMainRounds + 1;
            const targetMatch = { ...newRounds[bronzeRoundIdx][0] };
            targetMatch.slotA = { playerId: winnerId, playerName: winnerName, club: winnerClub, isBye: false };
            newRounds[bronzeRoundIdx][0] = targetMatch;
          }
        }
      }

      if (isRR) {
        if (allRoundsCompleted) {
          const catPlayers = players.filter(p =>
            p.status === "APPROVED" &&
            p.ageGroup === cat.ageGroup &&
            (cat.exactAge === 0 || p.exactAge === cat.exactAge) &&
            p.gender === cat.gender &&
            String(p.weight) === cat.weightCategory
          );

          // Calculate standings to find the actual Round Robin winner
          const standingsMap: Record<string, {
            playerId: string;
            name: string;
            club: string;
            wins: number;
            points: number;
            totalWinningTime: number;
          }> = {};

          catPlayers.forEach(p => {
            standingsMap[p.id] = { playerId: p.id, name: p.name, club: p.club || "", wins: 0, points: 0, totalWinningTime: 0 };
          });

          const allMatches: BracketMatch[] = [];
          newRounds.forEach(r => {
            r.forEach(m => {
              allMatches.push(m);
              if (m.status === "COMPLETED") {
                const elapsed = m.elapsedSeconds || 0;
                const ptsA = m.scoreA ? ( (m.scoreA.ippon || 0) * 100 + (m.scoreA.wazaAri || 0) * 10 + (m.scoreA.yuko || 0) * 1 ) : 0;
                const ptsB = m.scoreB ? ( (m.scoreB.ippon || 0) * 100 + (m.scoreB.wazaAri || 0) * 10 + (m.scoreB.yuko || 0) * 1 ) : 0;

                if (m.slotA.playerId && standingsMap[m.slotA.playerId]) standingsMap[m.slotA.playerId].points += Math.min(ptsA, 100);
                if (m.slotB.playerId && standingsMap[m.slotB.playerId]) standingsMap[m.slotB.playerId].points += Math.min(ptsB, 100);

                if (m.winnerId && standingsMap[m.winnerId]) {
                  standingsMap[m.winnerId].wins += 1;
                  standingsMap[m.winnerId].totalWinningTime += elapsed;
                }
              }
            });
          });

          const sortedPlayers = Object.values(standingsMap).sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            if (b.points !== a.points) return b.points - a.points;

            const tiedGroup = Object.values(standingsMap).filter(p => p.wins === a.wins && p.points === a.points);
            if (tiedGroup.length === 2) {
              const headToHead = allMatches.find(m => 
                m.status === "COMPLETED" && 
                ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
                 (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
              );
              if (headToHead && headToHead.winnerId) {
                return headToHead.winnerId === a.playerId ? -1 : 1;
              }
            }

            if (a.totalWinningTime !== b.totalWinningTime) {
              return a.totalWinningTime - b.totalWinningTime;
            }

            const headToHead = allMatches.find(m => 
              m.status === "COMPLETED" && 
              ((m.slotA.playerId === a.playerId && m.slotB.playerId === b.playerId) ||
               (m.slotA.playerId === b.playerId && m.slotB.playerId === a.playerId))
            );
            if (headToHead && headToHead.winnerId) {
              return headToHead.winnerId === a.playerId ? -1 : 1;
            }

            return 0;
          });

          const rrChampion = sortedPlayers[0];
          const rrSecond = sortedPlayers[1];
          const rrThird = sortedPlayers[2];
          if (rrChampion) {
            setTimeout(() => setChampion({ 
              name: rrChampion.name, 
              club: rrChampion.club, 
              categoryKey: catKey,
              secondPlaceName: rrSecond?.name,
              secondPlaceClub: rrSecond?.club,
              thirdPlaceName: rrThird?.name,
              thirdPlaceClub: rrThird?.club
            }), 0);
          }
        }
      } else {
        // Single Elimination final round winner is champion
        if (foundRi === newRounds.length - 1) {
          setTimeout(() => setChampion({ name: winnerName, club: winnerClub, categoryKey: catKey }), 0);
        }
      }

      newDraws[catKey] = { ...cat, rounds: newRounds, saved: true };
      affectedCatKey = catKey;
      break;
    }

    drawsRef.current = newDraws;
    setDraws(newDraws);

    // Auto-save the affected draw so next-round matches persist after refresh
    if (affectedCatKey) {
      const draw = newDraws[affectedCatKey];
      fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ageGroup: draw.ageGroup,
          exactAge: draw.exactAge !== undefined ? draw.exactAge : 0,
          gender: draw.gender,
          weightCategory: draw.weightCategory,
          matNumber: draw.matNumber !== undefined ? draw.matNumber : 1,
          rounds: draw.rounds,
        }),
      }).catch(() => {
        // mark unsaved if server save fails
        setDraws(d => ({ ...d, [affectedCatKey]: { ...d[affectedCatKey], saved: false } }));
      });
    }
  }, [token, tournamentId]);

  // Keep drawsRef in sync with draws state
  useEffect(() => { drawsRef.current = draws; }, [draws]);

  // ── Listen for results from scoreboard tab via BroadcastChannel ──────────────
  useEffect(() => {
    const channel = new BroadcastChannel("tnja_match_results");
    channel.onmessage = (e) => {
      const { matchId, winnerId, winnerName, winnerClub, scoreA, scoreB, winMethod, elapsedSeconds } = e.data;
      if (matchId && winnerName) handleMatchResult(matchId, winnerId, winnerName, winnerClub, scoreA, scoreB, winMethod, elapsedSeconds);
    };
    return () => channel.close();
  }, [handleMatchResult]);

  // ── Global Auto-Selection Effect ─────────────────────────────────────────────
  const ageGroupOrder = [
    "7-8 years",
    "8-9 years",
    "10-11 years",
    "mini sub-junior age group 1",
    "mini sub-junior age group 2",
    "mini sub-junior age group 3",
    "mini sub junior",
    "sub-junior",
    "sub junior",
    "cadet",
    "junior",
    "senior"
  ];
  const getAgeGroupRank = (age: string) => {
    const idx = ageGroupOrder.indexOf(age.toLowerCase());
    return idx === -1 ? 999 : idx;
  };

  const availableAgeGroupsGlobal = [...new Set(players.filter(p => genderFilter === "BOTH" || p.gender === genderFilter).map((p) => p.ageGroup))].sort((a, b) => getAgeGroupRank(a) - getAgeGroupRank(b) || a.localeCompare(b));
  
  useEffect(() => {
    if (availableAgeGroupsGlobal.length > 0 && (!availableAgeGroupsGlobal.includes(ageFilter) || ageFilter === "ALL")) {
      setAgeFilter(availableAgeGroupsGlobal[0]);
    }
  }, [genderFilter, availableAgeGroupsGlobal.join(",")]);

  const groupPlayersGlobal = players.filter(p => (genderFilter === "BOTH" || p.gender === genderFilter) && p.ageGroup === ageFilter);
  const availableWeightsGlobal = [...new Set(groupPlayersGlobal.map(p => String(p.weight)))].sort((a, b) => +a - +b);

  useEffect(() => {
    if (availableWeightsGlobal.length > 0 && !availableWeightsGlobal.includes(weightFilter) && weightFilter !== "ALL") {
      setWeightFilter("ALL");
    }
  }, [ageFilter, genderFilter, availableWeightsGlobal.join(",")]);

  useEffect(() => {
    setMatchStatusFilter("ALL");
  }, [ageFilter, genderFilter, weightFilter]);

  // ── Expired check ────────────────────────────────────────────────────────────
  const expired = (() => {
    if (!tournament) return false;
    const end = tournament.dateTo || tournament.date;
    if (!end) return false;
    const d = new Date(end);
    d.setHours(23, 59, 59, 999);
    return d < new Date();
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-[#FF7400]" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
            {toast.ok ? <Check size={18} /> : <X size={18} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>      {/* Full-width dark header */}
      <div className="-mt-6 -mx-6 md:-mt-8 md:-mx-8 mb-6 bg-[#1A202C] text-white shadow-md">
        <div className="px-6 pt-6 pb-4 md:px-8 md:pt-8 md:pb-5">
          <div className="flex items-start gap-3 mb-6">
            <button onClick={() => router.back()}
              className="mt-1 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-[28px] font-black text-white leading-none tracking-tight">{tournament?.title || "Tournament"}</h1>
              <p className="text-[12px] text-slate-400 font-bold mt-1.5 tracking-wide">Tournament Management Hub</p>
            </div>
          </div>

          {tournament && (
            <div>
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-6 px-2">
                {[
                  { icon: Calendar, label: "DATE", value: new Date(tournament.date).toLocaleDateString("en-GB") },
                  { icon: MapPin, label: "LOCATION", value: tournament.location },
                  { icon: Users, label: "PLAYERS", value: `${players.length}` },
                  { icon: Trophy, label: "LEVEL", value: tournament.level },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-[#FF7400]" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase mb-0.5">{label}</p>
                      <p className="text-[13px] font-bold text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* CLOSED badge */}
              {tournament.status === "CLOSED" && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 px-2">
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                    <Check size={15} className="text-emerald-400" />
                    <span className="text-emerald-300 font-black text-sm">Tournament Concluded — Certificates Available</span>
                  </div>
                </div>
              )}
              
              {/* Start Tournament Action */}
              {tournament.status !== "CLOSED" && (
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between gap-3 px-2">
                  <div className="text-[11px] font-bold text-slate-400">
                    {tournament.registrationClosed ? "Registrations are currently closed." : "Registrations are open."}
                  </div>
                  {!tournament.registrationClosed ? (
                    <button
                      onClick={() => setActiveTab("mats")}
                      className="flex items-center gap-2 px-4 py-2 bg-[#10B981] hover:bg-[#059669] text-white font-bold rounded-lg transition-all text-xs"
                    >
                      <PlayCircle size={14} /> Start Tournament (Close Registrations)
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 font-bold rounded-lg text-xs">
                      <Lock size={14} /> Registrations Closed
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expired banner */}
      {expired && (
        <div className="flex items-center gap-4 px-6 py-4 bg-slate-800 border border-slate-600 rounded-2xl">
          <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={24} className="text-slate-300" />
          </div>
          <div>
            <p className="text-white font-black text-sm">Tournament Expired</p>
            <p className="text-slate-400 text-xs font-semibold mt-0.5">
              This tournament date has passed. You can view details and results but cannot generate draws or open scoreboards.
            </p>
          </div>
        </div>
      )}


      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit flex-wrap">
        {(["overview", "players", "mats", "weigh-in", "draws", "matches", "results", "disqualify"] as Tab[]).map((tab) => {
          // Results tab is ALWAYS accessible — even for expired/CLOSED tournaments
          // Draws and matches are locked once the tournament date has passed
          const lockedByExpiry = expired && (tab === "draws" || tab === "matches");
          return (
            <button
              key={tab}
              onClick={() => !lockedByExpiry && setActiveTab(tab)}
              title={lockedByExpiry ? "Not available — tournament has expired" : undefined}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                lockedByExpiry
                  ? "text-slate-300 cursor-not-allowed"
                  : activeTab === tab
                  ? "bg-white text-[#FF7400] shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {lockedByExpiry && <span className="text-[10px]">🔒</span>}
              {tab === "players" ? `Registrations (${players.length})` : tab === "draws" ? "Draw Generation" : tab === "results" ? "Results & Reports" : tab === "weigh-in" ? "Weigh-In" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          );
        })}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && tournament && (() => {
        return (
          <div className="grid grid-cols-1 gap-6">
            {/* Tournament Info */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <LayoutList size={16} className="text-slate-400" /> Tournament Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
                {[
                  { l: "TITLE", v: tournament.title },
                  { l: "LEVEL", v: tournament.level },
                  { l: "GENDER", v: tournament.gender },
                  { l: "CATEGORY", v: tournament.category || "N/A" },
                  { l: "ENTRY FEE", v: `₹${tournament.entryFee}` },
                  { l: "STATUS", v: tournament.status },
                  { l: "BELT", v: tournament.beltEligibility || "NA" },
                  { l: "BPL ALLOWED", v: tournament.allowBPL ? "Yes" : "No" },
                ].map(({ l, v }) => (
                  <div key={l} className="min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{l}</p>
                    {l === "STATUS" ? (
                      <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full ${
                        v === "APPROVED" ? "bg-emerald-100 text-emerald-700" :
                        v === "REJECTED" ? "bg-red-100 text-red-700" :
                        v === "CLOSED" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {v}
                      </span>
                    ) : (
                      <p className="text-sm font-black text-slate-800 truncate" title={String(v)}>{v}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MATS & REFEREES ═══════════════════════════════════════════════════ */}
      {activeTab === "mats" && tournament && (
        <MatsOfficialsPanel
          tournament={tournament}
          tournamentId={tournamentId}
          tournamentMats={tournamentMats}
          setTournamentMats={setTournamentMats}
          matsCountInput={matsCountInput}
          setMatsCountInput={setMatsCountInput}
          matsConfirmed={matsConfirmed}
          setMatsConfirmed={setMatsConfirmed}
          wizardStep={wizardStep}
          setWizardStep={setWizardStep}
          selectedMatForAssignment={selectedMatForAssignment}
          setSelectedMatForAssignment={setSelectedMatForAssignment}
          refSearchQuery={refSearchQuery}
          setRefSearchQuery={setRefSearchQuery}
          refSearchResults={refSearchResults}
          refSearching={refSearching}
          refreshRefSearch={() => setRefSearchRefreshKey((k) => k + 1)}
          assignRefereeToMat={assignRefereeToMat}
          savingMats={savingMats}
          setSavingMats={setSavingMats}
          showToast={showToast}
          setConfirmModal={setConfirmModal}
          fetchTournament={fetchTournament}
          fetchPlayers={fetchPlayers}
          setActiveTab={setActiveTab}
        />
      )}
      {/* ══ WEIGH-IN & DISQUALIFICATION ═════════════════════════════════════════════════ */}
      {activeTab === "weigh-in" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
            <h3 className="font-black text-slate-800 text-base mb-2">Player Weigh-In</h3>
            
            <div className="relative">
              <input
                type="text"
                value={weighInSearch}
                onChange={(e) => setWeighInSearch(e.target.value)}
                placeholder="Search approved player by Name or ID..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold"
              />
              {weighInSearch.trim().length >= 2 && !selectedWeighInPlayer && (
                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-10">
                  {players.filter(p => p.status === "APPROVED" && (p.name.toLowerCase().includes(weighInSearch.toLowerCase()) || (p.tnjaId && p.tnjaId.toLowerCase().includes(weighInSearch.toLowerCase())))).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedWeighInPlayer(p); setWeighInSearch(""); setActualWeight(""); }}
                      className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500 font-semibold">{p.tnjaId} • {p.club}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-700">{p.ageGroup}</p>
                        <p className="text-xs font-black text-[#FF7400]">{p.gender} • {p.weightLabel}</p>
                      </div>
                    </button>
                  ))}
                  {players.filter(p => p.status === "APPROVED" && (p.name.toLowerCase().includes(weighInSearch.toLowerCase()) || (p.tnjaId && p.tnjaId.toLowerCase().includes(weighInSearch.toLowerCase())))).length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500 font-semibold">No approved player found matching "{weighInSearch}"</div>
                  )}
                </div>
              )}
            </div>

            {!selectedWeighInPlayer && weighInSearch.trim().length < 2 && (
              <div className="bg-slate-50 rounded-3xl p-10 border border-slate-200 border-dashed text-center space-y-4">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm text-slate-300">
                  <Search size={32} />
                </div>
                <h4 className="text-xl font-black text-slate-700">Search to Start Weigh-In</h4>
                <p className="text-sm font-semibold text-slate-500 max-w-sm mx-auto">
                  Type a player's name or TNJA ID in the search box above to verify their scale weight and ensure they match their registered category.
                </p>
              </div>
            )}

            {selectedWeighInPlayer && (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-black text-slate-800">{selectedWeighInPlayer.name}</h4>
                    <p className="text-sm font-bold text-slate-500">{selectedWeighInPlayer.tnjaId} • {selectedWeighInPlayer.club}</p>
                  </div>
                  <button onClick={() => setSelectedWeighInPlayer(null)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400">Gender</p>
                    <p className="font-bold text-slate-700">{selectedWeighInPlayer.gender}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400">Age Group</p>
                    <p className="font-bold text-slate-700">{selectedWeighInPlayer.ageGroup}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400">Registered Weight</p>
                    <p className="font-black text-blue-600">{selectedWeighInPlayer.weightLabel}</p>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-black text-slate-400">Status</p>
                    <p className="font-bold text-emerald-600">Approved</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <label className="block text-sm font-black text-slate-800 mb-2">Enter Actual Scale Weight (kg)</label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={actualWeight}
                        onChange={(e) => setActualWeight(e.target.value)}
                        placeholder="e.g. 66.5"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:border-[#FF7400] font-bold text-lg"
                      />
                    </div>
                    <div className="flex-1 pt-1">
                      {actualWeight ? (
                        (() => {
                          const w = Number(actualWeight);
                          const targetWeight = selectedWeighInPlayer.weightLabel === "Under 50" ? 50 : Number(selectedWeighInPlayer.weightLabel?.split("-")[1] || selectedWeighInPlayer.weightLabel?.replace("kg", "") || 0);
                          const minWeight = selectedWeighInPlayer.weightLabel === "Under 50" ? 0 : Number(selectedWeighInPlayer.weightLabel?.split("-")[0] || 0) - 0.99;
                          
                          const isMatch = w <= targetWeight && w > minWeight;
                          return isMatch ? (
                            <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2.5 rounded-xl">
                              <Check size={18} /> Weight is acceptable
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-red-600 font-bold bg-red-50 px-4 py-2.5 rounded-xl">
                              <AlertCircle size={18} /> Exceeds category limit!
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-sm text-slate-400 font-semibold mt-2 italic">Waiting for input...</p>
                      )}
                    </div>
                  </div>

                  {actualWeight && (
                    (() => {
                      const w = Number(actualWeight);
                      const targetWeight = selectedWeighInPlayer.weightLabel === "Under 50" ? 50 : Number(selectedWeighInPlayer.weightLabel?.split("-")[1] || selectedWeighInPlayer.weightLabel?.replace("kg", "") || 0);
                      const minWeight = selectedWeighInPlayer.weightLabel === "Under 50" ? 0 : Number(selectedWeighInPlayer.weightLabel?.split("-")[0] || 0) - 0.99;
                      
                      const isMatch = w <= targetWeight && w > minWeight;
                      if (!isMatch) {
                        return (
                          <div className="mt-6 pt-6 border-t border-red-100">
                            <p className="text-sm text-red-600 font-bold mb-3">
                              Player weight ({w}kg) does not match the registered category ({selectedWeighInPlayer.weightLabel}). 
                              You may disqualify this player from the tournament.
                            </p>
                            <button 
                              onClick={() => selectedWeighInPlayer.regId && handleDisqualifyPlayer(selectedWeighInPlayer.regId, actualWeight)}
                              disabled={isDisqualifying}
                              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isDisqualifying ? <Loader2 className="animate-spin" size={16} /> : <X size={16} />}
                              Disqualify Player
                            </button>
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ REGISTRATIONS (PLAYERS) ═══════════════════════════════════════════════════════════ */}
      {activeTab === "players" && (
        <div className="space-y-6">
          {/* Top Summary Metrics Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500 mb-1">Total Players</p>
                <p className="text-3xl font-black text-slate-800">{players.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                <Users size={24} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500 mb-1">Participating Clubs</p>
                <p className="text-3xl font-black text-slate-800">{new Set(players.map(p => p.club).filter(Boolean)).size}</p>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                <Target size={24} />
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500 mb-1">Districts Represented</p>
                <p className="text-3xl font-black text-slate-800">{new Set(players.map(p => p.district).filter(Boolean)).size}</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center">
                <MapPin size={24} />
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-grow w-full md:max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Name, TNJA ID, Club..."
                  value={regSearchQuery}
                  onChange={e => { setRegSearchQuery(e.target.value); setRegCurrentPage(1); }}
                  className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold text-sm"
                />
                {regSearchQuery && (
                  <button 
                    onClick={() => { setRegSearchQuery(""); setRegCurrentPage(1); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <XCircle size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setRegFiltersExpanded(!regFiltersExpanded)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 border font-bold rounded-xl text-sm transition-all flex-1 md:flex-none ${regFiltersExpanded || [regDistrictFilter !== "All Districts", regClubFilter !== "All Clubs", regGenderFilter !== "All Genders", regCategoryFilter !== "All Categories", regBeltFilter !== "All Belts", regPaymentFilter !== "All Payment Status"].some(Boolean) ? 'bg-[#FF7400]/10 border-[#FF7400]/20 text-[#FF7400]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <FilterX size={16} />
                  Filters
                  {(() => {
                    const count = [regDistrictFilter !== "All Districts", regClubFilter !== "All Clubs", regGenderFilter !== "All Genders", regCategoryFilter !== "All Categories", regBeltFilter !== "All Belts", regPaymentFilter !== "All Payment Status"].filter(Boolean).length;
                    return count > 0 ? <span className="ml-1 bg-[#FF7400] text-white text-[10px] px-1.5 py-0.5 rounded-full">{count}</span> : null;
                  })()}
                </button>
                <div className="w-px h-8 bg-slate-200 hidden md:block mx-1"></div>
                <button
                  type="button"
                  onClick={() => setIsAddPlayerOpen(true)}
                  className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  <Users size={16} />
                  <span className="hidden md:inline">Add Player</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportWizardOpen(true)}
                  className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 bg-[#FF7400] text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Upload size={16} />
                  <span className="hidden md:inline">Import</span>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {regFiltersExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                      {[
                        { label: "District", value: regDistrictFilter, setter: setRegDistrictFilter, options: ["All Districts", ...new Set(players.map(p => p.district).filter(Boolean))] },
                        { label: "Club", value: regClubFilter, setter: setRegClubFilter, options: ["All Clubs", ...new Set(players.map(p => p.club).filter(Boolean))] },
                        { label: "Gender", value: regGenderFilter, setter: setRegGenderFilter, options: ["All Genders", "MALE", "FEMALE"] },
                        { label: "Category", value: regCategoryFilter, setter: setRegCategoryFilter, options: ["All Categories", ...new Set(players.map(p => p.ageGroup).filter(Boolean))] },
                        { label: "Belt", value: regBeltFilter, setter: setRegBeltFilter, options: ["All Belts", ...new Set(players.map(p => p.belt).filter(Boolean))] },
                        { label: "Payment Status", value: regPaymentFilter, setter: setRegPaymentFilter, options: ["All Payment Status", "Paid", "Pending"] },
                      ].map(filter => (
                        <div key={filter.label} className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{filter.label}</label>
                          <select
                            value={filter.value}
                            onChange={(e) => { filter.setter(e.target.value); setRegCurrentPage(1); }}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#FF7400] transition-colors"
                          >
                            {filter.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    
                    {(() => {
                      const hasActive = [regDistrictFilter !== "All Districts", regClubFilter !== "All Clubs", regGenderFilter !== "All Genders", regCategoryFilter !== "All Categories", regBeltFilter !== "All Belts", regPaymentFilter !== "All Payment Status"].some(Boolean);
                      if (!hasActive) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                          <span className="text-xs font-bold text-slate-400 mr-1">Active:</span>
                          {[
                            { label: regDistrictFilter, isActive: regDistrictFilter !== "All Districts", reset: () => setRegDistrictFilter("All Districts") },
                            { label: regClubFilter, isActive: regClubFilter !== "All Clubs", reset: () => setRegClubFilter("All Clubs") },
                            { label: regGenderFilter, isActive: regGenderFilter !== "All Genders", reset: () => setRegGenderFilter("All Genders") },
                            { label: regCategoryFilter, isActive: regCategoryFilter !== "All Categories", reset: () => setRegCategoryFilter("All Categories") },
                            { label: regBeltFilter, isActive: regBeltFilter !== "All Belts", reset: () => setRegBeltFilter("All Belts") },
                            { label: regPaymentFilter, isActive: regPaymentFilter !== "All Payment Status", reset: () => setRegPaymentFilter("All Payment Status") }
                          ].map(chip => chip.isActive && (
                            <div key={chip.label} className="flex items-center gap-1.5 px-3 py-1 bg-[#FF7400]/10 text-[#FF7400] rounded-lg text-xs font-bold">
                              {chip.label}
                              <button onClick={() => { chip.reset(); setRegCurrentPage(1); }} className="hover:text-red-500">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              setRegDistrictFilter("All Districts");
                              setRegClubFilter("All Clubs");
                              setRegGenderFilter("All Genders");
                              setRegCategoryFilter("All Categories");
                              setRegBeltFilter("All Belts");
                              setRegPaymentFilter("All Payment Status");
                              setRegCurrentPage(1);
                            }}
                            className="text-red-500 hover:text-red-600 text-xs font-bold ml-2 underline underline-offset-2"
                          >
                            Clear All
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["TNJA ID", "Name", "District", "Category", "Belt", "Payment Status", "Registration Date", "Actions"].map((h) => (
                      <th key={h} className="px-5 py-4 text-left text-[11px] font-black text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    let filtered = players.filter(p => {
                      if (regSearchQuery && !p.name.toLowerCase().includes(regSearchQuery.toLowerCase()) && !p.tnjaId?.toLowerCase().includes(regSearchQuery.toLowerCase()) && !p.club.toLowerCase().includes(regSearchQuery.toLowerCase())) return false;
                      if (regDistrictFilter !== "All Districts" && p.district !== regDistrictFilter) return false;
                      if (regClubFilter !== "All Clubs" && p.club !== regClubFilter) return false;
                      if (regGenderFilter !== "All Genders" && p.gender !== regGenderFilter) return false;
                      if (regCategoryFilter !== "All Categories" && p.ageGroup !== regCategoryFilter) return false;
                      if (regBeltFilter !== "All Belts" && p.belt !== regBeltFilter) return false;
                      return true;
                    });
                    
                    const totalItems = filtered.length;
                    const paginated = filtered.slice((regCurrentPage - 1) * regItemsPerPage, regCurrentPage * regItemsPerPage);

                    if (paginated.length === 0) {
                      return (
                        <tr>
                          <td colSpan={8} className="px-5 py-10 text-center text-slate-400 font-bold">No players found matching your filters.</td>
                        </tr>
                      );
                    }

                    return paginated.map(p => {
                      let dotColor = "bg-slate-300";
                      const b = p.belt?.toLowerCase() || "";
                      if (b.includes("blue")) dotColor = "bg-blue-500";
                      else if (b.includes("brown")) dotColor = "bg-amber-800";
                      else if (b.includes("green")) dotColor = "bg-green-600";
                      else if (b.includes("yellow")) dotColor = "bg-yellow-400";
                      else if (b.includes("black")) dotColor = "bg-black";
                      else if (b.includes("orange")) dotColor = "bg-orange-500";

                      return (
                      <React.Fragment key={p.id}>
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 text-sm font-semibold text-slate-500">{p.tnjaId || "—"}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-800">{p.name}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-500">{p.district || "—"}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-500">{p.ageGroup}</td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                            {p.belt ? (
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                {p.belt}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-5 py-4">
                            {p.isPaid ? (
                              <span className="bg-emerald-50 text-emerald-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Paid</span>
                            ) : (
                              <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Unpaid</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-slate-500">
                            {p.registeredAt ? new Date(p.registeredAt).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-5 py-4 flex gap-2">
                            <button
                              onClick={() => setExpandedPlayerId(expandedPlayerId === p.id ? null : p.id)}
                              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button onClick={() => openEditMetricsModal(p)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Edit"><Edit2 size={16} /></button>
                            <button onClick={() => printRegistrationSlip(p, tournament)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Print"><Printer size={16} /></button>
                          </td>
                        </tr>
                        {expandedPlayerId === p.id && p.regId && (
                          <tr>
                            <td colSpan={8} className="p-0 border-b border-slate-200 bg-slate-50/80">
                              <div className="p-4 flex flex-col items-center">
                                <div className="w-full max-w-3xl space-y-4">
                                  {/* Player Details Card */}
                                  <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="font-black text-slate-800 text-sm">{p.name}</h4>
                                      {p.status && (
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                                          p.status === "APPROVED" ? "bg-emerald-50 text-emerald-600" :
                                          p.status === "REJECTED" ? "bg-red-50 text-red-600" :
                                          "bg-amber-50 text-amber-600"
                                        }`}>
                                          {p.status}
                                        </span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                                      {[
                                        { l: "TNJA ID", v: p.tnjaId || p.permanentId || p.tempId || "—" },
                                        { l: "Gender", v: p.gender || "—" },
                                        { l: "District", v: p.district || "—" },
                                        { l: "Club", v: p.club || "—" },
                                        { l: "Coach", v: p.coachName || "—" },
                                        { l: "Category", v: p.ageGroup || "—" },
                                        { l: "Age", v: p.exactAge ? `${p.exactAge} yrs` : "—" },
                                        { l: "Belt", v: p.belt || "—" },
                                        { l: "Weight", v: p.rawWeight || (p.weight ? `${p.weight} kg` : "—") },
                                        { l: "Height", v: p.rawHeight || "—" },
                                        { l: "Weight Category", v: p.weightLabel || "—" },
                                        { l: "Payment", v: p.isPaid ? "Paid" : "Unpaid" },
                                        { l: "Registered On", v: p.registeredAt ? new Date(p.registeredAt).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
                                      ].map(({ l, v }) => (
                                        <div key={l}>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{l}</p>
                                          <p className="text-sm font-bold text-slate-700">{v}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Pagination UI */}
            {(() => {
              let filtered = players.filter(p => {
                if (regSearchQuery && !p.name.toLowerCase().includes(regSearchQuery.toLowerCase()) && !p.tnjaId?.toLowerCase().includes(regSearchQuery.toLowerCase()) && !p.club.toLowerCase().includes(regSearchQuery.toLowerCase())) return false;
                if (regDistrictFilter !== "All Districts" && p.district !== regDistrictFilter) return false;
                if (regClubFilter !== "All Clubs" && p.club !== regClubFilter) return false;
                if (regGenderFilter !== "All Genders" && p.gender !== regGenderFilter) return false;
                if (regCategoryFilter !== "All Categories" && p.ageGroup !== regCategoryFilter) return false;
                if (regBeltFilter !== "All Belts" && p.belt !== regBeltFilter) return false;
                return true;
              });
              const totalItems = filtered.length;
              const totalPages = Math.ceil(totalItems / regItemsPerPage) || 1;
              if (totalItems === 0) return null;

              return (
                <div className="bg-white border-t border-slate-100 px-5 py-4 flex items-center justify-between">
                  <p className="text-sm text-slate-500 font-semibold">
                    Showing {(regCurrentPage - 1) * regItemsPerPage + 1} to {Math.min(regCurrentPage * regItemsPerPage, totalItems)} of {totalItems} entries
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 mr-4">
                      <select 
                        value={regItemsPerPage} 
                        onChange={(e) => { setRegItemsPerPage(Number(e.target.value)); setRegCurrentPage(1); }}
                        className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2 py-1.5 focus:outline-none"
                      >
                        <option value={10}>10 / page</option>
                        <option value={24}>24 / page</option>
                        <option value={50}>50 / page</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => setRegCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={regCurrentPage === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        if (page === 1 || page === totalPages || (page >= regCurrentPage - 1 && page <= regCurrentPage + 1)) {
                          return (
                            <button
                              key={page}
                              onClick={() => setRegCurrentPage(page)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${regCurrentPage === page ? "bg-[#FF7400] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === regCurrentPage - 2 || page === regCurrentPage + 2) {
                          return <span key={page} className="px-1 text-slate-400">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    <button 
                      onClick={() => setRegCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={regCurrentPage === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══ CHAMPION BANNER ═══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {champion && activeTab === "draws" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            className="bg-gradient-to-r from-yellow-400 via-[#FF7400] to-yellow-500 rounded-3xl p-6 shadow-2xl shadow-orange-500/30 flex items-center gap-5"
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <Trophy size={32} className="text-white animate-bounce" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-6 w-full">
              <div>
                <p className="text-white/70 text-xs font-black uppercase tracking-widest mb-0.5">🥇 1st Place (Champion)</p>
                <h2 className="text-2xl font-black text-white leading-tight">{champion.name}</h2>
                <p className="text-white/80 text-sm font-bold">{champion.club}</p>
              </div>

              {(champion.secondPlaceName || champion.thirdPlaceName) && (
                <div className="flex flex-wrap gap-6 border-t md:border-t-0 md:border-l border-white/20 pt-4 md:pt-0 md:pl-6">
                  {champion.secondPlaceName && (
                    <div>
                      <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-0.5">🥈 2nd Place</p>
                      <p className="text-base font-black text-white leading-tight">{champion.secondPlaceName}</p>
                      <p className="text-white/80 text-xs font-bold">{champion.secondPlaceClub}</p>
                    </div>
                  )}
                  {champion.thirdPlaceName && (
                    <div>
                      <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-0.5">🥉 3rd Place</p>
                      <p className="text-base font-black text-white leading-tight">{champion.thirdPlaceName}</p>
                      <p className="text-white/80 text-xs font-bold">{champion.thirdPlaceClub}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setChampion(null)} className="ml-auto text-white/50 hover:text-white transition-colors self-start md:self-center">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ DRAWS ═════════════════════════════════════════════════════════════ */}
      {activeTab === "draws" && expired && (
        <ExpiredBlock label="Draw Generation" />
      )}
      {activeTab === "draws" && !expired && (
        <div className="space-y-4">
          <DrawCategoryFilters
                genderFilter={genderFilter}
                setGenderFilter={setGenderFilter}
                ageFilter={ageFilter}
                setAgeFilter={setAgeFilter}
                weightFilter={weightFilter}
                setWeightFilter={setWeightFilter}
                setExactAgeFilter={setExactAgeFilter}
                availableAgeGroups={availableAgeGroupsGlobal}
                groupPlayers={groupPlayersGlobal}
                availableWeights={availableWeightsGlobal}
                eligiblePlayersCount={eligiblePlayers.length}
                draws={draws}
              />

          {tournament?.status !== "APPROVED" ? (
            <div className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-200">
              <AlertCircle size={18} /> Tournament must be approved before you can manage draws.
            </div>
          ) : hasPendingPlayers ? (
            <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 text-amber-600 rounded-2xl text-sm font-bold border border-amber-200">
              <AlertCircle size={18} /> You must approve or reject all pending player registrations before managing draws.
            </div>
          ) : null}

          {/* ── Dealing animation overlay ── */}
          <AnimatePresence>
            {drawPhase === "dealing" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center"
                >
                  <div className="flex gap-3 justify-center mb-4">
                    {drawPlayers.slice(0, Math.min(8, drawPlayers.length)).map((p, i) => (
                      <motion.div
                        key={p.id}
                        initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
                        animate={{
                          y: [0, -60, -20, 20],
                          x: [0, (i - 4) * 30, (i - 4) * 80, (i - 4) * 120],
                          rotate: [0, (i % 2 === 0 ? -15 : 15), (i % 2 === 0 ? 5 : -5), 0],
                          opacity: [1, 1, 0.5, 0],
                        }}
                        transition={{ duration: 0.6, delay: i * 0.05, ease: "easeInOut" }}
                        className="w-12 h-16 bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                          {p.name.charAt(0)}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <p className="text-white font-black text-lg">Dealing cards to bracket...</p>
                  <p className="text-white/50 text-sm mt-1">{drawPlayers.length} players</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main content: players list OR bracket ── */}
          <AnimatePresence mode="wait">
            {isMultiCategory ? (
              <motion.div
                key="multi-category-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {(() => {
                  const map: Record<string, { ageGroup: string; exactAge: string; gender: string; weight: string; weightLabel: string; catDrawPlayers: RegisteredPlayer[] }> = {};
                  eligiblePlayers.forEach(p => {
                    // Categories are grouped by age group (not each player's exact age) —
                    // this matches the single-category view and how saved draws are keyed,
                    // so players in the same age group don't get silently split into
                    // separate, identically-labeled cards.
                    const key = categoryKey(p.ageGroup, "ALL", p.gender, String(p.weight));
                    if (!map[key]) {
                      map[key] = {
                        ageGroup: p.ageGroup,
                        exactAge: "ALL",
                        gender: p.gender,
                        weight: String(p.weight),
                        weightLabel: p.weightLabel || String(p.weight),
                        catDrawPlayers: [],
                      };
                    }
                    map[key].catDrawPlayers.push(p);
                  });
                  const categories = Object.entries(map).map(([key, data]) => ({ key, ...data })).sort((a, b) => a.key.localeCompare(b.key));
                  
                  if (categories.length === 0) {
                    return (
                      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-16 text-center space-y-4">
                        <Grid size={48} className="mx-auto text-slate-200" />
                        <div>
                          <p className="text-slate-500 font-bold text-lg">No Categories Found</p>
                          <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
                            There are no approved players matching the current filters.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return categories.map(({ key, ageGroup, exactAge, gender, weight, weightLabel, catDrawPlayers }) => {
                    const draw = draws[key];
                    return (
                      <div key={key} className="bg-white rounded-3xl border border-slate-100 shadow-sm mb-6">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                          <h3 className="font-black text-slate-800 flex items-center gap-2">
                            <Trophy size={16} className="text-[#FF7400]" />
                            {ageGroup} · {gender === "FEMALE" ? "Girls" : "Boys"} · {weightLabel} {weightLabel !== "Under 50" && !weightLabel.includes("kg") ? "kg" : ""}
                          </h3>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {catDrawPlayers.length > 1 && (
                                <select
                                  value={categoryDrawMethod[key] || (catDrawPlayers.length <= 5 ? "round-robin" : "straight-elimination")}
                                  onChange={(e) => setCategoryDrawMethod(prev => ({ ...prev, [key]: e.target.value as any }))}
                                  className="px-2.5 py-1.5 text-[11px] font-bold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/20 transition-all cursor-pointer"
                                >
                                  <option value="round-robin">1.Round Robin</option>
                                  <option value="straight-elimination">2.Straight elimination</option>
                                  <option value="single-repechage">3.Single Repechage</option>
                                  <option value="double-repechage">4.Double Repechage</option>
                                </select>
                              )}
                              <button
                                onClick={() => {
                                  const defaultMethod = catDrawPlayers.length <= 5 ? "round-robin" : "straight-elimination";
                                  const selectedMethod = categoryDrawMethod[key] || defaultMethod;
                                  handleGenerateAndSaveDraw(
                                    draw?.generated ? true : false,
                                    false,
                                    {
                                      ageGroup: ageGroup,
                                      exactAge: exactAge,
                                      gender: gender,
                                      weightCategory: weight,
                                      players: catDrawPlayers,
                                      key: key,
                                      draw: draw
                                    },
                                    selectedMethod
                                  );
                                }}
                                disabled={catDrawPlayers.length < 1 || (catDrawPlayers.length === 1 && !!draw?.generated) || drawPhase === "shuffling" || drawPhase === "dealing" || autoGenerating}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white rounded-lg font-bold text-xs shadow-md shadow-slate-700/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {drawPhase === "shuffling" || drawPhase === "dealing"
                                  ? <><Loader2 size={13} className="animate-spin" /> Processing...</>
                                  : catDrawPlayers.length === 1
                                  ? <><Trophy size={13} /> {draw?.generated ? "Winner Declared" : "Direct Win"}</>
                                  : <><Shuffle size={13} /> {draw?.generated ? "Shuffle Bracket" : "Generate Draw"}</>}
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Assign:</span>
                              <select
                                value={draw?.matNumber || pendingMatByKey[key] || 1}
                                onChange={async (e) => {
                                  const newMat = Number(e.target.value);
                                  if (!draw) {
                                    setPendingMatByKey(prev => ({ ...prev, [key]: newMat }));
                                    return;
                                  }
                                  const updatedDraw = { ...draw, matNumber: newMat };
                                  setDraws(prev => ({ ...prev, [key]: updatedDraw }));

                                  try {
                                    await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
                                      method: "POST",
                                      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        ageGroup: updatedDraw.ageGroup,
                                        exactAge: updatedDraw.exactAge,
                                        gender: updatedDraw.gender,
                                        weightCategory: updatedDraw.weightCategory,
                                        matNumber: updatedDraw.matNumber,
                                        rounds: updatedDraw.rounds,
                                      })
                                    });
                                  } catch (err) {
                                    console.error(err);
                                  }
                                }}
                                className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black rounded-lg px-2 py-1 outline-none hover:bg-indigo-100 transition-colors cursor-pointer"
                              >
                                {(tournamentMats.length > 0 ? tournamentMats.map(m => m.matNumber).sort((a, b) => a - b) : [1]).map(m => {
                                  const coachName = tournamentMats.find(tm => tm.matNumber === m)?.refereeName;
                                  return (
                                    <option key={m} value={m}>MAT {m}{coachName ? ` — ${coachName}` : ""}</option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-5 border-b border-slate-50">
                          <div className="flex items-center justify-between mb-4">
                            <p className="font-black text-slate-800">
                              {catDrawPlayers.length} Players Ready
                            </p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {catDrawPlayers.map((p, i) => (
                              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-default">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                                    {p.name.charAt(0)}
                                  </div>
                                  <div className="overflow-hidden">
                                    <p className="text-xs font-black text-slate-800 truncate leading-tight">{p.name}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{p.gender === "FEMALE" ? "Female" : "Male"} · {p.club || p.district}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {draw?.generated && (() => {
                          const isCatRoundRobin = !!draw.rounds[0]?.[0]?.matchId.startsWith("rr_");
                          const catViewMode: ViewMode = categoryViewMode[key] || "bracket";
                          const effectiveCatViewMode: ViewMode = catViewMode === "leaderboard" && !isCatRoundRobin ? "bracket" : catViewMode;
                          return (
                          <div className="border-t border-slate-50">
                            <div className="flex items-center justify-between px-5 pt-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {effectiveCatViewMode === "bracket" ? "Bracket" : effectiveCatViewMode === "list" ? "Match List" : "Leaderboard"}
                              </h4>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => exportCategoryChartPDF(tournament, key, draw, catDrawPlayers)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7400] hover:bg-[#e66800] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                  title="Download Official Visual Competition Bracket Chart (PDF)"
                                >
                                  <Download size={13} /> Download Chart (PDF)
                                </button>
                                <button
                                  onClick={() => exportCategoryReport(tournament, key, draw, catDrawPlayers)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#FF7400] border border-orange-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                  title="Print Entire Match Result Report for this Category"
                                >
                                  <Printer size={13} /> Print Report
                                </button>
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                  {(isCatRoundRobin ? (["bracket", "list", "leaderboard"] as ViewMode[]) : (["bracket", "list"] as ViewMode[])).map((v) => (
                                    <button key={v} onClick={() => setCategoryViewMode(prev => ({ ...prev, [key]: v }))}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${effectiveCatViewMode === v ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-400"}`}>
                                      {v === "bracket" ? <><Grid size={12} className="inline mr-1" />Bracket</>
                                        : v === "list" ? <><List size={12} className="inline mr-1" />List</>
                                        : <><BarChart3 size={12} className="inline mr-1" />Leaderboard</>}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {effectiveCatViewMode === "leaderboard" ? (
                            /* Leaderboard View */
                            <div className="p-5 pb-8 bg-slate-50/30">
                              <RoundRobinLeaderboard
                                rounds={draw.rounds}
                                players={catDrawPlayers}
                                tournament={tournament}
                                currentKey={key}
                                currentDraw={draw}
                              />
                            </div>
                            ) : effectiveCatViewMode === "bracket" ? (
                            /* Bracket View */
                            <div className="p-5 pb-8 bg-slate-50/30">
                              <BracketView
                                rounds={draw.rounds}
                                onOpenScoreboard={openScoreboard}
                                players={catDrawPlayers}
                                tournament={tournament}
                                currentKey={key}
                                currentDraw={draw}
                              />
                            </div>
                            ) : (
                            /* Match List View */
                            <div className="p-5 bg-white">
                              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                                <span className="text-xs font-bold text-slate-500">
                                  Total {draw.rounds.reduce((acc, r) => acc + r.length, 0)} Matches across {draw.rounds.length} Rounds
                                </span>
                                <button
                                  onClick={() => exportCategoryReport(tournament, key, draw, catDrawPlayers)}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF7400] hover:bg-[#e66800] text-white rounded-xl text-xs font-black transition-all shadow-sm"
                                  title="Print Entire Match Results Report"
                                >
                                  <Printer size={13} /> Print Entire Match Results
                                </button>
                              </div>
                              <div className="divide-y divide-slate-50">
                                {draw.rounds.map((round, ri) => (
                                  <div key={ri} className="py-3">
                                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                                      {getRoundLabel(draw.rounds, ri, catDrawPlayers.length <= 5)}
                                    </h5>
                                    <div className="space-y-2">
                                      {round.map((match, mi) => {
                                        const isBronze = ri === draw.rounds.length - 1 && mi === 1;
                                        return (
                                          <motion.div
                                            key={match.matchId}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: ri * 0.15 + mi * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                                            className={`flex items-center justify-between p-3 rounded-2xl transition-colors ${
                                              isBronze ? "bg-amber-50/50 border border-amber-200" : "bg-slate-50 hover:bg-orange-50/30"
                                            }`}
                                          >
                                            <div className="flex items-center gap-4">
                                              <span className="text-[10px] font-black text-slate-400 min-w-[80px] flex flex-col gap-0.5">
                                                <span>Mat {draw.matNumber || 1} · #{match.matchNumber}</span>
                                                {isBronze && <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded inline-block w-max mt-1">🥉 BRONZE</span>}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold flex items-center gap-1 ${match.slotA.isBye ? "text-slate-300" : match.winnerId === match.slotA.playerId ? "text-emerald-600" : match.status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                                  {match.slotA.playerName}
                                                  {match.winnerId && match.winnerId === match.slotA.playerId && <Trophy size={12} />}
                                                </span>
                                                <span className="text-[10px] font-black text-slate-300">vs</span>
                                                <span className={`text-sm font-bold flex items-center gap-1 ${match.slotB.isBye ? "text-slate-300" : match.winnerId === match.slotB.playerId ? "text-emerald-600" : match.status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                                  {match.winnerId && match.winnerId === match.slotB.playerId && <Trophy size={12} />}
                                                  {match.slotB.playerName}
                                                </span>
                                              </div>
                                            </div>
                                            {match.slotA.playerName !== "TBD" && match.slotB.playerName !== "TBD" && !match.slotA.isBye && !match.slotB.isBye && match.status !== "COMPLETED" && (
                                              <button onClick={() => openScoreboard(match)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7400] text-white rounded-xl text-[10px] font-black hover:scale-105 transition-all">
                                                <Monitor size={11} /> Scoreboard
                                              </button>
                                            )}
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            )}
                          </div>
                          );
                        })()}
                      </div>
                    );
                  });
                })()}
              </motion.div>
            ) : (
              <motion.div
                key="single-category-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: 100, transition: { duration: 0.3 } }}
                className="space-y-6"
              >
                {/* Player cards list */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                {drawPlayers.length === 0 ? (
                  <div className="py-16 text-center space-y-4">
                    <Target size={48} className="mx-auto text-slate-200" />
                    <div>
                      <p className="text-slate-500 font-bold text-lg">No Players in This Category</p>
                      <p className="text-slate-400 text-sm mt-1">Select a different category filter above.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="flex flex-col xl:flex-row items-center justify-between bg-white border-2 border-slate-100 rounded-[1.5rem] p-4 mb-6 shadow-sm gap-6">
                      {/* Left Side: Status */}
                      <div className="flex items-center gap-4 w-full xl:w-auto">
                        <div className="flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shrink-0">
                          <Users size={24} />
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-lg">
                            {drawPlayers.length} Players Ready
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {drawPlayers.length === 1
                              ? (currentDraw?.generated ? "Winner declared" : "No opponent — declare a direct win")
                              : (currentDraw?.generated ? "Assign seeds & Re-Shuffle" : "Assign seeds & Generate Draw")}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Actions */}
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">

                        {/* Format Select */}
                        {drawPlayers.length > 1 && (
                          <div className="relative w-full md:w-auto">
                            <select
                              value={detailDrawMethod || (drawPlayers.length <= 5 ? "round-robin" : "straight-elimination")}
                              onChange={(e) => setDetailDrawMethod(e.target.value as DrawMethodType)}
                              className="w-full md:w-auto pl-4 pr-10 py-2.5 text-sm font-bold bg-orange-50/50 border-2 border-orange-200 text-orange-900 rounded-xl focus:outline-none focus:border-[#FF7400] hover:border-orange-300 transition-all cursor-pointer shadow-sm appearance-none"
                            >
                              <option value="round-robin">1. Round Robin</option>
                              <option value="straight-elimination">2. Straight Elimination</option>
                              <option value="single-repechage">3. Single Repechage</option>
                              <option value="double-repechage">4. Double Repechage</option>
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => currentDraw?.generated ? handleShuffle() : handleGenerateDraw()}
                          disabled={drawPlayers.length < 1 || (drawPlayers.length === 1 && !!currentDraw?.generated) || drawPhase === "shuffling" || drawPhase === "dealing" || autoGenerating}
                          className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm shadow-md transition-all ${
                            currentDraw?.generated
                            ? "bg-slate-700 text-white hover:bg-slate-600 hover:shadow-lg active:scale-95 disabled:opacity-50"
                            : "bg-slate-800 text-white hover:bg-slate-700 hover:shadow-lg active:scale-95 disabled:opacity-50"
                          }`}
                        >
                          {drawPhase === "shuffling" || drawPhase === "dealing"
                            ? <><Loader2 size={16} className="animate-spin" /> Processing...</>
                            : drawPlayers.length === 1
                            ? <><Trophy size={16} /> {currentDraw?.generated ? "Winner Declared" : "Direct Win"}</>
                            : <><Shuffle size={16} /> {currentDraw?.generated ? "Re-Shuffle Bracket" : "Generate Draw"}</>}
                        </button>

                        {/* Mat Assign */}
                        <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-3 md:ml-2 md:border-l border-slate-200 md:pl-4 mt-2 md:mt-0">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Assign:</span>
                          <div className="relative">
                            <select
                              value={currentDraw?.matNumber || pendingMatByKey[currentKey] || 1}
                              onChange={async (e) => {
                                const newMat = Number(e.target.value);
                                if (!currentDraw) {
                                  setPendingMatByKey(prev => ({ ...prev, [currentKey]: newMat }));
                                  return;
                                }
                                const updatedDraw = { ...currentDraw, matNumber: newMat };
                                setDraws(prev => ({ ...prev, [currentKey]: updatedDraw }));

                                try {
                                  await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      ageGroup: updatedDraw.ageGroup,
                                      exactAge: updatedDraw.exactAge,
                                      gender: updatedDraw.gender,
                                      weightCategory: updatedDraw.weightCategory,
                                      matNumber: updatedDraw.matNumber,
                                      rounds: updatedDraw.rounds,
                                    })
                                  });
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="pl-4 pr-10 py-2.5 text-sm font-black bg-indigo-50 border-2 border-indigo-200 text-indigo-700 rounded-xl outline-none focus:border-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer appearance-none shadow-sm"
                            >
                              {(tournamentMats.length > 0 ? tournamentMats.map(m => m.matNumber).sort((a, b) => a - b) : [1]).map(m => {
                                const coachName = tournamentMats.find(tm => tm.matNumber === m)?.refereeName;
                                return (
                                  <option key={m} value={m}>MAT {m}{coachName ? ` — ${coachName}` : ""}</option>
                                );
                              })}
                            </select>
                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" />
                          </div>
                        </div>

                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {drawPlayers.map((p, i) => (
                        <motion.div
                          key={`${p.id}-${shuffleKey}`}
                          layoutId={`player-card-${p.id}`}
                          initial={{ opacity: 0, y: 30, scale: 0.85 }}
                          animate={{
                            opacity: 1,
                            y: drawPhase === "shuffling" ? [0, -12, 8, -5, 0] : 0,
                            x: drawPhase === "shuffling" ? [0, (i % 2 === 0 ? -8 : 8), (i % 3 === 0 ? 5 : -5), 0] : 0,
                            scale: drawPhase === "shuffling" ? [1, 0.92, 1.04, 0.97, 1] : 1,
                            rotate: drawPhase === "shuffling" ? [0, (i % 2 === 0 ? -6 : 6), (i % 3 === 0 ? 3 : -3), 0] : 0,
                          }}
                          transition={{
                            opacity: { delay: i * 0.04, duration: 0.3 },
                            y: drawPhase === "shuffling"
                              ? { duration: 0.7, delay: i * 0.05, ease: "easeInOut" }
                              : { delay: i * 0.04, duration: 0.4, type: "spring" },
                            x: drawPhase === "shuffling"
                              ? { duration: 0.7, delay: i * 0.05 }
                              : { delay: i * 0.04 },
                            scale: drawPhase === "shuffling"
                              ? { duration: 0.7, delay: i * 0.05 }
                              : { delay: i * 0.04, duration: 0.4, type: "spring" },
                            rotate: drawPhase === "shuffling"
                              ? { duration: 0.7, delay: i * 0.05 }
                              : { delay: i * 0.04 },
                          }}
                          className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm hover:shadow-md hover:border-orange-300 transition-shadow cursor-default"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                              {p.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-black text-slate-800 truncate leading-tight">{p.name}</p>
                              <p className="text-[9px] text-slate-400 truncate">{p.gender === "FEMALE" ? "Female" : "Male"} · {p.club || p.district}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                {p.weight} kg
                              </span>
                              <button
                                onClick={() => openEditMetricsModal(p)}
                                className="text-slate-300 hover:text-orange-500 transition-colors"
                              >
                                <Edit2 size={12} />
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              {seeds[1]?.id === p.id && <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">S1</span>}
                              {seeds[2]?.id === p.id && <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">S2</span>}
                              {seeds[3]?.id === p.id && <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">S3</span>}
                              {seeds[4]?.id === p.id && <span className="text-[8px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">S4</span>}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
                </div>

                {/* Bracket — post-generate */}
                {currentDraw?.generated && (
                  <motion.div
                    key={`bracket-${currentKey}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden"
                  >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-black text-slate-800">
                    Draw — {filteredPlayers.length} Players
                    <span className="ml-2 text-xs font-semibold text-slate-400">
                      {ageFilter !== "ALL" ? ageFilter : ""} {genderFilter !== "ALL" ? genderFilter : ""} {weightFilter !== "ALL" ? `${weightFilter}kg` : ""}
                    </span>
                    {currentDraw.matNumber && (
                      <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                        MAT {currentDraw.matNumber}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => { 
                        const hasActive = currentDraw.rounds.some(r => r.some(m => m.status === "COMPLETED" || m.status === "IN_PROGRESS"));
                        if (hasActive) {
                          showToast("Cannot re-draw the bracket because matches have already started or completed!", false);
                          return;
                        }
                        if (window.confirm("Are you sure you want to re-draw this bracket? This will wipe the current bracket.")) {
                          setDraws(p => ({ ...p, [currentKey]: { ...currentDraw!, generated: false, saved: false } })); 
                          setDrawPhase("idle"); 
                        }
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                        currentDraw.rounds.some(r => r.some(m => m.status === "COMPLETED" || m.status === "IN_PROGRESS"))
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-500 hover:text-red-500 hover:bg-red-50"
                      }`}>
                      ↺ Re-draw
                    </button>
                    <button
                      onClick={() => exportCategoryChartPDF(tournament, currentKey, currentDraw, filteredPlayers)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7400] hover:bg-[#e66800] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      title="Download Official Visual Competition Bracket Chart (PDF)"
                    >
                      <Download size={13} /> Download Chart (PDF)
                    </button>
                    <button
                      onClick={() => exportCategoryReport(tournament, currentKey, currentDraw, filteredPlayers)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#FF7400] border border-orange-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                      title="Print Entire Match Result Report for this Category"
                    >
                      <Printer size={13} /> Print Report
                    </button>
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                      {(
                        isCurrentRoundRobin
                          ? (["bracket", "list", "leaderboard"] as ViewMode[])
                          : (["bracket", "list"] as ViewMode[])
                      ).map((v) => (
                        <button key={v} onClick={() => setViewMode(v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${effectiveViewMode === v ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-400"}`}>
                          {v === "bracket" ? <><Grid size={12} className="inline mr-1" />Bracket</>
                            : v === "list" ? <><List size={12} className="inline mr-1" />List</>
                            : <><BarChart3 size={12} className="inline mr-1" />Leaderboard</>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {effectiveViewMode === "leaderboard" ? (
                  <div className="p-5 pb-8 bg-slate-50/50">
                    <RoundRobinLeaderboard
                      rounds={currentDraw.rounds}
                      players={filteredPlayers}
                      tournament={tournament}
                      currentKey={currentKey}
                      currentDraw={currentDraw}
                    />
                  </div>
                ) : effectiveViewMode === "list" ? (
                  <div className="p-5">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500">
                        Total {currentDraw.rounds.reduce((acc, r) => acc + r.length, 0)} Matches across {currentDraw.rounds.length} Rounds
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => exportCategoryChartPDF(tournament, currentKey, currentDraw, filteredPlayers)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#FF7400] hover:bg-[#e66800] text-white rounded-xl text-xs font-black transition-all shadow-sm"
                          title="Download Official Visual Competition Bracket Chart as PDF"
                        >
                          <Download size={13} /> Download Chart (PDF)
                        </button>
                        <button
                          onClick={() => exportCategoryReport(tournament, currentKey, currentDraw, filteredPlayers)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all shadow-sm"
                          title="Print Entire Match Results Report"
                        >
                          <Printer size={13} /> Print Entire Match Results
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                    {currentDraw.rounds.map((round, ri) => (
                      <div key={ri} className="p-5">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                          {getRoundLabel(currentDraw.rounds, ri, filteredPlayers.length <= 5)}
                        </h4>
                        <div className="space-y-2">
                          {round.map((match, mi) => {
                            const isBronze = ! (filteredPlayers.length <= 5) && ri === currentDraw.rounds.length - 1 && mi === 1;
                            return (
                            <motion.div
                              key={match.matchId}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: ri * 0.15 + mi * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                              className={`flex items-center justify-between p-3 rounded-2xl transition-colors ${
                                isBronze ? "bg-amber-50/50 border border-amber-200" : "bg-slate-50 hover:bg-orange-50/30"
                              }`}
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black text-slate-400 min-w-[80px] flex flex-col gap-0.5">
                                  <span>Mat {currentDraw.matNumber || 1} · #{match.matchNumber}</span>
                                  {isBronze && <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded inline-block w-max mt-1">🥉 BRONZE</span>}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold flex items-center gap-1 ${match.slotA.isBye ? "text-slate-300" : match.winnerId === match.slotA.playerId ? "text-emerald-600" : match.status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                    {match.slotA.playerName}
                                    {match.winnerId && match.winnerId === match.slotA.playerId && <Trophy size={12} />}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-300">vs</span>
                                  <span className={`text-sm font-bold flex items-center gap-1 ${match.slotB.isBye ? "text-slate-300" : match.winnerId === match.slotB.playerId ? "text-emerald-600" : match.status === "COMPLETED" ? "text-slate-400 line-through" : "text-slate-800"}`}>
                                    {match.winnerId && match.winnerId === match.slotB.playerId && <Trophy size={12} />}
                                    {match.slotB.playerName}
                                  </span>
                                </div>
                              </div>
                              {match.status === "COMPLETED" && (
                                <div className="text-right flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                    {match.winMethod || "Win"} ({match.scoreA ? `${(match.scoreA.ippon || 0) * 100 + (match.scoreA.wazaAri || 0) * 10 + (match.scoreA.yuko || 0)} - ${(match.scoreB.ippon || 0) * 100 + (match.scoreB.wazaAri || 0) * 10 + (match.scoreB.yuko || 0)}` : "0 - 0"})
                                  </span>
                                  {match.elapsedSeconds !== undefined && (
                                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">
                                      ⏱️ {Math.floor(match.elapsedSeconds / 60)}m {match.elapsedSeconds % 60}s
                                    </span>
                                  )}
                                </div>
                              )}
                              {match.slotA.playerName !== "TBD" && match.slotB.playerName !== "TBD" && !match.slotA.isBye && !match.slotB.isBye && match.status !== "COMPLETED" && (
                                <button onClick={() => openScoreboard(match)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7400] text-white rounded-xl text-[10px] font-black hover:scale-105 transition-all">
                                  <Monitor size={11} /> Scoreboard
                                </button>
                                )}
                            </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 pb-8 bg-slate-50/50">
                    <BracketView
                      key={currentKey}
                      rounds={currentDraw.rounds}
                      onOpenScoreboard={openScoreboard}
                      players={filteredPlayers}
                      tournament={tournament}
                      currentKey={currentKey}
                      currentDraw={currentDraw}
                    />
                  </div>
                )}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══ MATCHES ═══════════════════════════════════════════════════════════ */}
      {activeTab === "matches" && expired && (
        <ExpiredBlock label="Match Scoreboard" />
      )}
      {activeTab === "matches" && !expired && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex-1 overflow-x-auto">
              <DrawCategoryFilters
                genderFilter={genderFilter}
                setGenderFilter={setGenderFilter}
                ageFilter={ageFilter}
                setAgeFilter={setAgeFilter}
                weightFilter={weightFilter}
                setWeightFilter={setWeightFilter}
                setExactAgeFilter={setExactAgeFilter}
                availableAgeGroups={availableAgeGroupsGlobal}
                groupPlayers={groupPlayersGlobal}
                availableWeights={availableWeightsGlobal}
                eligiblePlayersCount={eligiblePlayers.length}
                draws={draws}
              />
            </div>
            <button
              onClick={() => exportAllMatchesToPDF(tournament, draws)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl shadow-lg hover:bg-slate-700 transition-colors shrink-0"
            >
              <Printer size={16} /> Print Master Match List
            </button>
          </div>

          {(() => {
            // Draws are saved per exact weight/age sub-category, so when the filter is
            // broadened (e.g. "All Weights"), a single currentKey lookup misses every
            // sub-category draw. Gather every generated draw that matches the active
            // gender/age/weight filters instead of relying on one exact key.
            type MatchCategory = { key: string; ageGroup: string; gender: string; weightLabel: string; smallBracket: boolean; draw: DrawCategory };
            let matchCategories: MatchCategory[];

            if (isMultiCategory) {
              const map: Record<string, MatchCategory> = {};
              const counts: Record<string, number> = {};
              eligiblePlayers.forEach(p => {
                const key = categoryKey(p.ageGroup, "ALL", p.gender, String(p.weight));
                counts[key] = (counts[key] || 0) + 1;
                const d = draws[key];
                if (!map[key] && d?.generated) {
                  map[key] = { key, ageGroup: p.ageGroup, gender: p.gender, weightLabel: p.weightLabel || String(p.weight), smallBracket: false, draw: d };
                }
              });
              matchCategories = Object.values(map)
                .map(c => ({ ...c, smallBracket: (counts[c.key] || 0) <= 5 }))
                .sort((a, b) => a.key.localeCompare(b.key));
            } else {
              matchCategories = currentDraw?.generated
                ? [{ key: currentKey, ageGroup: ageFilter, gender: genderFilter, weightLabel: weightFilter, smallBracket: filteredPlayers.length <= 5, draw: currentDraw }]
                : [];
            }

            if (matchCategories.length === 0) {
              return (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm py-20 text-center">
                  <Swords size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-500 font-bold text-lg">No Draw for This Category</p>
                  <p className="text-slate-400 font-semibold text-sm mt-1">Generate a draw first</p>
                  <button onClick={() => setActiveTab("draws")}
                    className="mt-5 px-6 py-2.5 bg-[#FF7400] text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
                    Go to Draw Generation →
                  </button>
                </div>
              );
            }

            return matchCategories.map(({ key, ageGroup, gender, weightLabel, smallBracket, draw }) => {
              const stats = getRoundsStats(draw.rounds);
              const tiles: { key: typeof matchStatusFilter; label: string; count: number; color: string; dot: string }[] = [
                { key: "ALL", label: "Total Matches", count: stats.total, color: "text-slate-700 bg-white border-slate-200", dot: "bg-slate-400" },
                { key: "PENDING", label: "Not Started", count: stats.notStarted, color: "text-slate-600 bg-slate-50 border-slate-200", dot: "bg-slate-400" },
                { key: "IN_PROGRESS", label: "Live", count: stats.live, color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-500" },
                { key: "COMPLETED", label: "Completed", count: stats.completed, color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
              ];
              return (
              <div key={key} className="space-y-4">
                {isMultiCategory && (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                      <Trophy size={16} className="text-[#FF7400]" />
                      {ageGroup} · {gender === "FEMALE" ? "Girls" : "Boys"} · {weightLabel}{weightLabel && !weightLabel.includes("kg") ? " kg" : ""}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportCategoryChartPDF(tournament, key, draw, eligiblePlayers)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7400] hover:bg-[#e66800] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        title="Download Official Visual Competition Bracket Chart as PDF"
                      >
                        <Download size={13} /> Download Chart (PDF)
                      </button>
                      <button
                        onClick={() => exportCategoryReport(tournament, key, draw, eligiblePlayers)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
                      >
                        <Printer size={13} className="text-[#FF7400]" /> Print Category Report
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tiles.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setMatchStatusFilter(t.key)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${t.color} ${
                        matchStatusFilter === t.key ? "ring-2 ring-offset-1 ring-slate-800/60 shadow-md" : "hover:shadow-sm"
                      }`}
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-black uppercase tracking-wider opacity-70 flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${t.dot} ${t.key === "IN_PROGRESS" ? "animate-pulse" : ""}`} />
                          {t.label}
                        </p>
                        <p className="text-2xl font-black mt-0.5">{t.count}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="space-y-6">
                  {draw.rounds.map((fullRound, ri) => {
                    const round = fullRound.filter(m => matchStatusFilter === "ALL" || m.status === matchStatusFilter);
                    if (round.length === 0) return null;
                    return (
                    <div key={ri} className="bg-white rounded-[2rem] border border-slate-100 shadow-lg shadow-slate-200/40 overflow-hidden">
                      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Swords size={18} className="text-white/80" />
                          </div>
                          <h3 className="font-black text-lg tracking-tight">{getRoundLabel(draw.rounds, ri, smallBracket)}</h3>
                        </div>
                        <span className="text-xs font-bold text-slate-300 bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm">{round.length} match{round.length !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {round.map((match) => (
                      <div key={match.matchId}
                        className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50 transition-colors group">
                        
                        {/* Left: Mat & Match Info */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex flex-col items-center justify-center w-16 h-16 bg-slate-100 group-hover:bg-white rounded-2xl border border-slate-200 group-hover:border-[#FF7400]/30 group-hover:shadow-lg group-hover:shadow-[#FF7400]/10 transition-all">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mat</span>
                            <span className="text-2xl font-black text-slate-800 leading-none mt-0.5">{match.matNumber}</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Match #{match.matchNumber}</span>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md inline-flex items-center justify-center w-fit ${
                              match.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                              match.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-700 animate-pulse" :
                              "bg-slate-200 text-slate-500"
                            }`}>
                              {match.status === "IN_PROGRESS" && <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mr-1.5" />}
                              {match.status === "COMPLETED" && <Check size={10} className="mr-1" />}
                              {match.status}
                            </span>
                          </div>
                        </div>

                        {/* Center: The Matchup */}
                        <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 px-2 sm:px-6">
                          {/* Player A */}
                          <div className="flex-1 flex flex-col items-end text-right">
                            <motion.div
                              key={`${match.matchId}-slotA-${match.slotA.playerName}`}
                              initial={match.slotA.playerName !== "TBD" ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex flex-col items-end"
                            >
                              <div className={`text-sm sm:text-base font-black flex items-center justify-end gap-1.5 flex-wrap ${match.slotA.isBye ? "text-slate-300" : match.slotA.playerName === "TBD" ? "text-slate-400" : match.winnerId === match.slotA.playerId ? "text-emerald-700" : match.status === "COMPLETED" ? "text-slate-400" : "text-slate-800"}`}>
                                {match.slotA.playerName}
                                {match.winnerId === match.slotA.playerId && <Trophy size={16} className="text-emerald-500 ml-1" />}
                                {match.slotA.seedNumber && (
                                  <span className="ml-1 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">S{match.slotA.seedNumber}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5 max-w-[120px] sm:max-w-xs truncate">{match.slotA.club}</p>
                            </motion.div>
                          </div>

                          {/* VS Badge */}
                          <div className="shrink-0 flex flex-col items-center justify-center px-2">
                            <span className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-[10px] font-black text-slate-400 border border-slate-200">
                              VS
                            </span>
                          </div>

                          {/* Player B */}
                          <div className="flex-1 flex flex-col items-start text-left">
                            <motion.div
                              key={`${match.matchId}-slotB-${match.slotB.playerName}`}
                              initial={match.slotB.playerName !== "TBD" ? { opacity: 0, x: 10 } : { opacity: 1, x: 0 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex flex-col items-start"
                            >
                              <div className={`text-sm sm:text-base font-black flex items-center gap-1.5 flex-wrap ${match.slotB.isBye ? "text-slate-300" : match.slotB.playerName === "TBD" ? "text-slate-400" : match.winnerId === match.slotB.playerId ? "text-emerald-700" : match.status === "COMPLETED" ? "text-slate-400" : "text-slate-800"}`}>
                                {match.winnerId === match.slotB.playerId && <Trophy size={16} className="text-emerald-500 mr-1" />}
                                {match.slotB.playerName}
                                {match.slotB.seedNumber && (
                                  <span className="ml-1 text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">S{match.slotB.seedNumber}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5 max-w-[120px] sm:max-w-xs truncate">{match.slotB.club}</p>
                            </motion.div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full ${
                            match.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            match.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-700" :
                            "bg-slate-100 text-slate-400"
                          }`}>
                            {match.status}
                          </span>
                          {match.status === "COMPLETED" && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                {match.winMethod || "Win"} ({match.scoreA ? `${(match.scoreA.ippon || 0) * 100 + (match.scoreA.wazaAri || 0) * 10 + (match.scoreA.yuko || 0)} - ${(match.scoreB.ippon || 0) * 100 + (match.scoreB.wazaAri || 0) * 10 + (match.scoreB.yuko || 0)}` : "0 - 0"})
                              </span>
                              {match.elapsedSeconds !== undefined && (
                                <span className="text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                                  ⏱️ {Math.floor(match.elapsedSeconds / 60)}m {match.elapsedSeconds % 60}s
                                </span>
                              )}
                            </div>
                          )}
                          {match.slotA.playerName !== "TBD" && match.slotB.playerName !== "TBD" && match.status !== "COMPLETED" && (
                            <button onClick={() => openScoreboard(match)}
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF7400] to-orange-500 text-white rounded-xl text-xs font-black shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all">
                              <Monitor size={13} /> Open Scoreboard ↗
                            </button>
                          )}
                          {match.slotA.playerId && !match.slotB.playerId && match.status !== "COMPLETED" && (
                            <span className="text-xs text-amber-600 font-bold px-3 py-1 bg-amber-50 rounded-xl border border-amber-100">Waiting for opponent...</span>
                          )}
                          {(match.slotA.isBye || match.slotB.isBye) && (
                            <span className="text-xs text-slate-400 font-bold px-3 py-1 bg-slate-50 rounded-xl">BYE — auto advance</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
                </div>
              </div>
              );
            });
          })()}
        </div>
      )}

      {/* ══ RESULTS & REPORTS ══════════════════════════════════════════════════ */}
      {activeTab === "results" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <BarChart3 size={24} /> Match Results & Reports
              </h2>
              <p className="text-slate-500 text-sm mt-1">View completed matches, winners, and generate PDF reports</p>
            </div>
            <button onClick={() => exportOverallTournamentReport(tournament, players, draws, placements)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
              <Printer size={16} /> Official Completion Report
            </button>
          </div>
          
          <DrawCategoryFilters
                genderFilter={genderFilter}
                setGenderFilter={setGenderFilter}
                ageFilter={ageFilter}
                setAgeFilter={setAgeFilter}
                weightFilter={weightFilter}
                setWeightFilter={setWeightFilter}
                setExactAgeFilter={setExactAgeFilter}
                availableAgeGroups={availableAgeGroupsGlobal}
                groupPlayers={groupPlayersGlobal}
                availableWeights={availableWeightsGlobal}
                eligiblePlayersCount={eligiblePlayers.length}
                draws={draws}
              />

          {/* ── Conclude Tournament Panel ── */}
          {tournament?.status !== "CLOSED" ? (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center shrink-0">
                  <Award size={24} className="text-[#FF7400]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Conclude Category & Issue Certificates</h3>
                  <p className="text-slate-500 text-sm mt-1">Confirm placements below, then conclude to unlock certificates.</p>
                </div>
              </div>

              {isMultiCategory ? (
                <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold border border-amber-200">
                  <AlertCircle size={16} className="shrink-0" /> Placements and certificates are finalized one weight class at a time. Pick a single age group, gender and weight above — not "All Weights" — to conclude that category.
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-semibold">No players found for this category.</div>
              ) : !currentDraw?.generated ? (
                <div className="text-center py-8 text-slate-400 font-semibold">Generate a draw for this category before concluding it.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                    {filteredPlayers.map((player) => {
                      const placement = placements[player.id] || "PARTICIPATION";
                      const placementColors: Record<string, string> = {
                        FIRST: "border-yellow-400 bg-yellow-50",
                        SECOND: "border-slate-300 bg-slate-50",
                        THIRD: "border-orange-400 bg-orange-50",
                        PARTICIPATION: "border-slate-200 bg-slate-50/50",
                      };
                      return (
                        <div key={player.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${placementColors[placement]}`}>
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white shrink-0 ${player.gender === "FEMALE" ? "bg-pink-500" : "bg-blue-600"}`}>
                            {player.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-800 truncate">{player.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">{player.club || player.district}</p>
                          </div>
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setOpenDropdownId(openDropdownId === player.id ? null : player.id)}
                              className="flex items-center justify-between w-[120px] gap-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#FF7400]"
                            >
                              <span className="flex items-center gap-1.5">
                                {placement === "FIRST" && <><Trophy size={14} className="text-yellow-500"/> 1st Place</>}
                                {placement === "SECOND" && <><Medal size={14} className="text-slate-400"/> 2nd Place</>}
                                {placement === "THIRD" && <><Medal size={14} className="text-orange-600"/> 3rd Place</>}
                                {placement === "PARTICIPATION" && <><Award size={14} className="text-blue-500"/> Participant</>}
                              </span>
                            </button>
                            <AnimatePresence>
                              {openDropdownId === player.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                                  <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -5 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                                  >
                                    {[
                                      { val: "FIRST", label: "1st Place", icon: <Trophy size={14} className="text-yellow-500"/> },
                                      { val: "SECOND", label: "2nd Place", icon: <Medal size={14} className="text-slate-400"/> },
                                      { val: "THIRD", label: "3rd Place", icon: <Medal size={14} className="text-orange-600"/> },
                                      { val: "PARTICIPATION", label: "Participant", icon: <Award size={14} className="text-blue-500"/> }
                                    ].map(opt => (
                                      <button
                                        key={opt.val}
                                        onClick={() => {
                                          setPlacements(prev => ({ ...prev, [player.id]: opt.val as any }));
                                          setOpenDropdownId(null);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                                      >
                                        {opt.icon} {opt.label}
                                      </button>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                          <button
                            onClick={() => handleDownloadCertificate(player)}
                            disabled={!(currentDraw?.isConcluded || tournament?.status === "CLOSED")}
                            title={(currentDraw?.isConcluded || tournament?.status === "CLOSED") ? "Download certificate" : "Available after this category is concluded"}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold shrink-0 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:text-slate-500"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex items-center justify-end border-t border-slate-100 mt-4">
                    <button
                      onClick={() => setIsConcludeModalOpen(true)}
                      disabled={submittingResults || filteredPlayers.length === 0}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF7400] to-orange-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingResults ? <><Loader2 size={16} className="animate-spin" /> Concluding...</> : <><Trophy size={16} /> Conclude Category & Issue Certificates</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-5 px-8 py-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-3xl shadow-sm"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200">
                  <Check size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-emerald-800 font-black text-lg">Tournament Concluded</p>
                  <p className="text-emerald-600/80 text-sm font-semibold mt-0.5">All participants can now download their certificates from their dashboard.</p>
                </div>
              </motion.div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-yellow-100 via-orange-50 to-transparent opacity-50 pointer-events-none rounded-full -mr-20 -mt-20 blur-3xl" />
                
                <div className="flex items-center gap-4 mb-8 relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-200">
                    <Trophy size={28} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">Category Winners</h3>
                    <p className="text-slate-500 font-medium mt-1">Podium placements for the selected category filters.</p>
                  </div>
                </div>

                {filteredPlayers.filter(p => p.placement).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-slate-100">
                      <Trophy size={24} className="text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-bold text-lg">No Winners Yet</p>
                    <p className="text-slate-400 text-sm mt-1">Submit results to see the podium placements here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 relative z-10">
                    {filteredPlayers
                      .filter(p => p.placement)
                      .sort((a, b) => {
                        const order: Record<string, number> = { FIRST: 1, SECOND: 2, THIRD: 3, PARTICIPATION: 4 };
                        return (order[a.placement || ""] || 99) - (order[b.placement || ""] || 99);
                      })
                      .map((player) => {
                        const placement = player.placement as string;
                        const placementColors: Record<string, string> = {
                          FIRST: "border-yellow-200 bg-yellow-50 text-yellow-700",
                          SECOND: "border-slate-200 bg-slate-50 text-slate-700",
                          THIRD: "border-orange-200 bg-orange-50 text-orange-700",
                          PARTICIPATION: "border-blue-200 bg-blue-50 text-blue-700",
                        };
                        const placementIconColors: Record<string, string> = {
                          FIRST: "text-yellow-500",
                          SECOND: "text-slate-400",
                          THIRD: "text-orange-500",
                          PARTICIPATION: "text-blue-500",
                        };
                        const placementLabels: Record<string, string> = {
                          FIRST: "1st Place",
                          SECOND: "2nd Place",
                          THIRD: "3rd Place",
                          PARTICIPATION: "Participant",
                        };
                        const PlacementIcon = placement === "PARTICIPATION" ? Award : Trophy;
                        return (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            key={player.id}
                            className={`flex items-center gap-4 p-5 rounded-2xl border ${placementColors[placement].split(' ').slice(0,2).join(' ')} shadow-sm hover:shadow-md transition-shadow`}
                          >
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shrink-0 border border-black/5 shadow-sm">
                              <PlacementIcon size={24} className={placementIconColors[placement]} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-lg font-black text-slate-800 truncate">{player.name}</p>
                              <p className="text-sm font-semibold text-slate-500 truncate mt-0.5">{player.club || player.district}</p>
                            </div>
                            <div className="relative shrink-0 flex flex-col items-end gap-2 pl-4 border-l border-black/5">
                              <span className={`text-sm font-black ${placementColors[placement].split(' ')[2]} uppercase tracking-widest`}>
                                {placementLabels[placement]}
                              </span>
                              <button
                                onClick={() => handleDownloadCertificate(player)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-slate-500 rounded-lg text-[11px] font-bold hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
                              >
                                <Download size={12} /> Certificate
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}


          {(() => {
            // Same "All Weights" gap as the Matches tab: draws are saved per exact
            // sub-category, so gather every generated draw matching the active
            // filters instead of relying on one exact currentKey lookup.
            type ResultsCategory = { key: string; ageGroup: string; gender: string; weightLabel: string; smallBracket: boolean; draw: DrawCategory };
            let resultsCategories: ResultsCategory[];

            if (isMultiCategory) {
              const map: Record<string, ResultsCategory> = {};
              const counts: Record<string, number> = {};
              eligiblePlayers.forEach(p => {
                const key = categoryKey(p.ageGroup, "ALL", p.gender, String(p.weight));
                counts[key] = (counts[key] || 0) + 1;
                const d = draws[key];
                if (!map[key] && d?.generated) {
                  map[key] = { key, ageGroup: p.ageGroup, gender: p.gender, weightLabel: p.weightLabel || String(p.weight), smallBracket: false, draw: d };
                }
              });
              resultsCategories = Object.values(map)
                .map(c => ({ ...c, smallBracket: (counts[c.key] || 0) <= 5 }))
                .sort((a, b) => a.key.localeCompare(b.key));
            } else {
              resultsCategories = currentDraw?.generated
                ? [{ key: currentKey, ageGroup: ageFilter, gender: genderFilter, weightLabel: weightFilter, smallBracket: filteredPlayers.length <= 5, draw: currentDraw }]
                : [];
            }

            if (resultsCategories.length === 0) {
              return (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-20 text-center">
                  <BarChart3 size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-500 font-bold text-lg">No Draw for This Category</p>
                  <p className="text-slate-400 font-semibold text-sm mt-1">Generate a draw first to start matches</p>
                  <button onClick={() => setActiveTab("draws")}
                    className="mt-5 px-6 py-2.5 bg-[#FF7400] text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
                    Go to Draw Generation →
                  </button>
                </div>
              );
            }

            return (
            <div className="space-y-6">
              {resultsCategories.map(({ key, ageGroup, gender, weightLabel, smallBracket, draw }) => {
                const hasCompleted = draw.rounds.some(r => r.some(m => m.status === "COMPLETED"));
                if (!hasCompleted) return null;
                return (
                <div key={key} className="space-y-6">
                  {isMultiCategory && (
                    <h3 className="font-black text-slate-800 flex items-center gap-2 px-1">
                      <Trophy size={16} className="text-[#FF7400]" />
                      {ageGroup} · {gender === "FEMALE" ? "Girls" : "Boys"} · {weightLabel}{weightLabel && !weightLabel.includes("kg") ? " kg" : ""}
                    </h3>
                  )}
                  {/* Completed Matches */}
                  {draw.rounds.map((round, ri) => {
                    const completedMatches = round.filter(m => m.status === "COMPLETED");
                    if (completedMatches.length === 0) return null;

                    return (
                      <motion.div
                        key={ri}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                      >
                        <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center justify-between">
                          <h3 className="font-black">{getRoundLabel(draw.rounds, ri, smallBracket)} Results</h3>
                          <span className="text-xs font-bold text-emerald-100">{completedMatches.length} completed</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {completedMatches.map((match) => {
                            const winner = match.winnerId === match.slotA.playerId ? match.slotA : match.slotB;
                            const loser = match.winnerId === match.slotA.playerId ? match.slotB : match.slotA;
                            const nextMatchInfo = findNextMatch(draw.rounds, ri, round.indexOf(match), winner);

                            return (
                          <div key={match.matchId} className="p-6 hover:bg-emerald-50/30 transition-colors">
                            <div className="flex items-start justify-between gap-6">
                              <div className="flex-1 space-y-4">
                                {/* Match Header */}
                                <div className="flex items-center gap-4">
                                  <div className="text-center w-14">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Mat</p>
                                    <p className="text-2xl font-black text-slate-800">{match.matNumber}</p>
                                  </div>
                                  <div className="h-10 w-px bg-slate-200" />
                                  <div className="text-center w-14">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Match</p>
                                    <p className="text-2xl font-black text-slate-800">#{match.matchNumber}</p>
                                  </div>
                                </div>

                                {/* Winner & Loser */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Winner */}
                                  <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border-2 border-emerald-300"
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <Trophy size={16} className="text-emerald-600" />
                                      <p className="text-xs font-black text-emerald-600 uppercase">Winner</p>
                                    </div>
                                    <p className="text-lg font-black text-emerald-700">{winner.playerName}</p>
                                    <p className="text-xs text-emerald-600 font-semibold mt-1">{winner.club}</p>
                                    {winner.seedNumber && (
                                      <span className="mt-2 inline-block text-[9px] font-black text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                                        Seed #{winner.seedNumber}
                                      </span>
                                    )}
                                  </motion.div>

                                  {/* Loser */}
                                  <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.15 }}
                                    className="bg-slate-50 rounded-2xl p-4 border border-slate-200"
                                  >
                                    <p className="text-xs font-black text-slate-400 uppercase mb-2">Loser</p>
                                    <p className="text-lg font-bold text-slate-700">{loser.playerName}</p>
                                    <p className="text-xs text-slate-500 font-semibold mt-1">{loser.club}</p>
                                    {loser.seedNumber && (
                                      <span className="mt-2 inline-block text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                        Seed #{loser.seedNumber}
                                      </span>
                                    )}
                                  </motion.div>
                                </div>

                                {/* Next Match Info */}
                                {nextMatchInfo && (
                                  <motion.div
                                    initial={{ scale: 0.95, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-200 mt-4"
                                  >
                                    <p className="text-xs font-black text-blue-600 uppercase mb-2">📍 Next Match</p>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div>
                                        <p className="text-[10px] text-blue-600 font-bold uppercase">Round</p>
                                        <p className="font-black text-blue-700">{getRoundLabel(draw.rounds, nextMatchInfo.roundIndex)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] text-blue-600 font-bold uppercase">Match #{nextMatchInfo.matchNumber}</p>
                                        <p className="font-black text-blue-700">Mat {nextMatchInfo.matNumber}</p>
                                      </div>
                                      <div className="col-span-2">
                                        <p className="text-[10px] text-blue-600 font-bold uppercase">Opponent Status</p>
                                        <p className="font-semibold text-blue-700">
                                          {nextMatchInfo.opponent
                                            ? `vs ${nextMatchInfo.opponent}`
                                            : "⏳ Waiting for opponent to advance"}
                                        </p>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </div>

                              {/* Export PDF Button */}
                              <button
                                onClick={() => exportMatchToPDF(match, winner, loser, tournament, ri, nextMatchInfo)}
                                className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-blue-500/30 whitespace-nowrap"
                              >
                                <Download size={16} />
                                Export PDF
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
                </div>
                );
              })}
            </div>
            );
          })()}
        </div>
      )}

      {/* ══ SEED MODAL ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSeedModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

              <div className="p-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-black flex items-center gap-2">
                    <Award size={20} /> IJF Seeding Management
                  </h3>
                  <p className="text-amber-100 text-xs font-semibold mt-0.5">
                    S1 → top bracket · S2 → bottom · S3 & S4 → opposite halves (can only meet in Final)
                  </p>
                </div>
                <button onClick={() => { setShowSeedModal(false); setAssigningSeed(null); }}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-3 overflow-y-auto flex-grow">
                {([1, 2, 3, 4] as const).map((seedNum) => (
                  <div key={seedNum}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                        <span className="text-white font-black">S{seedNum}</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-700">
                          {seeds[seedNum]?.name || `Seed ${seedNum} — Unassigned`}
                        </p>
                        {seeds[seedNum] && (
                          <p className="text-xs text-slate-400 font-semibold">
                            {seeds[seedNum]?.club} · {seeds[seedNum]?.weight}kg
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setAssigningSeed(assigningSeed === seedNum ? null : seedNum)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${assigningSeed === seedNum ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600"}`}>
                        {seeds[seedNum] ? "Change" : "Assign"}
                      </button>
                      {seeds[seedNum] && (
                        <button onClick={() => setSeeds((s) => ({ ...s, [seedNum]: null }))}
                          className="px-3 py-1.5 bg-red-50 text-red-500 rounded-xl text-xs font-bold hover:bg-red-100 transition-all">
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Player picker */}
                <AnimatePresence>
                  {assigningSeed && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="border border-orange-200 rounded-2xl overflow-hidden bg-orange-50/50">
                      <p className="px-4 py-3 text-xs font-black text-orange-700 border-b border-orange-100 uppercase tracking-wider">
                        Select player for Seed {assigningSeed}
                      </p>
                      <div className="max-h-48 overflow-y-auto">
                        {filteredPlayers.length === 0 ? (
                          <p className="p-4 text-sm text-slate-400 text-center">No players in selected category</p>
                        ) : (
                          filteredPlayers.map((p) => (
                            <button key={p.id} onClick={() => handleAssignSeed(assigningSeed, p)}
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-100 transition-colors text-left border-b border-orange-50 last:border-0">
                              <span className="text-sm font-bold text-slate-800">{p.name}</span>
                              <span className="text-xs text-slate-400 font-semibold">{p.club} · {p.weight}kg</span>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setSeeds({ 1: null, 2: null, 3: null, 4: null })}
                    className="px-4 py-2 text-slate-400 hover:text-red-500 text-sm font-bold transition-colors">
                    Clear All Seeds
                  </button>
                  <button onClick={() => { setShowSeedModal(false); setAssigningSeed(null); }}
                    className="px-6 py-2.5 bg-[#FF7400] text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 transition-all">
                    Done ✓
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Metrics Modal ── */}
      <AnimatePresence>
        {editingMetrics && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 max-h-[85vh]"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-black text-slate-800">Edit Registration</h3>
                <button onClick={() => setEditingMetrics(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
              </div>
              <form onSubmit={handleUpdateMetrics} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Weight (kg) *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={editingMetrics.weight}
                      onChange={(e) => setEditingMetrics({ ...editingMetrics, weight: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Height</label>
                    <input
                      type="text"
                      value={editingMetrics.height}
                      onChange={(e) => setEditingMetrics({ ...editingMetrics, height: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                      placeholder="e.g. 165 cm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingMetrics.ageGroup}
                    onChange={(e) => setEditingMetrics({ ...editingMetrics, ageGroup: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                  >
                    {["Mini Sub-Junior Age Group 1", "Mini Sub-Junior Age Group 2", "Mini Sub-Junior Age Group 3", "Sub-Junior", "Cadet", "Junior", "Senior", "Veteran"].map((ag) => (
                      <option key={ag} value={ag}>{ag}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Belt</label>
                  <input
                    type="text"
                    value={editingMetrics.belt}
                    onChange={(e) => setEditingMetrics({ ...editingMetrics, belt: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                    placeholder="e.g. Green Belt"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Club</label>
                  <select
                    value={editingMetrics.clubId}
                    onChange={(e) => setEditingMetrics({ ...editingMetrics, clubId: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                  >
                    <option value="">— No Club —</option>
                    {clubOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Coach</label>
                  <select
                    value={editingMetrics.coachId}
                    onChange={(e) => setEditingMetrics({ ...editingMetrics, coachId: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 transition-colors font-bold text-slate-800"
                  >
                    <option value="">— No Coach —</option>
                    {coachOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingMetrics(null)}
                    className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingMetrics}
                    className="px-6 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-[#FFDA00] hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {savingMetrics ? "Saving..." : "Save Metrics"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Conclude Tournament Confirmation Modal ── */}
      <AnimatePresence>
        {isConcludeModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-4 text-red-600">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0 text-red-500">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">Conclude Category</h3>
                  <p className="text-sm font-semibold opacity-80">This action cannot be undone.</p>
                </div>
              </div>

              <div className="p-6">
                {(() => {
                  const categoryLabel = `${ageFilter !== "ALL" ? ageFilter : ""} · ${genderFilter === "FEMALE" ? "Girls" : "Boys"} · ${weightFilter !== "ALL" ? `${weightFilter}kg` : ""}`;
                  const otherDraws = Object.entries(draws).filter(([k, d]) => k !== currentKey && d.generated);
                  const isLastCategory = otherDraws.length === 0 || otherDraws.every(([, d]) => d.isConcluded);
                  return (
                    <p className="text-slate-600 font-medium leading-relaxed">
                      Are you sure you want to conclude <strong className="text-slate-900">{categoryLabel}</strong> and submit its final results?
                      {isLastCategory
                        ? <> This is the last remaining category, so it will also <strong className="text-slate-900">CLOSE</strong> the whole tournament and allow participants to download their certificates.</>
                        : <> Other categories in this tournament are unaffected and can still be concluded separately.</>}
                    </p>
                  );
                })()}

                <div className="pt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setIsConcludeModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleConcludeCategory(currentKey, filteredPlayers)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-500 text-white rounded-xl font-black shadow-lg shadow-red-500/20 hover:bg-red-600 hover:shadow-red-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    Yes, Conclude Category
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Custom Confirm Modal ── */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100"
            >
              <div className="p-6 bg-[#FF7400]/5 border-b border-[#FF7400]/10 flex items-center gap-4 text-[#FF7400]">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0 text-[#FF7400]">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black">{confirmModal.title}</h3>
                  <p className="text-sm font-semibold opacity-80">Please confirm your action</p>
                </div>
              </div>
              
              <div className="p-6">
                <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                  {confirmModal.message}
                </p>
                
                <div className="pt-8 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setConfirmModal({ isOpen: false, title: "", message: "" })}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmModal.action) confirmModal.action();
                      setConfirmModal({ isOpen: false, title: "", message: "" });
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#FF7400] text-white rounded-xl font-black shadow-lg shadow-[#FF7400]/20 hover:bg-orange-600 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    Proceed
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ══ DISQUALIFY ═════════════════════════════════════════════════════════ */}
      {activeTab === "disqualify" && !expired && (
        <DisqualifyTab
          players={players}
          tournamentId={tournamentId}
          onSuccess={() => fetchPlayers()}
        />
      )}
      {activeTab === "disqualify" && expired && (
        <ExpiredBlock label="Disqualify Players" />
      )}

      {/* ══ IMPORT WIZARD MODAL ════════════════════════════════════════════════ */}
      {isImportWizardOpen && (
        <ImportPlayersWizard
          tournamentId={tournamentId}
          onClose={() => setIsImportWizardOpen(false)}
          onSuccess={() => { fetchPlayers(); }}
        />
      )}

      {/* ══ ADD PLAYER MODAL ═══════════════════════════════════════════════════ */}
      {isAddPlayerOpen && (
        <AddPlayerModal
          tournamentId={tournamentId}
          onClose={() => setIsAddPlayerOpen(false)}
          onSuccess={() => { fetchPlayers(); showToast("Player added to tournament.", true); }}
        />
      )}

    </div>
  );
}
