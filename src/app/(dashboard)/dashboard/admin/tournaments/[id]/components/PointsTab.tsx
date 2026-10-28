"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Medal, HeartHandshake, Clock, Trash2, Save, AlertCircle, CheckCircle2, Pencil, X, Info } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type Placement = "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION";

interface Participant {
  playerId: string;
  name: string;
  ref: string;
  club: string | null;
  status: string;
  placement: Placement | null;
  placementPoints: number | null;
  sportsmanship: { points: number; reason: string | null } | null;
}

interface Volunteer {
  playerId: string;
  name: string;
  ref: string;
  inTime: string;
  outTime: string | null;
  points: number | null;
}

interface PointsData {
  level: string;
  levelRules: Record<Placement, number>;
  settings: { sportsmanshipPoints: number; volunteerPoints: number; volunteerFullHours: number };
  resultsSubmitted: boolean;
  participants: Participant[];
  volunteers: Volunteer[];
}

const PLACEMENT_LABEL: Record<Placement, string> = { FIRST: "Gold", SECOND: "Silver", THIRD: "Bronze", PARTICIPATION: "Participant" };
const PLACEMENT_STYLE: Record<Placement, string> = {
  FIRST: "bg-yellow-100 text-yellow-700",
  SECOND: "bg-slate-200 text-slate-700",
  THIRD: "bg-amber-100 text-amber-800",
  PARTICIPATION: "bg-slate-100 text-slate-500",
};

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

/** "2026-08-30T09:00" for a datetime-local input, in local time. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fmtTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

async function fetchPoints(tournamentId: string): Promise<PointsData> {
  const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/points`, { headers: auth() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load tournament points");
  return data;
}

/** Tournament → Points: result points, sportsmanship adjustments and volunteer shifts. */
export function PointsTab({ tournamentId }: { tournamentId: string }) {
  const [data, setData] = useState<PointsData | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [editing, setEditing] = useState<{ playerId: string; points: string; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [vol, setVol] = useState({ player: "", inTime: "", outTime: "" });

  const reload = useCallback(
    () => fetchPoints(tournamentId).then(setData).catch((err: Error) => setMessage({ text: err.message, type: "error" })),
    [tournamentId]
  );

  useEffect(() => {
    reload();
  }, [reload]);

  const call = async (url: string, method: string, body?: object) => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { method, headers: { ...auth(), "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || "Request failed");
      setMessage({ text: out.message, type: "success" });
      await reload();
      return true;
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSportsmanship = async () => {
    if (!editing) return;
    const ok = await call(`${API_BASE}/tournaments/${tournamentId}/sportsmanship/${editing.playerId}`, "PUT", { points: Number(editing.points), reason: editing.reason });
    if (ok) setEditing(null);
  };

  const saveVolunteer = async () => {
    const ok = await call(`${API_BASE}/tournaments/${tournamentId}/volunteers`, "PUT", {
      player: vol.player,
      inTime: vol.inTime ? new Date(vol.inTime).toISOString() : "",
      outTime: vol.outTime ? new Date(vol.outTime).toISOString() : null,
    });
    if (ok) setVol({ player: "", inTime: "", outTime: "" });
  };

  if (!data) {
    return message ? <Banner {...message} /> : <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>;
  }

  const max = data.settings.sportsmanshipPoints;

  return (
    <div className="space-y-6">
      {message && <Banner {...message} />}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 text-[#FF7400] rounded-lg"><Medal size={20} /></div>
            <div>
              <h3 className="font-black text-slate-800">Results & sportsmanship</h3>
              <p className="text-xs text-slate-500">
                {data.level.charAt(0) + data.level.slice(1).toLowerCase()} level · Gold {data.levelRules.FIRST} · Silver {data.levelRules.SECOND} · Bronze {data.levelRules.THIRD} · Participant {data.levelRules.PARTICIPATION} · Sportsmanship {max}
              </p>
            </div>
          </div>
        </div>

        {!data.resultsSubmitted && (
          <p className="flex items-start gap-2 m-5 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
            <Info size={16} className="mt-0.5 shrink-0" /> Points are awarded when results are submitted. Each player earns their best result only, plus {max} sportsmanship points.
          </p>
        )}

        {data.participants.length === 0 ? (
          <p className="py-10 text-center text-slate-400 text-sm">No approved participants.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-5 text-left">Player</th>
                  <th className="py-3 px-3 text-left">Result</th>
                  <th className="py-3 px-3 text-right">Result pts</th>
                  <th className="py-3 px-3 text-left">Sportsmanship</th>
                  <th className="py-3 px-5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.participants.map((p) => {
                  const isEditing = editing?.playerId === p.playerId;
                  return (
                    <tr key={p.playerId} className={p.status === "DISQUALIFIED" ? "opacity-60" : ""}>
                      <td className="py-3 px-5">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-400">{[p.ref, p.club].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="py-3 px-3">
                        {p.status === "DISQUALIFIED" ? (
                          <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 text-xs font-bold">Disqualified · 0 pts</span>
                        ) : p.placement ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${PLACEMENT_STYLE[p.placement]}`}>{PLACEMENT_LABEL[p.placement]}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Awaiting results</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums text-slate-700">{p.placementPoints ?? "—"}</td>
                      <td className="py-3 px-3">
                        {!p.sportsmanship ? (
                          <span className="text-slate-300">—</span>
                        ) : isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <select value={editing.points} onChange={(e) => setEditing({ ...editing, points: e.target.value })} aria-label="Sportsmanship points"
                              className="px-2 py-1.5 border border-slate-200 rounded-lg font-bold">
                              {Array.from({ length: max + 1 }, (_, i) => max - i).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <input value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
                              placeholder={Number(editing.points) < max ? "Reason (required)" : "Reason (optional)"}
                              className="flex-1 min-w-[160px] px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
                            <button onClick={saveSportsmanship} disabled={busy} className="p-1.5 rounded-lg bg-[#FF7400] text-white disabled:opacity-50" aria-label="Save"><Save size={14} /></button>
                            <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cancel"><X size={14} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`font-bold tabular-nums ${p.sportsmanship.points < max ? "text-red-600" : "text-emerald-600"}`}>{p.sportsmanship.points}/{max}</span>
                            {p.sportsmanship.reason && <span className="text-xs text-slate-500 truncate max-w-[200px]" title={p.sportsmanship.reason}>{p.sportsmanship.reason}</span>}
                            <button onClick={() => setEditing({ playerId: p.playerId, points: String(p.sportsmanship!.points), reason: p.sportsmanship!.reason ?? "" })}
                              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-[#FF7400]" aria-label={`Adjust ${p.name}'s sportsmanship`}><Pencil size={13} /></button>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right font-black text-[#FF7400] tabular-nums">
                        {p.placementPoints !== null ? p.placementPoints + (p.sportsmanship?.points ?? 0) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100">
          <div className="p-2 bg-orange-50 text-[#FF7400] rounded-lg"><HeartHandshake size={20} /></div>
          <div>
            <h3 className="font-black text-slate-800">Volunteers</h3>
            <p className="text-xs text-slate-500">
              {data.settings.volunteerPoints} points for a shift of {data.settings.volunteerFullHours} hours or more; shorter shifts earn pro rata. Points are given once the out time is recorded.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3 p-5 border-b border-slate-100 items-end">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">Player ID</span>
            <input value={vol.player} onChange={(e) => setVol({ ...vol, player: e.target.value })} placeholder="e.g. CBE-STU-A001"
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#FF7400]" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">In time</span>
            <input type="datetime-local" value={vol.inTime} onChange={(e) => setVol({ ...vol, inTime: e.target.value })}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">Out time</span>
            <input type="datetime-local" value={vol.outTime} onChange={(e) => setVol({ ...vol, outTime: e.target.value })}
              className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#FF7400]" />
          </label>
          <button onClick={saveVolunteer} disabled={busy || !vol.player.trim() || !vol.inTime}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-lg text-sm font-bold disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Record
          </button>
        </div>

        {data.volunteers.length === 0 ? (
          <p className="py-8 text-center text-slate-400 text-sm">No volunteers recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.volunteers.map((v) => (
              <li key={v.playerId} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-[160px]">
                  <p className="font-bold text-slate-800">{v.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{v.ref}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock size={13} /> {fmtTime(v.inTime)} → {v.outTime ? fmtTime(v.outTime) : <b className="text-amber-600">still on shift</b>}</span>
                <span className="w-16 text-right font-black text-[#FF7400] tabular-nums">{v.points ?? "—"}</span>
                {!v.outTime && (
                  <button onClick={() => setVol({ player: v.ref, inTime: toLocalInput(v.inTime), outTime: toLocalInput(new Date().toISOString()) })}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Check out</button>
                )}
                <button onClick={() => confirm(`Remove ${v.name} as a volunteer? Their volunteer points for this tournament are removed too.`) && call(`${API_BASE}/tournaments/${tournamentId}/volunteers/${v.playerId}`, "DELETE")}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500" aria-label={`Remove ${v.name}`}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Banner({ text, type }: { text: string; type: "success" | "error" }) {
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-semibold border ${type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
      {type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      {text}
    </div>
  );
}
