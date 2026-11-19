"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Download, CheckCircle, RotateCcw, ArrowLeft, RefreshCw, Hand, Activity, PlayCircle, PauseCircle, AlertTriangle } from "lucide-react";

interface Score { ippon: number; wazaAri: number; yuko: number; shido: number; awaseteIppon?: boolean }
type Fighter = "A" | "B";

const OSAEKOMI_IPPON_S   = 20;
const OSAEKOMI_WAZAARI_S = 10;
const OSAEKOMI_YUKO_S    = 5;

/** Score a single osaekomi hold can earn. */
type OsaAward = "yuko" | "wazaAri" | "ippon";
const OSA_LABEL: Record<OsaAward, string> = { yuko: "YUKO", wazaAri: "WAZA-ARI", ippon: "IPPON" };
/** Highest score reached after `sec` seconds of hold. */
/** Hold time as "07.42" (seconds.hundredths). */
const fmtOsa = (ms: number) => `${String(Math.floor(ms / 1000)).padStart(2, "0")}.${String(Math.floor((ms % 1000) / 10)).padStart(2, "0")}`;
const osaLevelAt = (sec: number): OsaAward | null =>
  sec >= OSAEKOMI_IPPON_S ? "ippon" : sec >= OSAEKOMI_WAZAARI_S ? "wazaAri" : sec >= OSAEKOMI_YUKO_S ? "yuko" : null;
const addOsaAward = (s: Score, a: OsaAward): Score => {
  const n = { ...s };
  if (a === "yuko") n.yuko += 1;
  else if (a === "ippon") n.ippon += 1;
  else {
    n.wazaAri += 1;
    if (n.wazaAri === 2) { n.wazaAri = 0; n.ippon += 1; n.awaseteIppon = true; }
  }
  return n;
};
const removeOsaAward = (s: Score, a: OsaAward): Score => {
  const n = { ...s };
  if (a === "yuko") n.yuko = Math.max(0, n.yuko - 1);
  else if (a === "ippon") n.ippon = Math.max(0, n.ippon - 1);
  else if (n.awaseteIppon) { n.awaseteIppon = false; n.ippon = Math.max(0, n.ippon - 1); n.wazaAri = 1; }
  else n.wazaAri = Math.max(0, n.wazaAri - 1);
  return n;
};
/** Score log written by the hold `holdId` (replaced when that hold's score upgrades or swaps). */
const isHoldScoreLog = (l: { id: string; type: string }, holdId: string) => !!holdId && l.type === "score" && l.id.startsWith(`${holdId}_osa_`);
const emptyScore = (): Score => ({ ippon: 0, wazaAri: 0, yuko: 0, shido: 0 });
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")} : ${String(s % 60).padStart(2, "0")}`;

const FALLBACK_techniques = [
  "Ippon Seoi Nage", "Morote Seoi Nage", "Seoi Otoshi",
  "O Uchi Gari", "Ko Uchi Gari", "O Soto Gari", "Ko Soto Gari",
  "Harai Goshi", "Uchi Mata", "Hane Goshi", "Koshi Guruma",
  "Tai Otoshi", "Tomoe Nage", "Kata Guruma", "Sumi Gaeshi",
  "De Ashi Barai", "Okuri Ashi Barai", "Sasae Tsuri Komi Ashi",
  "O Soto Otoshi", "Osoto Guruma",
  "Kesa Gatame", "Yoko Shiho Gatame", "Tate Shiho Gatame", "Kami Shiho Gatame",
  "Juji Gatame", "Ude Garami", "Ude Gatame",
  "Hadaka Jime", "Okuri Eri Jime", "Sankaku Jime",
];

const FALLBACK_penalties = [
  "Shido – Passivity", "Shido – False attack", "Shido – Defensive posture",
  "Shido – Out of bounds (Jogai)", "Shido – Leg grab", "Shido – Stalling",
  "Shido – Grip break", "Shido – Blocking", "Shido – Dangerous hold",
  "Hansoku-make – Head dive", "Hansoku-make – Dangerous throw",
  "Hansoku-make – Intentional fall", "Hansoku-make – Direct disqualification",
];

function ScoreboardInner() {
  const sp = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const tournamentId = params?.id as string;
  const matchId = sp.get("matchId") || "";

  const fighterAName    = sp.get("fighterAName")    || "FIGHTER A";
  const fighterBName    = sp.get("fighterBName")    || "FIGHTER B";
  const fighterAClub    = sp.get("fighterAClub")    || "";
  const fighterBClub    = sp.get("fighterBClub")    || "";
  const fighterACoach   = sp.get("fighterACoach")   || "";
  const fighterBCoach   = sp.get("fighterBCoach")   || "";
  const weightCategory  = sp.get("weightCategory")  || "48 kg";
  const matchNumber     = sp.get("matchNumber")     || "1";
  const matNumber       = sp.get("matNumber")       || "1";
  const tournamentTitle = sp.get("tournamentTitle") || "TNJA Championship";

  const [techniques, setTechniques] = useState<string[]>(FALLBACK_techniques);
  const [penalties, setPenalties]   = useState<string[]>(FALLBACK_penalties);

  const [selectedTechA, setSelectedTechA] = useState("");
  const [selectedTechB, setSelectedTechB] = useState("");
  const [selectedPenA, setSelectedPenA] = useState("");
  const [selectedPenB, setSelectedPenB] = useState("");
  const [descA, setDescA] = useState("");
  const [descB, setDescB] = useState("");

  interface MatchLog { id: string; timestamp: number; text: string; type: "score" | "penalty" | "system"; fighter?: Fighter; }
  const [logs, setLogs] = useState<MatchLog[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/scoreboard/options`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.techniques?.length) setTechniques(data.techniques);
        if (data?.penalties?.length)  setPenalties(data.penalties);
      })
      .catch(() => {});
  }, []);

  const [scoreA, setScoreA] = useState<Score>(emptyScore());
  const [scoreB, setScoreB] = useState<Score>(emptyScore());
  const [winner, setWinner] = useState<Fighter | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [winMethod, setWinMethod] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [dbMatchStatus, setDbMatchStatus] = useState("");

  const [durationInput, setDurationInput] = useState(4);
  const [timeLeft, setTimeLeft]   = useState(4 * 60);
  const [maxTime, setMaxTime]     = useState(4 * 60);
  const [running, setRunning]     = useState(false);
  const [goldenScore, setGoldenScore] = useState(false);
  const goldenScoreLoggedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timeLeft > maxTime) setMaxTime(timeLeft);
  }, [timeLeft, maxTime]);

  const [osaActive, setOsaActive] = useState(false);
  const [osaFor, setOsaFor]       = useState<Fighter | null>(null);
  const [osaMs, setOsaMs]         = useState(0); // current hold time in milliseconds
  const osaMsRef                  = useRef(0);
  const osaTime                   = Math.floor(osaMs / 1000);
  const osaRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const osaAward      = useRef<OsaAward | null>(null); // what the current hold has scored so far
  const osaHoldId     = useRef(""); // tags the current hold's score log

  const [confirmWinner, setConfirmWinner] = useState<Fighter | null>(null);

  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [resetComment, setResetComment] = useState("");
  const [showEditTimerModal, setShowEditTimerModal] = useState(false);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editSeconds, setEditSeconds] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  }, []);

  const saveMatchToDB = useCallback(async (
    currentScoreA = scoreA, currentScoreB = scoreB, currentWinner = winner, currentWinMethod = winMethod, currentLogs = logs
  ) => {
    if (!tournamentId || !matchId) return;
    const token = localStorage.getItem("token");

    const statusVal = currentWinner ? "COMPLETED" : running ? "IN_PROGRESS" : dbMatchStatus;

    if (!currentWinner) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/tournaments/${tournamentId}/matches/${matchId}/state`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            scoreA: currentScoreA,
            scoreB: currentScoreB,
            logs: currentLogs,
            timeLeft: timeLeft,
            status: statusVal
          })
        });
      } catch (err) {
        console.error("Error syncing match state", err);
      }
      return;
    }

    try {
      const getRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/tournaments/${tournamentId}/draws`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!getRes.ok) throw new Error("Failed to fetch draws");
      const draws = await getRes.json();
      if (!Array.isArray(draws)) return;

      let targetDraw: any = null;
      for (const draw of draws) {
        if (!Array.isArray(draw.rounds)) continue;
        let matchFound = false;
        const newRounds = draw.rounds.map((r: any[]) => r.map((m: any) => {
          if (m.matchId === matchId) {
            matchFound = true;
            const winnerIdVal = currentWinner ? (currentWinner === "A" ? sp.get("fighterAId") : sp.get("fighterBId")) : null;
            const elapsedSeconds = goldenScore ? (durationInput * 60) + timeLeft : (durationInput * 60) - timeLeft;
            return { ...m, winnerId: winnerIdVal, status: statusVal, scoreA: currentScoreA, scoreB: currentScoreB, winMethod: currentWinMethod, logs: currentLogs, timeLeft, elapsedSeconds };
          }
          return m;
        }));

        if (matchFound) {
          for (let ri = 0; ri < newRounds.length; ri++) {
            for (let mi = 0; mi < newRounds[ri].length; mi++) {
              if (newRounds[ri][mi].matchId === matchId && currentWinner) {
                const nextRi = ri + 1;
                if (nextRi < newRounds.length) {
                  const nextMi = Math.floor(mi / 2);
                  const winnerIdVal = currentWinner === "A" ? sp.get("fighterAId") : sp.get("fighterBId");
                  const winnerSlot = { playerId: winnerIdVal, playerName: currentWinner === "A" ? fighterAName : fighterBName, club: currentWinner === "A" ? fighterAClub : fighterBClub, isBye: false };
                  
                  // Route winner to the next standard match slot
                  if (mi % 2 === 0) newRounds[nextRi][nextMi].slotA = winnerSlot;
                  else              newRounds[nextRi][nextMi].slotB = winnerSlot;

                  // Bronze Match Logic: If this is the semi-final and a bronze match exists
                  if (ri === newRounds.length - 2 && newRounds[nextRi].length > 1) {
                    const loserIdVal = currentWinner === "A" ? sp.get("fighterBId") : sp.get("fighterAId");
                    const loserSlot = { playerId: loserIdVal, playerName: currentWinner === "A" ? fighterBName : fighterAName, club: currentWinner === "A" ? fighterBClub : fighterAClub, isBye: false };
                    
                    // Route loser to the Bronze Match (which is at index 1 of the final round)
                    if (mi % 2 === 0) newRounds[nextRi][1].slotA = loserSlot;
                    else              newRounds[nextRi][1].slotB = loserSlot;
                  }
                }
              }
            }
          }
          targetDraw = { ...draw, rounds: newRounds };
          break;
        }
      }

      if (!targetDraw) return;

      const postRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/tournaments/${tournamentId}/draws`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ageGroup: targetDraw.ageGroup, 
          exactAge: targetDraw.exactAge, 
          gender: targetDraw.gender, 
          weightCategory: targetDraw.weightCategory, 
          matNumber: targetDraw.matNumber, 
          rounds: targetDraw.rounds 
        })
      });
      if (!postRes.ok) {
        const errText = await postRes.text();
        console.error("Failed to save match to database:", errText);
        showToast("Failed to save match: " + errText);
      } else {
        if (currentWinner) {
          const winnerName = currentWinner === "A" ? fighterAName : fighterBName;
          showToast(`Match saved! Winner: ${winnerName} 🏆`);
        }
      }
    } catch (err: any) {
      console.error("Error saving match to DB:", err);
      showToast("Error saving match.");
    }
  }, [tournamentId, matchId, scoreA, scoreB, winner, winMethod, logs, timeLeft, running, sp, fighterAName, fighterBName, fighterAClub, fighterBClub, goldenScore, durationInput, showToast]);

  useEffect(() => {
    if (!tournamentId || !matchId) return;
    const token = localStorage.getItem("token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api"}/tournaments/${tournamentId}/draws`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.ok ? r.json() : null).then((draws: any[]) => {
        if (!draws || !Array.isArray(draws)) return;
        for (const draw of draws) {
          if (!Array.isArray(draw.rounds)) continue;
          for (const round of draw.rounds) {
            for (const m of round) {
              if (m.matchId === matchId) {
                if (m.status) setDbMatchStatus(m.status);
                if (m.scoreA) setScoreA(m.scoreA);
                if (m.scoreB) setScoreB(m.scoreB);
                if (m.winnerId) { const f: Fighter = m.winnerId === sp.get("fighterAId") ? "A" : "B"; setWinner(f); }
                if (m.winMethod) setWinMethod(m.winMethod);
                if (m.logs) {
                  setLogs(m.logs);
                  if (m.logs.some((l: any) => l.text.includes("GOLDEN SCORE started"))) {
                    setGoldenScore(true);
                    goldenScoreLoggedRef.current = true;
                  }
                }
                if (typeof m.timeLeft === "number") setTimeLeft(m.timeLeft);
                break;
              }
            }
          }
        }
      }).catch(err => console.error("Error restoring match state from DB:", err));
  }, [tournamentId, matchId, sp]);

  const checkWin = useCallback((sA: Score, sB: Score, isGolden: boolean): { w: Fighter | null; m: string } => {
    if (sA.awaseteIppon) return { w: "A", m: "Ippon (Waza-ari-awasete)" };
    if (sB.awaseteIppon) return { w: "B", m: "Ippon (Waza-ari-awasete)" };
    if (sA.ippon >= 1)   return { w: "A", m: "Ippon" };
    if (sB.ippon >= 1)   return { w: "B", m: "Ippon" };
    
    if (isGolden) {
      const aS = sA.wazaAri * 10 + sA.yuko;
      const bS = sB.wazaAri * 10 + sB.yuko;
      if (aS > bS) return { w: "A", m: "Golden Score" };
      if (bS > aS) return { w: "B", m: "Golden Score" };
    }

    if (sA.shido >= 3)   return { w: "B", m: "Hansoku-make (3× Shido)" };
    if (sB.shido >= 3)   return { w: "A", m: "Hansoku-make (3× Shido)" };
    return { w: null, m: "" };
  }, []);

  const declareWinner = useCallback((f: Fighter, method: string) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    setWinner(f); setWinMethod(method); setRunning(false); setOsaActive(false); setShowWinnerModal(true);
    if (timerRef.current) clearInterval(timerRef.current);
    if (osaRef.current)   clearInterval(osaRef.current);

    const winnerName = f === "A" ? fighterAName : fighterBName;
    const newLogText = `Winner declared: ${winnerName} via ${method}`;
    const nextLogs = [...logs, { id: `${Date.now()}_win`, timestamp: Date.now(), text: newLogText, type: "system" as const }];
    setLogs(nextLogs);

    const sp2 = new URLSearchParams(window.location.search);
    const elapsedSeconds = goldenScore ? (durationInput * 60) + timeLeft : (durationInput * 60) - timeLeft;
    try {
      const ch = new BroadcastChannel("tnja_match_results");
      ch.postMessage({ 
        matchId: sp2.get("matchId")||"", 
        winnerId: f === "A" ? sp2.get("fighterAId")||"" : sp2.get("fighterBId")||"", 
        winnerName, 
        winnerClub: f === "A" ? fighterAClub : fighterBClub,
        scoreA,
        scoreB,
        winMethod: method,
        elapsedSeconds
      });
      ch.close();
    } catch {}

    saveMatchToDB(scoreA, scoreB, f, method, nextLogs);
  }, [fighterAName, fighterBName, fighterAClub, fighterBClub, scoreA, scoreB, logs, goldenScore, durationInput, timeLeft, saveMatchToDB, dbMatchStatus]);

  const handleOpenEditTimer = useCallback(() => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked.");
      return;
    }
    setEditMinutes(Math.floor(timeLeft / 60));
    setEditSeconds(timeLeft % 60);
    setShowEditTimerModal(true);
  }, [timeLeft, dbMatchStatus, showToast]);

  const handleSaveTimer = useCallback(() => {
    const newTime = (editMinutes * 60) + editSeconds;
    setTimeLeft(newTime);
    if (newTime > maxTime) setMaxTime(newTime);
    setDurationInput(editMinutes);

    const nextLogs = [...logs, {
      id: `${Date.now()}_system_timer_edit`,
      timestamp: Date.now(),
      text: `Timer manually adjusted to ${editMinutes.toString().padStart(2, '0')}:${editSeconds.toString().padStart(2, '0')}`,
      type: "system" as const
    }];
    setLogs(nextLogs);
    saveMatchToDB(scoreA, scoreB, winner, winMethod, nextLogs);
    
    setShowEditTimerModal(false);
  }, [editMinutes, editSeconds, maxTime, logs, saveMatchToDB, scoreA, scoreB, winner, winMethod]);

  const handleResetClick = useCallback(() => {
    setShowResetPrompt(true);
  }, []);

  const confirmReset = useCallback(() => {
    if (!resetComment.trim()) {
      showToast("Reason is required to reset the match.");
      return;
    }
    const nextLogs = [{
      id: `${Date.now()}_system_reset`,
      timestamp: Date.now(),
      text: `Match completely reset. Reason: ${resetComment.trim()}`,
      type: "system" as const
    }];

    setScoreA(emptyScore());
    setScoreB(emptyScore());
    setWinner(null);
    setWinMethod("");
    setLogs(nextLogs);
    setTimeLeft(durationInput * 60);
    setRunning(false);
    setGoldenScore(false);
    goldenScoreLoggedRef.current = false;
    setOsaActive(false);
    setOsaFor(null);
    osaMsRef.current = 0;
    setOsaMs(0);
    setDbMatchStatus("PENDING");
    if (timerRef.current) clearInterval(timerRef.current);
    if (osaRef.current) clearInterval(osaRef.current);
    
    saveMatchToDB(emptyScore(), emptyScore(), null, "", nextLogs);
    showToast("Match has been reset successfully!");
    setShowResetPrompt(false);
    setResetComment("");
  }, [durationInput, saveMatchToDB, showToast, resetComment]);

  /** Download the match statistics timeline as a CSV file (opens in Excel). */
  const downloadStats = () => {
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const row = (...cols: (string | number)[]) => cols.map(cell).join(",");
    const weightCategory = sp.get("weightCategory") || "";
    const lines = [
      row("Tournament", tournamentTitle),
      row("Category", [sp.get("ageGroup") || "", weightCategory].filter(Boolean).join(" ")),
      row("Match", matchNumber, "Mat", matNumber),
      "",
      row("Player", "Ippon", "Waza-ari", "Yuko", "Shido"),
      row(`${fighterAName} (Player 1)`, scoreA.ippon, scoreA.wazaAri, scoreA.yuko, scoreA.shido),
      row(`${fighterBName} (Player 2)`, scoreB.ippon, scoreB.wazaAri, scoreB.yuko, scoreB.shido),
      ...(winner ? [row("Winner", winner === "A" ? fighterAName : fighterBName, winMethod || "")] : []),
      "",
      row("Time", "Competitor", "Type", "Description"),
      ...logs.map((l) =>
        row(
          new Date(l.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          l.fighter ? `${l.fighter === "A" ? fighterAName : fighterBName} (Player ${l.fighter === "A" ? 1 : 2})` : "System",
          l.type,
          l.text
        )
      ),
    ];
    // BOM so Excel reads names with non-ASCII characters correctly
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${`${fighterAName} vs ${fighterBName} match ${matchNumber} statistics`.replace(/[\\/:*?"<>|]+/g, "").trim()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const ageGroup = sp.get("ageGroup") || "";
    const weightCategory = sp.get("weightCategory") || "";
    const titleParts = [fighterAName];
    if (ageGroup) titleParts.push(ageGroup);
    if (weightCategory) titleParts.push(weightCategory);
    titleParts.push("vs", fighterBName);
    
    const newTitle = titleParts.join(" ");
    const originalTitle = document.title;
    document.title = newTitle;
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 500);
  };

  const isMatchEnded = checkWin(scoreA, scoreB, goldenScore).w !== null;

  const addScore = useCallback((fighter: Fighter, field: keyof Score) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    if (winner || isMatchEnded) {
      showToast("Match has ended! Please undo the score or declare the winner.");
      return;
    }
    const nextScoreA = fighter === "A" ? { ...scoreA, [field]: (scoreA[field] as number) + 1 } : scoreA;
    const nextScoreB = fighter === "B" ? { ...scoreB, [field]: (scoreB[field] as number) + 1 } : scoreB;
    if (checkWin(nextScoreA, nextScoreB, goldenScore).w !== null) {
      setRunning(false);
    }

    const fighterName = fighter === "A" ? fighterAName : fighterBName;
    const label = field === "wazaAri" ? "Waza-ari" : field.toUpperCase();

    if (fighter === "A") {
      setScoreA(prev => {
        const next = { ...prev, [field]: (prev[field] as number) + 1 };
        if (field === "wazaAri" && next.wazaAri === 2) {
          next.wazaAri = 0;
          next.ippon = 1;
          next.awaseteIppon = true;
        }
        let logText = `${fighterName} scored ${label}`;
        let logType: "score" | "penalty" | "system" = "score";
        if (field === "shido") {
          logType = "penalty";
          if (next.shido >= 3) logText = `${fighterName} disqualified via Hansoku-make (3x Shido)`;
          else logText = `${fighterName} received Shido`;
        }
        const nextLogs = [...logs, { id: `${Date.now()}_score_a_${field}`, timestamp: Date.now(), text: logText, type: logType, fighter }];
        setLogs(nextLogs);
        saveMatchToDB(next, scoreB, null, "", nextLogs);
        return next;
      });
    } else {
      setScoreB(prev => {
        const next = { ...prev, [field]: (prev[field] as number) + 1 };
        if (field === "wazaAri" && next.wazaAri === 2) {
          next.wazaAri = 0;
          next.ippon = 1;
          next.awaseteIppon = true;
        }
        let logText = `${fighterName} scored ${label}`;
        let logType: "score" | "penalty" | "system" = "score";
        if (field === "shido") {
          logType = "penalty";
          if (next.shido >= 3) logText = `${fighterName} disqualified via Hansoku-make (3x Shido)`;
          else logText = `${fighterName} received Shido`;
        }
        const nextLogs = [...logs, { id: `${Date.now()}_score_b_${field}`, timestamp: Date.now(), text: logText, type: logType, fighter }];
        setLogs(nextLogs);
        saveMatchToDB(scoreA, next, null, "", nextLogs);
        return next;
      });
    }
  }, [winner, isMatchEnded, fighterAName, fighterBName, logs, saveMatchToDB, scoreA, scoreB, dbMatchStatus]);

  const performUndo = (fighter: Fighter, type: "specific" | "last", field?: keyof Score) => {
    const fighterName = fighter === "A" ? fighterAName : fighterBName;

    if (type === "specific" && field) {
      const label = field === "wazaAri" ? "Waza-ari" : field.toUpperCase();
      const nextLogs = [...logs, { id: `${Date.now()}_undo_${fighter}_${field}`, timestamp: Date.now(), text: `Undo: ${fighterName} score decreased (${label})`, type: "system" as const, fighter }];
      setLogs(nextLogs);

      if (fighter === "A") {
        setScoreA(p => { 
          const next = { ...p };
          if (field === "wazaAri" && p.awaseteIppon) {
            next.wazaAri = 1;
            next.ippon = Math.max(0, p.ippon - 1);
            next.awaseteIppon = false;
          } else {
            (next as any)[field] = Math.max(0, (p[field] as number) - 1);
          }
          saveMatchToDB(next, scoreB, null, "", nextLogs); 
          return next; 
        });
      } else {
        setScoreB(p => { 
          const next = { ...p };
          if (field === "wazaAri" && p.awaseteIppon) {
            next.wazaAri = 1;
            next.ippon = Math.max(0, p.ippon - 1);
            next.awaseteIppon = false;
          } else {
            (next as any)[field] = Math.max(0, (p[field] as number) - 1);
          }
          saveMatchToDB(scoreA, next, null, "", nextLogs); 
          return next; 
        });
      }
    } else if (type === "last") {
      const fighterLogs = logs.filter(l => l.fighter === fighter && (l.type === "score" || l.type === "penalty"));
      const lastAction = fighterLogs[fighterLogs.length - 1];
      const text = lastAction.text.toLowerCase();
      
      let parsedField: keyof Score | null = null;
      if (text.includes("ippon")) parsedField = "ippon";
      else if (text.includes("waza-ari")) parsedField = "wazaAri";
      else if (text.includes("yuko")) parsedField = "yuko";
      else if (text.includes("shido") || text.includes("hansoku-make") || text.includes("disqualified")) parsedField = "shido";

      if (parsedField) {
        const filteredLogs = logs.filter(l => l.id !== lastAction.id);
        const label = parsedField === "wazaAri" ? "Waza-ari" : parsedField.toUpperCase();
        const nextLogs = [...filteredLogs, { id: `${Date.now()}_undo_${fighter}_${parsedField}`, timestamp: Date.now(), text: `Undo: ${fighterName} score decreased (${label})`, type: "system" as const, fighter }];
        setLogs(nextLogs);

        if (fighter === "A") {
          setScoreA(p => { 
            const next = { ...p };
            if (parsedField === "wazaAri" && p.awaseteIppon) {
              next.wazaAri = 1;
              next.ippon = Math.max(0, p.ippon - 1);
              next.awaseteIppon = false;
            } else {
              (next as any)[parsedField!] = Math.max(0, (p[parsedField!] as number) - 1);
            }
            saveMatchToDB(next, scoreB, null, "", nextLogs); 
            return next; 
          });
        } else {
          setScoreB(p => { 
            const next = { ...p };
            if (parsedField === "wazaAri" && p.awaseteIppon) {
              next.wazaAri = 1;
              next.ippon = Math.max(0, p.ippon - 1);
              next.awaseteIppon = false;
            } else {
              (next as any)[parsedField!] = Math.max(0, (p[parsedField!] as number) - 1);
            }
            saveMatchToDB(scoreA, next, null, "", nextLogs); 
            return next; 
          });
        }
      }
    }
  };

  const undoScore = (fighter: Fighter, field: keyof Score) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    if (winner) return;
    performUndo(fighter, "specific", field);
  };

  const undoLastScore = (fighter: Fighter) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    if (winner) return;
    const fighterLogs = logs.filter(l => l.fighter === fighter && (l.type === "score" || l.type === "penalty"));
    if (fighterLogs.length === 0) {
      showToast("No score or penalty logs found to undo.");
      return;
    }
    performUndo(fighter, "last");
  };

  const applyTechnique = (fighter: Fighter, tech: string, desc: string) => {
    const fighterName = fighter === "A" ? fighterAName : fighterBName;
    const logText = `${fighterName} executed ${tech}${desc ? ` - ${desc}` : ""}`;
    const nextLogs = [...logs, { id: `${Date.now()}_tech_${fighter}`, timestamp: Date.now(), text: logText, type: "system" as const, fighter }];
    setLogs(nextLogs);
    saveMatchToDB(fighter === "A" ? scoreA : scoreA, fighter === "B" ? scoreB : scoreB, null, "", nextLogs);
  };

  const applyPenalty = (fighter: Fighter, pen: string, desc: string) => {
    const fighterName = fighter === "A" ? fighterAName : fighterBName;
    const isDirectHansoku = pen.toLowerCase().includes("hansoku-make");
    const nextShido = (fighter === "A" ? scoreA.shido : scoreB.shido) + (isDirectHansoku ? 3 : 1);
    if (isDirectHansoku || nextShido >= 3) {
      setRunning(false);
    }

    if (isDirectHansoku) {
      const logText = `${fighterName} disqualified via Hansoku-make (${pen})${desc ? ` - ${desc}` : ""}`;
      const nextLogs = [...logs, { id: `${Date.now()}_pen_disq`, timestamp: Date.now(), text: logText, type: "penalty" as const, fighter }];
      setLogs(nextLogs);

      if (fighter === "A") setScoreA(p => { const nx = { ...p, shido: 3 }; saveMatchToDB(nx, scoreB, null, "", nextLogs); return nx; });
      else setScoreB(p => { const nx = { ...p, shido: 3 }; saveMatchToDB(scoreA, nx, null, "", nextLogs); return nx; });
    } else {
      const logText = `${fighterName} received Shido for ${pen}${desc ? ` - ${desc}` : ""}`;
      const nextLogs = [...logs, { id: `${Date.now()}_pen`, timestamp: Date.now(), text: logText, type: "penalty" as const, fighter }];
      setLogs(nextLogs);

      if (fighter === "A") setScoreA(p => { const nx = { ...p, shido: p.shido + 1 }; saveMatchToDB(nx, scoreB, null, "", nextLogs); return nx; });
      else setScoreB(p => { const nx = { ...p, shido: p.shido + 1 }; saveMatchToDB(scoreA, nx, null, "", nextLogs); return nx; });
    }
  };

  const handleApply = (fighter: Fighter) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    const selectedTech = fighter === "A" ? selectedTechA : selectedTechB;
    const selectedPen = fighter === "A" ? selectedPenA : selectedPenB;
    const desc = fighter === "A" ? descA : descB;
    
    if (selectedPen) applyPenalty(fighter, selectedPen, desc);
    if (selectedTech) applyTechnique(fighter, selectedTech, desc);
    
    if (!selectedPen && !selectedTech && desc) {
      const fighterName = fighter === "A" ? fighterAName : fighterBName;
      const nextLogs = [...logs, { id: `${Date.now()}_custom`, timestamp: Date.now(), text: `${fighterName}: ${desc}`, type: "system" as const, fighter }];
      setLogs(nextLogs);
      saveMatchToDB(scoreA, scoreB, null, "", nextLogs);
    }

    if (fighter === "A") { setSelectedTechA(""); setSelectedPenA(""); setDescA(""); }
    else { setSelectedTechB(""); setSelectedPenB(""); setDescB(""); }
  };

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (!goldenScore && t <= 1) {
            clearInterval(timerRef.current!); setRunning(false);
            const aS = scoreA.wazaAri * 10 + scoreA.yuko + scoreA.ippon * 100;
            const bS = scoreB.wazaAri * 10 + scoreB.yuko + scoreB.ippon * 100;
            if (aS === bS) { setGoldenScore(true); return 0; }
            return 0;
          }
          return goldenScore ? t + 1 : t - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, scoreA, scoreB, goldenScore]);

  useEffect(() => {
    if (goldenScore && !goldenScoreLoggedRef.current) {
      goldenScoreLoggedRef.current = true;
      const newLog = { id: `${Date.now()}_system_golden`, timestamp: Date.now(), text: `Match tied! GOLDEN SCORE started.`, type: "system" as const };
      const nextLogs = [...logsRef.current, newLog];
      setLogs(nextLogs);
      logsRef.current = nextLogs;
      if (saveMatchToDBRef.current) saveMatchToDBRef.current(undefined, undefined, undefined, undefined, nextLogs);
    }
  }, [goldenScore]);

  const saveMatchToDBRef = useRef(saveMatchToDB);
  useEffect(() => { saveMatchToDBRef.current = saveMatchToDB; }, [saveMatchToDB]);

  const logsRef = useRef(logs);
  useEffect(() => { logsRef.current = logs; }, [logs]);

  const runningRef = useRef(running);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === "Tab") {
        e.preventDefault();
        if (dbMatchStatus === "COMPLETED") {
          showToast("This match is already completed and locked.");
          return;
        }
        if (!runningRef.current && winner) return;
        
        const nextState = !runningRef.current;
        setRunning(nextState);
        showToast(nextState ? "Timer Started" : "Timer Paused");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dbMatchStatus, winner, showToast]);

  const osaTimeRef = useRef(0);

  /**
   * Move the current hold's score up to `level` for `fighter`. The hold's score is the highest
   * mark reached, not a sum: at 10s the 5s Yuko becomes Waza-ari, at 20s that becomes Ippon.
   */
  const upgradeOsaekomi = (fighter: Fighter, level: OsaAward, sec: number) => {
    const prev = osaAward.current;
    osaAward.current = level;
    const fighterName = fighter === "A" ? fighterAName : fighterBName;
    const holdLog = { id: `${osaHoldId.current}_osa_${fighter}_${level}`, timestamp: Date.now(), text: `${fighterName} scored ${OSA_LABEL[level]} (Osaekomi ${sec}s)`, type: "score" as const, fighter };
    const nL = [...logsRef.current.filter((l) => !isHoldScoreLog(l, osaHoldId.current)), holdLog];
    setLogs(nL); logsRef.current = nL;
    const apply = (p: Score) => addOsaAward(prev ? removeOsaAward(p, prev) : p, level);
    if (fighter === "A") setScoreA((p) => { const nx = apply(p); setTimeout(() => saveMatchToDBRef.current(nx, undefined, undefined, undefined, nL), 0); return nx; });
    else                 setScoreB((p) => { const nx = apply(p); setTimeout(() => saveMatchToDBRef.current(undefined, nx, undefined, undefined, nL), 0); return nx; });
  };
  const upgradeOsaekomiRef = useRef(upgradeOsaekomi);
  useEffect(() => { upgradeOsaekomiRef.current = upgradeOsaekomi; });

  useEffect(() => {
    if (osaActive && osaFor) {
      // Measured from the wall clock (not by counting ticks) so it stays exact to the hundredth;
      // the base carries the elapsed time over when the hold is swapped to the other player.
      const base = Date.now() - osaMsRef.current;
      osaRef.current = setInterval(() => {
        const ms = Math.min(Date.now() - base, OSAEKOMI_IPPON_S * 1000);
        const sec = Math.floor(ms / 1000);
        osaMsRef.current = ms;
        osaTimeRef.current = sec;
        setOsaMs(ms);

        const level = osaLevelAt(sec);
        if (level && level !== osaAward.current) upgradeOsaekomiRef.current(osaFor, level, sec);
        if (level === "ippon") {
          clearInterval(osaRef.current!); setOsaActive(false); setRunning(false);
        }
      }, 31);
    } else {
      if (osaRef.current) clearInterval(osaRef.current);
    }
    return () => { if (osaRef.current) clearInterval(osaRef.current); };
  }, [osaActive, osaFor]);

  useEffect(() => {
    if (isMatchEnded) {
      setRunning(false);
      if (osaActive) {
        if (osaRef.current) clearInterval(osaRef.current);
        setOsaActive(false);
      }
    }
  }, [isMatchEnded, osaActive]);

  const startOsaekomi = (fighter: Fighter) => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    if (winner || isMatchEnded) {
      showToast("Match has ended! Cannot start Osaekomi.");
      return;
    }
    osaTimeRef.current = 0;
    osaMsRef.current = 0;
    setOsaMs(0);
    setOsaActive(true); setOsaFor(fighter);
    osaAward.current = null;
    osaHoldId.current = String(Date.now());
    if (!running) setRunning(true);
  };

  /** The held player escaped (Toketa): stop the hold and keep whatever it has scored so far. */
  const cancelOsaekomi = () => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    if (!osaActive || !osaFor) return;
    if (osaRef.current) clearInterval(osaRef.current);
    const sec = fmtOsa(osaMsRef.current);
    const award = osaAward.current;
    const name = osaFor === "A" ? fighterAName : fighterBName;
    const cancelLog = {
      id: `${Date.now()}_osa_cancel`,
      timestamp: Date.now(),
      text: `Osaekomi cancelled at ${sec}s — ${award ? `${name} keeps ${OSA_LABEL[award]}` : "no score"}`,
      type: "system" as const,
    };
    const nL = [...logsRef.current, cancelLog];
    setLogs(nL); logsRef.current = nL;
    saveMatchToDBRef.current(undefined, undefined, undefined, undefined, nL);
    showToast(award ? `Osaekomi cancelled — ${OSA_LABEL[award]} kept` : "Osaekomi cancelled — no score");
    setOsaActive(false); setOsaFor(null);
    osaTimeRef.current = 0;
    osaMsRef.current = 0;
    setOsaMs(0);
    osaAward.current = null;
  };

  const swapOsaekomi = () => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked.");
      return;
    }
    if (!osaActive || !osaFor) {
      showToast("Osaekomi is not active.");
      return;
    }

    const oldFighter = osaFor;
    const newFighter: Fighter = oldFighter === "A" ? "B" : "A";
    const award = osaAward.current;

    // Switch holder; the hold time carries over
    setOsaFor(newFighter);

    // Move whatever this hold has scored from the old holder to the new one
    let nextScoreA = { ...scoreA };
    let nextScoreB = { ...scoreB };
    if (award) {
      if (oldFighter === "A") { nextScoreA = removeOsaAward(nextScoreA, award); nextScoreB = addOsaAward(nextScoreB, award); }
      else                    { nextScoreB = removeOsaAward(nextScoreB, award); nextScoreA = addOsaAward(nextScoreA, award); }
    }

    const oldName = oldFighter === "A" ? fighterAName : fighterBName;
    const newName = newFighter === "A" ? fighterAName : fighterBName;
    const newLogs = [
      ...logsRef.current.filter((l) => !isHoldScoreLog(l, osaHoldId.current)),
      { id: `${Date.now()}_osa_swap`, timestamp: Date.now(), text: `Osaekomi swapped from ${oldName} to ${newName} at ${fmtOsa(osaMsRef.current)}s`, type: "system" as const },
    ];
    if (award) {
      newLogs.push({ id: `${osaHoldId.current}_osa_${newFighter}_${award}`, timestamp: Date.now(), text: `${newName} scored ${OSA_LABEL[award]} (Osaekomi ${osaTimeRef.current}s)`, type: "score" as const, fighter: newFighter });
    }

    setScoreA(nextScoreA);
    setScoreB(nextScoreB);
    setLogs(newLogs);
    logsRef.current = newLogs;

    saveMatchToDB(nextScoreA, nextScoreB, null, "", newLogs);
    showToast(`Osaekomi swapped to ${newName}`);
  };

  const totalScore = (score: Score) => score.ippon * 100 + score.wazaAri * 10 + score.yuko;

  const timerProgress = Math.max(0, Math.min(1, timeLeft / maxTime));
  const arcLength = 546.637;
  const arcOffset = arcLength - (timerProgress * arcLength);
  const thumbAngle = 135 + (270 * timerProgress);

  return (
    <>
      <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex justify-center xl:items-center font-sans select-none overflow-y-auto text-white print:hidden">
        <div className="w-full max-w-[1400px] min-h-[100dvh] xl:min-h-0 xl:h-full xl:max-h-[820px] flex flex-col bg-[#111111] relative border border-white/10 rounded-none xl:rounded-lg shadow-2xl xl:overflow-hidden m-0 xl:my-auto xl:mx-4">
        
        {/* ══ HEADER ════════════════════════════════════════════════════════ */}
        {/* 3-column grid keeps the title centred whatever the side widths; z-10 keeps the panels' glow underneath */}
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 lg:px-6 py-2.5 border-b border-[#333] bg-[#1a1a1a] shadow-md shrink-0">
        <div className="flex items-center justify-self-start">
          {/* The emblem is wide (ribbon to the edges) on a white square — a round frame clips it */}
          <span className="flex items-center justify-center h-11 w-11 lg:h-[52px] lg:w-[52px] rounded-xl bg-white p-1 ring-1 ring-white/20 shadow-md overflow-hidden">
            <img src={TNJA_LOGO} alt="Tamil Nadu Judo Association logo" className="h-full w-full object-contain" />
          </span>
        </div>
        <div className="flex flex-col items-center min-w-0">
          <h1 className="text-[#f97316] text-base lg:text-lg font-black tracking-wide uppercase text-center">{tournamentTitle}</h1>
          <p className="text-gray-400 text-xs lg:text-sm font-medium tracking-wide text-center">
            {weightCategory} <span className="text-[#f97316]">●</span> Match {matchNumber} <span className="text-[#f97316]">●</span> Mat {matNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end justify-self-end gap-2 lg:gap-3">
          {winner ? (
            <div className="bg-green-600 text-white px-4 py-1.5 rounded-md font-bold text-sm shadow-[0_0_10px_rgba(22,163,74,0.6)] flex items-center gap-2 tracking-widest uppercase">
              <Trophy size={14} /> MATCH FINISHED • WINNER: {winner === "A" ? fighterAName : fighterBName}
            </div>
          ) : (
            <button className="flex items-center gap-2 bg-[#ffcccc] text-red-600 px-4 py-1.5 rounded-md font-bold text-sm">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> LIVE
            </button>
          )}
          <button onClick={() => window.location.reload()} className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-md font-bold text-sm hover:bg-gray-200">
            <RefreshCw size={14} /> Refresh
          </button>
          {/* <button onClick={resetMatch} className="flex items-center gap-2 bg-red-600/20 border border-red-600 text-red-500 px-4 py-1.5 rounded-md font-bold text-sm hover:bg-red-600 hover:text-white transition-colors">
            <RotateCcw size={14} /> Reset Match
          </button> */}
          {/* <button className="bg-[#facc15] p-1.5 rounded-md text-black hover:bg-yellow-500">
            <Settings size={20} />
          </button> */}
        </div>
      </div>
      {dbMatchStatus === "COMPLETED" && (
        <div className="bg-red-600 text-white text-center py-2 text-sm font-bold tracking-wider shrink-0 uppercase shadow-md z-[10]">
          This match is already completed and locked. You cannot change the winner.
        </div>
      )}

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <div className="flex-1 min-h-0 p-3 lg:p-4 flex flex-col xl:flex-row gap-3 lg:gap-4 overflow-y-auto xl:overflow-hidden">
        
        {/* ── PLAYER 1 (WHITE) ──────────────────────────────────────────── */}
        <PlayerPanel
          theme="white"
          className="order-2 xl:order-1"
          name={fighterAName}
          club={fighterAClub}
          coach={fighterACoach}
          score={scoreA}
          total={totalScore(scoreA)}
          osaActive={osaActive && osaFor === "A"}
          osaOtherActive={osaActive && osaFor === "B"}
          osaMs={osaFor === "A" ? osaMs : 0}
          onStartOsa={() => startOsaekomi("A")}
          onCancelOsa={cancelOsaekomi}
          onAdd={(f) => addScore("A", f)}
          onUndo={(f) => undoScore("A", f)}
          onHansoku={() => applyPenalty("A", "Hansoku-make", "")}
          onUndoLast={() => undoLastScore("A")}
          onWinner={() => setConfirmWinner("A")}
          techniques={techniques}
          penalties={penalties}
          tech={selectedTechA} setTech={setSelectedTechA}
          pen={selectedPenA} setPen={setSelectedPenA}
          desc={descA} setDesc={setDescA}
          onApply={() => handleApply("A")}
        />

        {/* ── CENTER PANEL ────────────────────────────────────────────────── */}
        <div className="w-full xl:w-[300px] shrink-0 min-h-0 flex flex-col lg:flex-row xl:flex-col gap-3 order-1 xl:order-2 lg:col-span-2 xl:col-span-1 items-stretch">
          <div className="bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center pt-3 pb-3 relative shadow-lg lg:w-[300px] xl:w-auto shrink-0">
            
            <div className="relative flex flex-col items-center justify-center">
              <svg viewBox="0 0 260 260" className="w-[190px] h-[190px]">
                <defs>
                  <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#facc15" />
                  </linearGradient>
                </defs>
                <path 
                  d="M 47.98 212.02 A 116 116 0 1 1 212.02 212.02" 
                  stroke="#333" strokeWidth="6" fill="none" strokeLinecap="round" 
                />
                <path 
                  d="M 47.98 212.02 A 116 116 0 1 1 212.02 212.02" 
                  stroke="url(#timerGrad)" 
                  strokeWidth="14" 
                  fill="none" 
                  strokeLinecap="round" 
                  style={{
                    strokeDasharray: arcLength,
                    strokeDashoffset: arcOffset,
                    transition: "stroke-dashoffset 1s linear"
                  }} 
                />
                
                {/* ── DRAINING THUMB / DOT ── */}
                <g 
                  style={{ 
                    transform: `rotate(${thumbAngle}deg)`, 
                    transformOrigin: "130px 130px",
                    transition: "transform 1s linear" 
                  }}
                >
                  <circle 
                    cx="246" cy="130" r="10" 
                    fill="#f97316" 
                    stroke="#ffffff" 
                    strokeWidth="4" 
                    style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))" }}
                  />
                  <circle cx="243" cy="127" r="3" fill="#ffffff" opacity="0.6" />
                </g>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pb-4">
                <span className="text-[10px] font-black tracking-[0.2em] text-[#5a7fa8] mb-0.5">{goldenScore ? "GOLDEN SCORE" : "ROUND 1"}</span>
                <button onClick={handleOpenEditTimer} className="text-[2.6rem] leading-none font-black text-white tabular-nums tracking-tighter mb-1 drop-shadow-md hover:text-orange-400 hover:scale-105 transition-all cursor-pointer">
                  {fmt(timeLeft)}
                </button>
                <span className="text-[10px] font-black tracking-[0.1em] text-[#5a7fa8]">TIME REMAINING</span>
              </div>
            </div>

            <div className="flex gap-3 w-full px-4 mt-1 justify-center">
              <button onClick={() => { if (dbMatchStatus === "COMPLETED") { showToast("This match is already completed and locked."); return; } if (!winner) { setRunning(true); } }} className="bg-[#2ecc71] hover:bg-[#27ae60] text-white pt-1.5 pb-1 w-[76px] rounded-lg font-black text-[10px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(46,204,113,0.3)]">
                <PlayCircle size={16} strokeWidth={2.5}/> START
              </button>
              <button onClick={() => { if (dbMatchStatus === "COMPLETED") { showToast("This match is already completed and locked."); return; } setRunning(false); }} className="bg-[#f1c40f] hover:bg-[#d4ac0d] text-black pt-1.5 pb-1 w-[76px] rounded-lg font-black text-[10px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(241,196,15,0.3)]">
                <PauseCircle size={16} strokeWidth={2.5}/> PAUSE
              </button>
              <button onClick={handleResetClick} title="Reset the match (asks for a reason)" className="bg-[#e74c3c] hover:bg-[#c0392b] text-white pt-1.5 pb-1 w-[76px] rounded-lg font-black text-[10px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(231,76,60,0.3)]">
                <RotateCcw size={16} strokeWidth={2.5}/> RESET
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1 min-w-0 min-h-0">
            <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-widest text-white/80">OSAEKOMI TIMER</span>
              {osaActive && (
                <span className={`text-xl font-black animate-pulse ${osaFor === "A" ? "text-white" : "text-blue-400"}`}>
                  {fmtOsa(osaMs)}s
                  {osaLevelAt(osaTime) && <span className="ml-2 text-xs align-middle">{OSA_LABEL[osaLevelAt(osaTime)!]}</span>}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => startOsaekomi("A")} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 rounded-sm border border-white/30">Osaekomi (P1)</button>
              <button onClick={() => startOsaekomi("B")} className="bg-blue-900/40 hover:bg-blue-800/60 text-blue-400 text-xs font-bold py-2 rounded-sm border border-blue-700">Osaekomi (P2)</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={swapOsaekomi} disabled={!osaActive} className="bg-transparent border border-orange-500/50 hover:bg-orange-600/20 text-orange-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:border-gray-700 disabled:text-gray-500 text-[10px] font-bold py-2 rounded-sm transition-all">Swap P1 ⇄ P2 (Keep Time)</button>
              <button onClick={cancelOsaekomi} disabled={!osaActive} title="Player escaped the hold — stop the timer and keep the points earned" className="bg-transparent border border-red-500/60 hover:bg-red-600/20 text-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:border-gray-700 disabled:text-gray-500 text-[10px] font-bold py-2 rounded-sm transition-all">Cancel (Toketa)</button>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl flex-1 min-h-[140px] max-h-[360px] xl:max-h-none p-3 overflow-hidden flex flex-col shadow-lg border border-[#333]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-white">MATCH STATISTICS</span>
                <button
                  onClick={downloadStats}
                  title="Download match statistics (CSV)"
                  aria-label="Download match statistics"
                  className="p-1.5 rounded-md border border-[#444] text-gray-300 hover:bg-[#333] hover:text-white transition-colors"
                >
                  <Download size={13} />
                </button>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] flex items-center gap-2 text-gray-400 font-bold tracking-wider"><span className="w-2.5 h-2.5 rounded-full bg-white"></span> PLAYER 1</span>
                <span className="text-[10px] flex items-center gap-2 text-gray-400 font-bold tracking-wider"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> PLAYER 2</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin text-xs font-semibold text-gray-300 pr-2 relative">
              <div className="flex flex-col gap-4 relative z-10 pl-8 pt-2 pb-2">
                {/* Inside the list so the line runs its full scrolled length */}
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 to-red-500 rounded-full" />
                <div className="flex items-center gap-3">
                  <div className="absolute left-[9.5px] w-1.5 h-1.5 rounded-full bg-green-500 ring-4 ring-[#1a1a1a]" />
                  <span className="text-[10px] text-gray-400 font-bold w-8">0:00</span>
                  <span className="text-[10px] text-white font-bold">START</span>
                </div>
                {logs.map((l) => (
                  <div key={l.id} className="flex items-start gap-3">
                    <div className={`absolute left-[9.5px] w-1.5 h-1.5 rounded-full ring-4 ring-[#1a1a1a] ${l.fighter === "A" ? "bg-white" : l.fighter === "B" ? "bg-blue-500" : "bg-gray-500"}`} />
                    <span className="text-[10px] text-gray-400 font-bold w-8 mt-0.5">{new Date(l.timestamp).toLocaleTimeString([],{minute:'2-digit',second:'2-digit'})}</span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white font-bold tracking-wider">
                          {(() => {
                            if (l.text.includes('scored')) return l.text.split('scored ')[1].toUpperCase();
                            if (l.text.includes('Shido')) return 'SHIDO';
                            if (l.text.includes('Hansoku-make')) return 'HANSOKU-MAKE';
                            if (l.text.includes('executed')) return 'TECHNIQUE';
                            if (l.text.includes('Undo')) return 'UNDO';
                            if (l.text.includes('Winner')) return 'RESULT';
                            return 'NOTE';
                          })()}
                        </span>
                        {l.fighter && (
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${l.fighter === "A" ? "bg-white text-black" : "bg-blue-600 text-white"}`}>
                            PLAYER {l.fighter === "A" ? "1" : "2"}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-gray-500 mt-0.5">{l.text}</span>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── PLAYER 2 (BLUE) ── */}
        <PlayerPanel
          theme="blue"
          className="order-3 xl:order-3"
          name={fighterBName}
          club={fighterBClub}
          coach={fighterBCoach}
          score={scoreB}
          total={totalScore(scoreB)}
          osaActive={osaActive && osaFor === "B"}
          osaOtherActive={osaActive && osaFor === "A"}
          osaMs={osaFor === "B" ? osaMs : 0}
          onStartOsa={() => startOsaekomi("B")}
          onCancelOsa={cancelOsaekomi}
          onAdd={(f) => addScore("B", f)}
          onUndo={(f) => undoScore("B", f)}
          onHansoku={() => applyPenalty("B", "Hansoku-make", "")}
          onUndoLast={() => undoLastScore("B")}
          onWinner={() => setConfirmWinner("B")}
          techniques={techniques}
          penalties={penalties}
          tech={selectedTechB} setTech={setSelectedTechB}
          pen={selectedPenB} setPen={setSelectedPenB}
          desc={descB} setDesc={setDescB}
          onApply={() => handleApply("B")}
        />

      </div>

      {/* ══ EXPORT SECTION ════════════════════════════════════════════════════ */}
      {(isMatchEnded || winner || dbMatchStatus === "COMPLETED") && (
        <div className="pb-6 flex justify-center shrink-0 px-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 lg:px-8 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-8 shadow-xl w-full md:w-auto">
            <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">EXPORT</span>
            <div className="flex flex-wrap justify-center gap-2 lg:gap-4">
              <button 
                onClick={handlePrint} 
                className="bg-white text-black font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded-sm transition-colors hover:bg-gray-200"
              >
                <Download size={16} /> Save PDF
              </button>
              <button 
                onClick={() => saveMatchToDB()} 
                className="bg-white text-black font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded-sm transition-colors hover:bg-gray-200"
              >
                <CheckCircle size={16} /> Save Match
              </button>
              <button onClick={handleResetClick} className="bg-red-600 text-white font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded-sm hover:bg-red-500 transition-colors">
                <RotateCcw size={16} /> Reset Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESET MATCH OVERLAY MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {showResetPrompt && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-[#1a1a1a] border-2 border-[#333] p-6 sm:p-8 mx-4 rounded-2xl max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2 text-center">Reset Match</h2>
              <p className="text-gray-400 mb-6 font-semibold text-xs sm:text-sm text-center">
                Please provide a <span className="text-red-500 font-bold">mandatory</span> reason for resetting this match.
              </p>
              
              <input
                type="text"
                placeholder="Reason (Required)"
                value={resetComment}
                onChange={(e) => setResetComment(e.target.value)}
                className="w-full bg-[#111] text-white px-4 py-3 rounded-lg border border-[#333] focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all mb-6"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") confirmReset(); }}
              />

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => { setShowResetPrompt(false); setResetComment(""); }} className="flex-1 bg-transparent hover:bg-[#333] text-gray-300 border-2 border-[#444] font-black py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button 
                  onClick={confirmReset} 
                  disabled={!resetComment.trim()}
                  className={`flex-1 font-black py-3 rounded-xl shadow-lg transition-all ${
                    resetComment.trim() 
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20' 
                      : 'bg-[#333] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Confirm Reset
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── WINNER OVERLAY MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showWinnerModal && winner && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 30 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              className="bg-[#1a1a1a] border-2 border-[#333] px-6 sm:px-12 py-8 sm:py-12 mx-4 rounded-[2px] shadow-2xl flex flex-col items-center max-w-2xl w-full text-center relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-green-400 to-green-600" />
              
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4 sm:mb-6 ring-4 ring-green-500/20 shrink-0">
                <Trophy size={40} className="sm:w-12 sm:h-12" />
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-[0.3em] text-gray-500 mb-2">WINNER DECLARED</h2>
              <h1 className="text-4xl sm:text-6xl font-black text-white mb-2 sm:mb-3 leading-tight drop-shadow-lg break-words">
                {winner === "A" ? fighterAName : fighterBName}
              </h1>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-400 mb-6 sm:mb-10">
                {winner === "A" ? fighterAClub : fighterBClub}
              </h3>
              
              <div className="bg-[#111] px-6 py-4 rounded-2xl border border-[#333] mb-8 sm:mb-10 w-full shadow-inner">
                <span className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase block mb-1">Method of Victory</span>
                <span className="text-xl sm:text-2xl font-black text-[#FF7400] uppercase tracking-wider">{winMethod || "Decision"}</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <button 
                  onClick={handlePrint} 
                  className="flex-1 bg-white hover:bg-gray-200 text-black font-black py-4 rounded-xl transition-all shadow-xl shadow-white/10 flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg"
                >
                  <Download size={20} className="sm:w-6 sm:h-6" /> Download PDF
                </button>
                <button 
                  onClick={() => window.close()} 
                  className="px-8 bg-transparent hover:bg-[#333] text-gray-300 border-2 border-[#444] font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} /> Back to Matches
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TOAST MESSAGE ─────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-600 border-2 border-red-400 text-white font-bold px-8 py-4 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] z-[99999] flex items-center gap-3"
          >
            <AlertTriangle size={20} /> {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CONFIRM WINNER MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmWinner && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-[#1a1a1a] border-2 border-[#333] p-6 sm:p-8 mx-4 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
              <h2 className="text-xl sm:text-2xl font-black text-white mb-2">Confirm Winner?</h2>
              <p className="text-gray-400 mb-6 sm:mb-8 font-semibold text-xs sm:text-sm">
                Are you sure you want to declare <span className="text-white font-bold">{confirmWinner === "A" ? fighterAName : fighterBName}</span> as the final winner? This will end the match immediately.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => setConfirmWinner(null)} className="flex-1 bg-transparent hover:bg-[#333] text-gray-300 border-2 border-[#444] font-black py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={() => {
                  const ws = checkWin(scoreA, scoreB, goldenScore);
                  declareWinner(confirmWinner, (ws.w === confirmWinner && ws.m) ? ws.m : "Decision");
                  setConfirmWinner(null);
                }} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl shadow-lg shadow-green-500/20 transition-all">
                  Yes, Declare
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ── EDIT TIMER MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showEditTimerModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="bg-[#1a1a1a] border-2 border-[#333] p-6 sm:p-8 mx-4 rounded-2xl max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-500 to-yellow-500" />
              <h2 className="text-xl sm:text-2xl font-black text-white mb-6 text-center">Edit Timer</h2>
              
              <div className="flex gap-4 justify-center items-center mb-8">
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                    className="w-20 bg-[#111] text-white text-3xl font-black text-center px-2 py-3 rounded-lg border border-[#333] focus:border-orange-500 outline-none transition-all"
                  />
                  <span className="text-xs text-gray-500 font-bold mt-2 uppercase tracking-wider">Minutes</span>
                </div>
                <span className="text-3xl font-black text-gray-500 mb-6">:</span>
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editSeconds}
                    onChange={(e) => setEditSeconds(parseInt(e.target.value) || 0)}
                    className="w-20 bg-[#111] text-white text-3xl font-black text-center px-2 py-3 rounded-lg border border-[#333] focus:border-orange-500 outline-none transition-all"
                  />
                  <span className="text-xs text-gray-500 font-bold mt-2 uppercase tracking-wider">Seconds</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button onClick={() => setShowEditTimerModal(false)} className="flex-1 bg-transparent hover:bg-[#333] text-gray-300 border-2 border-[#444] font-black py-3 rounded-xl transition-all">
                  Cancel
                </button>
                <button 
                  onClick={handleSaveTimer} 
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl shadow-lg shadow-orange-500/20 transition-all"
                >
                  Save Time
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        </div>
      </div>

      {/* ── PRINTABLE MATCH REPORT ─────────────────────────────────────────── */}
      <div className="hidden print:block bg-white text-black font-sans px-16 py-12 absolute inset-0 w-full min-h-screen z-[99999]">
        <style type="text/css" media="print">
          {`
            @page { size: auto; margin: 0mm; }
            html, body { background-color: #ffffff !important; }
          `}
        </style>
        
        <div className="text-center border-b-2 border-black pb-6 mb-8 flex flex-col items-center">
          <img src={TNJA_LOGO} alt="Tamil Nadu Judo Association logo" className="w-24 h-24 mb-4 object-contain" />
          <h1 className="text-4xl font-black uppercase tracking-widest mb-2">Tamil Nadu Judo Association</h1>
          <h2 className="text-2xl font-bold text-gray-600 uppercase">Official Match Report</h2>
        </div>

        <div className="flex justify-between items-end mb-10">
          <div className="w-5/12 border-2 border-black rounded-xl p-6 bg-gray-50">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Player 1 (White)</span>
            <p className="text-3xl font-black mt-2 text-orange-600">{fighterAName}</p>
          </div>
          <div className="text-4xl font-black text-gray-300 pb-6">VS</div>
          <div className="w-5/12 border-2 border-black rounded-xl p-6 bg-gray-50 text-right">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Player 2 (Blue)</span>
            <p className="text-3xl font-black mt-2 text-yellow-600">{fighterBName}</p>
          </div>
        </div>

        <div className="mb-10">
          <h3 className="text-xl font-bold uppercase tracking-widest border-b border-gray-300 pb-2 mb-4">Final Score</h3>
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 p-3">Player</th>
                <th className="border border-gray-400 p-3">Ippon</th>
                <th className="border border-gray-400 p-3">Waza-Ari</th>
                <th className="border border-gray-400 p-3">Yuko</th>
                <th className="border border-gray-400 p-3">Shido</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-400 p-3 font-bold">{fighterAName}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreA.ippon}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreA.wazaAri}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreA.yuko}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black text-red-600">{scoreA.shido}</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="border border-gray-400 p-3 font-bold">{fighterBName}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreB.ippon}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreB.wazaAri}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black">{scoreB.yuko}</td>
                <td className="border border-gray-400 p-3 text-2xl font-black text-red-600">{scoreB.shido}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-10">
          <h3 className="text-xl font-bold uppercase tracking-widest border-b border-gray-300 pb-2 mb-4">Match Log / Timeline</h3>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 p-2 w-24">Time</th>
                <th className="border border-gray-400 p-2 w-48">Competitor</th>
                <th className="border border-gray-400 p-2">Action / Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-300">
                  <td className="border-x border-gray-300 p-2 font-mono text-gray-600">
                    {new Date(l.timestamp).toLocaleTimeString([], {minute:'2-digit',second:'2-digit'})}
                  </td>
                  <td className="border-x border-gray-300 p-2 font-bold">
                    {l.fighter ? (l.fighter === "A" ? fighterAName : fighterBName) : "- System -"}
                  </td>
                  <td className="border-x border-gray-300 p-2">{l.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {winner && (
          <div className="mt-12 p-8 bg-green-50 border-4 border-green-600 rounded-2xl text-center">
            <p className="text-green-800 font-bold tracking-widest uppercase mb-2">Winner Declared</p>
            <h2 className="text-4xl font-black text-green-700">{winner === "A" ? fighterAName : fighterBName}</h2>
            <p className="text-gray-600 font-bold mt-4">Method of Victory: {winMethod}</p>
          </div>
        )}
      </div>
    </>
  );
}

import { Minus, Plus } from "lucide-react";
import { TNJA_LOGO } from "@/constants/brand";

type PanelTheme = "white" | "blue";
type PanelTokens = Record<string, string>;

/** Colour tokens for the two competitor cards: a clean white card and a solid blue card. */
const PANEL: Record<PanelTheme, PanelTokens> = {
  white: {
    card: "bg-white text-slate-900 border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.35)]",
    chip: "bg-slate-900 text-white",
    avatar: "bg-slate-100 text-slate-800 ring-1 ring-slate-200",
    muted: "text-slate-500",
    label: "text-slate-400",
    box: "bg-slate-50 border-slate-200",
    boxShido: "bg-yellow-50 border-yellow-300",
    boxHansoku: "bg-red-50 border-red-300",
    btn: "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    field: "bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:ring-slate-200",
    option: "bg-white text-slate-800",
    undo: "border-red-200 text-red-600 hover:bg-red-50",
    winner: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    lock: "bg-slate-50 border-slate-200",
    lockActive: "bg-slate-50 border-slate-900 ring-2 ring-slate-900/10",
    track: "bg-slate-200",
    fill: "bg-slate-900",
    tick: "bg-slate-50",
    start: "bg-slate-900 text-white hover:bg-slate-800",
    cancel: "border-red-300 text-red-600 hover:bg-red-50",
    markIdle: "border-slate-200 text-slate-400",
    markPassed: "border-slate-200 text-slate-300 line-through",
    markCurrent: "border-orange-400 bg-orange-50 text-orange-600",
  },
  blue: {
    card: "bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-white border border-blue-400/40 shadow-[0_10px_30px_rgba(29,78,216,0.35)]",
    chip: "bg-white text-blue-700",
    avatar: "bg-white/15 text-white ring-1 ring-white/30",
    muted: "text-blue-100/80",
    label: "text-blue-100/70",
    box: "bg-white/10 border-white/15",
    boxShido: "bg-yellow-400/20 border-yellow-300/60",
    boxHansoku: "bg-red-500/30 border-red-300/60",
    btn: "bg-white/10 border-white/15 text-white hover:bg-white/20",
    field: "bg-white/10 border-white/20 text-white placeholder:text-blue-100/60 focus:border-white/60 focus:ring-white/20",
    option: "bg-[#1e3a8a] text-white",
    undo: "border-red-300/50 text-red-100 hover:bg-red-500/20",
    winner: "border-emerald-300/50 text-emerald-100 hover:bg-emerald-500/20",
    lock: "bg-white/10 border-white/15",
    lockActive: "bg-white/10 border-white ring-2 ring-white/30",
    track: "bg-white/15",
    fill: "bg-white",
    tick: "bg-[#1e40af]",
    start: "bg-white text-blue-700 hover:bg-blue-50",
    cancel: "border-red-300/60 text-red-100 hover:bg-red-500/20",
    markIdle: "border-white/15 text-blue-100/60",
    markPassed: "border-white/10 text-blue-100/40 line-through",
    markCurrent: "border-amber-300 bg-amber-300/20 text-amber-100",
  },
};

type ScoreField = "ippon" | "wazaAri" | "yuko" | "shido";

/** One competitor's card: name, score, lock timer and the referee controls. */
function PlayerPanel(props: {
  theme: PanelTheme; className?: string;
  name: string; club: string; coach?: string; score: Score; total: number;
  osaActive: boolean; osaOtherActive: boolean; osaMs: number; onStartOsa: () => void; onCancelOsa: () => void;
  onAdd: (f: ScoreField) => void; onUndo: (f: ScoreField) => void; onHansoku: () => void; onUndoLast: () => void; onWinner: () => void;
  techniques: string[]; penalties: string[];
  tech: string; setTech: (v: string) => void; pen: string; setPen: (v: string) => void; desc: string; setDesc: (v: string) => void;
  onApply: () => void;
}) {
  const { theme, score } = props;
  const t = PANEL[theme];
  const hansoku = score.shido >= 3;
  const fieldCls = `w-full border rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 transition-colors ${t.field}`;

  return (
    <div className={`flex-[1.2] flex flex-col rounded-2xl overflow-hidden p-4 lg:p-5 gap-4 ${t.card} ${props.className ?? ""}`}>
      {/* Header: identity + total */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 lg:w-14 lg:h-14 shrink-0 rounded-full flex items-center justify-center text-base lg:text-lg font-black ${t.avatar}`}>
          {props.name.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[10px] font-black tracking-widest px-2.5 py-0.5 rounded-full mb-1 ${t.chip}`}>
            {theme === "white" ? "PLAYER 1 · WHITE" : "PLAYER 2 · BLUE"}
          </span>
          <h2 className="text-lg lg:text-xl font-black leading-tight truncate">{props.name}</h2>
          {(props.club || props.coach) && (
            <p className={`text-xs truncate ${t.muted}`}>{[props.club, props.coach && `Coach: ${props.coach}`].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[10px] font-black tracking-widest ${t.label}`}>SCORE</p>
          <p className="text-3xl lg:text-4xl font-black tabular-nums leading-none">{props.total}</p>
        </div>
      </div>

      {/* Score boxes */}
      <div className="grid grid-cols-4 gap-2">
        <ScoreBox t={t} label="IPPON" value={score.ippon} onUndo={() => props.onUndo("ippon")} onAdd={() => props.onAdd("ippon")} />
        <ScoreBox t={t} label="WAZA-ARI" value={score.wazaAri} onUndo={() => props.onUndo("wazaAri")} onAdd={() => props.onAdd("wazaAri")} />
        <ScoreBox t={t} label="YUKO" value={score.yuko} onUndo={() => props.onUndo("yuko")} onAdd={() => props.onAdd("yuko")} />
        <ScoreBox t={t} label={hansoku ? "HANSOKU" : "SHIDO"} value={hansoku ? "H" : score.shido}
          tone={hansoku ? t.boxHansoku : score.shido > 0 ? t.boxShido : undefined}
          onUndo={() => props.onUndo("shido")} onAdd={() => props.onAdd("shido")} />
      </div>

      <OsaekomiCard t={t} active={props.osaActive} otherActive={props.osaOtherActive} ms={props.osaMs} onStart={props.onStartOsa} onCancel={props.onCancelOsa} />

      {/* Referee actions */}
      <div className="flex flex-col gap-2.5 flex-grow">
        <span className={`text-[10px] font-black tracking-widest ${t.label}`}>ACTIONS</span>
        <div className="grid grid-cols-5 gap-2">
          <ActionBtn t={t} label="IPPON" onClick={() => props.onAdd("ippon")} />
          <ActionBtn t={t} label="WAZA-ARI" onClick={() => props.onAdd("wazaAri")} />
          <ActionBtn t={t} label="YUKO" onClick={() => props.onAdd("yuko")} />
          <ActionBtn t={t} label="SHIDO" icon={<span className="w-2.5 h-3.5 bg-yellow-400 rounded-[2px]" />} onClick={() => props.onAdd("shido")} />
          <ActionBtn t={t} label="HANSOKU" icon={<span className="w-2.5 h-3.5 bg-red-600 rounded-[2px]" />} onClick={props.onHansoku} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={props.onUndoLast} className={`border py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors ${t.undo}`}>
            <RotateCcw size={14} /> UNDO LAST
          </button>
          <button onClick={props.onWinner} className={`border py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors ${t.winner}`}>
            <Trophy size={14} /> WINNER
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select value={props.tech} onChange={(e) => props.setTech(e.target.value)} aria-label="Technique" className={fieldCls}>
            <option value="" className={t.option}>Select Technique</option>
            {props.techniques.map((x) => <option key={x} value={x} className={t.option}>{x}</option>)}
          </select>
          <select value={props.pen} onChange={(e) => props.setPen(e.target.value)} aria-label="Penalty" className={fieldCls}>
            <option value="" className={t.option}>Select Penalty</option>
            {props.penalties.map((x) => <option key={x} value={x} className={t.option}>{x}</option>)}
          </select>
        </div>

        <textarea value={props.desc} onChange={(e) => props.setDesc(e.target.value)} placeholder="Description" className={`${fieldCls} h-11 resize-none`} />

        <button onClick={props.onApply} className="mt-auto w-full bg-[#16a34a] hover:bg-[#15803d] text-white font-black tracking-wider py-2.5 rounded-lg text-sm transition-colors shadow-[0_4px_14px_rgba(22,163,74,0.35)]">
          APPLY
        </button>
      </div>
    </div>
  );
}

function ScoreBox({ t, label, value, tone, onUndo, onAdd }: { t: PanelTokens; label: string; value: number | string; tone?: string; onUndo?: () => void; onAdd?: () => void }) {
  return (
    <div className={`${tone ?? t.box} rounded-xl flex flex-col items-center justify-center py-2.5 border relative group`}>
      <span className={`text-[10px] font-black tracking-widest ${t.label}`}>{label}</span>
      <span className="text-3xl leading-tight font-black tabular-nums">{value}</span>
      <div className="absolute -bottom-2 right-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onUndo && (
          <button onClick={(e) => { e.stopPropagation(); onUndo(); }} className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform" title="Undo Score">
            <Minus size={14} strokeWidth={4} />
          </button>
        )}
        {onAdd && (
          <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform" title="Add Score">
            <Plus size={14} strokeWidth={4} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Per-player hold (osaekomi) timer: a 0–20s bar with the Yuko (5s), Waza-ari (10s) and Ippon (20s)
 * marks. The mark reached lights up; the score itself is awarded by the timer logic above.
 */
function OsaekomiCard({ t, active, otherActive, ms, onStart, onCancel }: {
  t: PanelTokens; active: boolean; otherActive: boolean; ms: number; onStart: () => void; onCancel: () => void;
}) {
  const seconds = Math.floor(ms / 1000);
  const marks: { s: number; award: OsaAward }[] = [
    { s: OSAEKOMI_YUKO_S, award: "yuko" },
    { s: OSAEKOMI_WAZAARI_S, award: "wazaAri" },
    { s: OSAEKOMI_IPPON_S, award: "ippon" },
  ];
  const reached = osaLevelAt(seconds);
  const next = marks.find((m) => seconds < m.s);
  const pct = Math.min(100, (ms / (OSAEKOMI_IPPON_S * 1000)) * 100);

  return (
    <div className={`rounded-xl border p-3 transition-all ${active ? t.lockActive : t.lock}`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`text-[10px] font-black tracking-widest ${t.label}`}>LOCK TIMER</span>
          <span className={`text-2xl font-black tabular-nums ${active ? "" : "opacity-30"}`}>{fmtOsa(ms)}s</span>
          {active && next && <span className={`text-[10px] font-bold truncate tabular-nums ${t.muted}`}>{((next.s * 1000 - ms) / 1000).toFixed(1)}s to {OSA_LABEL[next.award]}</span>}
        </div>
        {active ? (
          <button onClick={onCancel} title="Player escaped the hold — stop and keep the points earned"
            className={`px-3 py-1.5 rounded-lg border text-[10px] font-black tracking-wider transition-colors ${t.cancel}`}>
            CANCEL
          </button>
        ) : (
          <button onClick={onStart} disabled={otherActive} title={otherActive ? "The other player is holding — use Swap" : "Start the hold for this player"}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-colors disabled:opacity-30 ${t.start}`}>
            START LOCK
          </button>
        )}
      </div>

      {/* Progress to 20s with the score marks */}
      <div className={`relative h-2 rounded-full ${t.track}`}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${t.fill}`} style={{ width: `${pct}%` }} />
        {marks.slice(0, -1).map((m) => (
          <div key={m.s} className={`absolute -top-0.5 -bottom-0.5 w-0.5 ${t.tick}`} style={{ left: `${(m.s / OSAEKOMI_IPPON_S) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {marks.map((m) => (
          <div key={m.s} className={`rounded-lg border px-2 py-1 text-center transition-colors ${
            reached === m.award ? t.markCurrent : seconds >= m.s ? t.markPassed : t.markIdle
          }`}>
            <p className="text-[10px] font-black tracking-wider">{OSA_LABEL[m.award]}</p>
            <p className="text-[9px] font-bold">{m.s}s</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({ t, icon, label, onClick }: { t: PanelTokens; icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 border rounded-lg py-2 px-1 transition-colors ${t.btn}`}>
      {icon && <span className="h-3.5 flex items-center">{icon}</span>}
      <span className="text-[9px] font-black tracking-wider">{label}</span>
    </button>
  );
}

export default function ScoreboardPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[9999] bg-[#111] flex items-center justify-center text-white/50 font-bold">Loading Scoreboard...</div>}>
      <ScoreboardInner />
    </Suspense>
  );
}
