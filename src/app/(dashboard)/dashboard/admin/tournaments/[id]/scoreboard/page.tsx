"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Download, CheckCircle, RotateCcw, ArrowLeft, RefreshCw, Hand, Activity, StopCircle, PlayCircle, PauseCircle, AlertTriangle } from "lucide-react";

interface Score { ippon: number; wazaAri: number; yuko: number; shido: number; awaseteIppon?: boolean }
type Fighter = "A" | "B";

const OSAEKOMI_IPPON_S   = 20;
const OSAEKOMI_WAZAARI_S = 10;
const OSAEKOMI_YUKO_S    = 5;
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
  const [osaTime, setOsaTime]     = useState(0);
  const osaRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const osaMilestones = useRef({ wazaAri: false, yuko: false });

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
    setOsaTime(0);
    setDbMatchStatus("PENDING");
    if (timerRef.current) clearInterval(timerRef.current);
    if (osaRef.current) clearInterval(osaRef.current);
    
    saveMatchToDB(emptyScore(), emptyScore(), null, "", nextLogs);
    showToast("Match has been reset successfully!");
    setShowResetPrompt(false);
    setResetComment("");
  }, [durationInput, saveMatchToDB, showToast, resetComment]);

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

  useEffect(() => {
    if (osaActive && osaFor) {
      osaRef.current = setInterval(() => {
        osaTimeRef.current += 1;
        const next = osaTimeRef.current;
        setOsaTime(next);

        if (next === OSAEKOMI_YUKO_S && !osaMilestones.current.yuko) {
          osaMilestones.current.yuko = true;
          const fighterName = osaFor === "A" ? fighterAName : fighterBName;
          const newLog = { id: `${Date.now()}_osa_${osaFor}_yuko`, timestamp: Date.now(), text: `${fighterName} scored YUKO (Osaekomi)`, type: "score" as const, fighter: osaFor };
          const nL = [...logsRef.current, newLog];
          setLogs(nL); logsRef.current = nL;
          
          if (osaFor === "A") {
            setScoreA(p => { 
              const nx = { ...p, yuko: p.yuko + 1 }; 
              setTimeout(() => saveMatchToDBRef.current(nx, undefined, undefined, undefined, nL), 0); 
              return nx; 
            });
          } else {
            setScoreB(p => { 
              const nx = { ...p, yuko: p.yuko + 1 }; 
              setTimeout(() => saveMatchToDBRef.current(undefined, nx, undefined, undefined, nL), 0); 
              return nx; 
            });
          }
        }

        if (next === OSAEKOMI_WAZAARI_S && !osaMilestones.current.wazaAri) {
          osaMilestones.current.wazaAri = true;
          const fighterName = osaFor === "A" ? fighterAName : fighterBName;
          const newLog = { id: `${Date.now()}_osa_${osaFor}_wazaari`, timestamp: Date.now(), text: `${fighterName} scored WAZA-ARI (Osaekomi)`, type: "score" as const, fighter: osaFor };
          const nL = [...logsRef.current, newLog];
          setLogs(nL); logsRef.current = nL;
          
          if (osaFor === "A") {
            setScoreA(p => { 
              const nx = { ...p, wazaAri: p.wazaAri + 1 }; 
              if (nx.wazaAri === 2) {
                nx.wazaAri = 0;
                nx.ippon = 1;
                nx.awaseteIppon = true;
              }
              setTimeout(() => saveMatchToDBRef.current(nx, undefined, undefined, undefined, nL), 0); 
              return nx; 
            });
          } else {
            setScoreB(p => { 
              const nx = { ...p, wazaAri: p.wazaAri + 1 }; 
              if (nx.wazaAri === 2) {
                nx.wazaAri = 0;
                nx.ippon = 1;
                nx.awaseteIppon = true;
              }
              setTimeout(() => saveMatchToDBRef.current(undefined, nx, undefined, undefined, nL), 0); 
              return nx; 
            });
          }
        }
        if (next >= OSAEKOMI_IPPON_S) {
          clearInterval(osaRef.current!); setOsaActive(false); setRunning(false);
          const fighterName = osaFor === "A" ? fighterAName : fighterBName;
          const newLog = { id: `${Date.now()}_osa_${osaFor}_ippon`, timestamp: Date.now(), text: `${fighterName} scored IPPON (Osaekomi)`, type: "score" as const, fighter: osaFor };
          const nL = [...logsRef.current, newLog];
          setLogs(nL); logsRef.current = nL;
          
          if (osaFor === "A") { setScoreA(p => { const nx = { ...p, ippon: p.ippon + 1 }; setTimeout(() => saveMatchToDBRef.current(nx, undefined, undefined, undefined, nL), 0); return nx; }); }
          else                { setScoreB(p => { const nx = { ...p, ippon: p.ippon + 1 }; setTimeout(() => saveMatchToDBRef.current(undefined, nx, undefined, undefined, nL), 0); return nx; }); }
        }
      }, 1000);
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
    setOsaTime(0);
    setOsaActive(true); setOsaFor(fighter);
    osaMilestones.current = { wazaAri: false, yuko: false };
    if (!running) setRunning(true);
  };

  const toketa = () => {
    if (dbMatchStatus === "COMPLETED") {
      showToast("This match is already completed and locked. You cannot change the winner.");
      return;
    }
    setOsaActive(false); setOsaFor(null); 
    osaTimeRef.current = 0;
    setOsaTime(0);
    if (osaRef.current) clearInterval(osaRef.current);
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
    const newFighter = oldFighter === "A" ? "B" : "A";

    // Switch holder
    setOsaFor(newFighter);

    // Adjust scores if milestones were hit during this active hold
    let nextScoreA = { ...scoreA };
    let nextScoreB = { ...scoreB };

    const hasYuko = osaMilestones.current.yuko;
    const hasWazaAri = osaMilestones.current.wazaAri;

    if (oldFighter === "A") {
      if (hasYuko) {
        nextScoreA.yuko = Math.max(0, nextScoreA.yuko - 1);
        nextScoreB.yuko = nextScoreB.yuko + 1;
      }
      if (hasWazaAri) {
        if (nextScoreA.awaseteIppon) {
          nextScoreA.awaseteIppon = false;
          nextScoreA.ippon = Math.max(0, nextScoreA.ippon - 1);
          nextScoreA.wazaAri = 1;
        } else {
          nextScoreA.wazaAri = Math.max(0, nextScoreA.wazaAri - 1);
        }
        nextScoreB.wazaAri = nextScoreB.wazaAri + 1;
        if (nextScoreB.wazaAri === 2) {
          nextScoreB.wazaAri = 0;
          nextScoreB.ippon = nextScoreB.ippon + 1;
          nextScoreB.awaseteIppon = true;
        }
      }
    } else {
      if (hasYuko) {
        nextScoreB.yuko = Math.max(0, nextScoreB.yuko - 1);
        nextScoreA.yuko = nextScoreA.yuko + 1;
      }
      if (hasWazaAri) {
        if (nextScoreB.awaseteIppon) {
          nextScoreB.awaseteIppon = false;
          nextScoreB.ippon = Math.max(0, nextScoreB.ippon - 1);
          nextScoreB.wazaAri = 1;
        } else {
          nextScoreB.wazaAri = Math.max(0, nextScoreB.wazaAri - 1);
        }
        nextScoreA.wazaAri = nextScoreA.wazaAri + 1;
        if (nextScoreA.wazaAri === 2) {
          nextScoreA.wazaAri = 0;
          nextScoreA.ippon = nextScoreA.ippon + 1;
          nextScoreA.awaseteIppon = true;
        }
      }
    }

    // Update logs
    const oldName = oldFighter === "A" ? fighterAName : fighterBName;
    const newName = newFighter === "A" ? fighterAName : fighterBName;

    const filteredLogs = logs.filter(log => {
      // Remove the score logs generated during this session for the old fighter
      if (log.type === "score" && log.id.includes(`_osa_${oldFighter}_`)) {
        return false;
      }
      return true;
    });

    const swapLog = {
      id: `${Date.now()}_osa_swap`,
      timestamp: Date.now(),
      text: `Osaekomi swapped from ${oldName} to ${newName} at ${osaTime}s`,
      type: "system" as const
    };

    const newLogs = [...filteredLogs, swapLog];

    if (hasYuko) {
      newLogs.push({
        id: `${Date.now()}_osa_${newFighter}_yuko`,
        timestamp: Date.now(),
        text: `${newName} scored YUKO (Osaekomi)`,
        type: "score" as const,
        fighter: newFighter
      });
    }
    if (hasWazaAri) {
      newLogs.push({
        id: `${Date.now()}_osa_${newFighter}_wazaari`,
        timestamp: Date.now(),
        text: `${newName} scored WAZA-ARI (Osaekomi)`,
        type: "score" as const,
        fighter: newFighter
      });
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
        <div className="w-full max-w-[1400px] min-h-[100dvh] xl:min-h-0 xl:h-full xl:max-h-[900px] flex flex-col bg-[#111111] relative border border-white/10 rounded-none xl:rounded-lg shadow-2xl xl:overflow-hidden m-0 xl:my-auto xl:mx-4">
        
        {/* ══ HEADER ════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 lg:px-8 py-4 border-b border-[#333] bg-[#1a1a1a] shadow-md shrink-0">
        <div className="flex items-center">
          <img src="/navbar/Logo.png" alt="TNJA Logo" className="h-10 lg:h-16 w-auto object-contain" />
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-[#f97316] text-lg lg:text-xl font-black tracking-wide uppercase text-center">{tournamentTitle}</h1>
          <p className="text-gray-400 text-xs lg:text-sm font-medium tracking-wide text-center">
            {weightCategory} <span className="text-[#f97316]">●</span> Match {matchNumber} <span className="text-[#f97316]">●</span> Mat {matNumber}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:gap-4">
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
      <div className="flex-1 p-4 lg:p-6 flex flex-col xl:flex-row gap-4 lg:gap-6 overflow-y-auto xl:overflow-hidden">
        
        {/* ── PLAYER 1 (WHITE) ──────────────────────────────────────────── */}
        <div className="flex-[1.2] flex flex-col bg-[#161616] rounded-2xl border-2 border-white/80 shadow-[0_0_35px_rgba(255,255,255,0.3)] overflow-hidden p-4 relative order-2 xl:order-1">
          <div className="flex justify-between items-start mb-4">
            <span className="bg-white text-black text-xs font-bold px-4 py-1.5 rounded-full tracking-wider shadow-lg">PLAYER 1</span>
            <span className="text-2xl lg:text-3xl">🇮🇳</span>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6 mb-4">
            <div className="w-16 h-16 lg:w-20 lg:h-20 shrink-0 rounded-full border border-gray-400 overflow-hidden bg-gray-200 flex items-center justify-center shadow-lg">
              <span className="text-black text-xl lg:text-2xl font-black">{fighterAName.substring(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-1 truncate">{fighterAName}</h2>
              <p className="text-xs lg:text-sm text-gray-400 mb-2 truncate">{fighterAClub}</p>
              {fighterACoach && <div className="text-gray-500 text-xs font-semibold tracking-wider mb-2 truncate">Coach: {fighterACoach}</div>}
              <div className="text-lg lg:text-xl font-bold text-white">Score : {totalScore(scoreA)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-4 mb-4">
            <ScoreBox label="IPPON" value={scoreA.ippon} theme="white" onUndo={() => undoScore("A", "ippon")} onAdd={() => addScore("A", "ippon")} />
            <ScoreBox label="WAZA-ARI" value={scoreA.wazaAri} theme="white" onUndo={() => undoScore("A", "wazaAri")} onAdd={() => addScore("A", "wazaAri")} />
            <ScoreBox label="YUKO" value={scoreA.yuko} theme="white" onUndo={() => undoScore("A", "yuko")} onAdd={() => addScore("A", "yuko")} />
            <ScoreBox label={scoreA.shido >= 3 ? "HANSOKU" : "SHIDO"} value={scoreA.shido >= 3 ? "H" : scoreA.shido} theme="white" onUndo={() => undoScore("A", "shido")} onAdd={() => addScore("A", "shido")} />
          </div>

          <div className="flex flex-col flex-grow">
            <span className="text-xs font-bold tracking-widest text-white mb-2">ACTIONS</span>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 lg:gap-3 mb-4">
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="IPPON" onClick={() => addScore("A", "ippon")} />
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="WAZA-ARI" onClick={() => addScore("A", "wazaAri")} />
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="YUKO" onClick={() => addScore("A", "yuko")} />
              <ActionBtn icon={<div className="w-3 h-4 bg-yellow-400 rounded-sm shadow-sm" />} label="SHIDO" onClick={() => addScore("A", "shido")} />
              <ActionBtn icon={<div className="w-3 h-4 bg-red-600 rounded-sm shadow-sm" />} label="HANSOKU" onClick={() => applyPenalty("A", "Hansoku-make", "")} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => undoLastScore("A")} className="border border-red-700 text-red-500 hover:bg-red-900/30 py-2.5 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <RotateCcw size={16} /> UNDO LAST
              </button>
              <button onClick={() => setConfirmWinner("A")} className="border border-green-700 text-green-500 hover:bg-green-900/30 py-2.5 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <Trophy size={16} /> WINNER
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <select value={selectedTechA} onChange={e=>setSelectedTechA(e.target.value)} className="bg-transparent border border-white/50 text-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-white appearance-none">
                <option value="">Select Technique</option>
                {techniques.map(t=><option key={t} value={t} className="bg-[#141414]">{t}</option>)}
              </select>
              <select value={selectedPenA} onChange={e=>setSelectedPenA(e.target.value)} className="bg-transparent border border-white/50 text-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-white appearance-none">
                <option value="">Select Penalty</option>
                {penalties.map(p=><option key={p} value={p} className="bg-[#141414]">{p}</option>)}
              </select>
            </div>

            <textarea value={descA} onChange={e=>setDescA(e.target.value)} placeholder="Description" className="w-full bg-transparent border border-white/50 text-gray-300 rounded p-3 text-sm h-16 resize-none mb-4 focus:outline-none focus:ring-1 focus:ring-white" />
            
            <div className="mt-auto flex justify-center">
              <button onClick={() => handleApply("A")} className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3 px-16 rounded text-sm transition-colors shadow-[0_0_15px_rgba(22,163,74,0.4)]">
                APPLY
              </button>
            </div>
          </div>
        </div>

        {/* ── CENTER PANEL ────────────────────────────────────────────────── */}
        <div className="w-full xl:w-[380px] shrink-0 flex flex-col lg:flex-row xl:flex-col gap-4 lg:gap-6 order-1 xl:order-2 lg:col-span-2 xl:col-span-1 items-stretch">
          <div className="bg-[#1a1a1a] rounded-2xl flex flex-col items-center justify-center pt-8 pb-4 relative shadow-lg lg:w-[380px] xl:w-auto shrink-0">
            
            <div className="relative flex flex-col items-center justify-center">
              <svg className="w-[260px] h-[260px]">
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
                <span className="text-[11px] font-black tracking-[0.2em] text-[#5a7fa8] mb-1">{goldenScore ? "GOLDEN SCORE" : "ROUND 1"}</span>
                <button onClick={handleOpenEditTimer} className="text-6xl font-black text-white tabular-nums tracking-tighter mb-1 drop-shadow-md hover:text-orange-400 hover:scale-105 transition-all cursor-pointer">
                  {fmt(timeLeft)}
                </button>
                <span className="text-[10px] font-black tracking-[0.1em] text-[#5a7fa8]">TIME REMAINING</span>
              </div>
            </div>

            <div className="flex gap-5 w-full px-4 mt-2 justify-center">
              <button onClick={() => { if (dbMatchStatus === "COMPLETED") { showToast("This match is already completed and locked."); return; } if (!winner) { setRunning(true); } }} className="bg-[#2ecc71] hover:bg-[#27ae60] text-white pt-2 pb-1.5 w-[90px] rounded-lg font-black text-[11px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(46,204,113,0.3)]">
                <PlayCircle size={18} strokeWidth={2.5}/> START
              </button>
              <button onClick={() => { if (dbMatchStatus === "COMPLETED") { showToast("This match is already completed and locked."); return; } setRunning(false); }} className="bg-[#f1c40f] hover:bg-[#d4ac0d] text-black pt-2 pb-1.5 w-[90px] rounded-lg font-black text-[11px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(241,196,15,0.3)]">
                <PauseCircle size={18} strokeWidth={2.5}/> PAUSE
              </button>
              <button onClick={() => { if (dbMatchStatus === "COMPLETED") { showToast("This match is already completed and locked."); return; } setRunning(false); setTimeLeft(0); }} className="bg-[#e74c3c] hover:bg-[#c0392b] text-white pt-2 pb-1.5 w-[90px] rounded-lg font-black text-[11px] tracking-wider flex flex-col items-center gap-1 shadow-[0_4px_10px_rgba(231,76,60,0.3)]">
                <StopCircle size={18} strokeWidth={2.5}/> STOP
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:gap-6 flex-1 min-w-0">
            <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-white">OSAEKOMI TIMER</span>
              {osaActive && (
                <span className={`text-xl font-black animate-pulse ${osaFor === "A" ? "text-white" : "text-blue-400"}`}>
                  {osaTime}s
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => startOsaekomi("A")} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded border border-white/30">Osaekomi (P1)</button>
              <button onClick={() => startOsaekomi("B")} className="bg-blue-900/40 hover:bg-blue-800/60 text-blue-400 text-xs font-bold py-2.5 rounded border border-blue-700">Osaekomi (P2)</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={swapOsaekomi} disabled={!osaActive} className="bg-transparent border border-orange-500/50 hover:bg-orange-600/20 text-orange-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:border-gray-700 disabled:text-gray-500 text-[10px] font-bold py-2.5 rounded transition-all">Swap P1 ⇄ P2 (Keep Time)</button>
              <button onClick={toketa} className="bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 text-[10px] font-bold py-2.5 rounded transition-all">Toketa (Stop Hold)</button>
            </div>
          </div>

          <div className="bg-[#1a1a1a] rounded-xl flex-1 p-5 overflow-hidden flex flex-col shadow-lg border border-[#333]">
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-bold tracking-widest text-white">MATCH STATISTICS</span>
              <div className="flex flex-col gap-1 items-end">
                <span className="text-[10px] flex items-center gap-2 text-gray-400 font-bold tracking-wider"><span className="w-2.5 h-2.5 rounded-full bg-white"></span> PLAYER 1</span>
                <span className="text-[10px] flex items-center gap-2 text-gray-400 font-bold tracking-wider"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> PLAYER 2</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin text-xs font-semibold text-gray-300 pr-2 relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-yellow-500 to-red-500 rounded-full" />
              <div className="flex flex-col gap-4 relative z-10 pl-8 pt-2 pb-2">
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

        {/* ── PLAYER 2 (BLUE) ────────────────────────────────────────── */}
        <div className="flex-[1.2] flex flex-col bg-[#161616] rounded-2xl border-2 border-blue-500 shadow-[0_0_35px_rgba(37,99,235,0.5)] overflow-hidden p-4 relative order-3 xl:order-3">
          <div className="flex justify-between items-start mb-4">
            <span className="bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full tracking-wider shadow-lg">PLAYER 2</span>
            <span className="text-2xl lg:text-3xl">🇮🇳</span>
          </div>
          
          <div className="flex items-center gap-4 lg:gap-6 mb-4">
            <div className="w-16 h-16 lg:w-20 lg:h-20 shrink-0 rounded-full border border-gray-600 overflow-hidden bg-blue-800 flex items-center justify-center shadow-lg">
              <span className="text-white text-xl lg:text-2xl font-black">{fighterBName.substring(0, 2).toUpperCase()}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-1 truncate">{fighterBName}</h2>
              <p className="text-xs lg:text-sm text-gray-400 mb-2 truncate">{fighterBClub}</p>
              <div className="text-lg lg:text-xl font-bold text-white">Score : {totalScore(scoreB)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-4 mb-4">
            <ScoreBox label="IPPON" value={scoreB.ippon} theme="blue" onUndo={() => undoScore("B", "ippon")} onAdd={() => addScore("B", "ippon")} />
            <ScoreBox label="WAZA-ARI" value={scoreB.wazaAri} theme="blue" onUndo={() => undoScore("B", "wazaAri")} onAdd={() => addScore("B", "wazaAri")} />
            <ScoreBox label="YUKO" value={scoreB.yuko} theme="blue" onUndo={() => undoScore("B", "yuko")} onAdd={() => addScore("B", "yuko")} />
            <ScoreBox label={scoreB.shido >= 3 ? "HANSOKU" : "SHIDO"} value={scoreB.shido >= 3 ? "H" : scoreB.shido} theme="blue" onUndo={() => undoScore("B", "shido")} onAdd={() => addScore("B", "shido")} />
          </div>

          <div className="flex flex-col flex-grow">
            <span className="text-xs font-bold tracking-widest text-white mb-2">ACTIONS</span>
            
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 lg:gap-3 mb-4">
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="IPPON" onClick={() => addScore("B", "ippon")} />
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="WAZA-ARI" onClick={() => addScore("B", "wazaAri")} />
              <ActionBtn icon={<span className="text-[14px]">🥋</span>} label="YUKO" onClick={() => addScore("B", "yuko")} />
              <ActionBtn icon={<div className="w-3 h-4 bg-yellow-400 rounded-sm shadow-sm" />} label="SHIDO" onClick={() => addScore("B", "shido")} />
              <ActionBtn icon={<div className="w-3 h-4 bg-red-600 rounded-sm shadow-sm" />} label="HANSOKU" onClick={() => applyPenalty("B", "Hansoku-make", "")} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <button onClick={() => undoLastScore("B")} className="border border-red-700 text-red-500 hover:bg-red-900/30 py-2.5 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <RotateCcw size={16} /> UNDO LAST
              </button>
              <button onClick={() => setConfirmWinner("B")} className="border border-green-700 text-green-500 hover:bg-green-900/30 py-2.5 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                <Trophy size={16} /> WINNER
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <select value={selectedTechB} onChange={e=>setSelectedTechB(e.target.value)} className="bg-transparent border border-blue-500 text-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none">
                <option value="">Select Technique</option>
                {techniques.map(t=><option key={t} value={t} className="bg-[#141414]">{t}</option>)}
              </select>
              <select value={selectedPenB} onChange={e=>setSelectedPenB(e.target.value)} className="bg-transparent border border-blue-500 text-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 appearance-none">
                <option value="">Select Penalty</option>
                {penalties.map(p=><option key={p} value={p} className="bg-[#141414]">{p}</option>)}
              </select>
            </div>

            <textarea value={descB} onChange={e=>setDescB(e.target.value)} placeholder="Description" className="w-full bg-transparent border border-blue-500 text-gray-300 rounded p-3 text-sm h-16 resize-none mb-4 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            
            <div className="mt-auto flex justify-center">
              <button onClick={() => handleApply("B")} className="bg-[#16a34a] hover:bg-[#15803d] text-white font-bold py-3 px-16 rounded text-sm transition-colors shadow-[0_0_15px_rgba(22,163,74,0.4)]">
                APPLY
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ══ EXPORT SECTION ════════════════════════════════════════════════════ */}
      {(isMatchEnded || winner || dbMatchStatus === "COMPLETED") && (
        <div className="pb-6 flex justify-center shrink-0 px-4">
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 lg:px-8 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-8 shadow-xl w-full md:w-auto">
            <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">EXPORT</span>
            <div className="flex flex-wrap justify-center gap-2 lg:gap-4">
              <button 
                onClick={handlePrint} 
                className="bg-white text-black font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded transition-colors hover:bg-gray-200"
              >
                <Download size={16} /> Save PDF
              </button>
              <button 
                onClick={() => saveMatchToDB()} 
                className="bg-white text-black font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded transition-colors hover:bg-gray-200"
              >
                <CheckCircle size={16} /> Save Match
              </button>
              <button onClick={handleResetClick} className="bg-red-600 text-white font-bold text-sm px-5 py-2.5 flex items-center gap-2 rounded hover:bg-red-500 transition-colors">
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
              className="bg-[#1a1a1a] border-2 border-[#333] px-6 sm:px-12 py-8 sm:py-12 mx-4 rounded-[2rem] shadow-2xl flex flex-col items-center max-w-2xl w-full text-center relative overflow-hidden"
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
          <img src="/navbar/Logo.png" alt="TNJA Logo" className="w-24 h-24 mb-4 object-contain" />
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

function ScoreBox({ label, value, theme, onUndo, onAdd }: { label: string; value: number | string; theme: "white" | "blue"; onUndo?: () => void; onAdd?: () => void }) {
  const bgClass = theme === "white" 
    ? "bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)] border-white/30" 
    : "bg-blue-600/20 shadow-[0_0_20px_rgba(37,99,235,0.3)] border-blue-500/40";
  return (
    <div className={`${bgClass} rounded-lg flex flex-col items-center justify-center py-4 border relative group`}>
      <span className="text-xs text-white/50 font-bold tracking-widest mb-1">{label}</span>
      <span className="text-4xl text-white font-black">{value}</span>
      <div className="absolute -bottom-2 right-1 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {onUndo && (
          <button 
            onClick={(e) => { e.stopPropagation(); onUndo(); }} 
            className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
            title="Undo Score"
          >
            <Minus size={14} strokeWidth={4} />
          </button>
        )}
        {onAdd && (
          <button 
            onClick={(e) => { e.stopPropagation(); onAdd(); }} 
            className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform"
            title="Add Score"
          >
            <Plus size={14} strokeWidth={4} />
          </button>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-center gap-1.5 bg-transparent border border-[#444] hover:bg-[#333] rounded p-2 transition-colors">
      <div className="h-5 flex items-center justify-center">{icon}</div>
      <span className="text-[8px] font-black tracking-wider text-gray-300">{label}</span>
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
