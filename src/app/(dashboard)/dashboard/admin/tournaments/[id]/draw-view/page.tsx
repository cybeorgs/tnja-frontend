"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Minus, Plus, Trophy, Users, Grid3x3, AlertCircle, Play, SkipForward } from "lucide-react";
import type { DrawCategory, RegisteredPlayer, Tournament } from "../types";
import { backfillBronzeMatches, processByeMatches, getEliminationFormatLabel, isDrawRoundRobin } from "../lib/bracketEngine";
import { BracketView, RoundRobinLeaderboard } from "../components/BracketView";
import { TNJA_LOGO } from "@/constants/brand";
import { useDistrictCodes, representingOf } from "@/utils/districtCodes";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const fmtKg = (w: string) => { const v = String(w ?? "").trim(); return !v ? "" : /kg/i.test(v) || /under/i.test(v) ? v : `${v} kg`; };
const genderLabel = (g: string) => (g === "FEMALE" ? "Girls" : "Boys");
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Representation = Pick<RegisteredPlayer, "representing" | "representingDistrict" | "representingUnit" | "district">;

/** Every competitor named in a draw, taken from its match slots (BYE / TBD left out). */
function drawPlayers(d: DrawCategory): RegisteredPlayer[] {
  const seen = new Map<string, RegisteredPlayer>();
  for (const round of d.rounds) {
    for (const m of round) {
      for (const s of [m.slotA, m.slotB]) {
        if (!s?.playerId || s.isBye || s.playerName === "TBD" || seen.has(s.playerId)) continue;
        seen.set(s.playerId, {
          id: s.playerId, name: s.playerName, club: s.club || "", district: s.club || "",
          weight: d.weightCategory as unknown as number, ageGroup: d.ageGroup, gender: d.gender, belt: "",
          seedNumber: s.seedNumber, coachName: s.coachName,
        });
      }
    }
  }
  return [...seen.values()];
}

/** View-only page for one category's draw (opened in its own tab from the tournament page). */
function DrawViewInner() {
  const params = useParams();
  const sp = useSearchParams();
  const tournamentId = params?.id as string;
  const want = { age: sp.get("age") || "", gender: sp.get("gender") || "", weight: sp.get("weight") || "" };

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [draws, setDraws] = useState<DrawCategory[] | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1.25);
  const [reps, setReps] = useState<Record<string, Representation>>({});

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [tRes, dRes, rRes] = await Promise.all([
        fetch(`${API_BASE}/tournaments/${tournamentId}`, { headers }),
        fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, { headers }),
        fetch(`${API_BASE}/tournaments/${tournamentId}/registrations`, { headers }),
      ]);
      if (!dRes.ok) throw new Error(dRes.status === 401 ? "Please log in to view the draw." : "Could not load the draw.");
      if (tRes.ok) setTournament(await tRes.json());
      if (rRes.ok) {
        // Who each player represents (district confirmed at weigh-in, else home district)
        const raw = await rRes.json();
        const regs: Record<string, unknown>[] = Array.isArray(raw) ? raw : raw?.registrations || [];
        const map: Record<string, Representation> = {};
        for (const r of regs as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
          const id = r.playerId || r.player?.id || r.id;
          if (!id) continue;
          map[id] = {
            representing: r.representing || "",
            representingDistrict: r.representingDistrict || "",
            representingUnit: r.representingUnit || "",
            district: r.player?.district?.name || r.district || "",
          };
        }
        setReps(map);
      }
      const data = await dRes.json();
      const list: DrawCategory[] = (Array.isArray(data) ? data : []).map((d: DrawCategory) => {
        let rounds: unknown = d.rounds;
        if (typeof rounds === "string") { try { rounds = JSON.parse(rounds); } catch { rounds = []; } }
        const arr = Array.isArray(rounds) ? (rounds as DrawCategory["rounds"]) : [];
        return { ...d, rounds: backfillBronzeMatches(processByeMatches(arr)), generated: arr.length > 0, saved: true };
      });
      setDraws(list.filter((d) => d.generated));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the draw.");
    }
  }, [tournamentId]);

  // Initial load, then refresh every 10s so results from the mats show up live
  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, 10000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const draw = (draws ?? []).find((d) => same(d.ageGroup, want.age) && same(d.gender, want.gender) && same(d.weightCategory, want.weight));
  const players = draw ? drawPlayers(draw).map((p) => ({ ...p, ...reps[p.id] })) : [];

  // ── Draw ceremony: names drop into their first-round boxes one at a time ──
  const catKey = draw ? `${draw.ageGroup}|${draw.gender}|${draw.weightCategory}` : "";
  const [anim, setAnim] = useState<{ order: number[]; step: number } | null>(null);
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; });

  const startCeremony = useCallback(() => {
    const d = drawRef.current;
    if (!d || !d.rounds[0]) return;
    const order: number[] = [];
    d.rounds[0].forEach((m, mi) => {
      if (m.slotA.playerId && !m.slotA.isBye) order.push(mi * 2);
      if (m.slotB.playerId && !m.slotB.isBye) order.push(mi * 2 + 1);
    });
    setAnim({ order, step: 0 });
  }, []);

  // Play once when the draw first loads (not on the 10s live refresh)
  useEffect(() => {
    if (!catKey) return;
    const t = setTimeout(startCeremony, 400);
    return () => clearTimeout(t);
  }, [catKey, startCeremony]);

  // Advance one name at a time; clear the ceremony a moment after the last one lands
  useEffect(() => {
    if (!anim) return;
    const done = anim.step >= anim.order.length;
    const t = setTimeout(
      () => setAnim((a) => (a && !done ? { ...a, step: a.step + 1 } : null)),
      done ? 1800 : anim.step === 0 ? 700 : 1200
    );
    return () => clearTimeout(t);
  }, [anim]);

  const reveal = useMemo(
    () => (anim ? { shown: new Set(anim.order.slice(0, anim.step)), latest: anim.step > 0 ? anim.order[anim.step - 1] : null } : null),
    [anim]
  );
  const latestPlace = reveal?.latest ?? null;
  const latestMatch = draw && latestPlace !== null ? draw.rounds[0][Math.floor(latestPlace / 2)] : null;
  const latestSlot = latestMatch ? (latestPlace! % 2 === 0 ? latestMatch.slotA : latestMatch.slotB) : null;
  const districtCodes = useDistrictCodes();
  const latestRep = latestSlot?.playerId && reps[latestSlot.playerId] ? representingOf(reps[latestSlot.playerId], districtCodes) : null;
  const latestFrom = latestRep ? `[${latestRep.code}] ${latestRep.name}` : latestSlot?.club || "";

  const isRR = draw ? isDrawRoundRobin(draw) : false;
  const title = draw
    ? `${titleCase(draw.ageGroup)} · ${genderLabel(draw.gender)} · ${fmtKg(draw.weightCategory)}`
    : [titleCase(want.age), want.gender && genderLabel(want.gender), fmtKg(want.weight)].filter(Boolean).join(" · ");
  const drawKey = draw ? `${draw.ageGroup}-${draw.gender}-${draw.weightCategory}` : "";

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 overflow-y-auto text-slate-900">
      {/* ── Header: the selected draw + controls; the ceremony spotlight docks here so it is always in view ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TNJA_LOGO} alt="Tamil Nadu Judo Association" className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white shrink-0" />
          <div className="min-w-0 mr-auto">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 truncate">{tournament?.title || "Tournament draw"}</p>
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
              <Trophy size={24} className="text-[#FF7400] shrink-0" />
              <span className="truncate">{title || "Draw"}</span>
            </h1>
            {draw && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600"><Users size={12} /> {players.length} competitors</span>
                {draw.matNumber ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700"><Grid3x3 size={12} /> Mat {draw.matNumber}</span> : null}
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 text-[#FF7400]">{isRR ? "Round Robin" : getEliminationFormatLabel(draw.rounds)}</span>
                {draw.isConcluded && <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Concluded</span>}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-1" aria-label="Zoom">
              <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} className="p-1.5 rounded-md hover:bg-white text-slate-600" aria-label="Zoom out"><Minus size={14} /></button>
              <button onClick={() => setZoom(1.25)} className="px-1 text-xs font-black text-slate-700 tabular-nums w-11" title="Reset zoom">{Math.round(zoom * 100)}%</button>
              <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} className="p-1.5 rounded-md hover:bg-white text-slate-600" aria-label="Zoom in"><Plus size={14} /></button>
            </div>
            {draw && (anim ? (
              <button onClick={() => setAnim(null)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50">
                <SkipForward size={15} /> Skip
              </button>
            ) : (
              <button onClick={startCeremony} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-black shadow-md shadow-orange-500/20">
                <Play size={15} /> Replay Draw
              </button>
            ))}
          </div>
        </div>

        {/* Spotlight: the name being drawn right now */}
        <AnimatePresence>
          {anim && draw && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-gradient-to-r from-slate-900 to-slate-800"
            >
              <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="text-white/60 text-xs font-black uppercase tracking-widest w-28 shrink-0">
                  {anim.step === 0 ? "Get ready" : `Draw ${Math.min(anim.step, anim.order.length)} of ${anim.order.length}`}
                </span>
                <div className="flex-1 min-w-[200px] h-14 relative">
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={anim.step}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ type: "spring", stiffness: 260, damping: 22 }}
                      className="absolute inset-0 flex items-center gap-4"
                    >
                      {anim.step === 0 || !latestSlot ? (
                        <span className="text-2xl font-black text-white">Drawing {anim.order.length} names…</span>
                      ) : (
                        <>
                          <span className="w-12 h-12 shrink-0 rounded-full bg-[#FF7400] text-white flex items-center justify-center text-xl font-black">{latestSlot.playerName.charAt(0)}</span>
                          <span className="min-w-0">
                            <span className="block text-2xl sm:text-3xl font-black text-white truncate leading-tight">{latestSlot.playerName}</span>
                            {latestFrom && <span className="block text-sm font-semibold text-white/60 truncate">{latestFrom}</span>}
                          </span>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                {latestMatch && anim.step > 0 && (
                  <motion.span key={`to-${anim.step}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="shrink-0 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-black">
                    → {isRR ? "Pool" : "Match"} {latestMatch.matchNumber} · Box {latestPlace! % 2 === 0 ? "A" : "B"}
                  </motion.span>
                )}
              </div>
              <div className="h-1 bg-white/10">
                <motion.div className="h-full bg-[#FF7400]" animate={{ width: `${(Math.min(anim.step, anim.order.length) / Math.max(1, anim.order.length)) * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        {error ? (
          <p className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold text-sm"><AlertCircle size={16} /> {error}</p>
        ) : draws === null ? (
          <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
        ) : !draw ? (
          <div className="py-24 text-center">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-black text-slate-700">This draw isn&apos;t available</p>
            <p className="text-sm text-slate-500">It may not be generated yet. Open it again from the tournament&apos;s Draw Generation tab.</p>
          </div>
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div style={{ zoom }}>
                <BracketView hideHeader rounds={draw.rounds} players={players} tournament={tournament} currentKey={drawKey} currentDraw={draw} reveal={reveal} />
              </div>
            </div>
            {isRR && !anim && (
              <div className="p-4 sm:p-6 border-t border-slate-100">
                <RoundRobinLeaderboard rounds={draw.rounds} players={players} tournament={tournament} currentKey={drawKey} currentDraw={draw} />
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default function DrawViewPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[9999] bg-slate-100 flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>}>
      <DrawViewInner />
    </Suspense>
  );
}
