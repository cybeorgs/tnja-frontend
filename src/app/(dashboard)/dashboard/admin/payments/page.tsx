"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IndianRupee,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Search,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Undo2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
const PAGE_SIZE = 25;

type Purpose = "ALL" | "REGISTRATION" | "TOURNAMENT" | "EVENT";
type StatusFilter = "ALL" | "CAPTURED" | "PENDING" | "FAILED" | "REFUNDED";
type Preset = "today" | "7d" | "month" | "year" | "all" | "custom";

interface Transaction {
  id: string;
  purpose: Exclude<Purpose, "ALL">;
  payerType: string;
  payerName: string;
  payerRef: string | null;
  description: string;
  amount: number;
  status: Exclude<StatusFilter, "ALL">;
  method: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  failureReason: string | null;
  date: string;
}

interface Bucket { key: string; amount: number; count: number }

interface Report {
  summary: {
    collected: number;
    capturedCount: number;
    averageTicket: number;
    pendingCount: number;
    failedCount: number;
    refunded: number;
    byPurpose: Bucket[];
    byRegistrationType: Bucket[];
    byDay: Bucket[];
  };
  total: number;
  transactions: Transaction[];
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom" },
];

const PURPOSES: { id: Purpose; label: string }[] = [
  { id: "ALL", label: "All income" },
  { id: "REGISTRATION", label: "Registration fees" },
  { id: "TOURNAMENT", label: "Tournament entries" },
  { id: "EVENT", label: "Event entries" },
];

const PURPOSE_LABEL: Record<string, string> = { REGISTRATION: "Registration fees", TOURNAMENT: "Tournament entries", EVENT: "Event entries" };
const TYPE_LABEL: Record<string, string> = { PLAYER: "Players", COACH: "Coaches", MEMBER: "Administrative Members", CLUB: "Clubs" };

const STATUS_STYLE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  CAPTURED: { label: "Successful", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 size={13} /> },
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200", icon: <Clock size={13} /> },
  FAILED: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200", icon: <XCircle size={13} /> },
  REFUNDED: { label: "Refunded", className: "bg-slate-100 text-slate-600 border-slate-200", icon: <Undo2 size={13} /> },
};

const rupees = (paise: number) =>
  (paise / 100).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Start/end of the preset range in the admin's local time, as ISO strings for the API. */
function rangeFor(preset: Preset, customFrom: string, customTo: string): { from?: string; to?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (preset) {
    case "today":
      return { from: startOfDay(now).toISOString() };
    case "7d":
      return { from: new Date(startOfDay(now).getTime() - 6 * 86400000).toISOString() };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case "year":
      return { from: new Date(now.getFullYear(), 0, 1).toISOString() };
    case "custom":
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
        to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined,
      };
    default:
      return {};
  }
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "ALL") qs.set(k, String(v));
  });
  return qs.toString();
}

// useSearchParams needs a Suspense boundary for the production build.
export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsReport />
    </Suspense>
  );
}

function PaymentsReport() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The category lives in the URL (?purpose=EVENT) so the sidebar's Event / Tournament links open the report pre-filtered.
  const purposeParam = searchParams.get("purpose");
  const purpose: Purpose = PURPOSES.some((p) => p.id === purposeParam) ? (purposeParam as Purpose) : "ALL";
  const setPurpose = (value: Purpose) =>
    router.replace(value === "ALL" ? pathname : `${pathname}?purpose=${value}`, { scroll: false });

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  // A sidebar link changes the category without going through changeFilter, so reset paging here too.
  const [pagedPurpose, setPagedPurpose] = useState(purpose);
  if (pagedPurpose !== purpose) {
    setPagedPurpose(purpose);
    setPage(1);
  }
  const [reloadTick, setReloadTick] = useState(0);
  const [result, setResult] = useState<{ key: string; report?: Report; error?: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  // Search waits for a pause in typing before it hits the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo(
    () => ({ ...rangeFor(preset, customFrom, customTo), purpose, status, q }),
    [preset, customFrom, customTo, purpose, status, q]
  );
  const requestKey = `${buildQuery({ ...filters, page, pageSize: PAGE_SIZE })}#${reloadTick}`;

  useEffect(() => {
    const controller = new AbortController();
    const query = buildQuery({ ...filters, page, pageSize: PAGE_SIZE });
    fetch(`${API_BASE}/admin/payments?${query}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load payments");
        setResult({ key: requestKey, report: data });
      })
      .catch((err) => {
        if (err.name !== "AbortError") setResult({ key: requestKey, error: err.message || "Failed to load payments" });
      });
    return () => controller.abort();
  }, [filters, page, requestKey]);

  const loading = result?.key !== requestKey;
  const report = result?.report;
  const summary = report?.summary;
  const totalPages = report ? Math.max(1, Math.ceil(report.total / PAGE_SIZE)) : 1;

  const changeFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/payments?${buildQuery({ ...filters, page: 1, pageSize: 5000 })}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data: Report & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");

      const header = ["Date", "Payer", "Payer ID", "Payer type", "Paid for", "Category", "Amount (INR)", "Status", "Method", "Razorpay payment ID", "Razorpay order ID", "Failure reason"];
      const lines = data.transactions.map((t) => [
        formatDateTime(t.date), t.payerName, t.payerRef ?? "", t.payerType, t.description, PURPOSE_LABEL[t.purpose],
        (t.amount / 100).toFixed(2), STATUS_STYLE[t.status]?.label ?? t.status, t.method ?? "", t.razorpayPaymentId ?? "", t.razorpayOrderId ?? "", t.failureReason ?? "",
      ]);
      const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `tnja-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert((err as Error).message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setReloadTick((t) => t + 1)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 text-sm shadow-sm"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            disabled={exporting || !report?.total}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FF7400] text-white rounded-xl font-bold hover:bg-orange-600 text-sm shadow-sm disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters: one row above everything they control */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => changeFilter(setPreset)(p.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                preset === p.id ? "bg-[#FF7400] text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => changeFilter(setCustomFrom)(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-[#FF7400]" aria-label="From date" />
              to
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => changeFilter(setCustomTo)(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:border-[#FF7400]" aria-label="To date" />
            </div>
          )}
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <select value={purpose} onChange={(e) => changeFilter(setPurpose)(e.target.value as Purpose)} aria-label="Category"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#FF7400]">
            {PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select value={status} onChange={(e) => changeFilter(setStatus)(e.target.value as StatusFilter)} aria-label="Status"
            className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#FF7400]">
            <option value="ALL">All statuses</option>
            <option value="CAPTURED">Successful</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, Player ID, tournament or Razorpay ID…"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#FF7400]" />
          </div>
        </div>
      </div>

      {result?.error && !loading && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium">{result.error}</div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={<IndianRupee size={18} />} label="Total collected" value={summary ? rupees(summary.collected) : "—"} hint={summary?.refunded ? `${rupees(summary.refunded)} refunded` : "Successful payments only"} loading={loading} emphasis />
        <StatTile icon={<Receipt size={18} />} label="Successful payments" value={summary ? summary.capturedCount.toLocaleString("en-IN") : "—"} loading={loading} />
        <StatTile icon={<TrendingUp size={18} />} label="Average payment" value={summary ? rupees(summary.averageTicket) : "—"} loading={loading} />
        <StatTile icon={<AlertTriangle size={18} />} label="Pending / failed" value={summary ? `${summary.pendingCount} / ${summary.failedCount}` : "—"} hint="Not counted in the total" loading={loading} />
      </div>

      {summary && summary.capturedCount > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-sm font-black text-slate-800">Money collected over time</h2>
            <p className="text-xs text-slate-400 mb-4">Successful payments, {summary.byDay.length > 62 ? "per month" : "per day"}</p>
            <TrendChart days={summary.byDay} />
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5">
            <Breakdown title="By category" rows={summary.byPurpose} total={summary.collected} label={(k) => PURPOSE_LABEL[k] ?? k} />
            {summary.byRegistrationType.length > 0 && (
              <Breakdown title="Registration fees by type" rows={summary.byRegistrationType} total={summary.byRegistrationType.reduce((s, r) => s + r.amount, 0)} label={(k) => TYPE_LABEL[k] ?? k} />
            )}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800">Transactions</h2>
          <span className="text-xs font-semibold text-slate-400">{report ? `${report.total.toLocaleString("en-IN")} found` : ""}</span>
        </div>

        {loading && !report ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-[#FF7400]" />
            <p className="text-sm font-medium">Loading payments…</p>
          </div>
        ) : !report || report.transactions.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">No payments match these filters</p>
            <p className="text-xs text-slate-400 mt-1">Try a wider date range or clear the search.</p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Paid by</th>
                  <th className="px-5 py-3">Paid for</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Razorpay ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.transactions.map((t) => {
                  const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.PENDING;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600">{formatDateTime(t.date)}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-slate-800">{t.payerName}</p>
                        <p className="text-xs text-slate-400">
                          {t.payerRef && <span className="font-mono">{t.payerRef}</span>}
                          {t.payerRef && " · "}
                          <span className="capitalize">{t.payerType.replace(/_/g, " ").toLowerCase()}</span>
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 min-w-[180px]">
                        {t.description}
                        {t.failureReason && <p className="text-xs text-red-500 mt-0.5">{t.failureReason}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-black text-slate-800 whitespace-nowrap">{rupees(t.amount)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-bold ${st.className}`}>
                          {st.icon}
                          {st.label}
                        </span>
                        {t.method && <p className="text-[11px] text-slate-400 mt-1 uppercase">{t.method}</p>}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap">{t.razorpayPaymentId ?? t.razorpayOrderId ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {report && report.total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || loading} aria-label="Previous page"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages || loading} aria-label="Next page"
                className="p-2 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
  emphasis?: boolean;
}

function StatTile({ icon, label, value, hint, loading, emphasis }: StatTileProps) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${emphasis ? "bg-[#FF7400] border-[#FF7400] text-white" : "bg-white border-slate-100"}`}>
      <div className={`flex items-center gap-2 text-xs font-bold ${emphasis ? "text-orange-100" : "text-slate-500"}`}>
        {icon}
        {label}
      </div>
      <p className={`text-2xl sm:text-3xl font-black mt-2 tracking-tight ${emphasis ? "text-white" : "text-slate-800"} ${loading ? "opacity-50" : ""}`}>{value}</p>
      {hint && <p className={`text-[11px] mt-1 ${emphasis ? "text-orange-100" : "text-slate-400"}`}>{hint}</p>}
    </div>
  );
}

interface BreakdownProps {
  title: string;
  rows: Bucket[];
  total: number;
  label: (key: string) => string;
}

/** Share of the collected money per group; one hue, longest bar first. */
function Breakdown({ title, rows, total, label }: BreakdownProps) {
  return (
    <div>
      <h3 className="text-sm font-black text-slate-800 mb-3">{title}</h3>
      <ul className="space-y-3">
        {rows.map((r) => {
          const share = total ? (r.amount / total) * 100 : 0;
          return (
            <li key={r.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-slate-600">{label(r.key)}</span>
                <span className="font-black text-slate-800">{rupees(r.amount)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden" role="img" aria-label={`${label(r.key)}: ${Math.round(share)}%`}>
                <div className="h-full rounded-full bg-[#FF7400]" style={{ width: `${Math.max(share, 2)}%` }} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{r.count} payment{r.count === 1 ? "" : "s"} · {Math.round(share)}%</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Single-series bar chart of daily (or, for long ranges, monthly) collections with a hover tooltip. */
function TrendChart({ days }: { days: Bucket[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const bars = useMemo(() => {
    if (days.length <= 62) {
      return days.map((d) => ({
        ...d,
        label: new Date(`${d.key}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      }));
    }
    const months = new Map<string, Bucket>();
    for (const d of days) {
      const key = d.key.slice(0, 7);
      const m = months.get(key) ?? { key, amount: 0, count: 0 };
      m.amount += d.amount;
      m.count += d.count;
      months.set(key, m);
    }
    return [...months.values()].map((m) => ({
      ...m,
      label: new Date(`${m.key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
    }));
  }, [days]);

  const max = Math.max(...bars.map((b) => b.amount), 1);
  const active = hover !== null ? bars[hover] : null;

  return (
    <div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-0 border-t border-dashed border-slate-200" />
        <span className="absolute right-0 -top-4 text-[10px] font-semibold text-slate-400">{rupees(max)}</span>
        <div className="h-44 flex items-end gap-[2px] pt-1" onMouseLeave={() => setHover(null)}>
          {bars.map((b, i) => (
            <button
              key={b.key}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${b.label}: ${rupees(b.amount)} from ${b.count} payment${b.count === 1 ? "" : "s"}`}
              className="flex-1 h-full flex items-end min-w-[3px] max-w-[48px] group focus:outline-none"
            >
              <span
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-[#C45A00]" : "bg-[#FF7400]"}`}
                style={{ height: `${Math.max((b.amount / max) * 100, 1.5)}%` }}
              />
            </button>
          ))}
        </div>
        <div className="border-t border-slate-300" />
        {active && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow-lg whitespace-nowrap pointer-events-none">
            <span className="font-semibold">{active.label}</span> · <span className="font-black">{rupees(active.amount)}</span> · {active.count} payment{active.count === 1 ? "" : "s"}
          </div>
        )}
      </div>
      <div className="flex justify-between text-[10px] font-semibold text-slate-400 mt-1.5">
        <span>{bars[0]?.label}</span>
        {bars.length > 1 && <span>{bars[bars.length - 1].label}</span>}
      </div>
    </div>
  );
}
