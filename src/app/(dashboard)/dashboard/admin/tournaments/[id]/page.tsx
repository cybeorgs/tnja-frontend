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
  LayoutList, Upload, AlertTriangle, Scale,
  LayoutGrid, UserPlus, Grid3x3, Network, Ban, type LucideIcon,
  Timer, RotateCcw,
} from "lucide-react";
import type { BracketMatch, BracketSlot, DrawCategory, RegisteredPlayer, Seeds, Tab, Tournament, ViewMode } from "./types";
import {
  categoryKey, clubSeparatedShuffle, findNextMatch, generateIJFBracket, generateRoundRobin,
  isDrawRoundRobin, processByeMatches, backfillBronzeMatches, getRoundLabel, shuffleArray, bracketFromSlots,
  getEliminationFormatLabel, appendRepechageRounds, repechageKindOf, tagSmallRepechage, slotsFromDrawSetup, roundRobinRepeats, isMatchReady, compareWeights,
  applyMatchResult, mainBracketRoundCount, normaliseRounds, detectDrawPlacements, PLACEMENT_ORDER,
} from "./lib/bracketEngine";
import TimingModal from "./components/TimingModal";
import Tip from "./components/Tip";
import { fmtClock, timingOf } from "./lib/matchTiming";
import { exportAllMatchesToPDF, exportMatchToPDF, exportOverallTournamentReport, printRegistrationSlip, exportCategoryReport, exportCategoryChartPDF } from "./lib/pdfExport";
import { getRoundsStats } from "./lib/matchStats";
import { ExpiredBlock } from "./components/ExpiredBlock";
import { BracketView, RoundRobinLeaderboard } from "./components/BracketView";
import { ImportPlayersWizard } from "./components/ImportPlayersWizard";
import { AddPlayerModal } from "./components/AddPlayerModal";
import { DisqualifyTab } from "./components/DisqualifyTab";
import { WeighInTab } from "./components/WeighInTab";
import { PointsTab } from "./components/PointsTab";
import { CertificateTab } from "./components/CertificateTab";
import { ContestSheet } from "./components/ContestSheet";
import { BestPerformanceTab } from "./components/BestPerformanceTab";
import { DrawCategoryFilters } from "./components/DrawCategoryFilters";
import { MatsOfficialsPanel, matFromApi } from "./components/MatsOfficialsPanel";
import { CategoryStartBoard } from "./components/CategoryStartBoard";
import { EditDrawModal, canEditBracket, slotsFromRounds } from "./components/EditDrawModal";
import { RoundRobinEditModal, canEditRoundRobin, canCorrectLiveDraw } from "./components/RoundRobinEditModal";
import { CorrectBracketModal } from "./components/CorrectBracketModal";
import { ResetCategoryModal } from "./components/ResetCategoryModal";
/** A saved draw that can still be edited by hand: elimination (first round) or round robin (whole schedule). */
const canEditDraw = (rounds: BracketMatch[][]) => canEditBracket(rounds) || canEditRoundRobin(rounds);
import { DrawSetupModal, type DrawSetupChoice } from "./components/DrawSetupModal";
import { levelLabel } from "@/utils/tournamentLevel";

/** One category, passed explicitly when drawing from a category card. */
type DrawCat = { ageGroup: string; exactAge: string; gender: string; weightCategory: string; players: RegisteredPlayer[]; key: string; draw: DrawCategory | undefined };

type ConfirmModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  action?: () => void;
  /** What will happen, shown as a short list */
  steps?: { icon: React.ReactNode; title: string; text: string }[];
  /** One-line caution, e.g. that it can't be undone */
  warning?: string;
  confirmLabel?: string;
  tone?: "warning" | "danger";
};
const CLOSED_CONFIRM: ConfirmModalState = { isOpen: false, title: "", message: "" };

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type DrawMethod = "round-robin" | "straight-elimination" | "single-repechage" | "double-repechage";
/** Repechage formats can be chosen from 3 players. With 3–4 there is no quarter-final, so the repechage
 *  collapses to the semi-final losers' bronze match (see tagSmallRepechage). */
const REPECHAGE_MIN_PLAYERS = 3;
const isRepechage = (m: string) => m === "single-repechage" || m === "double-repechage";

/** The format a saved draw was actually made in. */
const drawMethodOf = (rounds: BracketMatch[][]): DrawMethod => {
  if (rounds[0]?.[0]?.matchId.startsWith("rr_")) return "round-robin";
  if (rounds[0]?.[0]?.formatHint) return rounds[0][0].formatHint;
  const kind = repechageKindOf(rounds);
  return kind === "double" ? "double-repechage" : kind === "single" ? "single-repechage" : "straight-elimination";
};

/**
 * What the format dropdown shows: the organiser's pick (if it is possible for this many players),
 * otherwise the format the draw was really made in, otherwise the default for the category size.
 */
const shownDrawMethod = (chosen: string | undefined | null, playerCount: number, rounds?: BracketMatch[][]): DrawMethod => {
  if (chosen && !(isRepechage(chosen) && playerCount < REPECHAGE_MIN_PLAYERS)) return chosen as DrawMethod;
  if (rounds?.length) return drawMethodOf(rounds);
  return playerCount <= 5 ? "round-robin" : "straight-elimination";
};

/** Weight categories are stored as "-60kg" or "60"; never print "kg kg". */
const fmtKg = (w: unknown) => { const v = String(w ?? "").trim(); return !v ? "" : /kg/i.test(v) ? v : `${v} kg`; };

const TAB_META: Record<Tab, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: LayoutGrid },
  players: { label: "Registrations", icon: UserPlus },
  mats: { label: "Mats", icon: Grid3x3 },
  "weigh-in": { label: "Weigh-In", icon: Scale },
  draws: { label: "Draw Generation", icon: Network },
  matches: { label: "Matches", icon: Swords },
  results: { label: "Results", icon: BarChart3 },
  certificate: { label: "Certificates", icon: Award },
  points: { label: "Points", icon: Medal },
  "best-performance": { label: "Best Performance", icon: Trophy },
  disqualify: { label: "Disqualify", icon: Ban },
};

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
  /** Results tab: which round sections are open (closed by default). */
  const [openResultRounds, setOpenResultRounds] = useState<Set<string>>(new Set());
  const toggleResultRound = (k: string) => setOpenResultRounds((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  // ── Modals State ────────────────────────────────────────────────────────────
  const [editingMetrics, setEditingMetrics] = useState<{ regId: string, weight: string, height: string, belt: string, clubId: string, coachId: string, ageGroup: string } | null>(null);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [clubOptions, setClubOptions] = useState<{ id: string; name: string }[]>([]);
  const [coachOptions, setCoachOptions] = useState<{ id: string; fullName: string }[]>([]);
  const [isConcludeModalOpen, setIsConcludeModalOpen] = useState(false);
  const [concludingCategoryKey, setConcludingCategoryKey] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(CLOSED_CONFIRM);

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // ── Mats & Referees State ──────────────────────────────────────────────────
  const [tournamentMats, setTournamentMats] = useState<{matNumber: number, refereeId: string, refereeName?: string, refereeCoachId?: string}[]>([]);
  const [savingMats, setSavingMats] = useState(false);
  const [loadingMats, setLoadingMats] = useState(false);
  const [matsCountInput, setMatsCountInput] = useState<string>("");
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
        setTournamentMats(data.mats.map(matFromApi));
        if (data.mats.length > 0) setMatsCountInput(data.mats.length.toString());
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

  // ── Auto-detect placements from draw results ─────────────────────────────────
  // Runs whenever the draws or players change (e.g. when Results tab is opened)
  const autoDetectPlacements = useCallback(() => {
    if (Object.keys(draws).length === 0 || players.length === 0) return;

    const detected: Record<string, "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION"> = {};

    // Start everyone as PARTICIPATION
    players.forEach((p) => { detected[p.id] = "PARTICIPATION"; });

    // Iterate over every draw category to find final + semi-final losers/winners
    for (const draw of Object.values(draws)) {
      if (!draw.rounds || draw.rounds.length === 0) continue;
      const catPlayers = players.filter(p =>
        p.status === "APPROVED" &&
        p.ageGroup === draw.ageGroup &&
        (draw.exactAge === 0 || p.exactAge === draw.exactAge) &&
        p.gender === draw.gender &&
        String(p.weight) === draw.weightCategory
      );
      // Medals only: a medal won in one draw is never reset by another draw the same player is in.
      for (const [id, placement] of Object.entries(detectDrawPlacements(draw.rounds, catPlayers.map(p => p.id)))) {
        if (placement !== "PARTICIPATION") detected[id] = placement;
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

  const handleDownloadCertificate = async (player: RegisteredPlayer, mode: "download" | "view" = "download") => {
    if (!player.regId) {
      showToast("This player has no registration record, so no certificate can be generated", false);
      return;
    }
    // Opened synchronously so the popup blocker treats it as part of the click
    const viewWindow = mode === "view" ? window.open("", "_blank") : null;
    try {
      showToast("Generating certificate...");
      const params = new URLSearchParams({ regId: player.regId });
      // Before the category is concluded, use the placement currently picked on screen
      if (placements[player.id]) params.set("placement", placements[player.id]);
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        viewWindow?.close();
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Failed to generate certificate", false);
        return;
      }
      const blob = new Blob([await res.blob()], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (viewWindow) {
        viewWindow.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return;
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = `${player.name.replace(/\s+/g, "_")}_certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoking synchronously can cancel the download before the browser picks up the blob
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error(err);
      viewWindow?.close();
      showToast("Error downloading certificate", false);
    }
  };

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const isFreeTournament = !!tournament && !(Number(tournament.entryFee) > 0);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  // Closing registration opens weigh-in. Categories are then started one by one by the organiser
  // (Draw Generation → Category start board). Mats and officials can be changed at any time.
  const handleCloseRegistration = () => {
    setConfirmModal({
      isOpen: true,
      title: "Close registration?",
      message: `${tournament?.title ?? "This tournament"} · ${players.length} player${players.length === 1 ? "" : "s"} registered`,
      steps: [
        { icon: <Lock size={16} />, title: "No new entries", text: "Players can no longer register or be imported." },
        { icon: <Scale size={16} />, title: "Weigh-in opens", text: "Weigh players in, one category at a time." },
        { icon: <PlayCircle size={16} />, title: "You start each category", text: "Make its draw after weigh-in, then start it when you are ready." },
      ],
      warning: "Registration can't be reopened after this.",
      confirmLabel: "Close registration",
      action: async () => {
        try {
          const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/start`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            showToast("Registration closed. Weigh-in is open.", true);
            fetchTournament();
            fetchPlayers();
            setActiveTab("weigh-in");
          } else {
            const err = await res.json().catch(() => null);
            showToast(err?.error || "Could not close registration", false);
          }
        } catch {
          showToast("Could not close registration", false);
        }
      },
    });
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

  /** Set once fetchDraws exists (declared further down). */
  const fetchDrawsRef = useRef<(() => void) | null>(null);
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
        fetchDrawsRef.current?.(); // a category change moves the player between draws
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
              weighInWeight: r.weighInWeight ?? null,
              weighInStatus: r.weighInStatus ?? null,
              representing: r.representing || "",
              representingDistrict: r.representingDistrict || "",
              representingUnit: r.representingUnit || "",
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
            rounds: normaliseRounds(roundsArr),
            generated: roundsArr.length > 0,
            saved: true,
          };
        });
        // A draw generated or edited here but not saved yet is kept as it is (the refresh runs on a timer)
        setDraws((prev) => {
          const merged = { ...drawMap };
          for (const [k, d] of Object.entries(prev)) if (d.saved === false) merged[k] = d;
          return merged;
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tournamentId, token]);
  useEffect(() => { fetchDrawsRef.current = fetchDraws; }, [fetchDraws]);

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

  // ── Edit a generated draw by hand (straight elimination, before the category starts) ──
  const [editingDrawKey, setEditingDrawKey] = useState<string | null>(null);
  /** Draw setup dialog (asked before an elimination draw): which format, and is it a redraw. */
  /** Draw setup dialog (fights / byes). `cat` is set when opened from a category card instead of the filtered view. */
  const [drawSetup, setDrawSetup] = useState<{ isRedraw: boolean; method: DrawMethod; cat?: DrawCat } | null>(null);
  const saveEditedDraw = async (key: string, d: DrawCategory, slots: (string | null)[]) => {
    const byId = new Map(players.map((p) => [p.id, p]));
    const main = bracketFromSlots(slots.map((id) => (id ? byId.get(id) ?? null : "BYE")));
    // A repechage draw keeps its format: rebuild the repechage + bronze rounds after the edited main bracket.
    const kind = repechageKindOf(d.rounds);
    const hint = d.rounds[0]?.[0]?.formatHint;
    const rounds = kind ? appendRepechageRounds(main, kind) : hint ? tagSmallRepechage(main, hint) : main;
    const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ageGroup: d.ageGroup, exactAge: d.exactAge ?? 0, gender: d.gender, weightCategory: d.weightCategory, matNumber: d.matNumber ?? 1, rounds }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not save the draw");
    let saved = data?.draw?.rounds ?? rounds;
    if (typeof saved === "string") { try { saved = JSON.parse(saved); } catch { saved = rounds; } }
    setDraws((p) => ({ ...p, [key]: { ...d, rounds: normaliseRounds(saved), generated: true, saved: true } }));
    showToast("Draw updated", true);
  };

  /** Save a hand-edited round robin schedule (pool order, pairings and play order decided by the organiser). */
  const [correctingKey, setCorrectingKey] = useState<string | null>(null);
  const [resettingKey, setResettingKey] = useState<string | null>(null);
  /** Players of a draw's category: those already in it plus approved players of the same category. */
  const categoryPlayersFor = (d: DrawCategory) => {
    const inDraw = new Set(d.rounds.flatMap((r) => r.flatMap((m) => [m.slotA.playerId, m.slotB.playerId])).filter((x): x is string => !!x));
    return players.filter((p) => inDraw.has(p.id) || (
      p.status === "APPROVED" && p.ageGroup === d.ageGroup && p.gender === d.gender &&
      String(p.weight) === d.weightCategory && (!d.exactAge || p.exactAge === d.exactAge)
    ));
  };
  /** Save a hand-edited draw; correction = a live (started) category, played matches unchanged. */
  const saveRoundRobinDraw = async (key: string, d: DrawCategory, rounds: BracketMatch[][], correction = false) => {
    const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ageGroup: d.ageGroup, exactAge: d.exactAge ?? 0, gender: d.gender, weightCategory: d.weightCategory, matNumber: d.matNumber ?? 1, rounds, ...(correction && { correction: true }) }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Could not save the draw");
    let saved = data?.draw?.rounds ?? rounds;
    if (typeof saved === "string") { try { saved = JSON.parse(saved); } catch { saved = rounds; } }
    setDraws((p) => ({ ...p, [key]: { ...d, rounds: normaliseRounds(saved), generated: true, saved: true } }));
    showToast(correction ? "Live draw corrected" : "Round robin updated", true);
  };

  /** Drag-and-drop on the bracket: swap two first-round places (BYEs included) and save. */
  const swapFirstRound = async (key: string, d: DrawCategory, from: number, to: number) => {
    const slots = slotsFromRounds(d.rounds);
    if (from < 0 || to < 0 || from >= slots.length || to >= slots.length) return;
    [slots[from], slots[to]] = [slots[to], slots[from]];
    try {
      await saveEditedDraw(key, d, slots);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save the draw", false);
    }
  };

  // ── Start / stop one category (the organiser decides which categories run) ──
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const [timingOpen, setTimingOpen] = useState(false);
  const toggleCategoryStart = async (key: string, d: DrawCategory, started: boolean) => {
    setStartingKey(key);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/draws/start`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ageGroup: d.ageGroup, exactAge: d.exactAge ?? 0, gender: d.gender, weightCategory: d.weightCategory, started }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not update the category");
      setDraws((p) => (p[key] ? { ...p, [key]: { ...p[key], startedAt: data.startedAt ?? null } } : p));
      showToast(data.message, true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update the category", false);
    } finally {
      setStartingKey(null);
    }
  };
  const isCurrentRoundRobin = !!currentDraw?.rounds[0]?.[0]?.matchId.startsWith("rr_");
  const effectiveViewMode: ViewMode = (viewMode === "leaderboard" && !isCurrentRoundRobin) || (viewMode === "sheet" && isCurrentRoundRobin) ? "bracket" : viewMode;

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
    explicitCat?: DrawCat,
    drawMethod?: DrawMethodType,
    /** From the draw setup dialog: who gets the byes (null = random). Uses the draw-number layout. */
    setup?: DrawSetupChoice
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

    // Every player in the category must clear weigh-in before the bracket is drawn
    const notWeighed = activePlayers.filter(p => p.weighInStatus !== "PASSED");
    if (notWeighed.length > 0) {
      showToast(`${notWeighed.length} of ${activePlayers.length} players in this category still need weigh-in. Finish the Weigh-In tab first.`, false);
      return;
    }

    if (!explicitCat && isMultiCategory) {
      showToast("Please select a specific category (Age, Gender, Weight) to Generate or Shuffle the draw.", false);
      return;
    }

    // Bye walkovers are auto-completed when the draw is made; only real bouts (two players) lock the draw.
    const isRealBout = (m: BracketMatch) => !!m.slotA.playerId && !!m.slotB.playerId && !m.slotA.isBye && !m.slotB.isBye;
    const hasActive = activeDraw?.rounds?.some(r => r.some(m => isRealBout(m) && (m.status === "COMPLETED" || m.status === "IN_PROGRESS")));
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
          title: "Re-shuffle this bracket?",
          message: "Players will be drawn into new positions.",
          warning: "All unsaved matches in this bracket will be lost.",
          confirmLabel: "Re-shuffle",
          tone: "danger",
          action: () => handleGenerateAndSaveDraw(isShuffle, true, explicitCat, selectedMethod)
        });
        return;
      }
    }

    setDrawPhase(isShuffle ? "shuffling" : "dealing");
    if (isShuffle) setShuffleKey(k => k + 1);

    let rounds;
    /** Shown with the "generated" toast when the chosen method had to be changed. */
    let drawNote = "";
    if (activePlayers.length === 1) {
      // Single-player category — no opponent to pair against, so just declare
      // a direct win. generateIJFBracket pairs the lone player against a BYE
      // slot, and processByeMatches auto-completes that as a walkover.
      rounds = processByeMatches(generateIJFBracket(activePlayers, seeds, "club-separated"));
    } else if (selectedMethod === "round-robin") {
      const shuffledPlayers = isShuffle ? shuffleArray(activePlayers) : activePlayers;
      rounds = generateRoundRobin(shuffledPlayers);
    } else {
      // With a setup choice, players get draw numbers (01 v 05, 03 v 07 | 02 v 06, 04 v 08) and the
      // organiser's byes; otherwise the earlier automatic bracket.
      const rawRounds = setup
        ? bracketFromSlots(slotsFromDrawSetup(activePlayers, setup.byeIds, setup.fights))
        : generateIJFBracket(isShuffle ? clubSeparatedShuffle(activePlayers) : activePlayers, seeds, "club-separated");
      rounds = processByeMatches(rawRounds);
      const wantsRepechage = selectedMethod === "single-repechage" || selectedMethod === "double-repechage";

      if (wantsRepechage && rounds.length < 3) {
        // Repechage is fed by quarter-final losers. A bracket of 4 or fewer has no quarter-final, so
        // no repechage round is added (its slots could never fill); the semi-final losers' bronze match
        // stands in for it and the draw is tagged with the chosen format.
        rounds = tagSmallRepechage(rounds, selectedMethod as "single-repechage" | "double-repechage");
        drawNote = selectedMethod === "double-repechage"
          ? `${activePlayers.length} players: no quarter-finals, so both semi-final losers take bronze (no bronze match).`
          : `${activePlayers.length} players: no quarter-finals, so the repechage is one bronze match between the semi-final losers.`;
      } else if (wantsRepechage) {
        // Repechage + bronze rounds come from the shared builder, so an edited draw rebuilds identically.
        rounds = appendRepechageRounds(rounds, selectedMethod === "double-repechage" ? "double" : "single");
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
          showToast(drawNote || (isShuffle ? "Bracket re-shuffled and auto-saved! 🏆" : "Draw generated and auto-saved! 🏆"));
        } else {
          const err = await res.json().catch(() => null);
          showToast(err?.error || "Failed to auto-save draw", false);
        }
      } catch { showToast("Error auto-saving draw", false); }
      finally { setSaving(false); }
    }, isShuffle ? 900 : 700);
  };

  const handleShuffle = () => handleGenerateAndSaveDraw(true);
  const handleGenerateDraw = () => handleGenerateAndSaveDraw(false);



  /** Open a category's draw on its own view-only page in a new browser tab. */
  const openDrawView = (d: DrawCategory, print = false) => {
    const q = new URLSearchParams({ age: d.ageGroup, gender: d.gender, weight: d.weightCategory, ...(print && { print: "1" }) });
    window.open(`/dashboard/admin/tournaments/${tournamentId}/draw-view?${q.toString()}`, "_blank", "noopener");
  };

  const openScoreboard = (match: BracketMatch) => {
    const owner = Object.values(draws).find((d) => d.rounds.some((r) => r.some((m) => m.matchId === match.matchId)));
    if (owner && !owner.startedAt) {
      showToast(`${owner.ageGroup} ${owner.weightCategory} hasn't started yet. Press Start for it on the Category start board (Draw Generation tab) to open its scoreboards.`, false);
      return;
    }
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
    elapsedSeconds?: number,
    /** false when the scoreboard has already saved this result: update the screen only */
    persist = true
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
        if (persist) alert("This match is already completed and locked. You cannot change the winner.");
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

      const totalMainRounds = mainBracketRoundCount(newRounds);

      if (!isRR) {
        // Winner on to the next match, repechage and bronze rounds rebuilt (shared with the scoreboard)
        applyMatchResult(newRounds, matchId, newRounds[foundRi][foundMi]).forEach((row, i) => { newRounds[i] = row; });
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
        if (foundRi === totalMainRounds - 1 && foundMi === 0) {
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
    if (affectedCatKey && persist) {
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
      // The scoreboard saves the result itself; show it at once, then re-read the saved draw
      // (saving our own copy too could overwrite newer results from other devices).
      if (matchId && winnerName) handleMatchResult(matchId, winnerId, winnerName, winnerClub, scoreA, scoreB, winMethod, elapsedSeconds, false);
      setTimeout(fetchDraws, 1500);
    };
    return () => channel.close();
  }, [handleMatchResult, fetchDraws]);

  // Results saved by referees on other devices: refresh the draws every 15 s and on focus
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") fetchDraws(); };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [fetchDraws]);

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
  const availableWeightsGlobal = [...new Set(groupPlayersGlobal.map(p => String(p.weight)))].sort(compareWeights);

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
      </AnimatePresence>

      {/* Header + tabs stay pinned while the tab content scrolls underneath */}
      <div className="sticky -top-8 z-30 -mt-8 -mx-8 print:static bg-white border-b border-slate-200">
        <div className="px-8 pt-5 pb-3 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="text-xl lg:text-2xl font-black text-slate-900 leading-tight">{tournament?.title || "Tournament"}</h1>
                {tournament && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-black uppercase tracking-wide whitespace-nowrap">
                    <Trophy size={12} /> {(() => {
                      const lvl = levelLabel(tournament.level, tournament.levelOther);
                      return /tournament/i.test(lvl) ? lvl : `${lvl} Tournament`;
                    })()}
                  </span>
                )}
              </div>
              {tournament && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm font-medium text-slate-500">
                  {[
                    { icon: Calendar, value: new Date(tournament.date).toLocaleDateString("en-GB"), label: "Date" },
                    { icon: MapPin, value: tournament.location, label: "Venue" },
                    { icon: Users, value: `${players.length} ${players.length === 1 ? "player" : "players"} registered`, label: "Registrations" },
                  ].map(({ icon: Icon, value, label }, i) => (
                    <span key={label} className="inline-flex items-center gap-3 min-w-0">
                      {i > 0 && <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden />}
                      <span title={label} className="inline-flex items-center gap-1.5 min-w-0">
                        <Icon size={15} className="text-[#FF7400] shrink-0" />
                        <span className="truncate max-w-[16rem]">{value}</span>
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {tournament && (
            <div className="flex items-center gap-3 shrink-0 lg:self-center pl-[60px] lg:pl-0">
              {tournament.status === "CLOSED" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-xs">
                  <Check size={14} /> Concluded · certificates available
                </span>
              ) : tournament.registrationClosed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold text-xs">
                  <Lock size={13} /> Registration closed
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Registration open
                  </span>
                  <button
                    onClick={handleCloseRegistration}
                    className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#FF7400] hover:bg-orange-600 text-white font-bold rounded-xl transition-colors text-sm"
                  >
                    <Lock size={14} /> Close Registration
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <nav aria-label="Tournament sections" className="px-8 print:hidden">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {(["overview", "players", "mats", "weigh-in", "draws", "matches", "results", "certificate", "points", "best-performance", "disqualify"] as Tab[]).map((tab) => {
              // Results tab is ALWAYS accessible — even for expired/CLOSED tournaments
              // Draws and matches are locked once the tournament date has passed
              const lockedByExpiry = expired && (tab === "draws" || tab === "matches");
              const active = activeTab === tab;
              const { label, icon: Icon } = TAB_META[tab];
              return (
                <button
                  key={tab}
                  onClick={() => !lockedByExpiry && setActiveTab(tab)}
                  title={lockedByExpiry ? "Not available — tournament has expired" : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex items-center gap-2 px-3.5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    lockedByExpiry
                      ? "border-transparent text-slate-300 cursor-not-allowed"
                      : active
                      ? "border-[#FF7400] text-[#FF7400]"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-200"
                  }`}
                >
                  {lockedByExpiry ? <Lock size={15} /> : <Icon size={16} className={active ? "text-[#FF7400]" : tab === "players" ? "text-[#FF7400]" : "text-slate-400"} />}
                  {label}
                  {tab === "players" && (
                    <span className={`min-w-[24px] h-6 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-black border ${
                      active ? "bg-[#FF7400] border-[#FF7400] text-white" : "bg-orange-50 border-orange-200 text-[#FF7400]"
                    }`}>
                      {players.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
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
                  { l: "LEVEL", v: levelLabel(tournament.level, tournament.levelOther) },
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
          selectedMatForAssignment={selectedMatForAssignment}
          setSelectedMatForAssignment={setSelectedMatForAssignment}
          refSearchQuery={refSearchQuery}
          setRefSearchQuery={setRefSearchQuery}
          refSearchResults={refSearchResults}
          refSearching={refSearching}
          refreshRefSearch={() => setRefSearchRefreshKey((k) => k + 1)}
          savingMats={savingMats}
          setSavingMats={setSavingMats}
          showToast={showToast}
        />
      )}
      {/* ══ WEIGH-IN & DISQUALIFICATION ═════════════════════════════════════════════════ */}
      {activeTab === "weigh-in" && tournament && (
        <WeighInTab
          tournamentId={tournamentId}
          players={players}
          registrationClosed={!!tournament.registrationClosed}
          onChanged={() => { fetchPlayers(); fetchDraws(); }}
          showToast={showToast}
        />
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
                {/* Once the tournament has started no new players can be entered */}
                {tournament?.registrationClosed ? (
                  <span className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-500 font-bold rounded-xl text-sm">
                    <Lock size={16} />
                    <span className="hidden md:inline">Registration closed</span>
                  </span>
                ) : (
                  <>
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
                  </>
                )}
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
                      <React.Fragment key={p.regId || p.id}>
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
                            {/* Free tournaments mark registrations paid so they pass the payment check; show them as Free. */}
                            {isFreeTournament ? (
                              <span className="bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Free</span>
                            ) : p.isPaid ? (
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
                              onClick={() => setExpandedPlayerId(expandedPlayerId === (p.regId || p.id) ? null : (p.regId || p.id))}
                              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button onClick={() => openEditMetricsModal(p)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Edit"><Edit2 size={16} /></button>
                            <button onClick={() => printRegistrationSlip(p, tournament)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors" title="Print"><Printer size={16} /></button>
                          </td>
                        </tr>
                        {expandedPlayerId === (p.regId || p.id) && p.regId && (
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
                                        { l: "Payment", v: isFreeTournament ? "Free" : p.isPaid ? "Paid" : "Unpaid" },
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
          <CategoryStartBoard
            draws={draws}
            registrationClosed={!!tournament?.registrationClosed}
            busyKey={startingKey}
            onToggle={toggleCategoryStart}
          />
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
                                  value={shownDrawMethod(categoryDrawMethod[key], catDrawPlayers.length, draw?.generated ? draw.rounds : undefined)}
                                  onChange={(e) => setCategoryDrawMethod(prev => ({ ...prev, [key]: e.target.value as DrawMethod }))}
                                  className="px-2.5 py-1.5 text-[11px] font-bold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/20 transition-all cursor-pointer"
                                >
                                  <option value="round-robin">1.Round Robin</option>
                                  <option value="straight-elimination">2.Straight elimination</option>
                                  <option value="single-repechage" disabled={catDrawPlayers.length < REPECHAGE_MIN_PLAYERS}>3.Single Repechage{catDrawPlayers.length < REPECHAGE_MIN_PLAYERS ? ` (${REPECHAGE_MIN_PLAYERS}+ players)` : ""}</option>
                                  <option value="double-repechage" disabled={catDrawPlayers.length < REPECHAGE_MIN_PLAYERS}>4.Double Repechage{catDrawPlayers.length < REPECHAGE_MIN_PLAYERS ? ` (${REPECHAGE_MIN_PLAYERS}+ players)` : ""}</option>
                                </select>
                              )}
                              <button
                                onClick={() => {
                                  // Same method the dropdown shows (it reflects an existing draw's format)
                                  const selectedMethod = shownDrawMethod(categoryDrawMethod[key], catDrawPlayers.length, draw?.generated ? draw.rounds : undefined);
                                  const cat: DrawCat = { ageGroup, exactAge, gender, weightCategory: weight, players: catDrawPlayers, key, draw };
                                  // Elimination formats ask first: how many fights / byes, and who gets the byes.
                                  if (selectedMethod !== "round-robin" && catDrawPlayers.length >= 3) {
                                    setDrawSetup({ isRedraw: !!draw?.generated, method: selectedMethod, cat });
                                    return;
                                  }
                                  handleGenerateAndSaveDraw(!!draw?.generated, false, cat, selectedMethod);
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
                              {draw?.generated && (
                                <button
                                  onClick={() => openDrawView(draw)}
                                  title="Open this draw in a new tab, view only"
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#FF7400] text-[#FF7400] rounded-lg font-bold text-xs hover:bg-orange-50 transition-colors"
                                >
                                  <Eye size={13} /> View Draw ↗
                                </button>
                              )}
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
                          const effectiveCatViewMode: ViewMode = (catViewMode === "leaderboard" && !isCatRoundRobin) || (catViewMode === "sheet" && isCatRoundRobin) ? "bracket" : catViewMode;
                          return (
                          <div className="border-t border-slate-50">
                            <div className="flex items-center justify-between px-5 pt-4">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                {effectiveCatViewMode === "bracket" ? "Bracket" : effectiveCatViewMode === "sheet" ? "Contest Sheet" : effectiveCatViewMode === "list" ? "Match List" : "Leaderboard"}
                              </h4>
                              <div className="flex items-center gap-2">
                                {draw.saved && !draw.startedAt && !draw.isConcluded && canEditDraw(draw.rounds) && (
                                  <button
                                    onClick={() => setEditingDrawKey(key)}
                                    title={canEditRoundRobin(draw.rounds) ? "Drag players and matches, decide who fights whom (before Start)" : "Change first-round pairings and who gets a BYE (before Start)"}
                                    className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
                                  >
                                    <Edit2 size={13} /> Edit draw
                                  </button>
                                )}
                                <button
                                  onClick={() => exportCategoryChartPDF(tournament, key, draw, catDrawPlayers)}
                                  title="Download bracket chart (PDF)"
                                  aria-label="Download bracket chart (PDF)"
                                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#FF7400] hover:border-orange-200 transition-colors"
                                >
                                  <Download size={16} />
                                </button>
                                <button
                                  onClick={() => exportCategoryReport(tournament, key, draw, catDrawPlayers)}
                                  title="Print match report"
                                  aria-label="Print match report"
                                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#FF7400] hover:border-orange-200 transition-colors"
                                >
                                  <Printer size={16} />
                                </button>
                                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                  {(isCatRoundRobin ? (["bracket", "list", "leaderboard"] as ViewMode[]) : (["bracket", "sheet", "list"] as ViewMode[])).map((v) => (
                                    <button key={v} onClick={() => setCategoryViewMode(prev => ({ ...prev, [key]: v }))}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${effectiveCatViewMode === v ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-400"}`}>
                                      {v === "bracket" ? <><Grid size={12} className="inline mr-1" />Bracket</>
                                        : v === "sheet" ? <><LayoutList size={12} className="inline mr-1" />Sheet</>
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
                            ) : effectiveCatViewMode === "sheet" ? (
                            /* Contest Sheet View */
                            <div className="p-5 pb-8 bg-white">
                              <SheetPrintBar onPrint={() => openDrawView(draw, true)} />
                              <ContestSheet rounds={draw.rounds} players={catDrawPlayers} />
                            </div>
                            ) : effectiveCatViewMode === "bracket" ? (
                            /* Bracket View */
                            <div className="p-5 pb-8 bg-slate-50/30">
                              <BracketView
                                rounds={draw.rounds}
                                onOpenScoreboard={openScoreboard}
                                onSwapFirstRound={draw.saved && !draw.startedAt && !draw.isConcluded && canEditBracket(draw.rounds) ? (a, b) => swapFirstRound(key, draw, a, b) : undefined}
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
                                                {isBronze && <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-sm inline-block w-max mt-1">🥉 BRONZE</span>}
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
                                            {isMatchReady(match) && (
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
                {/* Category toolbar: everything for this category in one place */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {drawPlayers.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-slate-500 font-bold">No players in this category</p>
                    <p className="text-slate-400 text-sm mt-1">Pick another category above.</p>
                  </div>
                ) : (() => {
                  const locked = !!currentDraw?.startedAt;
                  const busy = drawPhase === "shuffling" || drawPhase === "dealing" || autoGenerating;
                  const generated = !!currentDraw?.generated;
                  const status = currentDraw?.isConcluded ? "finished" : locked ? "live" : generated ? "ready" : "none";
                  const catTitle = [ageFilter !== "ALL" ? ageFilter : "", genderFilter === "FEMALE" ? "Girls" : genderFilter === "MALE" ? "Boys" : "", weightFilter !== "ALL" ? fmtKg(weightFilter) : ""].filter(Boolean).join(" · ") || "All players";
                  const formatLabel = generated && currentDraw ? (isCurrentRoundRobin ? "Round Robin" : getEliminationFormatLabel(currentDraw.rounds)) : "";
                  return (
                    <>
                      {/* Title + facts */}
                      <div className="px-5 pt-4 pb-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-800">{catTitle}</h3>
                            {status === "live" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Live
                              </span>
                            )}
                            {status === "finished" && <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700">Finished</span>}
                            {status === "ready" && <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-500">Not started</span>}
                          </div>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            {drawPlayers.length} {drawPlayers.length === 1 ? "player" : "players"}
                            {formatLabel && <> · {formatLabel}</>}
                          </p>
                        </div>
                      </div>

                      {/* Toolbar: setup | draw | output | view, all on one line */}
                      <div className="flex flex-wrap items-center gap-2 px-5 pb-4 border-b border-slate-100">
                        {/* Mat */}
                        <Tip text="Mat (and its referee) where this category's matches are played" align="start">
                        <label className="flex items-center gap-1.5 h-9 pl-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-black tracking-wider text-slate-400">MAT</span>
                          <span className="text-xs font-bold text-slate-400">Mat</span>
                          <span className="relative">
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
                              className="h-[34px] pl-1 pr-8 text-sm font-bold bg-transparent text-slate-700 rounded-lg outline-none cursor-pointer appearance-none"
                            >
                              {(tournamentMats.length > 0 ? tournamentMats.map(m => m.matNumber).sort((a, b) => a - b) : [1]).map(m => {
                                const refName = tournamentMats.find(tm => tm.matNumber === m)?.refereeName;
                                return <option key={m} value={m}>{m}{refName ? ` — ${refName}` : ""}</option>;
                              })}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </span>
                        </label>
                        </Tip>

                        {/* Scoreboard timing */}
                        {(() => {
                          const tm = timingOf(currentDraw);
                          const canSet = !!currentDraw?.saved && !currentDraw?.isConcluded;
                          return (
                            <Tip text={canSet ? `Scoreboard timing: ${fmtClock(tm.duration)} match, golden score ${tm.goldenLimit ? "max " + fmtClock(tm.goldenLimit) : "unlimited"}${tm.custom ? "" : " (age group default)"}. Click to change.` : "Save the draw first, then set the match time"}>
                            <button
                              onClick={() => canSet && setTimingOpen(true)}
                              disabled={!canSet}
                              aria-label="Scoreboard timing"
                              className="h-9 px-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 text-sm font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Timer size={15} />
                              <span className="tabular-nums">{fmtClock(tm.duration)}</span>
                              <span className="text-[11px] font-semibold text-indigo-400">GS {tm.goldenLimit ? fmtClock(tm.goldenLimit) : "∞"}</span>
                            </button>
                            </Tip>
                          );
                        })()}
                        {timingOpen && currentDraw && (
                          <TimingModal
                            tournamentId={tournamentId}
                            token={token}
                            draw={currentDraw}
                            title={catTitle}
                            onClose={() => setTimingOpen(false)}
                            onSaved={(saved, message) => {
                              setDraws((prev) => {
                                const next = { ...prev };
                                for (const d of saved) {
                                  const k = categoryKey(d.ageGroup, d.exactAge === 0 ? "ALL" : String(d.exactAge), d.gender, d.weightCategory);
                                  if (next[k]) next[k] = { ...next[k], matchDuration: d.matchDuration, goldenScoreLimit: d.goldenScoreLimit };
                                }
                                return next;
                              });
                              setTimingOpen(false);
                              showToast(message, true);
                            }}
                          />
                        )}

                        {/* Draw controls (hidden once the category has started) */}
                        {!locked && drawPlayers.length > 1 && (
                          <Tip text="Draw format used when you generate or redraw">
                          <span className="relative">
                            <select
                              value={shownDrawMethod(detailDrawMethod, drawPlayers.length, generated ? currentDraw?.rounds : undefined)}
                              onChange={(e) => setDetailDrawMethod(e.target.value as DrawMethodType)}
                              aria-label="Draw format"
                              className="h-9 pl-3 pr-8 text-sm font-bold bg-white border border-slate-200 text-slate-700 rounded-lg outline-none focus:border-[#FF7400] hover:border-slate-300 cursor-pointer appearance-none"
                            >
                              <option value="round-robin">Round Robin</option>
                              <option value="straight-elimination">Straight Elimination</option>
                              <option value="single-repechage" disabled={drawPlayers.length < REPECHAGE_MIN_PLAYERS}>Single Repechage{drawPlayers.length < REPECHAGE_MIN_PLAYERS ? ` (${REPECHAGE_MIN_PLAYERS}+ players)` : ""}</option>
                              <option value="double-repechage" disabled={drawPlayers.length < REPECHAGE_MIN_PLAYERS}>Double Repechage{drawPlayers.length < REPECHAGE_MIN_PLAYERS ? ` (${REPECHAGE_MIN_PLAYERS}+ players)` : ""}</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </span>
                          </Tip>
                        )}

                        {!locked && <span className="hidden md:block w-px h-7 bg-slate-200 mx-1" aria-hidden />}
                        {!locked && !(drawPlayers.length === 1 && generated) && (
                          <Tip text={drawPlayers.length === 1 ? "Only one player: declare them the winner" : generated ? "Draw again with the selected format (replaces the current draw)" : "Make the draw with the selected format"}>
                          <button
                            onClick={() => {
                              const method = shownDrawMethod(detailDrawMethod, drawPlayers.length, generated ? currentDraw?.rounds : undefined);
                              // Elimination formats ask first: how many fights / byes, and who gets the byes.
                              if (method !== "round-robin" && drawPlayers.length >= 3) setDrawSetup({ isRedraw: generated, method });
                              else if (generated) handleShuffle();
                              else handleGenerateDraw();
                            }}
                            disabled={busy}
                            className={`h-9 inline-flex items-center gap-1.5 px-4 rounded-lg text-sm font-black transition-colors disabled:opacity-50 ${
                              generated ? "bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400" : "bg-[#FF7400] text-white hover:bg-orange-600"
                            }`}
                          >
                            {busy ? <Loader2 size={15} className="animate-spin" />
                              : drawPlayers.length === 1 ? <Trophy size={15} /> : <Shuffle size={15} />}
                            {drawPlayers.length === 1 ? "Declare winner" : generated ? "Redraw" : "Generate draw"}
                          </button>
                          </Tip>
                        )}
                        {generated && currentDraw?.saved && !locked && canEditDraw(currentDraw.rounds) && (
                          <Tip text={canEditRoundRobin(currentDraw.rounds) ? "Drag players and matches, and decide who fights whom (only before Start)" : "Change first-round pairings and who gets a BYE (only before Start)"}>
                          <button
                            onClick={() => setEditingDrawKey(currentKey)}
                            className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                          >
                            <Edit2 size={14} /> Edit draw
                          </button>
                          </Tip>
                        )}

                        {/* Start this category right here (also on the Category start board above) */}
                        {generated && currentDraw?.saved && !locked && !currentDraw.isConcluded && (
                          <Tip text={!tournament?.registrationClosed ? "Close registration first, then start categories" : "Start this category: the draw locks and its scoreboards open"}>
                          <button
                            onClick={() => toggleCategoryStart(currentKey, currentDraw, true)}
                            disabled={startingKey === currentKey || busy || !tournament?.registrationClosed}
                            className="h-9 inline-flex items-center gap-1.5 px-4 rounded-lg text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {startingKey === currentKey ? <Loader2 size={15} className="animate-spin" /> : <PlayCircle size={15} />} Start
                          </button>
                          </Tip>
                        )}

                        {/* Live correction: the draw was made wrong and matches are already being played */}
                        {generated && currentDraw && locked && !currentDraw.isConcluded && canCorrectLiveDraw(currentDraw.rounds) && (
                          <Tip text="Category is live: change the players of matches not played yet. Played matches and results stay locked.">
                            <button
                              onClick={() => setCorrectingKey(currentKey)}
                              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-colors"
                            >
                              <Edit2 size={14} /> Correct draw
                            </button>
                          </Tip>
                        )}
                        {/* Reset: stop the category and clear its draw + results, to draw it again */}
                        {generated && currentDraw && locked && !currentDraw.isConcluded && (
                          <Tip text="Stop this category and clear its draw and all its results, so you can redraw and start again (organiser only)">
                            <button
                              onClick={() => setResettingKey(currentKey)}
                              className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                              <RotateCcw size={14} /> Reset category
                            </button>
                          </Tip>
                        )}

                        {/* Output + view */}
                        {generated && currentDraw && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="hidden md:block w-px h-7 bg-slate-200 mx-1" aria-hidden />
                            <Tip text="Open this draw in a new tab (view only, with the draw animation)">
                            <button
                              onClick={() => openDrawView(currentDraw)}
                              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 text-[#E85D00] text-sm font-bold hover:bg-orange-100 hover:border-orange-400 transition-colors"
                            >
                              <Eye size={15} /> View Draw ↗
                            </button>
                            </Tip>
                            <Tip text="Download the bracket chart as a PDF (portrait or landscape)">
                            <button
                              onClick={() => exportCategoryChartPDF(tournament, currentKey, currentDraw, filteredPlayers)}
                              aria-label="Download bracket chart (PDF)"
                              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-sm font-bold hover:bg-sky-100 hover:border-sky-300 transition-colors"
                            >
                              <Download size={15} /> Chart PDF
                            </button>
                            </Tip>
                            <Tip text="Print the match report for this category">
                            <button
                              onClick={() => exportCategoryReport(tournament, currentKey, currentDraw, filteredPlayers)}
                              aria-label="Print match report"
                              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 text-sm font-bold hover:bg-violet-100 hover:border-violet-300 transition-colors"
                            >
                              <Printer size={15} /> Report
                            </button>
                            </Tip>
                            <span className="hidden md:block w-px h-7 bg-slate-200 mx-1" aria-hidden />
                            <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg">
                              {(isCurrentRoundRobin ? (["bracket", "list", "leaderboard"] as ViewMode[]) : (["bracket", "sheet", "list"] as ViewMode[])).map((v) => (
                                <Tip key={v} text={v === "bracket" ? "Bracket view: the tree of all rounds" : v === "sheet" ? "Sheet view: one-page contest sheet, left and right halves" : v === "list" ? "List view: every match, round by round" : "Standings: round robin table"} align="end">
                                <button
                                  onClick={() => setViewMode(v)}
                                  className={`h-8 px-3 rounded-md text-xs font-bold inline-flex items-center gap-1 transition-colors ${effectiveViewMode === v ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                >
                                  {v === "bracket" ? <><Grid size={12} />Bracket</> : v === "sheet" ? <><LayoutList size={12} />Sheet</> : v === "list" ? <><List size={12} />List</> : <><BarChart3 size={12} />Standings</>}
                                </button>
                                </Tip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Round robin with a repeated pairing still to be fought (e.g. left by the old winner-advance bug) */}
                      {generated && currentDraw && !currentDraw.isConcluded && (() => {
                        const { repeats } = roundRobinRepeats(currentDraw.rounds);
                        const open = repeats.filter((x) => x.match.status === "PENDING");
                        if (!open.length) return null;
                        const canFix = locked ? canCorrectLiveDraw(currentDraw.rounds) : canEditDraw(currentDraw.rounds);
                        return (
                          <div className="mx-5 mt-3 flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200">
                            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                            <p className="flex-1 min-w-0 text-sm font-bold text-rose-700">
                              {open.map((x) => `Round ${x.round}: ${x.match.slotA.playerName} v ${x.match.slotB.playerName}`).join(", ")}
                              {" "}repeat{open.length === 1 ? "s" : ""} a pairing that already happened. Each pair should meet only once.
                            </p>
                            {canFix && (
                              <button
                                onClick={() => (locked ? setCorrectingKey(currentKey) : setEditingDrawKey(currentKey))}
                                className="h-8 px-3 rounded-lg text-xs font-black text-white bg-rose-600 hover:bg-rose-700"
                              >
                                Fix now
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Players */}
                      <div className="px-5 py-3 flex flex-wrap gap-2">
                        {drawPlayers.map((p, i) => (
                          <motion.div
                            key={`${p.id}-${shuffleKey}`}
                            layoutId={`player-card-${p.id}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{
                              opacity: 1,
                              y: drawPhase === "shuffling" ? [0, -8, 5, 0] : 0,
                              rotate: drawPhase === "shuffling" ? [0, (i % 2 === 0 ? -4 : 4), 0] : 0,
                            }}
                            transition={{
                              opacity: { delay: i * 0.03, duration: 0.25 },
                              y: drawPhase === "shuffling" ? { duration: 0.6, delay: i * 0.04 } : { delay: i * 0.03, duration: 0.3 },
                              rotate: drawPhase === "shuffling" ? { duration: 0.6, delay: i * 0.04 } : { duration: 0.2 },
                            }}
                            className="group inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-slate-200 bg-white"
                          >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] text-white shrink-0 ${p.gender === "FEMALE" ? "bg-pink-400" : "bg-blue-500"}`}>
                              {p.name.charAt(0)}
                            </span>
                            <span className="text-xs font-bold text-slate-700 max-w-[10rem] truncate" title={`${p.name} · ${p.club || p.district}`}>{p.name}</span>
                            <span className="text-[11px] font-semibold text-slate-400">{fmtKg(p.weight)}</span>
                            {([1, 2, 3, 4] as const).map((s) => seeds[s]?.id === p.id && (
                              <span key={s} className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">S{s}</span>
                            ))}
                            <button
                              onClick={() => openEditMetricsModal(p)}
                              aria-label={`Edit ${p.name}'s weight`}
                              className="text-slate-300 hover:text-[#FF7400] transition-colors"
                            >
                              <Edit2 size={11} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  );
                })()}
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
                ) : effectiveViewMode === "sheet" ? (
                  <div className="p-5 pb-8 bg-white">
                    <SheetPrintBar onPrint={() => openDrawView(currentDraw, true)} />
                    <ContestSheet rounds={currentDraw.rounds} players={filteredPlayers} />
                  </div>
                ) : effectiveViewMode === "list" ? (
                  <div className="p-5">
                    <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-500">
                        Total {currentDraw.rounds.reduce((acc, r) => acc + r.length, 0)} Matches across {currentDraw.rounds.length} Rounds
                      </span>
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
                                  {isBronze && <span className="text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-sm inline-block w-max mt-1">🥉 BRONZE</span>}
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
                              {isMatchReady(match) && (
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
                      onSwapFirstRound={currentDraw.saved && !currentDraw.startedAt && !currentDraw.isConcluded && canEditBracket(currentDraw.rounds) ? (a, b) => swapFirstRound(currentKey, currentDraw, a, b) : undefined}
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
                    <div key={ri} className="bg-white rounded-[2px] border border-slate-100 shadow-lg shadow-slate-200/40 overflow-hidden">
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
                          {isMatchReady(match) && (
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
          <DrawCategoryFilters
                variant="compact"
                trailing={
                  <button
                    onClick={() => exportOverallTournamentReport(tournament, players, draws, placements)}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-orange-200 bg-orange-50 text-[#FF7400] text-sm font-bold hover:bg-orange-100 transition-colors"
                  >
                    <Printer size={15} /> Completion report
                  </button>
                }
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
                    {/* Gold, Silver, Bronze, then participants (stable sort keeps their order otherwise). */}
                    {[...filteredPlayers]
                      .sort((a, b) => (PLACEMENT_ORDER[placements[a.id] || "PARTICIPATION"] ?? 99) - (PLACEMENT_ORDER[placements[b.id] || "PARTICIPATION"] ?? 99))
                      .map((player) => {
                      const placement = placements[player.id] || "PARTICIPATION";
                      // Medal cards: each place has its own metal, badge and glow
                      const medal: Record<string, { card: string; badge: string; tag: string; label: string; rank: string; name: string; sub: string }> = {
                        FIRST: {
                          card: "border-yellow-300 bg-gradient-to-br from-yellow-100 via-amber-50 to-yellow-200 shadow-[0_6px_20px_rgba(234,179,8,0.25)]",
                          badge: "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 text-yellow-950 ring-4 ring-yellow-200 shadow-[0_0_14px_rgba(234,179,8,0.6)]",
                          tag: "bg-amber-500 text-white", label: "GOLD", rank: "1", name: "text-amber-900", sub: "text-amber-700/80",
                        },
                        SECOND: {
                          card: "border-slate-300 bg-gradient-to-br from-slate-100 via-white to-slate-200 shadow-[0_6px_20px_rgba(100,116,139,0.18)]",
                          badge: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-500 text-slate-900 ring-4 ring-slate-200 shadow-[0_0_12px_rgba(148,163,184,0.6)]",
                          tag: "bg-slate-500 text-white", label: "SILVER", rank: "2", name: "text-slate-800", sub: "text-slate-500",
                        },
                        THIRD: {
                          card: "border-orange-300 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-200 shadow-[0_6px_20px_rgba(194,65,12,0.18)]",
                          badge: "bg-gradient-to-br from-orange-300 via-orange-500 to-amber-800 text-white ring-4 ring-orange-200 shadow-[0_0_12px_rgba(234,88,12,0.5)]",
                          tag: "bg-orange-700 text-white", label: "BRONZE", rank: "3", name: "text-orange-950", sub: "text-orange-800/70",
                        },
                        PARTICIPATION: {
                          card: "border-slate-200 bg-white", badge: "bg-slate-100 text-slate-400", tag: "", label: "", rank: "", name: "text-slate-800", sub: "text-slate-400",
                        },
                      };
                      const md = medal[placement] ?? medal.PARTICIPATION;
                      return (
                        <motion.div
                          key={player.id}
                          layout
                          whileHover={{ y: -2 }}
                          className={`relative flex items-center gap-3 p-3 rounded-2xl border overflow-hidden transition-shadow ${md.card}`}
                        >
                          {md.label && <span aria-hidden className="pointer-events-none absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/40" />}
                          <div className={`relative w-11 h-11 rounded-full flex items-center justify-center font-black text-base shrink-0 ${md.badge}`}>
                            {md.rank || player.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <p className={`text-sm font-black truncate ${md.name}`}>{player.name}</p>
                              {md.label && <span className={`shrink-0 text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded ${md.tag}`}>{md.label}</span>}
                            </div>
                            <p className={`text-[11px] font-semibold truncate ${md.sub}`}>{player.club || player.district}</p>
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
                            onClick={() => handleDownloadCertificate(player, "view")}
                            title="View certificate"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold shrink-0 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            onClick={() => handleDownloadCertificate(player)}
                            title="Download certificate"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-bold shrink-0 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
                          >
                            <Download size={14} />
                          </button>
                        </motion.div>
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
                      .sort((a, b) => (PLACEMENT_ORDER[a.placement || ""] || 99) - (PLACEMENT_ORDER[b.placement || ""] || 99))
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

                    const roundKey = `${key}|${ri}`;
                    const open = openResultRounds.has(roundKey);
                    const isRR = isDrawRoundRobin(draw);
                    return (
                      <div key={ri} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <button
                          onClick={() => toggleResultRound(roundKey)}
                          aria-expanded={open}
                          title={open ? "Hide the results of this round" : "Show the results of this round"}
                          className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white flex items-center gap-3 text-left hover:from-emerald-700 hover:to-emerald-600 transition-colors"
                        >
                          <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                          <span className="font-black text-sm flex-1">{getRoundLabel(draw.rounds, ri, smallBracket)} Results</span>
                          <span className="text-[11px] font-bold text-emerald-50 bg-white/15 px-2 py-0.5 rounded-full">{completedMatches.length} completed</span>
                        </button>

                        <AnimatePresence initial={false}>
                          {open && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="divide-y divide-slate-100 overflow-hidden"
                            >
                              {completedMatches.map((match) => {
                                const winner = match.winnerId === match.slotA.playerId ? match.slotA : match.slotB;
                                const loser = match.winnerId === match.slotA.playerId ? match.slotB : match.slotA;
                                // Round robin: nobody advances, so there is no "next match"
                                const nextMatchInfo = isRR ? null : findNextMatch(draw.rounds, ri, round.indexOf(match), winner);
                                return (
                                  <div key={match.matchId} className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 hover:bg-emerald-50/40 transition-colors">
                                    <span className="text-[11px] font-black text-slate-400 w-20 shrink-0">Mat {match.matNumber} · #{match.matchNumber}</span>
                                    <span className="flex items-center gap-1.5 min-w-0">
                                      <Trophy size={14} className="text-emerald-600 shrink-0" />
                                      <span className="text-sm font-black text-emerald-700 truncate">{winner.playerName}</span>
                                    </span>
                                    <span className="text-[10px] font-black text-slate-300">DEF.</span>
                                    <span className="text-sm font-semibold text-slate-500 truncate min-w-0">{loser.isBye ? "BYE" : loser.playerName}</span>
                                    {match.winMethod && (
                                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{match.winMethod}</span>
                                    )}
                                    {nextMatchInfo && (
                                      <span className="text-[11px] font-semibold text-blue-600">
                                        → {getRoundLabel(draw.rounds, nextMatchInfo.roundIndex)} #{nextMatchInfo.matchNumber}
                                        {nextMatchInfo.opponent ? ` vs ${nextMatchInfo.opponent}` : " (waiting)"}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => exportMatchToPDF(match, winner, loser, tournament, ri, nextMatchInfo)}
                                      title="Export this match result as PDF"
                                      className="ml-auto h-8 px-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors"
                                    >
                                      <Download size={13} /> PDF
                                    </button>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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
                            {seeds[seedNum]?.club} · {fmtKg(seeds[seedNum]?.weight)}
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
                              <span className="text-xs text-slate-400 font-semibold">{p.club} · {fmtKg(p.weight)}</span>
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
                  const categoryLabel = `${ageFilter !== "ALL" ? ageFilter : ""} · ${genderFilter === "FEMALE" ? "Girls" : "Boys"} · ${weightFilter !== "ALL" ? fmtKg(weightFilter) : ""}`;
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

      {drawSetup && (
        <DrawSetupModal
          title={drawSetup.cat
            ? [drawSetup.cat.ageGroup, drawSetup.cat.gender === "FEMALE" ? "Girls" : "Boys", fmtKg(drawSetup.cat.weightCategory)].join(" · ")
            : [ageFilter !== "ALL" ? ageFilter : "", genderFilter === "FEMALE" ? "Girls" : genderFilter === "MALE" ? "Boys" : "", weightFilter !== "ALL" ? fmtKg(weightFilter) : ""].filter(Boolean).join(" · ")}
          formatLabel={{ "straight-elimination": "Straight Elimination", "single-repechage": "Single Repechage", "double-repechage": "Double Repechage", "round-robin": "Round Robin" }[drawSetup.method]}
          players={drawSetup.cat ? drawSetup.cat.players : eligiblePlayers}
          isRedraw={drawSetup.isRedraw}
          onCancel={() => setDrawSetup(null)}
          onConfirm={(choice) => {
            const { isRedraw, method, cat } = drawSetup;
            setDrawSetup(null);
            handleGenerateAndSaveDraw(isRedraw, true, cat, method, choice);
          }}
        />
      )}

      {editingDrawKey && draws[editingDrawKey] && canEditRoundRobin(draws[editingDrawKey].rounds) && (() => {
        const d = draws[editingDrawKey];
        // players already in the pool, plus approved players of this category (to bring someone in)
        const poolPlayers = categoryPlayersFor(d);
        return (
          <RoundRobinEditModal
            title={`${d.ageGroup} · ${d.gender === "FEMALE" ? "Girls" : "Boys"} · ${d.weightCategory}`}
            players={poolPlayers}
            rounds={d.rounds}
            onClose={() => setEditingDrawKey(null)}
            onSave={(rounds) => saveRoundRobinDraw(editingDrawKey, d, rounds)}
          />
        );
      })()}
      {resettingKey && draws[resettingKey] && (() => {
        const d = draws[resettingKey];
        return (
          <ResetCategoryModal
            tournamentId={tournamentId}
            token={token}
            draw={d}
            title={`${d.ageGroup} · ${d.gender === "FEMALE" ? "Girls" : "Boys"} · ${d.weightCategory}`}
            onClose={() => setResettingKey(null)}
            onDone={(message) => {
              // back to "no draw yet": Generate draw / Start become available again
              setDraws((p) => ({ ...p, [resettingKey]: { ...d, rounds: [], generated: false, saved: true, startedAt: null } }));
              setResettingKey(null);
              showToast(message, true);
              fetchDraws();
            }}
          />
        );
      })()}
      {correctingKey && draws[correctingKey] && (() => {
        const d = draws[correctingKey];
        const title = `${d.ageGroup} · ${d.gender === "FEMALE" ? "Girls" : "Boys"} · ${d.weightCategory}`;
        const save = (rounds: BracketMatch[][]) => saveRoundRobinDraw(correctingKey, d, rounds, true);
        return isDrawRoundRobin(d) ? (
          <RoundRobinEditModal live title={title} players={categoryPlayersFor(d)} rounds={d.rounds} onClose={() => setCorrectingKey(null)} onSave={save} />
        ) : (
          <CorrectBracketModal title={title} players={categoryPlayersFor(d)} rounds={d.rounds} onClose={() => setCorrectingKey(null)} onSave={save} />
        );
      })()}
      {editingDrawKey && draws[editingDrawKey] && !canEditRoundRobin(draws[editingDrawKey].rounds) && (() => {
        const d = draws[editingDrawKey];
        const ids = new Set(slotsFromRounds(d.rounds).filter((x): x is string => !!x));
        return (
          <EditDrawModal
            title={`${d.ageGroup} · ${d.gender === "FEMALE" ? "Girls" : "Boys"} · ${d.weightCategory}`}
            players={players.filter((p) => ids.has(p.id))}
            rounds={d.rounds}
            onClose={() => setEditingDrawKey(null)}
            onSave={(slots) => saveEditedDraw(editingDrawKey, d, slots)}
          />
        );
      })()}

      {/* ── Confirm Modal ── */}
      <AnimatePresence>
        {confirmModal.isOpen && (() => {
          const danger = confirmModal.tone === "danger";
          const close = () => setConfirmModal(CLOSED_CONFIRM);
          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={close}>
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-red-50 text-red-600 ring-8 ring-red-50/50" : "bg-amber-50 text-amber-600 ring-8 ring-amber-50/50"}`}>
                      <AlertTriangle size={20} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h3 id="confirm-title" className="text-lg font-black text-slate-900 leading-tight">{confirmModal.title}</h3>
                      {confirmModal.message && <p className="mt-1 text-sm font-semibold text-slate-500 whitespace-pre-line">{confirmModal.message}</p>}
                    </div>
                  </div>

                  {confirmModal.steps && (
                    <ol className="mt-6 space-y-3">
                      {confirmModal.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{step.icon}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-800">{step.title}</p>
                            <p className="text-xs font-medium text-slate-500">{step.text}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {confirmModal.warning && (
                    <div className={`mt-6 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${danger ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                      <AlertCircle size={14} className="shrink-0" />
                      {confirmModal.warning}
                    </div>
                  )}
                </div>

                <div className="px-6 sm:px-7 py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={close}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    autoFocus
                    onClick={() => {
                      confirmModal.action?.();
                      close();
                    }}
                    className={`px-5 py-2.5 rounded-xl font-black text-white shadow-sm transition-colors ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#FF7400] hover:bg-orange-600"}`}
                  >
                    {confirmModal.confirmLabel || "Confirm"}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* ══ POINTS (sportsmanship + volunteers) ═════════════════════════════════ */}
      {activeTab === "points" && <PointsTab tournamentId={tournamentId} />}

      {/* ══ BEST PERFORMANCE (district championship) ═════════════════════════ */}
      {activeTab === "best-performance" && <BestPerformanceTab players={players} />}

      {/* ══ CERTIFICATES ══════════════════════════════════════════════════════ */}
      {activeTab === "certificate" && <CertificateTab tournamentId={tournamentId} />}

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
          tournamentCategory={tournament?.category}
          tournamentGender={tournament?.gender}
          onClose={() => setIsAddPlayerOpen(false)}
          onSuccess={() => { fetchPlayers(); showToast("Player added to tournament.", true); }}
        />
      )}

    </div>
  );
}

/** Above the contest sheet: prints it on one landscape page (via the draw's view page). */
function SheetPrintBar({ onPrint }: { onPrint: () => void }) {
  return (
    <div className="flex justify-end mb-3">
      <button
        onClick={onPrint}
        className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:border-[#FF7400] hover:text-[#FF7400] transition-colors"
      >
        <Printer size={14} /> Print sheet
      </button>
    </div>
  );
}
