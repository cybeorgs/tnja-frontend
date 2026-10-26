"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronLeft,
  CheckCircle2,
  Clock,
  XCircle,
  User,
  Calendar,
  Hash,
  Loader2,
  ClipboardCheck,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CreditCard,
  Upload,
  ArrowRight,
  BadgeCheck,
} from "lucide-react";
import FileUpload from "@/components/common/FileUpload";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REPLAY" | "BPL_REJECTED";

interface TrackResult {
  fullName: string;
  tempId: string;
  permanentId?: string | null;
  role?: string;
  status: Status;
  createdAt: string;
  district?: { name: string };
  city?: string;
  email?: string;
  mobileNumber?: string;
  isBPL?: boolean;
  bplProof?: string | null;
  isPaid?: boolean;
  rejectionRemark?: string | null;
  mustChangePassword?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const statusConfig: Record<
  Status,
  { label: string; color: string; bg: string; border: string; icon: React.ReactNode; desc: string }
> = {
  PENDING: {
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: <Clock size={22} className="text-amber-500" />,
    desc: "Your application has been received and is currently under review by the admin.",
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: <CheckCircle2 size={22} className="text-emerald-500" />,
    desc: "Your application has been approved.",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <XCircle size={22} className="text-red-500" />,
    desc: "Your application has been permanently rejected. Please contact the TNJA office if you have questions.",
  },
  REPLAY: {
    label: "Changes Requested",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: <Clock size={22} className="text-purple-500" />,
    desc: "The admin has requested changes to your application. Please review the remarks below and update your details.",
  },
  BPL_REJECTED: {
    label: "Approved – BPL Not Accepted",
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: <AlertTriangle size={22} className="text-orange-500" />,
    desc: "Your application is approved, but your BPL proof was not accepted. Upload new proof, or continue without BPL and pay the registration fee.",
  },
};

const ID_LABEL: Record<string, string> = { PLAYER: "Player ID", COACH: "Coach ID", CLUB: "Club ID" };
const FEE_KEY: Record<string, string> = { PLAYER: "playerFee", COACH: "coachFee", CLUB: "clubFee" };

const steps = [
  { key: "submitted", label: "Submitted" },
  { key: "review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "issued", label: "ID Issued" },
];

type StepState = "done" | "active" | "rejected" | "pending";

function getStepState(result: TrackResult, stepKey: string): StepState {
  const { status, permanentId } = result;
  if (stepKey === "submitted") return "done";
  if (stepKey === "review") return status === "PENDING" || status === "REPLAY" ? "active" : "done";
  if (stepKey === "approved") {
    if (status === "REJECTED") return "rejected";
    if (status === "APPROVED") return "done";
    if (status === "BPL_REJECTED") return "active";
    return "pending";
  }
  if (permanentId) return "done";
  return status === "APPROVED" ? "active" : "pending";
}

const loadRazorpayScript = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function TrackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Emails link here as /track?tempId=… so the ID is pre-filled.
  const [tempId, setTempId] = useState(() => searchParams.get("tempId") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [fee, setFee] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<"pay" | "decline" | "resubmit" | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [newBplProof, setNewBplProof] = useState("");

  const role = result?.role || "";
  const idLabel = ID_LABEL[role] || "Administrative Member ID";
  const bplExempt = role === "PLAYER" && !!result?.isBPL && !!result?.bplProof;
  const needsPayment = !!result && result.status === "APPROVED" && !result.permanentId && !bplExempt;

  // Load the registration fee only when the applicant has something to pay.
  useEffect(() => {
    if (!needsPayment) return;
    fetch(`${API_BASE}/settings/global`)
      .then((res) => (res.ok ? res.json() : null))
      .then((settings) => setFee(settings ? Number(settings[FEE_KEY[role] || "memberFee"]) || null : null))
      .catch(() => setFee(null));
  }, [needsPayment, role]);

  const fetchStatus = async (id: string, pwd: string) => {
    const res = await fetch(`${API_BASE}/auth/track-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempId: id, password: pwd }),
    });

    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error(res.ok ? "Invalid response from server." : "Tracking is currently unavailable. Please try again shortly.");
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.message || "Record not found.");
    if (data.token) localStorage.setItem("token", data.token);
    setResult(data.user || data);
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempId.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setNotice("");
    setActionError("");
    setResult(null);

    try {
      await fetchStatus(tempId.trim(), password.trim());
    } catch (err: any) {
      setError(
        err.name === "TypeError"
          ? "Network error. Please check your connection and try again."
          : err.message || "Could not find registration. Please check your Temporary ID and Password."
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      await fetchStatus(tempId.trim(), password.trim());
    } catch (err: any) {
      setActionError(err.message || "Could not refresh your status. Please track again.");
    }
  };

  const postAction = async (path: string, body?: object) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  };

  const handleResubmitBpl = async () => {
    if (!newBplProof) return setActionError("Please upload your new BPL proof first.");
    setActionLoading("resubmit");
    setActionError("");
    try {
      const data = await postAction("/application/bpl/resubmit", { bplProof: newBplProof });
      setNotice(data.message);
      setNewBplProof("");
      await refreshStatus();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleContinueWithoutBpl = async () => {
    if (!confirm("Continue without BPL? You will need to pay the registration fee to get your Player ID.")) return;
    setActionLoading("decline");
    setActionError("");
    try {
      const data = await postAction("/application/bpl/decline");
      setNotice(data.message);
      await refreshStatus();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePayment = async () => {
    if (!result) return;
    setActionLoading("pay");
    setActionError("");
    try {
      if (!(await loadRazorpayScript())) throw new Error("Payment gateway failed to load. Please check your connection.");
      // The backend derives the applicant from the token and the fee from settings.
      const order = await postAction("/application/create-order");

      const checkout = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Tamil Nadu Judo Association",
        description: "Registration Fee",
        order_id: order.orderId,
        prefill: { name: result.fullName, email: result.email, contact: result.mobileNumber },
        theme: { color: "#FF7400" },
        handler: async (response: any) => {
          setActionLoading("pay");
          try {
            const verified = await postAction("/application/verify-payment", {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            setNotice(
              verified.status === "PENDING"
                ? `Payment received and awaiting bank confirmation. Your ${idLabel} will be issued and emailed shortly.`
                : `Payment successful! Your ${idLabel} has been issued.`
            );
            await refreshStatus();
          } catch (err: any) {
            setActionError(`Payment verification failed: ${err.message}. If money was deducted, your ID will be issued automatically once the bank confirms.`);
          } finally {
            setActionLoading(null);
          }
        },
        modal: { ondismiss: () => setActionLoading(null) },
      });
      checkout.open();
    } catch (err: any) {
      setActionError(err.message || "Could not start the payment.");
      setActionLoading(null);
    }
  };

  const goToDashboard = () => {
    if (!result) return;
    localStorage.setItem("userRole", result.role || "");
    localStorage.setItem("userName", result.fullName || "");
    localStorage.setItem("userStatus", result.status || "APPROVED");
    localStorage.setItem("userEmail", result.email || "");

    if (result.status === "REPLAY") return router.push("/dashboard/resubmit");
    if (result.mustChangePassword) return router.push("/dashboard/change-password");

    if (["SUPER_ADMIN", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(result.role || "")) {
      router.push("/dashboard/admin");
    } else if (result.role === "PLAYER") {
      router.push("/dashboard/player");
    } else {
      router.push("/dashboard/member");
    }
  };

  const cfg = result ? statusConfig[result.status] ?? statusConfig.PENDING : null;
  const showRemark = !!result?.rejectionRemark && ["REPLAY", "REJECTED", "BPL_REJECTED"].includes(result.status);
  const showDashboardButton = !!result && (!!result.permanentId || result.status === "REPLAY" || (result.status === "APPROVED" && !needsPayment));

  const statusMessage = !result || !cfg
    ? ""
    : result.status === "APPROVED"
      ? result.permanentId
        ? `Your ${idLabel} has been issued. You can now log in to your dashboard.`
        : needsPayment
          ? `Pay the registration fee to receive your ${idLabel}.`
          : `Your ${idLabel} is being issued.`
      : cfg.desc;

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 px-4 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#FF7400] transition-colors mb-6"
        >
          <ChevronLeft size={16} />
          Back to Login
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          {/* ── Left: sign in with temporary credentials ── */}
          <aside className="bg-white rounded-3xl shadow-xl shadow-orange-100/60 border border-orange-100 p-6 lg:sticky lg:top-6">
            <div className="flex items-center gap-3 mb-6">
              <div
                style={{ backgroundColor: "#FF7400" }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-200"
              >
                <ClipboardCheck size={24} color="#fff" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-800">Track Registration</h1>
                <p className="text-xs text-slate-500 font-medium">Use the Temporary ID and password from your email</p>
              </div>
            </div>

            <form onSubmit={handleTrack} className="space-y-4">
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tempId}
                  onChange={(e) => setTempId(e.target.value)}
                  placeholder="Temporary ID (e.g. TEMP-STU-XXXXXX)"
                  required
                  className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-[#FF7400]/10 transition-all"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Temporary Password"
                  required
                  className="w-full pl-9 pr-12 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-[#FF7400]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || !tempId.trim() || !password.trim()}
                style={{ backgroundColor: "#FF7400" }}
                className="w-full py-3 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all shadow-md shadow-orange-200"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? "Checking…" : result ? "Refresh Status" : "Track Application"}
              </button>
            </form>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </aside>

          {/* ── Right: application status ── */}
          <section className="min-w-0">
            <AnimatePresence mode="wait">
              {result && cfg ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Summary: who, status, progress */}
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{ backgroundColor: "#FF7400" }}
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-lg"
                        >
                          {(result.fullName || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-lg font-black text-slate-800 truncate">{result.fullName || "—"}</p>
                          <p className="text-xs text-slate-400 font-semibold capitalize">
                            {result.role?.replace(/_/g, " ").toLowerCase() || "Member"}
                            {role === "PLAYER" && result.isBPL ? " · BPL" : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-2 self-start sm:self-auto px-4 py-2 rounded-full border text-sm font-black ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>

                    <p className="text-sm text-slate-500 font-medium mt-4">{statusMessage}</p>
                    {showRemark && (
                      <div className={`mt-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admin Remarks</p>
                        <p className={`text-sm font-bold mt-0.5 whitespace-pre-line ${cfg.color}`}>{result.rejectionRemark}</p>
                      </div>
                    )}

                    {/* Progress steps */}
                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-100">
                      {steps.map((step, idx) => {
                        const state = getStepState(result, step.key);
                        const next = idx < steps.length - 1 ? getStepState(result, steps[idx + 1].key) : null;
                        return (
                          <React.Fragment key={step.key}>
                            <div className="flex flex-col items-center gap-1.5">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                                  state === "rejected"
                                    ? "bg-red-500 border-red-500"
                                    : state === "done"
                                      ? "bg-emerald-500 border-emerald-500"
                                      : state === "active"
                                        ? "border-amber-400 bg-amber-50"
                                        : "border-slate-200 bg-white"
                                }`}
                              >
                                {state === "rejected" ? (
                                  <XCircle size={18} color="#fff" />
                                ) : state === "done" ? (
                                  <CheckCircle2 size={18} color="#fff" />
                                ) : state === "active" ? (
                                  <Clock size={16} className="text-amber-500" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-slate-200" />
                                )}
                              </div>
                              <span className="text-[11px] font-bold text-slate-500 text-center leading-tight">{step.label}</span>
                            </div>
                            {next && (
                              <div className={`grow h-0.5 mx-2 mb-5 rounded-full ${next !== "pending" ? "bg-[#FF7400]" : "bg-slate-200"}`} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {(notice || actionError) && (
                    <div className="space-y-3">
                      {notice && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium">{notice}</div>
                      )}
                      {actionError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">{actionError}</div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Application details */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">Application Details</p>
                      <dl className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Hash size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temporary ID</dt>
                            <dd className="text-sm font-bold text-slate-700 font-mono break-all">{result.tempId}</dd>
                          </div>
                        </div>
                        {result.permanentId && (
                          <div className="flex items-start gap-3">
                            <BadgeCheck size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{idLabel}</dt>
                              <dd className="text-sm font-bold text-emerald-600 font-mono break-all">{result.permanentId}</dd>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Applied On</dt>
                            <dd className="text-sm font-bold text-slate-700">
                              {new Date(result.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </dd>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
                          <div>
                            <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</dt>
                            <dd className="text-sm font-bold text-slate-700">{result.district?.name || result.city || "—"}</dd>
                          </div>
                        </div>
                      </dl>
                    </div>

                    {/* Next step */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-4">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Next Step</p>

                      {needsPayment && (
                        <>
                          <div className="flex items-end justify-between">
                            <span className="text-sm font-bold text-slate-600">Registration fee</span>
                            <span className="text-3xl font-black text-[#FF7400]">{fee !== null ? `₹${fee.toLocaleString("en-IN")}` : "…"}</span>
                          </div>
                          <button
                            onClick={handlePayment}
                            disabled={!!actionLoading}
                            style={{ backgroundColor: "#FF7400" }}
                            className="w-full py-3 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-200 flex items-center justify-center gap-2 disabled:opacity-60 hover:opacity-90 transition-all"
                          >
                            {actionLoading === "pay" ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                            {actionLoading === "pay" ? "Processing…" : `Pay & Get ${idLabel}`}
                          </button>
                          <p className="text-[11px] text-slate-400 text-center">Secure payment via Razorpay. Your {idLabel} is issued as soon as payment succeeds.</p>
                        </>
                      )}

                      {result.permanentId && (
                        <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-2xl text-center space-y-1">
                          <BadgeCheck size={28} className="text-emerald-500 mx-auto" />
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your {idLabel}</p>
                          <p className="text-2xl font-black text-emerald-600 font-mono break-all">{result.permanentId}</p>
                          <p className="text-xs text-slate-500">Also sent to your registered email.</p>
                        </div>
                      )}

                      {result.status === "PENDING" && (
                        <p className="text-sm text-slate-500">
                          No action needed. The admin will review your application and you will get an email with the decision. Check back here any time.
                        </p>
                      )}
                      {result.status === "BPL_REJECTED" && (
                        <p className="text-sm text-slate-500">Choose one of the two options below to continue your registration.</p>
                      )}
                      {result.status === "REJECTED" && (
                        <p className="text-sm text-slate-500">This decision is final. Please contact the TNJA office if you have questions.</p>
                      )}
                      {result.status === "REPLAY" && (
                        <p className="text-sm text-slate-500">Update your application using the admin remarks above, then resubmit it for review.</p>
                      )}

                      {showDashboardButton && (
                        <div>
                          <button
                            onClick={goToDashboard}
                            style={{ backgroundColor: "#FF7400" }}
                            className="flex justify-center items-center gap-2 w-full py-3 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-200 hover:opacity-90 transition-all"
                          >
                            {result.status === "REPLAY" ? "Update My Application" : "Go to Dashboard"} <ArrowRight size={16} />
                          </button>
                          {result.permanentId && result.mustChangePassword && (
                            <p className="text-[11px] text-slate-400 text-center mt-2">You will be asked to set a new password first.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BPL not accepted: resubmit proof or continue without BPL */}
                  {result.status === "BPL_REJECTED" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-3">
                        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <Upload size={16} className="text-[#FF7400]" /> Option 1: Resubmit BPL proof
                        </p>
                        <FileUpload
                          label="New BPL proof"
                          value={newBplProof}
                          onChange={setNewBplProof}
                          helperText="Upload a clear photo or PDF of your BPL card (max 5MB)"
                          required
                        />
                        <button
                          onClick={handleResubmitBpl}
                          disabled={!!actionLoading || !newBplProof}
                          className="w-full py-3 bg-slate-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-900 transition-all"
                        >
                          {actionLoading === "resubmit" && <Loader2 size={16} className="animate-spin" />}
                          Resubmit for Review
                        </button>
                      </div>
                      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-3">
                        <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <CreditCard size={16} className="text-[#FF7400]" /> Option 2: Continue without BPL
                        </p>
                        <p className="text-sm text-slate-500">Pay the registration fee and receive your Player ID straight away.</p>
                        <button
                          onClick={handleContinueWithoutBpl}
                          disabled={!!actionLoading}
                          style={{ backgroundColor: "#FF7400" }}
                          className="w-full py-3 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
                        >
                          {actionLoading === "decline" && <Loader2 size={16} className="animate-spin" />}
                          Continue without BPL
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="hidden lg:flex flex-col items-center justify-center text-center min-h-[420px] rounded-3xl border-2 border-dashed border-orange-200 bg-white/50 p-10"
                >
                  <ClipboardCheck size={40} className="text-orange-300 mb-4" />
                  <p className="text-lg font-black text-slate-700">Your application status will appear here</p>
                  <p className="text-sm text-slate-500 mt-1 max-w-sm">
                    Enter your Temporary ID and password on the left to see your progress, admin remarks and next steps.
                  </p>
                  <div className="flex items-center gap-2 mt-8 text-[11px] font-bold text-slate-400">
                    {steps.map((step, idx) => (
                      <React.Fragment key={step.key}>
                        <span className="px-3 py-1.5 rounded-full bg-white border border-slate-200">{step.label}</span>
                        {idx < steps.length - 1 && <span className="w-4 h-px bg-slate-300" />}
                      </React.Fragment>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </div>
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center px-4 py-12">
          <Loader2 className="animate-spin text-[#FF7400]" size={40} />
        </main>
      }
    >
      <TrackPageContent />
    </Suspense>
  );
}
