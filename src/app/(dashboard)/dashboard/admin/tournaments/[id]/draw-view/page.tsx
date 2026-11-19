"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, Minus, Plus, Trophy, Users, Grid3x3, Calendar, MapPin, AlertCircle, Play, SkipForward } from "lucide-react";
import type { DrawCategory, RegisteredPlayer, Tournament } from "../types";
import { backfillBronzeMatches, processByeMatches, getEliminationFormatLabel, isDrawRoundRobin } from "../lib/bracketEngine";
import { BracketView, RoundRobinLeaderboard } from "../components/BracketView";
import { TNJA_LOGO } from "@/constants/brand";
import { levelLabel } from "@/utils/tournamentLevel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const AGE_ORDER = [
  "7-8 years", "8-9 years", "10-11 years",
  "mini sub-junior age group 1", "mini sub-junior age group 2", "mini sub-junior age group 3", "mini sub junior",
  "sub-junior", "sub junior", "cadet", "junior", "senior",
];
const ageRank = (a: string) => { const i = AGE_ORDER.indexOf(a.toLowerCase()); return i === -1 ? 999 : i; };
const weightNum = (w: string) => { const n = parseFloat(String(w).replace(/[^\d.]/g, "")); return isNaN(n) ? 9999 : n; };
const fmtKg = (w: string) => { const v = String(w ?? "").trim(); return !v ? "" : /kg/i.test(v) || /under/i.test(v) ? v : `${v} kg`; };
const genderLabel = (g: string) => (g === "FEMALE" ? "Girls" : "Boys");
const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

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

function DrawViewInner() {
  const params = useParams();
  const sp = useSearchParams();
  const tournamentId = params?.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [draws, setDraws] = useState<DrawCategory[] | null>(null);
  const [error, setError] = useState("");
  const [age, setAge] = useState(sp.get("age") || "");
  const [gender, setGender] = useState(sp.get("gender") || "");
  const [weight, setWeight] = useState(sp.get("weight") || "");
  const [zoom, setZoom] = useState(1.25);

  const load = useCallback(async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
    try {
      const [tRes, dRes] = await Promise.all([
        fetch(`${API_BASE}/tournaments/${tournamentId}`, { headers }),
        fetch(`${API_BASE}/tournaments/${tournamentId}/draws`, { headers }),
      ]);
      if (!dRes.ok) throw new Error(dRes.status === 401 ? "Please log in to view the draw." : "Could not load the draw.");
      if (tRes.ok) setTournament(await tRes.json());
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

  // Effective selection: fall back to the first option that exists at each level
  const ages = useMemo(() => [...new Set((draws ?? []).map((d) => d.ageGroup))].sort((a, b) => ageRank(a) - ageRank(b) || a.localeCompare(b)), [draws]);
  const effAge = ages.includes(age) ? age : ages[0] ?? "";
  const genders = useMemo(() => ["MALE", "FEMALE"].filter((g) => (draws ?? []).some((d) => d.ageGroup === effAge && d.gender === g)), [draws, effAge]);
  const effGender = genders.includes(gender) ? gender : genders[0] ?? "";
  const weights = useMemo(
    () => [...new Set((draws ?? []).filter((d) => d.ageGroup === effAge && d.gender === effGender).map((d) => d.weightCategory))].sort((a, b) => weightNum(a) - weightNum(b)),
    [draws, effAge, effGender]
  );
  const effWeight = weights.includes(weight) ? weight : weights[0] ?? "";
  const draw = (draws ?? []).find((d) => d.ageGroup === effAge && d.gender === effGender && d.weightCategory === effWeight);
  const players = useMemo(() => (draw ? drawPlayers(draw) : []), [draw]);

  // Keep the URL in step so the tab can be refreshed or shared on the same category
  useEffect(() => {
    if (!effAge) return;
    const q = new URLSearchParams({ age: effAge, gender: effGender, weight: effWeight });
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [effAge, effGender, effWeight]);

  // ── Draw ceremony: names drop into their first-round boxes one at a time ──
  const catKey = draw ? `${draw.ageGroup}|${draw.gender}|${draw.weightCategory}` : "";
  const [anim, setAnim] = useState<{ key: string; order: number[]; step: number } | null>(null);
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
    setAnim({ key: `${d.ageGroup}|${d.gender}|${d.weightCategory}`, order, step: 0 });
  }, []);

  // Play it whenever a category is opened (not on the 10s live refresh)
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

  const activeAnim = anim && anim.key === catKey ? anim : null;
  const reveal = useMemo(
    () => (activeAnim ? { shown: new Set(activeAnim.order.slice(0, activeAnim.step)), latest: activeAnim.step > 0 ? activeAnim.order[activeAnim.step - 1] : null } : null),
    [activeAnim]
  );
  const latestPlace = reveal?.latest ?? null;
  const latestMatch = draw && latestPlace !== null ? draw.rounds[0][Math.floor(latestPlace / 2)] : null;
  const latestSlot = latestMatch ? (latestPlace! % 2 === 0 ? latestMatch.slotA : latestMatch.slotB) : null;

  const isRR = draw ? isDrawRoundRobin(draw) : false;
  const dateText = tournament?.date ? new Date(tournament.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 overflow-y-auto text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={TNJA_LOGO} alt="Tamil Nadu Judo Association" className="w-11 h-11 object-contain rounded-lg border border-slate-200 bg-white" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate">{tournament?.title || "Tournament Draw"}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-semibold text-slate-500">
              {tournament && <span className="text-[#FF7400] font-black uppercase tracking-wider">{levelLabel(tournament.level, tournament.levelOther)}</span>}
              {dateText && <span className="inline-flex items-center gap-1"><Calendar size={12} /> {dateText}</span>}
              {tournament?.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {tournament.location}</span>}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live · updates every 10s
          </span>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1" aria-label="Zoom">
            <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} className="p-1.5 rounded-md hover:bg-white text-slate-600" aria-label="Zoom out"><Minus size={14} /></button>
            <button onClick={() => setZoom(1.25)} className="px-2 text-xs font-black text-slate-700 tabular-nums w-12" title="Reset zoom">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} className="p-1.5 rounded-md hover:bg-white text-slate-600" aria-label="Zoom in"><Plus size={14} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error ? (
          <p className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold text-sm"><AlertCircle size={16} /> {error}</p>
        ) : draws === null ? (
          <div className="py-24 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
        ) : draws.length === 0 ? (
          <div className="py-24 text-center">
            <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-black text-slate-700">No draws generated yet</p>
            <p className="text-sm text-slate-500">Generate a draw on the tournament page and it will appear here.</p>
          </div>
        ) : (
          <>
            {/* Category pickers */}
            <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <ChipRow label="Category" options={ages.map((a) => ({ value: a, label: titleCase(a) }))} value={effAge} onChange={(v) => { setAge(v); setGender(""); setWeight(""); }} />
              <ChipRow label="Gender" options={genders.map((g) => ({ value: g, label: genderLabel(g) }))} value={effGender} onChange={(v) => { setGender(v); setWeight(""); }} />
              <ChipRow label="Weight" options={weights.map((w) => ({ value: w, label: fmtKg(w) }))} value={effWeight} onChange={setWeight} />
            </section>

            {draw && (
              <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-black text-slate-900">
                    <Trophy size={22} className="text-[#FF7400]" />
                    {titleCase(draw.ageGroup)} · {genderLabel(draw.gender)} · {fmtKg(draw.weightCategory)}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"><Users size={13} /> {players.length} competitors</span>
                    {draw.matNumber ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700"><Grid3x3 size={13} /> Mat {draw.matNumber}</span> : null}
                    <span className="px-2.5 py-1 rounded-full bg-orange-50 text-[#FF7400]">{isRR ? "Round Robin" : getEliminationFormatLabel(draw.rounds)}</span>
                    {draw.isConcluded && <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Concluded</span>}
                  </div>
                  <div className="ml-auto">
                    {activeAnim ? (
                      <button onClick={() => setAnim(null)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 text-sm font-black text-slate-600 hover:bg-slate-50">
                        <SkipForward size={15} /> Skip
                      </button>
                    ) : (
                      <button onClick={startCeremony} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-black shadow-md shadow-orange-500/20">
                        <Play size={15} /> Replay Draw
                      </button>
                    )}
                  </div>
                </div>

                {/* Spotlight: the name being drawn right now */}
                <AnimatePresence>
                  {activeAnim && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800"
                    >
                      <div className="px-5 sm:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="text-white/60 text-xs font-black uppercase tracking-widest w-28 shrink-0">
                          {activeAnim.step === 0 ? "Get ready" : activeAnim.step > activeAnim.order.length - 1 && !latestSlot ? "" : `Draw ${Math.min(activeAnim.step, activeAnim.order.length)} of ${activeAnim.order.length}`}
                        </div>
                        <div className="flex-1 min-w-0 h-14 relative">
                          <AnimatePresence mode="popLayout">
                            <motion.div
                              key={activeAnim.step}
                              initial={{ opacity: 0, y: 30, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -30, scale: 0.9 }}
                              transition={{ type: "spring", stiffness: 260, damping: 22 }}
                              className="absolute inset-0 flex items-center gap-4"
                            >
                              {activeAnim.step === 0 || !latestSlot ? (
                                <span className="text-2xl font-black text-white">Drawing {activeAnim.order.length} names…</span>
                              ) : (
                                <>
                                  <span className="w-12 h-12 shrink-0 rounded-full bg-[#FF7400] text-white flex items-center justify-center text-xl font-black">{latestSlot.playerName.charAt(0)}</span>
                                  <span className="min-w-0">
                                    <span className="block text-2xl sm:text-3xl font-black text-white truncate leading-tight">{latestSlot.playerName}</span>
                                    {latestSlot.club && <span className="block text-sm font-semibold text-white/60 truncate">{latestSlot.club}</span>}
                                  </span>
                                </>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                        {latestMatch && activeAnim.step > 0 && (
                          <motion.div key={`to-${activeAnim.step}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="shrink-0 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-black">
                            → {isRR ? "Pool" : "Match"} {latestMatch.matchNumber} · Box {latestPlace! % 2 === 0 ? "A" : "B"}
                          </motion.div>
                        )}
                      </div>
                      <div className="h-1 bg-white/10">
                        <motion.div className="h-full bg-[#FF7400]" animate={{ width: `${(Math.min(activeAnim.step, activeAnim.order.length) / Math.max(1, activeAnim.order.length)) * 100}%` }} transition={{ duration: 0.4 }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="p-4 sm:p-6 overflow-x-auto">
                  <div style={{ zoom }}>
                    <BracketView rounds={draw.rounds} players={players} tournament={tournament} currentKey={`${draw.ageGroup}-${draw.gender}-${draw.weightCategory}`} currentDraw={draw} reveal={reveal} />
                  </div>
                </div>
                {isRR && (
                  <div className="p-4 sm:p-6 border-t border-slate-100">
                    <RoundRobinLeaderboard rounds={draw.rounds} players={players} tournament={tournament} currentKey={`${draw.ageGroup}-${draw.gender}-${draw.weightCategory}`} currentDraw={draw} />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ChipRow({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <span className="w-20 shrink-0 text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-4 py-2 rounded-xl text-sm font-black border transition-colors ${
              value === o.value ? "bg-[#FF7400] border-[#FF7400] text-white shadow-md shadow-orange-500/20" : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
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
