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
} from "lucide-react";
import FileUpload from "@/components/common/FileUpload";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REPLAY";

interface TrackResult {
  fullName: string;
  tempId: string;
  permanentId?: string;
  role?: string;
  status: Status;
  createdAt: string;
  district?: { name: string };
  city?: string;
}

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
    desc: "Congratulations! Your application has been approved. You can now log in to your dashboard.",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <XCircle size={22} className="text-red-500" />,
    desc: "Your application was not approved. Please contact the association for more details.",
  },
  REPLAY: {
    label: "Changes Requested",
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    icon: <Clock size={22} className="text-purple-500" />,
    desc: "The admin has requested changes to your application. Please login to review the remarks and resubmit.",
  },
};

const steps = [
  { key: "submitted", label: "Application Submitted" },
  { key: "review", label: "Under Review" },
  { key: "decision", label: "Decision" },
];

function getStepState(status: Status, stepKey: string) {
  if (stepKey === "submitted") return "done";
  if (stepKey === "review") return (status === "PENDING" || status === "REPLAY") ? "active" : "done";
  if (stepKey === "decision") {
    if (status === "APPROVED") return "approved";
    if (status === "REJECTED") return "rejected";
    return "pending";
  }
  return "pending";
}

function TrackPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tempId, setTempId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const paramId = searchParams.get("tempId");
    if (paramId) {
      setTempId(paramId);
    }
  }, [searchParams]);

  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resubmitSuccess, setResubmitSuccess] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

  useEffect(() => {
    if (result) {
      const initialForm: any = {};
      Object.keys(result).forEach((key) => {
        const val = result[key];
        // Exclude specific system/relation keys
        if (
          [
            "id",
            "password",
            "createdAt",
            "updatedAt",
            "status",
            "rejectionRemark",
            "role",
            "tempId",
            "permanentId",
            "districtId",
            "talukId",
            "zoneId",
            "clubId",
            "coachId",
            "district",
            "taluk",
            "zone",
            "club",
            "coach",
            "students",
            "tournaments",
            "members",
            "payments",
            "grievances",
            "matches",
            "logs",
            "approvedBy",
            "approvedAt",
            "mustChangePassword",
            "resetPasswordToken",
            "resetPasswordExpires",
            "isPaid",
            "validUntil",
            "wins",
            "losses",
            "draws"
          ].includes(key)
        ) {
          return;
        }

        // Include if it's not an object (primitive) OR if it is null (empty primitive)
        if (val === null || typeof val !== "object") {
          initialForm[key] = val || "";
        }
      });
      setFormData(initialForm);
      setResubmitSuccess(false);
      setResubmitError(null);
    } else {
      setFormData({});
    }
  }, [result]);

  const handleInputChange = (key: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleDirectLogin = () => {
    if (!result) return;

    localStorage.setItem("userRole", result.role);
    localStorage.setItem("userName", result.fullName || "");
    localStorage.setItem("userStatus", result.status || "APPROVED");
    localStorage.setItem("userEmail", result.email || "");

    if (result.mustChangePassword) {
      router.push("/dashboard/change-password");
      return;
    }

    if (result.status === "PENDING") {
      alert("Your application is pending approval.");
      return;
    }
    
    if (result.status === "REJECTED" || result.status === "REPLAY") {
      router.push("/dashboard/resubmit");
      return;
    }

    if (["SUPER_ADMIN", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(result.role)) {
      router.push("/dashboard/admin");
    } else if (result.role === "PLAYER") {
      router.push("/dashboard/player");
    } else {
      router.push("/dashboard/member");
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResubmitError(null);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/resubmit-application`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resubmit application");

      setResubmitSuccess(true);
      // Update result state to PENDING so the UI updates to show pending status
      setResult((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          status: "PENDING",
          rejectionRemark: null,
        };
      });
    } catch (err: any) {
      setResubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempId.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/auth/track-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tempId: tempId.trim(),
          password: password.trim(),
        }),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        if (!res.ok) {
          throw new Error("Tracking endpoint is currently unavailable.");
        }
        throw new Error("Invalid response from server.");
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Record not found.");
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      setResult(data.user || data);
    } catch (err: any) {
      if (err.name === 'TypeError') {
        setError("Network error. Please check if the server is running.");
      } else {
        setError(err.message || "Could not find registration. Please check your Temporary ID and Password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const cfg = result ? statusConfig[result.status as Status] ?? statusConfig.PENDING : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Back */}
      <div className="w-full max-w-lg mb-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#FF7400] transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Login
        </Link>
      </div>

      {/* Header */}
      <div className="text-center mb-8">
        <div
          style={{ backgroundColor: "#FF7400" }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200"
        >
          <ClipboardCheck size={28} color="#fff" />
        </div>
        <h1 className="text-2xl font-black text-slate-800">Track Registration</h1>
        <p className="text-sm text-slate-500 mt-1 font-medium">
          Enter your Temporary ID and Password to check your application status
        </p>
      </div>

      {/* Search card */}
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-orange-100/60 border border-orange-100 p-6">
        <form onSubmit={handleTrack} className="space-y-4">
          <div className="relative">
            <Hash
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
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
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Temporary Password (sent to your email)"
              required
              className="w-full pl-9 pr-12 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-[#FF7400]/10 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
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
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            {loading ? "Checking…" : "Track Application"}
          </button>
        </form>

        {/* Error */}
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

        {/* Result */}
        <AnimatePresence>
          {result && cfg && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 space-y-4"
            >
              {/* Status banner */}
              <div
                className={`flex flex-col gap-2.5 px-4 py-3.5 rounded-2xl border ${cfg.bg} ${cfg.border}`}
              >
                <div className="flex items-center gap-3">
                  {cfg.icon}
                  <div>
                    <p className={`text-sm font-black ${cfg.color}`}>
                      {cfg.label}
                    </p>
                    <p className="text-xs text-slate-500 font-medium leading-snug mt-0.5">
                      {result.status === "REPLAY"
                        ? "The admin has requested changes to your application. Please review the remarks below and update your details."
                        : cfg.desc}
                    </p>
                  </div>
                </div>
                {result.status === "REPLAY" && result.rejectionRemark && (
                  <div className="ml-9 p-3 bg-white border border-purple-100 rounded-xl shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Admin Remarks
                    </p>
                    <p className="text-xs font-bold text-purple-700 mt-0.5 whitespace-pre-line">
                      {result.rejectionRemark}
                    </p>
                  </div>
                )}
              </div>

              {/* Info card */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    style={{ backgroundColor: "#FF7400" }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-base"
                  >
                    {(result.fullName || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">
                      {result.fullName || "—"}
                    </p>
                    <p className="text-xs text-slate-400 font-medium capitalize">
                      {result.role?.replace(/_/g, " ").toLowerCase() || "Member"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="flex items-start gap-2">
                    <Hash size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Temp ID
                      </p>
                      <p className="text-xs font-bold text-slate-700 font-mono">
                        {result.tempId}
                      </p>
                    </div>
                  </div>

                  {result.permanentId && (
                    <div className="flex items-start gap-2">
                      <Hash size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Permanent ID
                        </p>
                        <p className="text-xs font-bold text-emerald-600 font-mono">
                          {result.permanentId}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <Calendar size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Applied On
                      </p>
                      <p className="text-xs font-bold text-slate-700">
                        {new Date(result.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <User size={13} className="text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Location
                      </p>
                      <p className="text-xs font-bold text-slate-700">
                        {result.district?.name || result.city || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress steps */}
              <div className="flex items-center justify-between px-2 pt-1">
                {steps.map((step, idx) => {
                  const state = getStepState(result.status as Status, step.key);
                  const isDone = state === "done" || state === "approved";
                  const isActive = state === "active";
                  const isApproved = state === "approved";
                  const isRejected = state === "rejected";

                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isRejected
                              ? "bg-red-500 border-red-500"
                              : isApproved
                                ? "bg-emerald-500 border-emerald-500"
                                : isDone
                                  ? "border-[#FF7400]"
                                  : isActive
                                    ? "border-amber-400 bg-amber-50"
                                    : "border-slate-200 bg-white"
                            }`}
                          style={
                            isDone && !isApproved && !isRejected
                              ? { backgroundColor: "#FF7400" }
                              : {}
                          }
                        >
                          {isRejected ? (
                            <XCircle size={16} color="#fff" />
                          ) : isDone ? (
                            <CheckCircle2 size={16} color="#fff" />
                          ) : isActive ? (
                            <Clock size={14} className="text-amber-500" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-200" />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 text-center leading-tight max-w-[70px]">
                          {step.label}
                        </span>
                      </div>
                      {idx < steps.length - 1 && (
                        <div
                          className={`flex-grow h-0.5 mx-2 mb-4 rounded-full ${getStepState(result.status as Status, steps[idx + 1].key) !== "pending"
                              ? "bg-[#FF7400]"
                              : "bg-slate-200"
                            }`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="pt-6 border-t border-slate-100 mt-4">
                <button
                  onClick={handleDirectLogin}
                  style={{ backgroundColor: "#FF7400" }}
                  className="flex justify-center items-center w-full py-3 text-white font-bold text-sm rounded-xl shadow-md shadow-orange-200 hover:opacity-90 transition-all"
                >
                  Login to Dashboard →
                </button>
              </div>

              
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center px-4 py-12">
        <Loader2 className="animate-spin text-[#FF7400]" size={40} />
      </main>
    }>
      <TrackPageContent />
    </Suspense>
  );
}
