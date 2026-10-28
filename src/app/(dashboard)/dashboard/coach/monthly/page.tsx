"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Save, CalendarCheck, AlertCircle, CheckCircle2, Lock, Users, Info } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

interface StudentRow {
  id: string;
  name: string;
  ref: string;
  photo: string | null;
  record: { sessionsAttended: number; discipline: number; updatedAt: string } | null;
  points: { attendance: number; discipline: number; autoMinimum?: boolean } | null;
}

interface MonthData {
  month: string;
  editable: boolean;
  editableMonths: string[];
  sessionsHeld: number | null;
  settings: { attendanceMaxPoints: number; disciplineMaxPoints: number; disciplineMinPoints: number };
  students: StudentRow[];
}

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const monthLabel = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

/** The last six months, newest first ("2026-10", "2026-09", …). */
function recentMonths(): string[] {
  const d = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });
}

async function fetchMonth(month: string): Promise<MonthData> {
  const res = await fetch(`${API_BASE}/coach/monthly-records?month=${month}`, { headers: auth() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load the monthly update");
  return data;
}

/** The editable form values for a loaded month. */
function formFrom(d: MonthData) {
  return {
    sessionsHeld: d.sessionsHeld !== null ? String(d.sessionsHeld) : "",
    rows: Object.fromEntries(d.students.map((s) => [s.id, {
      attended: s.record ? String(s.record.sessionsAttended) : "",
      discipline: s.record ? String(s.record.discipline) : "",
    }])),
  };
}

/** Coach: each month, record every student's attendance and discipline. */
export default function CoachMonthlyPage() {
  const months = recentMonths();
  const [month, setMonth] = useState(months[0]);
  const [data, setData] = useState<MonthData | null>(null);
  const [sessionsHeld, setSessionsHeld] = useState("");
  const [rows, setRows] = useState<Record<string, { attended: string; discipline: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const apply = (d: MonthData) => {
    const form = formFrom(d);
    setData(d);
    setSessionsHeld(form.sessionsHeld);
    setRows(form.rows);
  };

  useEffect(() => {
    let cancelled = false;
    fetchMonth(month)
      .then((d) => {
        if (cancelled) return;
        const form = formFrom(d);
        setData(d);
        setSessionsHeld(form.sessionsHeld);
        setRows(form.rows);
      })
      .catch((err: Error) => !cancelled && setMessage({ text: err.message, type: "error" }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const changeMonth = (m: string) => {
    setLoading(true);
    setMessage(null);
    setMonth(m);
  };

  const held = Number(sessionsHeld);
  const max = data?.settings;
  const attendancePoints = (attended: string) =>
    max && held > 0 && attended !== "" ? Math.round(max.attendanceMaxPoints * Math.min(1, Number(attended) / held)) : null;

  const filled = data ? data.students.filter((s) => rows[s.id]?.attended !== "" && rows[s.id]?.discipline !== "") : [];

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/coach/monthly-records`, {
        method: "PUT",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          sessionsHeld: held,
          records: filled.map((s) => ({ playerId: s.id, sessionsAttended: Number(rows[s.id].attended), discipline: Number(rows[s.id].discipline) })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not save");
      setMessage({ text: body.message, type: "success" });
      apply(await fetchMonth(month));
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const setRow = (id: string, key: "attended" | "discipline", value: string) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value.replace(/[^0-9]/g, "") } }));

  return (
    <div className="max-w-5xl space-y-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3"><CalendarCheck className="text-[#FF7400]" /> Monthly Update</h1>
          <p className="text-slate-500 mt-1">Record each student&apos;s attendance and discipline. These earn them ranking points.</p>
        </div>
        <select value={month} onChange={(e) => changeMonth(e.target.value)} aria-label="Month"
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-[#FF7400]">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </header>

      {message && (
        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm font-semibold ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          {message.type === "success" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          {message.text}
        </div>
      )}

      {loading || !data ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" /></div>
      ) : (
        <>
          <div className="flex items-start gap-2 p-4 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-700">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>
              Attendance earns up to <b>{data.settings.attendanceMaxPoints}</b> points (sessions attended ÷ sessions held). Discipline is scored
              0–<b>{data.settings.disciplineMaxPoints}</b>. A student you don&apos;t update for a finished month automatically gets
              the minimum of <b>{data.settings.disciplineMinPoints}</b>. You can update the current and previous month.
            </p>
          </div>

          {!data.editable && (
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500"><Lock size={15} /> {monthLabel(month)} is closed and can no longer be changed.</p>
          )}

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 p-5 border-b border-slate-100">
              <label className="text-sm font-bold text-slate-700" htmlFor="held">Sessions held in {monthLabel(month)}</label>
              <input id="held" inputMode="numeric" value={sessionsHeld} disabled={!data.editable}
                onChange={(e) => setSessionsHeld(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400] disabled:opacity-60" />
            </div>

            {data.students.length === 0 ? (
              <div className="py-14 text-center text-slate-400"><Users size={32} className="mx-auto mb-2 opacity-40" /> You have no approved students yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-5 text-left">Student</th>
                      <th className="py-3 px-3 text-left">Attended</th>
                      <th className="py-3 px-3 text-left">Discipline (0–{data.settings.disciplineMaxPoints})</th>
                      <th className="py-3 px-5 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.students.map((s) => {
                      const row = rows[s.id] ?? { attended: "", discipline: "" };
                      const att = attendancePoints(row.attended);
                      const dis = row.discipline !== "" ? Math.min(Number(row.discipline), data.settings.disciplineMaxPoints) : null;
                      return (
                        <tr key={s.id}>
                          <td className="py-3 px-5">
                            <p className="font-bold text-slate-800">{s.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{s.ref}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1.5">
                              <input inputMode="numeric" value={row.attended} disabled={!data.editable} aria-label={`${s.name} sessions attended`}
                                onChange={(e) => setRow(s.id, "attended", e.target.value)}
                                className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400] disabled:opacity-60" />
                              <span className="text-slate-400">/ {sessionsHeld || "–"}</span>
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <select value={row.discipline} disabled={!data.editable} aria-label={`${s.name} discipline`}
                              onChange={(e) => setRow(s.id, "discipline", e.target.value)}
                              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400] disabled:opacity-60">
                              <option value="">–</option>
                              {Array.from({ length: data.settings.disciplineMaxPoints + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                            </select>
                          </td>
                          <td className="py-3 px-5 text-right">
                            {att !== null && dis !== null ? (
                              <span className="font-black text-[#FF7400] tabular-nums">{att + dis}</span>
                            ) : s.points?.autoMinimum ? (
                              <span className="text-xs font-semibold text-amber-600">Not updated · {s.points.discipline} pt minimum</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {data.editable && data.students.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-t border-slate-100">
                <p className="text-sm text-slate-500">{filled.length} of {data.students.length} students filled in. Only filled rows are saved.</p>
                <button onClick={save} disabled={saving || filled.length === 0 || sessionsHeld === ""}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-lg font-bold disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Monthly Update
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
