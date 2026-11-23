"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, RefreshCw, Search, Send } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

interface Recipient {
  regId: string;
  name: string;
  email: string;
  category: string;
  placement: "FIRST" | "SECOND" | "THIRD" | "PARTICIPATION";
  ready: boolean;
  reason: string | null;
  emailedAt: string | null;
}
interface Job { total: number; done: number; sent: number; failed: { name: string; error: string }[]; startedAt: number; finishedAt?: number }

const PLACEMENT: Record<Recipient["placement"], { label: string; cls: string }> = {
  FIRST: { label: "1st · Merit", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  SECOND: { label: "2nd · Merit", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  THIRD: { label: "3rd · Merit", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  PARTICIPATION: { label: "Participation", cls: "bg-white text-slate-500 border-slate-200" },
};

type Filter = "all" | "unsent" | "sent" | "notready";
type CertFilter = "all" | "merit" | Recipient["placement"];

const CERT_OPTIONS: { key: CertFilter; label: string }[] = [
  { key: "all", label: "All certificates" },
  { key: "merit", label: "Merit (Gold to Bronze)" },
  { key: "FIRST", label: "1st · Merit" },
  { key: "SECOND", label: "2nd · Merit" },
  { key: "THIRD", label: "3rd · Merit" },
  { key: "PARTICIPATION", label: "Participation" },
];

const matchesCert = (r: Recipient, f: CertFilter) =>
  f === "all" || (f === "merit" ? r.placement !== "PARTICIPATION" : r.placement === f);

/** "Mini Sub-Junior Age Group 1 · Girls · +26kg" → { age: "Mini Sub-Junior Age Group 1", gender: "Girls", weight: "+26kg" } */
const partsOf = (category: string) => {
  const [age = category, gender = "", weight = ""] = category.split(" · ");
  return { age, gender, weight };
};
const AGE_ORDER = ["Mini Sub-Junior Age Group 1", "Mini Sub-Junior Age Group 2", "Mini Sub-Junior Age Group 3", "Sub-Junior", "Cadet", "Junior", "Senior"];
const ageSort = (a: string, b: string) => {
  const ia = AGE_ORDER.indexOf(a), ib = AGE_ORDER.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
};
/** "-57kg" → 57, "+78kg" → 78.5 so the open class sorts after the last limit. */
const weightSort = (a: string, b: string) => {
  const v = (w: string) => (parseFloat(w.replace(/[^\d.]/g, "")) || 0) + (w.startsWith("+") ? 0.5 : 0);
  return v(a) - v(b);
};

const fmtSent = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Emails each player their certificate PDF at their registered email. Only players whose category is
 * concluded (or the whole tournament closed) can be sent one. Sending runs on the server in the
 * background; this panel polls for progress.
 */
export function EmailCertificatesPanel({ tournamentId, settingsDirty }: { tournamentId: string; settingsDirty: boolean }) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("unsent");
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [weightFilter, setWeightFilter] = useState("all");
  const [certFilter, setCertFilter] = useState<CertFilter>("all");
  const [starting, setStarting] = useState(false);

  const running = !!job && !job.finishedAt;

  /** Fetch only — no state updates, so it can be called from an effect. */
  const fetchRecipients = useCallback(async (): Promise<{ recipients: Recipient[]; job: Job | null }> => {
    const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate-recipients`, { headers: auth() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to load players");
    return { recipients: data.recipients ?? [], job: data.job ?? null };
  }, [tournamentId]);

  const apply = useCallback((d: { recipients: Recipient[]; job: Job | null }) => {
    setRecipients(d.recipients);
    setJob(d.job);
    setError("");
  }, []);
  const fail = useCallback((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load players"), []);

  /** Manual refresh / after sending. */
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { apply(await fetchRecipients()); } catch (e) { fail(e); } finally { if (!quiet) setLoading(false); }
  }, [fetchRecipients, apply, fail]);

  // First load (`loading` starts true); state is set only in the promise callbacks.
  useEffect(() => {
    let cancelled = false;
    fetchRecipients()
      .then((d) => { if (!cancelled) apply(d); })
      .catch((e) => { if (!cancelled) fail(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchRecipients, apply, fail]);

  // Poll while a send is in progress.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => load(true), 2000);
    return () => clearInterval(t);
  }, [running, load]);

  // Each dropdown lists only what exists under the choices to its left (gender → age group → weight).
  const genderOptions = useMemo(() => [...new Set(recipients.map((r) => partsOf(r.category).gender).filter(Boolean))].sort(), [recipients]);
  const ageOptions = useMemo(() => [...new Set(recipients
    .map((r) => partsOf(r.category))
    .filter((p) => genderFilter === "all" || p.gender === genderFilter)
    .map((p) => p.age))].sort(ageSort), [recipients, genderFilter]);
  const weightOptions = useMemo(() => [...new Set(recipients
    .map((r) => partsOf(r.category))
    .filter((p) => (genderFilter === "all" || p.gender === genderFilter) && (ageFilter === "all" || p.age === ageFilter))
    .map((p) => p.weight).filter(Boolean))].sort(weightSort), [recipients, genderFilter, ageFilter]);

  /** Gender / age / weight / certificate filters (the status tabs and their counts apply on top of these). */
  const narrowed = useMemo(() => recipients.filter((r) => {
    const p = partsOf(r.category);
    return (genderFilter === "all" || p.gender === genderFilter) &&
      (ageFilter === "all" || p.age === ageFilter) &&
      (weightFilter === "all" || p.weight === weightFilter) &&
      matchesCert(r, certFilter);
  }), [recipients, genderFilter, ageFilter, weightFilter, certFilter]);

  const counts = useMemo(() => ({
    all: narrowed.length,
    unsent: narrowed.filter((r) => r.ready && !r.emailedAt).length,
    sent: narrowed.filter((r) => r.emailedAt).length,
    notready: narrowed.filter((r) => !r.ready).length,
  }), [narrowed]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return narrowed.filter((r) => {
      if (filter === "unsent" && !(r.ready && !r.emailedAt)) return false;
      if (filter === "sent" && !r.emailedAt) return false;
      if (filter === "notready" && r.ready) return false;
      return !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    });
  }, [narrowed, filter, query]);

  const selectableVisible = visible.filter((r) => r.ready);
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((r) => selected.has(r.regId));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAllVisible = () => setSelected((prev) => {
    const next = new Set(prev);
    if (allVisibleSelected) selectableVisible.forEach((r) => next.delete(r.regId));
    else selectableVisible.forEach((r) => next.add(r.regId));
    return next;
  });

  const send = async (regIds: string[], what: string) => {
    if (!regIds.length) return;
    const resend = recipients.filter((r) => regIds.includes(r.regId) && r.emailedAt).length;
    const msg = `Email certificates to ${what}?${resend ? `\n\n${resend} of them already received one and will get it again.` : ""}`;
    if (!window.confirm(msg)) return;
    setStarting(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate-email`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ regIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send certificates");
      const skipped = (data.skipped ?? []).length;
      setNotice(`Sending ${data.queued} certificate${data.queued === 1 ? "" : "s"}…${skipped ? ` ${skipped} skipped (not ready).` : ""}`);
      setSelected(new Set());
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send certificates");
    } finally {
      setStarting(false);
    }
  };

  const filtered = genderFilter !== "all" || ageFilter !== "all" || weightFilter !== "all" || certFilter !== "all";
  // With a category / certificate filter on, the main button sends only to that slice.
  const unsentIds = narrowed.filter((r) => r.ready && !r.emailedAt).map((r) => r.regId);
  const selectCls = "h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-orange-100";
  const tabs: { key: Filter; label: string }[] = [
    { key: "unsent", label: "Ready to send" },
    { key: "sent", label: "Sent" },
    { key: "notready", label: "Not ready" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7400] flex items-center justify-center shrink-0"><Mail size={19} /></div>
          <div>
            <h4 className="text-base font-black text-slate-800">Email certificates</h4>
            <p className="text-sm text-slate-500 mt-0.5">
              Send each player their certificate (PDF) at their registered email. Available once their category is concluded.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh list"
            title="Refresh list"
            className="w-10 h-10 inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#FF7400] hover:border-orange-200 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => send([...selected], `${selected.size} selected player${selected.size === 1 ? "" : "s"}`)}
            disabled={!selected.size || running || starting}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] disabled:opacity-50"
          >
            <Send size={15} /> Send to selected{selected.size ? ` (${selected.size})` : ""}
          </button>
          <button
            type="button"
            onClick={() => send(unsentIds, `${filtered ? "the" : "all"} ${unsentIds.length} player${unsentIds.length === 1 ? "" : "s"}${filtered ? " in this filter" : ""} who haven't received one yet`)}
            disabled={!unsentIds.length || running || starting}
            className="h-10 inline-flex items-center gap-2 px-4 rounded-xl text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-50"
          >
            {starting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} {filtered ? "Send to filtered not sent" : "Send to all not sent"} ({unsentIds.length})
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="px-5 pt-4 space-y-2">
        {settingsDirty && (
          <p className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-800">
            <AlertCircle size={16} className="shrink-0" /> You have unsaved certificate settings. Save them first — emails use the saved settings.
          </p>
        )}
        {running && job && (
          <div className="rounded-xl bg-orange-50 border border-orange-200 px-4 py-3">
            <div className="flex items-center justify-between text-sm font-bold text-orange-800">
              <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Sending certificates…</span>
              <span>{job.done} of {job.total}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-orange-100 overflow-hidden">
              <div className="h-full bg-[#FF7400] transition-all" style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}
        {!running && job?.finishedAt && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${job.failed.length ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            <p className="flex items-center gap-2">
              {job.failed.length ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              Last send: {job.sent} of {job.total} emailed{job.failed.length ? `, ${job.failed.length} failed` : ""}.
            </p>
            {job.failed.length > 0 && (
              <ul className="mt-1.5 ml-6 list-disc text-xs font-medium">
                {job.failed.slice(0, 8).map((f, i) => <li key={i}>{f.name}: {f.error}</li>)}
                {job.failed.length > 8 && <li>…and {job.failed.length - 8} more</li>}
              </ul>
            )}
          </div>
        )}
        {notice && !running && !job?.finishedAt && <p className="text-sm font-semibold text-slate-600">{notice}</p>}
        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`h-8 px-3 rounded-lg text-xs font-bold transition-colors ${filter === t.key ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              {t.label} <span className="ml-0.5 text-slate-400">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={genderFilter}
            onChange={(e) => { setGenderFilter(e.target.value); setAgeFilter("all"); setWeightFilter("all"); }}
            aria-label="Filter by gender"
            className={`${selectCls} w-full sm:w-32`}
          >
            <option value="all">Boys & Girls</option>
            {genderOptions.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={ageFilter}
            onChange={(e) => { setAgeFilter(e.target.value); setWeightFilter("all"); }}
            aria-label="Filter by age group"
            className={`${selectCls} w-full sm:w-56`}
          >
            <option value="all">All age groups</option>
            {ageOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={weightFilter}
            onChange={(e) => setWeightFilter(e.target.value)}
            aria-label="Filter by weight"
            className={`${selectCls} w-full sm:w-32`}
          >
            <option value="all">All weights</option>
            {weightOptions.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <select
            value={certFilter}
            onChange={(e) => setCertFilter(e.target.value as CertFilter)}
            aria-label="Filter by certificate"
            className={`${selectCls} w-full sm:w-48`}
          >
            {CERT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {filtered && (
            <button
              type="button"
              onClick={() => { setGenderFilter("all"); setAgeFilter("all"); setWeightFilter("all"); setCertFilter("all"); }}
              className="h-9 px-3 rounded-lg text-xs font-bold text-slate-500 hover:text-[#FF7400]"
            >
              Clear
            </button>
          )}
          <label className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or category"
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-sm font-medium outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-orange-100"
            />
          </label>
        </div>
      </div>

      {/* List */}
      <div className="px-5 pb-5">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm font-semibold text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading players…</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-400 rounded-xl border border-dashed border-slate-200">
            {recipients.length === 0 ? "No approved players in this tournament yet." : "No players match this view."}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={!selectableVisible.length || running}
                      aria-label="Select all shown"
                      className="w-4 h-4 accent-[#FF7400]"
                    />
                  </th>
                  <th className="px-3 py-2.5">Player</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Certificate</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visible.map((r) => (
                  <tr key={r.regId} className={r.ready ? "hover:bg-orange-50/30" : "opacity-70"}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(r.regId)}
                        onChange={() => toggle(r.regId)}
                        disabled={!r.ready || running}
                        aria-label={`Select ${r.name}`}
                        className="w-4 h-4 accent-[#FF7400] disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2.5 min-w-[180px]">
                      <p className="font-bold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.email || <span className="italic text-slate-400">No email</span>}</p>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.category}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${PLACEMENT[r.placement].cls}`}>
                        {PLACEMENT[r.placement].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.emailedAt ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><CheckCircle2 size={13} /> Sent {fmtSent(r.emailedAt)}</span>
                      ) : r.ready ? (
                        <span className="text-xs font-bold text-slate-500">Ready</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
