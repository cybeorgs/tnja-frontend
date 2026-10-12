"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Trophy,
  MapPin,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  IndianRupee,
  Users,
  Plus,
  Calendar,
  ChevronRight,
  Hourglass,
  Send,
  MessageSquare,
  Edit2,
  Download,
} from "lucide-react";
import FileUpload from "@/components/common/FileUpload";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
const AVAILABLE_CATEGORIES = ["Mini Sub Junior", "Sub Junior", "Cadet", "Junior", "Senior"];

/** Format an ISO / yyyy-mm-dd date string as DD/MM/YYYY for display. */
function formatDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d || y.length !== 4) return "";
  return `${d}/${m}/${y}`;
}

/**
 * The real <input type="date"> behind our formatted overlay is invisible, so a user
 * typing digits directly into it gets no feedback on segment boundaries (day/month/year)
 * and can end up with garbage like a 6-digit year. Force every interaction through the
 * native calendar popup instead, and block manual digit entry.
 */
function openDatePicker(e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>) {
  const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
  try {
    el.showPicker?.();
  } catch {
    // showPicker can throw if the browser blocks it outside a user gesture; safe to ignore.
  }
}
function blockDateTyping(e: React.KeyboardEvent<HTMLInputElement>) {
  if (/^[0-9]$/.test(e.key)) e.preventDefault();
}

function MarsIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="10" cy="14" r="6" />
      <path d="M15 9l6-6M15 3h6v6" />
    </svg>
  );
}

function VenusIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="9" r="6" />
      <path d="M12 15v7M9 19h6" />
    </svg>
  );
}

function GenderIcon({ gender, size = 18, className = "" }: { gender: string; size?: number; className?: string }) {
  if (gender === "MALE") return <MarsIcon size={size} className={className} />;
  if (gender === "FEMALE") return <VenusIcon size={size} className={className} />;
  return <Users size={size} className={className} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "NOT_REQUIRED";

/** Coerce null / undefined from the API to "PENDING" so comparisons are safe */
function safeStatus(val: ApprovalStatus | null | undefined): ApprovalStatus {
  return val ?? "PENDING";
}

/** Normalise the role string regardless of casing / separator from the backend */
function normaliseRole(raw: string): string {
  return raw.toUpperCase().replace(/[- ]/g, "_");
}

interface Tournament {
  id: string;
  title: string;
  date: string;
  dateTo?: string;
  location: string;
  level: string;
  entryFee: number;
  totalSlots: number;
  registrationCount?: number;
  ageFrom: number;
  ageTo: number;
  category?: string;
  gender: string;
  beltEligibility?: string;
  allowBPL: boolean;
  status: string;
  districtApproval: ApprovalStatus;
  stateApproval: ApprovalStatus;
  superAdminApproval: ApprovalStatus;
  ceoApproval: ApprovalStatus;
  rejectionRemark?: string;
  hasPendingPlayers?: boolean;
  club?: { name: string; district?: { name: string } };
  bannerImage?: string;
}

// ─── Role configuration ───────────────────────────────────────────────────────
/**
 * Maps each admin role to the approval field they manage.
 * null = this role creates but doesn't sit in an approval queue.
 */
const APPROVAL_LEVEL_MAP: Record<string, string | null> = {
  DISTRICT_PRESIDENT: "district",
  DISTRICT_SECRETARY: "district",
  ZONE_PRESIDENT: null,   // creator only, no approval seat
  ZONE_SECRETARY: null,
  STATE_PRESIDENT: "state",
  STATE_SECRETARY: "state",
  SUPER_ADMIN: "superAdmin",
  CEO: "ceo",
};

/** Roles that are allowed to create tournaments. */
const CAN_CREATE_ROLES = [
  "DISTRICT_PRESIDENT",
  "DISTRICT_SECRETARY",
  "ZONE_PRESIDENT",
  "ZONE_SECRETARY",
  "STATE_PRESIDENT",
  "STATE_SECRETARY",
  "SUPER_ADMIN",
  "CEO",
];

const ROLE_LABEL: Record<string, string> = {
  DISTRICT_PRESIDENT: "District President",
  DISTRICT_SECRETARY: "District Secretary",
  ZONE_PRESIDENT: "Zone President",
  ZONE_SECRETARY: "Zone Secretary",
  STATE_PRESIDENT: "State President",
  STATE_SECRETARY: "State Secretary",
  SUPER_ADMIN: "Super Admin",
  CEO: "CEO",
};

/**
 * Returns true if the tournament belongs in this role's approval queue.
 *
 * Approval chain:
 *   Club created     → District → State → (SuperAdmin OR CEO)
 *   District created →            State → (SuperAdmin OR CEO)  (district auto-skipped)
 *   Zone created     →            State → (SuperAdmin OR CEO)  (district auto-skipped)
 *   State created    →                    (SuperAdmin OR CEO)  (district+state auto-skipped)
 *
 * SuperAdmin and CEO are PARALLEL final approvers.
 * Only ONE of them needs to approve — whichever acts first closes the tournament.
 */
function inApprovalQueue(t: Tournament, role: string): boolean {
  // Coerce null/undefined fields from the API into proper status strings
  const district = safeStatus(t.districtApproval);
  const state = safeStatus(t.stateApproval);
  const superAdmin = safeStatus(t.superAdminApproval);
  const ceo = safeStatus(t.ceoApproval);

  switch (normaliseRole(role)) {
    case "DISTRICT_PRESIDENT":
    case "DISTRICT_SECRETARY":
      return district === "PENDING";

    case "STATE_PRESIDENT":
    case "STATE_SECRETARY":
      // District step must already be resolved (APPROVED or NOT_REQUIRED / auto-skipped)
      return (
        (district === "APPROVED" || district === "NOT_REQUIRED") &&
        state === "PENDING"
      );

    case "SUPER_ADMIN":
      // Super Admin sees their own queue + CEO's queue combined
      return superAdmin === "PENDING" || ceo === "PENDING";

    case "CEO":
      // CEO sees their own queue + Super Admin's queue combined
      return ceo === "PENDING" || superAdmin === "PENDING";

    default:
      console.warn("[Tournaments] unrecognised role in inApprovalQueue:", role);
      return false;
  }
}

const ApprovalChain = () => null;

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = {
  title: "", dateFrom: "", dateTo: "", location: "", description: "",
  entryFee: "", totalSlots: "", numberOfMats: "1", ageFrom: "0", ageTo: "100", category: [] as string[],
  gender: "BOTH", allowBPL: false, beltEligibility: "", level: "DISTRICT", zoneId: "", districtId: "", clubId: "",
  bannerImage: "",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminTournamentsPage() {
  const searchParams = useSearchParams();
  const [userRole, setUserRole] = useState<string>("");

  // "approval" = show pending approvals for this role
  // "mine"     = show tournaments created by this role
  // "approved" = show fully approved tournaments
  const [activeTab, setActiveTab] = useState<"approval" | "mine" | "approved">("approval");

  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [approvedByMeList, setApprovedByMeList] = useState<Tournament[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [districts, setDistricts] = useState<Array<{ id: string; name: string; zoneName?: string }>>([]);
  const [clubs, setClubs] = useState<Array<{ id: string; clubName?: string; name?: string; districtId?: string; district?: any }>>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [replyLoading, setReplyLoading] = useState<Record<string, boolean>>({});
  const [tMessages, setTMessages] = useState<Record<string, { id: string; senderRole: string; senderName: string; message: string; createdAt: string }[]>>({});

  const fetchTournamentMessages = useCallback(async (tournamentId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTMessages((prev) => ({ ...prev, [tournamentId]: data }));
      }
    } catch (err) {
      console.error("Failed to fetch tournament messages", err);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [submitLoading, setSubmitLoading] = useState(false);

  // Edit modal
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [editFormData, setEditFormData] = useState({ ...emptyForm });
  const [editLoading, setEditLoading] = useState(false);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectRemark, setRejectRemark] = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Initialise role & active tab ─────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("userRole") || "";
    const role = normaliseRole(raw);
    console.log("[Tournaments] resolved role:", role, "(raw from localStorage:", raw, ")");
    setUserRole(role);

    const tabParam = searchParams.get("tab");
    if (tabParam === "approval" || tabParam === "mine" || tabParam === "approved") {
      setActiveTab(tabParam);
    } else {
      const isCreatorOnly = role === "ZONE_PRESIDENT" || role === "ZONE_SECRETARY";
      setActiveTab(isCreatorOnly ? "mine" : "approval");
    }

    // Fetch districts, zones, and clubs for tournament creation
    fetch(`${API_BASE}/districts`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setDistricts(data);
          const uniqueZones = Array.from(new Set(data.map((d: any) => d.zoneName).filter(Boolean))) as string[];
          if (uniqueZones.length > 0) setZones(uniqueZones);
        }
      })
      .catch(err => console.error("Failed to fetch districts", err));

    const token = localStorage.getItem("token");
    fetch(`${API_BASE}/clubs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setClubs(data);
      })
      .catch(err => console.error("Failed to fetch clubs", err));
  }, [searchParams]);

  // ── Per-tab fetch — fires whenever activeTab or userRole changes ─────────────
  const fetchTabData = useCallback(async (tab: "approval" | "mine" | "approved", role: string) => {
    if (!role) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const _approvalLevel = APPROVAL_LEVEL_MAP[role] ?? null;
      const _canCreate = CAN_CREATE_ROLES.includes(role);
      const _hasApprovalRole = _approvalLevel !== null;

      const [adminRes, myRes, approvedRes] = await Promise.all([
        _hasApprovalRole ? fetch(`${API_BASE}/tournaments/admin`, { headers }) : Promise.resolve(null),
        _canCreate ? fetch(`${API_BASE}/tournaments/official/my`, { headers }) : Promise.resolve(null),
        fetch(`${API_BASE}/tournaments/admin/approved`, { headers })
      ]);

      if (adminRes?.ok) {
        const data = await adminRes.json();
        setAllTournaments(data);
        if (tab === "approval") data.forEach((t: any) => fetchTournamentMessages(t.id));
      }
      if (myRes?.ok) {
        const data = await myRes.json();
        setMyTournaments(data);
        if (tab === "mine") data.forEach((t: any) => fetchTournamentMessages(t.id));
      }
      if (approvedRes?.ok) {
        const data = await approvedRes.json();
        setApprovedByMeList(data);
        if (tab === "approved") data.forEach((t: any) => fetchTournamentMessages(t.id));
      }
    } catch (err) {
      console.error("[Tournaments] fetchTabData error:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchTournamentMessages]);

  useEffect(() => {
    if (!userRole || !activeTab) return;
    fetchTabData(activeTab, userRole);
  }, [activeTab, userRole, fetchTabData]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    const handleScroll = () => {
      if (isFilterOpen) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isFilterOpen]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const approvalLevel = APPROVAL_LEVEL_MAP[userRole] ?? null;
  const canCreate = CAN_CREATE_ROLES.includes(userRole);
  const hasApprovalRole = approvalLevel !== null;

  const approvalQueue = allTournaments.filter(t => inApprovalQueue(t, userRole));

  const displayedApproval = approvalQueue.filter(
    t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedMine = myTournaments
    .filter(t => filter === "ALL" || t.status === filter)
    .filter(t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const displayedApproved = approvedByMeList.filter(
    t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  const handleDownloadReport = async (tId: string, title: string) => {
    setDownloadingReportId(tId);
    try {
      const token = localStorage.getItem("tnja_token") || localStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/tournaments/${tId}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to download report", "error");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = title?.replace(/[^a-zA-Z0-9_-]/g, "_") || tId;
      a.download = `Tournament_Report_${safeTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast("Tournament report downloaded!", "success");
    } catch (err) {
      console.error("Error downloading report:", err);
      showToast("Error downloading report", "error");
    } finally {
      setDownloadingReportId(null);
    }
  };

  // ── Approve / Reject action ──────────────────────────────────────────────────
  const handleAction = async (id: string, status: "APPROVED" | "REJECTED", remark?: string) => {
    const message = replyTexts[id]?.trim() || remark || "";
    if (status === "REJECTED" && !message) {
      setRejectModal({ id });
      return;
    }
    setActionLoading(id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, remark: message, message, approvalLevel }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      showToast(`Tournament ${status.toLowerCase()} successfully`, "success");
      setReplyTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
      setRejectModal(null);
      setRejectRemark("");
      fetchTabData("approval", userRole);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTournamentReply = async (id: string) => {
    const message = replyTexts[id]?.trim();
    if (!message) return;
    setReplyLoading(prev => ({ ...prev, [id]: true }));
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setReplyTexts(prev => { const n = { ...prev }; delete n[id]; return n; });
      await fetchTournamentMessages(id);
      showToast("Reply sent to creator.", "success");
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setReplyLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Open edit modal pre-filled ────────────────────────────────────────────
  const openEditModal = (t: Tournament) => {
    setEditingTournament(t);
    const dateFrom = t.date ? new Date(t.date).toISOString().split("T")[0] : "";
    const dateTo = t.dateTo ? new Date(t.dateTo).toISOString().split("T")[0] : "";
    const categoryArr = t.category ? t.category.split(", ").map(s => s.trim()).filter(Boolean) : [];
    setEditFormData({
      title: t.title || "",
      dateFrom,
      dateTo,
      location: t.location || "",
      description: "",
      entryFee: String(t.entryFee ?? ""),
      totalSlots: String((t as any).totalSlots ?? ""),
      numberOfMats: String((t as any).numberOfMats ?? "1"),
      ageFrom: String(t.ageFrom ?? "0"),
      ageTo: String(t.ageTo ?? "100"),
      category: categoryArr,
      gender: t.gender || "BOTH",
      allowBPL: t.allowBPL ?? false,
      beltEligibility: t.beltEligibility || "",
      level: t.level || "DISTRICT",
      zoneId: (t as any).zoneId || "",
      districtId: (t as any).districtId || (t as any).district?.id || "",
      clubId: (t as any).clubId || (t as any).club?.id || "",
      bannerImage: t.bannerImage || "",
    });
  };

  // ── Edit tournament ──────────────────────────────────────────────────────────
  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTournament) return;

    if (editFormData.level === "ZONE" && !editFormData.zoneId) {
      showToast("Please select a zone for zonal tournament.", "error");
      return;
    }
    if (editFormData.level === "DISTRICT" && !editFormData.districtId) {
      showToast("Please select a district for district tournament.", "error");
      return;
    }
    if (editFormData.level === "CLUB" && !editFormData.clubId) {
      showToast("Please select a club for club tournament.", "error");
      return;
    }

    setEditLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${editingTournament.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...editFormData,
          category: editFormData.category.join(", "),
          entryFee: Number(editFormData.entryFee),
          totalSlots: Number(editFormData.totalSlots),
          numberOfMats: Number(editFormData.numberOfMats),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      showToast("Tournament updated successfully!", "success");
      setEditingTournament(null);
      fetchTabData("mine", userRole);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Create tournament ────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.level === "ZONE" && !formData.zoneId) {
      showToast("Please select a zone for zonal tournament.", "error");
      return;
    }
    if (formData.level === "DISTRICT" && !formData.districtId) {
      showToast("Please select a district for district tournament.", "error");
      return;
    }
    if (formData.level === "CLUB" && !formData.clubId) {
      showToast("Please select a club for club tournament.", "error");
      return;
    }

    setSubmitLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/official/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          category: formData.category.join(", "),
          entryFee: Number(formData.entryFee),
          totalSlots: Number(formData.totalSlots),
          numberOfMats: Number(formData.numberOfMats),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      showToast("Tournament created! Awaiting approvals.", "success");
      setIsCreateOpen(false);
      setFormData({ ...emptyForm });
      fetchTabData("mine", userRole);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Approval chain preview inside Create modal ────────────────────────────────
  const ApprovalChainPreview = () => {
    return null;
  };

  // ── Stat cards ───────────────────────────────────────────────────────────────
  const totalMine = myTournaments.length;
  const approvedMine = myTournaments.filter(t => t.status === "APPROVED").length;
  const pendingQueue = approvalQueue.length;

  const isExpired = (t: { date?: string; dateTo?: string }): boolean => {
    const endDate = t.dateTo || t.date;
    if (!endDate) return false;
    const d = new Date(endDate);
    d.setHours(23, 59, 59, 999);
    return d < new Date();
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 relative">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-200 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#FF7400]">Tournaments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {ROLE_LABEL[userRole] || "Admin"} — Tournament Management
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-[#FF7400] text-white font-bold rounded-2xl shadow-lg shadow-[#FF7400]/20 hover:scale-105 active:scale-95 transition-all w-fit"
          >
            <Plus size={20} /> Create Tournament
          </button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pending my approval */}
        {hasApprovalRole && (
          <div className="bg-white p-6 rounded-[14px] border border-b-[4px] border-amber-400 shadow-md flex flex-col justify-between h-[120px]">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">PENDING MY APPROVAL</p>
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-slate-900">{pendingQueue}</h3>
              <div className="w-[46px] h-[46px] bg-amber-50 rounded-full flex items-center justify-center shadow-inner">
                <AlertCircle size={22} className="text-amber-500" />
              </div>
            </div>
          </div>
        )}

        {/* My tournaments */}
        {canCreate && (
          <div className="bg-white p-6 rounded-[14px] border border-b-[4px] border-[#FF7400] shadow-md flex flex-col justify-between h-[120px]">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">MY TOURNAMENTS</p>
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-slate-900">{totalMine}</h3>
              <div className="w-[46px] h-[46px] bg-orange-50 rounded-full flex items-center justify-center shadow-inner">
                <Trophy size={22} className="text-[#FF7400]" />
              </div>
            </div>
          </div>
        )}

        {/* Fully approved (creator view) or Total in system (approver view) */}
        {canCreate ? (
          <div className="bg-white p-6 rounded-[14px] border border-b-[4px] border-emerald-500 shadow-md flex flex-col justify-between h-[120px]">
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">FULLY APPROVED</p>
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-slate-900">{approvedMine}</h3>
              <div className="w-[46px] h-[46px] bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                <CheckCircle2 size={22} className="text-emerald-500" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white p-6 rounded-[14px] border border-b-[4px] border-[#FF7400] shadow-md flex flex-col justify-between h-[120px]">
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">PENDING IN QUEUE</p>
              <div className="flex items-center justify-between">
                <h3 className="text-4xl font-black text-slate-900">{allTournaments.length}</h3>
                <div className="w-[46px] h-[46px] bg-orange-50 rounded-full flex items-center justify-center shadow-inner">
                  <Trophy size={22} className="text-[#FF7400]" />
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-[14px] border border-b-[4px] border-emerald-500 shadow-md flex flex-col justify-between h-[120px]">
              <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">APPROVED BY ME</p>
              <div className="flex items-center justify-between">
                <h3 className="text-4xl font-black text-slate-900">{approvedByMeList.length}</h3>
                <div className="w-[46px] h-[46px] bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0 border-b border-slate-200">
        {[
          ...(hasApprovalRole ? [{
            key: "approval" as const,
            label: `Approval Queue${pendingQueue > 0 ? ` (${pendingQueue})` : ""}`,
          }] : []),
          ...(canCreate ? [{ key: "mine" as const, label: "My Tournaments" }] : []),
          { key: "approved" as const, label: "Approved Tournaments" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-bold border-b-2 -mb-[2px] transition-all ${activeTab === tab.key
              ? "border-[#FF7400] text-[#FF7400]"
              : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tournaments..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 font-medium text-sm text-slate-700 shadow-sm"
          />
        </div>

        {/* Status filter only for "My Tournaments" tab */}
        {activeTab === "mine" && (
          <div className="relative" ref={filterRef}>
            <div
              className="p-[1.5px] rounded-[10px] shrink-0 inline-flex shadow-sm"
              style={{ background: "linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)" }}
            >
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 font-bold rounded-[8.5px] hover:bg-slate-50 transition-all text-sm"
              >
                <Filter size={16} />
                {filter === "ALL" ? "Filter" : filter}
              </button>
            </div>
            {isFilterOpen && (
              <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 shadow-xl rounded-[10px] overflow-hidden z-50 w-44">
                {["ALL", "APPROVED", "PENDING", "REJECTED"].map(f => (
                  <button
                    key={f}
                    onClick={() => { setFilter(f); setIsFilterOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${filter === f ? "bg-orange-50 text-[#FF7400]" : "text-slate-600 hover:bg-slate-50"
                      }`}
                  >
                    {f === "ALL" ? "All Tournaments" : f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main content area ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin text-[#FF7400]" />
        </div>
      ) : (
        <>
          {/* ════════════ APPROVAL QUEUE ════════════ */}
          {activeTab === "approval" && (
            <>
              {displayedApproval.length === 0 ? (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
                  <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-300" />
                  <h3 className="text-lg font-bold text-slate-500">No Pending Approvals</h3>
                  <p className="text-slate-400 text-sm mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayedApproval.map(t => (
                    <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                      {/* Top — image + details */}
                      <div className="flex">
                        <div className="w-44 flex-shrink-0 relative" style={{ minHeight: 200 }}>
                          <img src={t.bannerImage || "/homepage/whatjudo/judo1.png"} alt="Judo" className="absolute inset-0 w-full h-full object-cover" />
                        </div>
                        <div className="flex-grow p-5">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                            {[
                              { label: "Tournament Name", value: t.title },
                              { label: "Level", value: t.level },
                              { label: "Gender", value: t.gender || "—" },
                              { label: "Category", value: t.category || "N/A" },
                              { label: "Date", value: new Date(t.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) },
                              { label: "Time", value: new Date(t.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
                              { label: "Location", value: t.location },
                              { label: "Tournament Fees", value: t.entryFee === 0 ? "Free" : String(t.entryFee) },
                            ].map(({ label, value }) => (
                              <div key={label}>
                                <p className="text-[11px] font-bold text-[#FF7400] mb-0.5">{label}</p>
                                <p className="text-sm font-semibold text-slate-700 leading-tight">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tournament Chat Section */}
                      <div className="bg-slate-50/50 border-t border-slate-100 p-5 space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <MessageSquare size={13} className="text-[#FF7400]" />
                          Communication History & Comments
                        </h4>

                        {/* Messages list */}
                        {tMessages[t.id]?.length > 0 ? (
                          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                            {tMessages[t.id].map((msg) => (
                              <div key={msg.id} className="flex items-start gap-2.5">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black ${
                                  msg.senderRole === "CLUB" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-[#FF7400]"
                                }`}>
                                  {msg.senderName.charAt(0)}
                                </div>
                                <div className="flex-grow">
                                  <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                                    <span className="font-bold text-slate-900 mr-1.5">{msg.senderName}:</span>
                                    {msg.message}
                                  </p>
                                  <p className="text-[9px] text-slate-400 mt-0.5">
                                    {new Date(msg.createdAt).toLocaleDateString("en-GB")} {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-slate-400">No communication history yet.</p>
                        )}
                      </div>

                      {/* Bottom row */}
                      <div className="flex items-center px-4 py-3 border-t border-slate-100">
                        {/* Send Reply — fixed width, orange border */}
                        <div className="w-72 rounded-[10px] p-[1.5px]" style={{ background: "linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)" }}>
                          <div className="flex items-center gap-2 bg-white rounded-[8.5px] px-3 py-2">
                            <input
                              type="text"
                              placeholder="Send Reply"
                              value={replyTexts[t.id] || ""}
                              onChange={(e) => setReplyTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === "Enter" && handleSendTournamentReply(t.id)}
                              className="flex-grow bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none"
                            />
                            <button
                              onClick={() => handleSendTournamentReply(t.id)}
                              disabled={!replyTexts[t.id]?.trim() || replyLoading[t.id]}
                              className="text-slate-400 hover:text-[#FF7400] disabled:opacity-30 transition-colors shrink-0"
                            >
                              {replyLoading[t.id] ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            </button>
                          </div>
                        </div>

                        {/* Buttons pushed to far right */}
                        <div className="ml-auto flex items-center gap-2">
                          {(safeStatus(t.superAdminApproval) === "APPROVED" || safeStatus(t.ceoApproval) === "APPROVED") ? (
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                                Approved by {safeStatus(t.superAdminApproval) === "APPROVED" ? "Super Admin" : "CEO"}
                              </span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAction(t.id, "APPROVED")}
                                disabled={actionLoading === t.id}
                                className="px-5 py-2 bg-[#FF7400] text-white text-sm font-bold rounded-lg hover:bg-[#E56900] disabled:opacity-50 transition-all"
                              >
                                {actionLoading === t.id ? <Loader2 size={15} className="animate-spin" /> : "Approve"}
                              </button>
                              <button
                                onClick={() => handleAction(t.id, "REJECTED")}
                                disabled={!!actionLoading}
                                className="px-5 py-2 bg-white border border-slate-300 text-slate-600 text-sm font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-all"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>


                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════ APPROVED TOURNAMENTS ════════════ */}
          {activeTab === "approved" && (
            <>
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 size={32} className="animate-spin text-[#FF7400]" />
                </div>
              ) : displayedApproved.length === 0 ? (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
                  <CheckCircle2 size={40} className="mx-auto mb-3 text-slate-200" />
                  <h3 className="text-lg font-bold text-slate-500">No Approved Tournaments</h3>
                  <p className="text-slate-400 text-sm mt-1">You haven't approved any tournaments yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedApproved.map(t => (
                    <motion.div
                      key={t.id}
                      whileHover={{ y: -4 }}
                      className="bg-white rounded-[20px] shadow-lg overflow-hidden flex flex-col"
                    >
                      <div className="h-32 bg-gradient-to-br from-emerald-900 via-emerald-700 to-[#FF7400] relative overflow-hidden">
                        {t.bannerImage && <img src={t.bannerImage} alt="Banner" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60" />}
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/30">
                          {t.level}
                        </div>
                        <div className="absolute top-3 right-3 bg-emerald-500/80 backdrop-blur text-white text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Approved
                        </div>
                        {t.club && (
                          <div className="absolute bottom-3 left-3 right-3 bg-black/40 backdrop-blur rounded-xl p-2.5 border border-white/20">
                            <p className="text-white text-xs font-bold truncate">{t.club.name}</p>
                            {t.club.district && (
                              <p className="text-white/70 text-[10px] truncate">{t.club.district.name}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="p-5 flex-grow flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-3 leading-snug">{t.title}</h3>

                        <div className="space-y-2 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-[#FF7400]" />
                            {new Date(t.date).toLocaleDateString("en-GB")}
                            {t.dateTo && ` – ${new Date(t.dateTo).toLocaleDateString("en-GB")}`}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-[#FF7400]" />{t.location}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users size={13} className="text-[#FF7400]" />
                            Category: {t.category || "N/A"} · {t.gender}
                          </div>
                          <div className="flex items-center gap-2">
                            <IndianRupee size={13} className="text-[#FF7400]" />
                            {t.entryFee === 0 ? "Free Entry" : `₹${t.entryFee}`}
                          </div>
                        </div>

                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleDownloadReport(t.id, t.title)}
                            disabled={downloadingReportId === t.id}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold rounded-xl text-xs transition-all border border-orange-200 shrink-0 disabled:opacity-50"
                            title="Download tournament report"
                          >
                            {downloadingReportId === t.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                            <span>Report</span>
                          </button>
                          {!t.hasPendingPlayers ? (
                            <Link
                              href={`/dashboard/admin/tournaments/${t.id}`}
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all"
                            >
                              <Trophy size={12} /> Manage Tournament
                              <ChevronRight size={12} />
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed"
                            >
                              <AlertCircle size={12} /> Resolve Pending Players
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ════════════ MY TOURNAMENTS ════════════ */}
          {activeTab === "mine" && (
            <>
              {displayedMine.length === 0 ? (
                <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
                  <Trophy size={40} className="mx-auto mb-3 text-slate-200" />
                  <h3 className="text-lg font-bold text-slate-500">No Tournaments Yet</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Click "Create Tournament" to get started.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedMine.map(t => (
                    <motion.div
                      key={t.id}
                      whileHover={{ y: -4 }}
                      className="bg-white rounded-[20px] shadow-lg overflow-hidden flex flex-col"
                    >
                      {/* Card banner */}
                      <div className="h-28 bg-gradient-to-br from-[#FF7400]/15 to-amber-50 flex items-center justify-center relative overflow-hidden">
                        {t.bannerImage ? (
                          <img src={t.bannerImage} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <Trophy size={40} className="text-[#FF7400]/20 absolute" />
                        )}
                        <span className="absolute top-3 left-3 bg-white/90 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                          {t.level}
                        </span>
                        {isExpired(t) ? (
                          <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full border bg-slate-100 text-slate-500 border-slate-300 flex items-center gap-1">
                            <Clock size={10} /> Expired
                          </span>
                        ) : (
                          <span className={`absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                            t.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            t.status === "CLOSED" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                            t.status === "REJECTED" ? "bg-red-50 text-red-600 border-red-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {t.status === "APPROVED" ? <><CheckCircle2 size={10} /> Approved</> :
                             t.status === "CLOSED" ? <><CheckCircle2 size={10} /> Concluded</> :
                             t.status === "REJECTED" ? <><XCircle size={10} /> Rejected</> : <><Hourglass size={10} /> Pending</>}
                          </span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="p-5 flex-grow flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-3 leading-snug">{t.title}</h3>

                        <div className="space-y-2 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-[#FF7400]" />
                            {new Date(t.date).toLocaleDateString("en-GB")}
                            {t.dateTo && ` – ${new Date(t.dateTo).toLocaleDateString("en-GB")}`}
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-[#FF7400]" />{t.location}
                          </div>
                          <div className="flex items-center gap-2">
                            <IndianRupee size={13} className="text-[#FF7400]" />
                            {t.entryFee === 0 ? "Free Entry" : `₹${t.entryFee}`}
                          </div>
                        </div>

                        <ApprovalChain />

                        {t.rejectionRemark && (
                          <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 text-xs text-red-700">
                            <span className="font-bold">Rejected: </span>{t.rejectionRemark}
                          </div>
                        )}

                        {/* Tournament Chat Section */}
                        <div className="mt-4 bg-slate-50 border-t border-slate-100 p-4 rounded-xl space-y-3">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <MessageSquare size={13} className="text-[#FF7400]" />
                            Communication History
                          </h4>

                          {/* Messages list */}
                          {tMessages[t.id]?.length > 0 ? (
                            <div className="space-y-3 max-h-32 overflow-y-auto pr-1">
                              {tMessages[t.id].map((msg) => (
                                <div key={msg.id} className="flex items-start gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black ${
                                    msg.senderRole === "CLUB" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-[#FF7400]"
                                  }`}>
                                    {msg.senderName.charAt(0)}
                                  </div>
                                  <div className="flex-grow">
                                    <p className="text-[11px] text-slate-700 font-semibold leading-relaxed">
                                      <span className="font-bold text-slate-900 mr-1">{msg.senderName}:</span>
                                      {msg.message}
                                    </p>
                                    <p className="text-[8px] text-slate-400">
                                      {new Date(msg.createdAt).toLocaleDateString("en-GB")} {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] font-semibold text-slate-400">No communication history yet.</p>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 flex gap-2">
                          {/* Edit button — only creator can edit */}
                          <button
                            onClick={() => openEditModal(t)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all border border-slate-200 hover:border-slate-300 shrink-0"
                            title="Edit tournament details"
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          {!t.hasPendingPlayers ? (
                            <Link
                              href={`/dashboard/admin/tournaments/${t.id}`}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#FF7400] to-orange-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all"
                            >
                              <Trophy size={14} /> Manage
                              <ChevronRight size={14} />
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-sm transition-all cursor-not-allowed"
                            >
                              <AlertCircle size={14} /> Resolve Pending Players
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════ CREATE TOURNAMENT MODAL ════════════ */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl lg:max-w-4xl bg-white rounded-[1.75rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">Create Tournament</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    As {ROLE_LABEL[userRole]} — approvals will be routed automatically.
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all"
                >
                  <XCircle size={26} />
                </button>
              </div>

              {/* Approval chain preview banner */}
              <ApprovalChainPreview />

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tournament Title *</label>
                    <input
                      required type="text" value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g. District Championship 2026"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div className="md:col-span-2 mt-2">
                    <FileUpload 
                      label="Banner Image (Optional)" 
                      value={formData.bannerImage} 
                      onChange={(url) => setFormData({ ...formData, bannerImage: url })} 
                      accept="image/*" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({ ...formData, level: e.target.value, zoneId: "", districtId: "", clubId: "" })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                    >
                      <option value="CLUB">Club</option>
                      <option value="DISTRICT">District</option>
                      <option value="ZONE">Zonal</option>
                      <option value="STATE">State</option>
                      <option value="NATIONAL">National</option>
                    </select>
                  </div>

                  {formData.level === "ZONE" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Zone</label>
                      <select
                        required
                        value={formData.zoneId || ""}
                        onChange={e => setFormData({ ...formData, zoneId: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                      >
                        <option value="" disabled>Select a Zone</option>
                        {zones.map((zone) => (
                          <option key={zone} value={zone}>{zone}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.level === "DISTRICT" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">District</label>
                      <select
                        required
                        value={formData.districtId || ""}
                        onChange={e => setFormData({ ...formData, districtId: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                      >
                        <option value="" disabled>Select a District</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.level === "CLUB" && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">District</label>
                        <select
                          value={formData.districtId || ""}
                          onChange={e => setFormData({ ...formData, districtId: e.target.value, clubId: "" })}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                        >
                          <option value="">Select a District</option>
                          {districts.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Club</label>
                        <select
                          required
                          value={formData.clubId || ""}
                          onChange={e => setFormData({ ...formData, clubId: e.target.value })}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                        >
                          <option value="" disabled>Select a Club</option>
                          {clubs
                            .filter(c => !formData.districtId || c.districtId === formData.districtId || (c as any).district?.id === formData.districtId)
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.clubName || (c as any).name}</option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className={formData.level !== "ZONE" ? "md:col-span-1" : ""}>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gender</label>
                    <div className="relative">
                      <GenderIcon gender={formData.gender} size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.gender}
                        onChange={e => setFormData({ ...formData, gender: e.target.value })}
                        className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold"
                      >
                        <option value="BOTH">Both</option>
                        <option value="MALE">Male Only</option>
                        <option value="FEMALE">Female Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Date *</label>
                    <div className="relative">
                      <input
                        required type="date" min={new Date().toISOString().split('T')[0]} value={formData.dateFrom}
                        onChange={e => setFormData({ ...formData, dateFrom: e.target.value })}
                        onFocus={openDatePicker} onClick={openDatePicker} onKeyDown={blockDateTyping}
                        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between peer-focus:ring-2 peer-focus:ring-[#FF7400]/50">
                        <span className={formData.dateFrom ? "text-slate-800 font-medium" : "text-slate-400"}>
                          {formData.dateFrom ? formatDDMMYYYY(formData.dateFrom) : "DD/MM/YYYY"}
                        </span>
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Date (optional)</label>
                    <div className="relative">
                      <input
                        type="date" min={formData.dateFrom || new Date().toISOString().split('T')[0]} value={formData.dateTo}
                        onChange={e => setFormData({ ...formData, dateTo: e.target.value })}
                        onFocus={openDatePicker} onClick={openDatePicker} onKeyDown={blockDateTyping}
                        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between peer-focus:ring-2 peer-focus:ring-[#FF7400]/50">
                        <span className={formData.dateTo ? "text-slate-800 font-medium" : "text-slate-400"}>
                          {formData.dateTo ? formatDDMMYYYY(formData.dateTo) : "DD/MM/YYYY"}
                        </span>
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 hover:border-[#FF7400]/30 transition-all">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-[#FF7400]"
                          checked={Array.isArray(formData.category) && formData.category.length === AVAILABLE_CATEGORIES.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, category: [...AVAILABLE_CATEGORIES] });
                            } else {
                              setFormData({ ...formData, category: [] });
                            }
                          }} 
                        />
                        All
                      </label>
                      {AVAILABLE_CATEGORIES.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 hover:border-[#FF7400]/30 transition-all">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 accent-[#FF7400]" 
                            checked={Array.isArray(formData.category) && formData.category.includes(cat)} 
                            onChange={(e) => {
                              const currentCategories = Array.isArray(formData.category) ? formData.category : [];
                              if (e.target.checked) {
                                setFormData({ ...formData, category: [...currentCategories, cat] });
                              } else {
                                setFormData({ ...formData, category: currentCategories.filter((c: string) => c !== cat) });
                              }
                            }} 
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Venue / Location *</label>
                    <input
                      required type="text" value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value.replace(/[^a-zA-Z0-9\s,.'-]/g, '') })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Belt Eligibility</label>
                    <input
                      type="text" value={formData.beltEligibility}
                      onChange={e => setFormData({ ...formData, beltEligibility: e.target.value })}
                      placeholder="e.g. Yellow belt and above"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                    <input
                      required type="text" maxLength={5} value={formData.entryFee}
                      onChange={e => setFormData({ ...formData, entryFee: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>


                  <div className="md:col-span-2 flex items-center gap-3">
                    <input
                      type="checkbox" id="bpl_create" checked={formData.allowBPL}
                      onChange={e => {
                        setFormData({ 
                          ...formData, 
                          allowBPL: e.target.checked
                        });
                      }}
                      className="w-5 h-5 accent-[#FF7400]"
                    />
                    <label htmlFor="bpl_create" className="text-sm font-bold text-slate-700">
                      Allow BPL Students to Register for Free
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description *</label>
                    <textarea
                      required value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full h-24 px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button" onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit" disabled={submitLoading}
                    className="flex-1 py-4 bg-[#FF7400] text-white font-bold rounded-xl shadow-xl shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 transition-all"
                  >
                    {submitLoading
                      ? <Loader2 size={20} className="animate-spin" />
                      : <><Calendar size={18} /> Submit Tournament</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════ EDIT TOURNAMENT MODAL ════════════ */}
      <AnimatePresence>
        {editingTournament && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl lg:max-w-4xl bg-white rounded-[1.75rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800">Edit Tournament</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Update details for <span className="font-bold text-[#FF7400]">{editingTournament.title}</span>
                  </p>
                </div>
                <button
                  onClick={() => setEditingTournament(null)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all"
                >
                  <XCircle size={26} />
                </button>
              </div>

              <form onSubmit={handleEdit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tournament Title *</label>
                    <input
                      required type="text" value={editFormData.title}
                      onChange={e => setEditFormData({ ...editFormData, title: e.target.value })}
                      placeholder="e.g. District Championship 2026"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Level</label>
                    <select
                      value={editFormData.level}
                      onChange={e => setEditFormData({ ...editFormData, level: e.target.value, zoneId: "", districtId: "", clubId: "" })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                    >
                      <option value="CLUB">Club</option>
                      <option value="DISTRICT">District</option>
                      <option value="ZONE">Zonal</option>
                      <option value="STATE">State</option>
                      <option value="NATIONAL">National</option>
                    </select>
                  </div>

                  {editFormData.level === "ZONE" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Zone</label>
                      <select
                        required
                        value={editFormData.zoneId || ""}
                        onChange={e => setEditFormData({ ...editFormData, zoneId: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                      >
                        <option value="" disabled>Select a Zone</option>
                        {zones.map((zone) => (
                          <option key={zone} value={zone}>{zone}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editFormData.level === "DISTRICT" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">District</label>
                      <select
                        required
                        value={editFormData.districtId || ""}
                        onChange={e => setEditFormData({ ...editFormData, districtId: e.target.value })}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                      >
                        <option value="" disabled>Select a District</option>
                        {districts.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editFormData.level === "CLUB" && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">District</label>
                        <select
                          value={editFormData.districtId || ""}
                          onChange={e => setEditFormData({ ...editFormData, districtId: e.target.value, clubId: "" })}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                        >
                          <option value="">Select a District</option>
                          {districts.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Club</label>
                        <select
                          required
                          value={editFormData.clubId || ""}
                          onChange={e => setEditFormData({ ...editFormData, clubId: e.target.value })}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold text-slate-900"
                        >
                          <option value="" disabled>Select a Club</option>
                          {clubs
                            .filter(c => !editFormData.districtId || c.districtId === editFormData.districtId || (c as any).district?.id === editFormData.districtId)
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.clubName || (c as any).name}</option>
                            ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gender</label>
                    <div className="relative">
                      <GenderIcon gender={editFormData.gender} size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <select
                        value={editFormData.gender}
                        onChange={e => setEditFormData({ ...editFormData, gender: e.target.value })}
                        className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 font-semibold"
                      >
                        <option value="BOTH">Both</option>
                        <option value="MALE">Male Only</option>
                        <option value="FEMALE">Female Only</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Date *</label>
                    <div className="relative">
                      <input
                        required type="date" value={editFormData.dateFrom}
                        onChange={e => setEditFormData({ ...editFormData, dateFrom: e.target.value })}
                        onFocus={openDatePicker} onClick={openDatePicker} onKeyDown={blockDateTyping}
                        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between peer-focus:ring-2 peer-focus:ring-[#FF7400]/50">
                        <span className={editFormData.dateFrom ? "text-slate-800 font-medium" : "text-slate-400"}>
                          {editFormData.dateFrom ? formatDDMMYYYY(editFormData.dateFrom) : "DD/MM/YYYY"}
                        </span>
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Date (optional)</label>
                    <div className="relative">
                      <input
                        type="date" min={editFormData.dateFrom} value={editFormData.dateTo}
                        onChange={e => setEditFormData({ ...editFormData, dateTo: e.target.value })}
                        onFocus={openDatePicker} onClick={openDatePicker} onKeyDown={blockDateTyping}
                        className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between peer-focus:ring-2 peer-focus:ring-[#FF7400]/50">
                        <span className={editFormData.dateTo ? "text-slate-800 font-medium" : "text-slate-400"}>
                          {editFormData.dateTo ? formatDDMMYYYY(editFormData.dateTo) : "DD/MM/YYYY"}
                        </span>
                        <Calendar size={18} className="text-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 hover:border-[#FF7400]/30 transition-all">
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-[#FF7400]"
                          checked={Array.isArray(editFormData.category) && editFormData.category.length === AVAILABLE_CATEGORIES.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditFormData({ ...editFormData, category: [...AVAILABLE_CATEGORIES] });
                            } else {
                              setEditFormData({ ...editFormData, category: [] });
                            }
                          }}
                        />
                        All
                      </label>
                      {AVAILABLE_CATEGORIES.map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 hover:border-[#FF7400]/30 transition-all">
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-[#FF7400]"
                            checked={Array.isArray(editFormData.category) && editFormData.category.includes(cat)}
                            onChange={(e) => {
                              const current = Array.isArray(editFormData.category) ? editFormData.category : [];
                              if (e.target.checked) {
                                setEditFormData({ ...editFormData, category: [...current, cat] });
                              } else {
                                setEditFormData({ ...editFormData, category: current.filter((c: string) => c !== cat) });
                              }
                            }}
                          />
                          {cat}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Venue / Location *</label>
                    <input
                      required type="text" value={editFormData.location}
                      onChange={e => setEditFormData({ ...editFormData, location: e.target.value.replace(/[^a-zA-Z0-9\s,.'-]/g, '') })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Belt Eligibility</label>
                    <input
                      type="text" value={editFormData.beltEligibility}
                      onChange={e => setEditFormData({ ...editFormData, beltEligibility: e.target.value })}
                      placeholder="e.g. Yellow belt and above"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                    <input
                      required type="text" maxLength={5} value={editFormData.entryFee}
                      onChange={e => setEditFormData({ ...editFormData, entryFee: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50"
                    />
                  </div>


                  <div className="md:col-span-2 flex items-center gap-3">
                    <input
                      type="checkbox" id="bpl_edit" checked={editFormData.allowBPL}
                      onChange={e => {
                        setEditFormData({
                          ...editFormData,
                          allowBPL: e.target.checked
                        });
                      }}
                      className="w-5 h-5 accent-[#FF7400]"
                    />
                    <label htmlFor="bpl_edit" className="text-sm font-bold text-slate-700">
                      Allow BPL Students to Register for Free
                    </label>
                  </div>

                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button" onClick={() => setEditingTournament(null)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={editLoading}
                    className="flex-1 py-4 bg-[#FF7400] text-white font-bold rounded-xl shadow-xl shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 transition-all"
                  >
                    {editLoading
                      ? <Loader2 size={20} className="animate-spin" />
                      : <><Edit2 size={18} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════════════ REJECT MODAL ════════════ */}
      <AnimatePresence>
        {rejectModal && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Reject Tournament</h2>
              <p className="text-slate-500 text-sm mb-5">
                Provide a reason — it will be visible to the creator.
              </p>
              <textarea
                value={rejectRemark}
                onChange={e => setRejectRemark(e.target.value)}
                placeholder="Enter rejection reason..."
                className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none mb-5"
              />
              <div className="flex gap-4">
                <button
                  onClick={() => { setRejectModal(null); setRejectRemark(""); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAction(rejectModal.id, "REJECTED", rejectRemark)}
                  disabled={!rejectRemark.trim() || !!actionLoading}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
                >
                  {actionLoading
                    ? <Loader2 size={16} className="animate-spin" />
                    : "Confirm Reject"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
