"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  Users,
  Plus,
  Calendar,
  ChevronRight,
  ChevronDown,
  Hourglass,
  Send,
  MessageSquare,
  Edit2,
  Download,
} from "lucide-react";
import EventBannerField from "@/components/common/EventBannerField";
import MapLinkField from "@/components/common/MapLinkField";
import { eventDayCount } from "@/components/common/EventScheduleFields";

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
  zoneApproval?: ApprovalStatus;
  stateApproval: ApprovalStatus;
  superAdminApproval: ApprovalStatus;
  ceoApproval: ApprovalStatus;
  rejectionRemark?: string;
  hasPendingPlayers?: boolean;
  club?: { name: string; district?: TournamentDistrict };
  official?: { assignedDistrict?: TournamentDistrict | null; district?: TournamentDistrict | null };
  district?: TournamentDistrict | null;
  zoneId?: string | null;
  bannerImage?: string;
  mapLink?: string | null;
}

interface TournamentDistrict { id?: string; name: string; zoneName?: string | null }

/** District a tournament belongs to: its own (district tournaments), else the host club's, else the creating official's. */
function tournamentDistrict(t: Tournament): TournamentDistrict | null {
  return t.district ?? t.club?.district ?? t.official?.assignedDistrict ?? t.official?.district ?? null;
}

/** A zonal tournament carries its zone in zoneId; others take the zone of their district. */
function tournamentZone(t: Tournament): string | null {
  return t.level === "ZONE" ? t.zoneId ?? null : tournamentDistrict(t)?.zoneName ?? null;
}

// ─── Role configuration ───────────────────────────────────────────────────────
/**
 * Maps each admin role to the approval field they manage.
 * null = this role creates but doesn't sit in an approval queue.
 */
const APPROVAL_LEVEL_MAP: Record<string, string | null> = {
  DISTRICT_PRESIDENT: "district",
  DISTRICT_SECRETARY: "district",
  ZONE_PRESIDENT: "zone", // zonal tournaments in their own zone only
  ZONE_SECRETARY: "zone",
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
 *   Zonal (by club or district) → Zone → State → (SuperAdmin OR CEO)
 *   Zone created     →            State → (SuperAdmin OR CEO)  (zone + district auto-skipped)
 *   State created    →                    (SuperAdmin OR CEO)  (district+state auto-skipped)
 *
 * SuperAdmin and CEO are PARALLEL final approvers.
 * Only ONE of them needs to approve — whichever acts first closes the tournament.
 */
function inApprovalQueue(t: Tournament, role: string): boolean {
  // Coerce null/undefined fields from the API into proper status strings
  const district = safeStatus(t.districtApproval);
  // Only zonal tournaments carry a zone step; older rows may not have the field at all.
  const zone = t.zoneApproval ?? "NOT_REQUIRED";
  const state = safeStatus(t.stateApproval);
  const superAdmin = safeStatus(t.superAdminApproval);
  const ceo = safeStatus(t.ceoApproval);

  switch (normaliseRole(role)) {
    case "DISTRICT_PRESIDENT":
    case "DISTRICT_SECRETARY":
      return district === "PENDING";

    case "ZONE_PRESIDENT":
    case "ZONE_SECRETARY":
      // The backend already limits this list to zonal tournaments in the officer's zone.
      return zone === "PENDING";

    case "STATE_PRESIDENT":
    case "STATE_SECRETARY":
      // District step must already be resolved (APPROVED or NOT_REQUIRED / auto-skipped)
      return (
        (district === "APPROVED" || district === "NOT_REQUIRED") &&
        (zone === "APPROVED" || zone === "NOT_REQUIRED") &&
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

// ─── List UI pieces ───────────────────────────────────────────────────────────

const MINE_STATUS_TABS = [
  { id: "ALL", label: "All" },
  { id: "APPROVED", label: "Approved" },
  { id: "PENDING", label: "Pending" },
  { id: "REJECTED", label: "Rejected" },
];

const MINE_STATUS_STYLE: Record<string, { label: string; text: string; strip: string; icon: React.ReactNode }> = {
  APPROVED: { label: "Approved", text: "text-emerald-700", strip: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
  CLOSED: { label: "Concluded", text: "text-indigo-700", strip: "bg-indigo-500", icon: <CheckCircle2 size={14} /> },
  REJECTED: { label: "Rejected", text: "text-red-600", strip: "bg-red-500", icon: <XCircle size={14} /> },
  PENDING: { label: "Awaiting approval", text: "text-amber-700", strip: "bg-amber-400", icon: <Hourglass size={14} /> },
  EXPIRED: { label: "Ended", text: "text-slate-500", strip: "bg-slate-300", icon: <Clock size={14} /> },
};

interface TournamentMessage { id: string; senderRole: string; senderName: string; message: string; createdAt: string }

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

function DateBadge({ date }: { date: string }) {
  const d = new Date(date);
  return (
    <div className="w-14 shrink-0 text-center border border-slate-200 rounded-lg overflow-hidden h-fit">
      <p className="text-[10px] font-black uppercase py-0.5 text-white bg-[#FF7400]">{d.toLocaleDateString("en-IN", { month: "short" })}</p>
      <p className="text-xl font-black text-slate-800 leading-tight pt-1">{d.getDate()}</p>
      <p className="text-[10px] font-bold text-slate-400 pb-1">{d.getFullYear()}</p>
    </div>
  );
}

function Tag({ children, tone = "bg-slate-100 text-slate-600" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${tone}`}>{children}</span>;
}

/** Location, organiser and the tags shared by every tournament card. */
function TournamentMeta({ t }: { t: Tournament }) {
  return (
    <>
      <div className="mt-1.5 space-y-1 text-xs text-slate-500">
        <p className="flex items-center gap-1.5 truncate">
          <MapPin size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{t.location || "Venue to be announced"}</span>
        </p>
        {t.club && (
          <p className="flex items-center gap-1.5 truncate">
            <Users size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">{t.club.name}{t.club.district ? ` · ${t.club.district.name}` : ""}</span>
          </p>
        )}
        {t.dateTo && t.dateTo !== t.date && (
          <p className="flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            {shortDate(t.date)} – {shortDate(t.dateTo)}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <Tag>{t.level.charAt(0) + t.level.slice(1).toLowerCase()}</Tag>
        {t.category && <Tag>{t.category}</Tag>}
        {t.gender && <Tag>{t.gender === "BOTH" ? "Men & Women" : t.gender.charAt(0) + t.gender.slice(1).toLowerCase()}</Tag>}
        <Tag tone={t.entryFee === 0 ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-[#C45A00]"}>
          {t.entryFee === 0 ? "Free" : `₹${Number(t.entryFee).toLocaleString("en-IN")}`}
        </Tag>
      </div>
    </>
  );
}

function StatusLine({ tone, icon, label }: { tone: string; icon: React.ReactNode; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${tone}`}>{icon}{label}</span>;
}

function MessageThread({ messages }: { messages?: TournamentMessage[] }) {
  if (!messages?.length) return <p className="text-xs text-slate-400">No messages yet.</p>;
  return (
    <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
      {messages.map((msg) => (
        <div key={msg.id} className="flex items-start gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-black ${
            msg.senderRole === "CLUB" ? "bg-sky-100 text-sky-700" : "bg-orange-100 text-[#FF7400]"
          }`}>
            {msg.senderName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900 mr-1">{msg.senderName}</span>{msg.message}
            </p>
            <p className="text-[10px] text-slate-400">
              {shortDate(msg.createdAt)}, {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ManageLink({ t }: { t: Tournament }) {
  if (t.hasPendingPlayers) {
    return (
      <span className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed" title="Approve or reject the pending players first">
        <AlertCircle size={13} /> Resolve pending players
      </span>
    );
  }
  return (
    <Link
      href={`/dashboard/admin/tournaments/${t.id}`}
      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FF7400] hover:bg-[#E56900] text-white text-xs font-bold rounded-lg transition-colors"
    >
      <Trophy size={13} /> Manage <ChevronRight size={13} />
    </Link>
  );
}

interface TournamentCardProps {
  t: Tournament;
  strip: string;
  status: React.ReactNode;
  actions: React.ReactNode;
  faded?: boolean;
  remark?: string;
  messages?: TournamentMessage[];
  chatOpen: boolean;
  onToggleChat: () => void;
}

/** Compact card for the Approved and My Tournaments views; the message thread folds away. */
function TournamentCard({ t, strip, status, actions, faded, remark, messages, chatOpen, onToggleChat }: TournamentCardProps) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col hover:shadow-md transition-shadow ${faded ? "opacity-80" : ""}`}>
      <div className={`h-1 ${strip}`} />
      <div className="p-4 flex gap-4 flex-1">
        <DateBadge date={t.date} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-black text-slate-900 leading-snug line-clamp-2">{t.title}</h3>
          <TournamentMeta t={t} />
          {remark && (
            <p className="mt-3 p-2.5 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
              <span className="font-bold">Reason: </span>{remark}
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        {status}
        <button onClick={onToggleChat} className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-[#FF7400]" aria-expanded={chatOpen}>
          <MessageSquare size={13} /> Messages{messages?.length ? ` (${messages.length})` : ""}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {chatOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-100 bg-slate-50/60">
            <div className="p-4"><MessageThread messages={messages} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-4 pb-4 pt-1 flex gap-2">{actions}</div>
    </motion.div>
  );
}

function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-lg text-slate-300">
      <div className="flex justify-center mb-3">{icon}</div>
      <p className="text-sm font-bold text-slate-500">{title}</p>
      <p className="text-xs text-slate-400 mt-1">{text}</p>
      {action}
    </div>
  );
}

/** Search matches the tournament title or its location. */
function matchesSearch(t: { title: string; location?: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${t.title} ${t.location ?? ""}`.toLowerCase().includes(q);
}

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = {
  title: "", dateFrom: "", dateTo: "", location: "", description: "",
  entryFee: "", totalSlots: "", numberOfMats: "1", ageFrom: "0", ageTo: "100", category: [] as string[],
  gender: "BOTH", allowBPL: false, beltEligibility: "", level: "DISTRICT", zoneId: "", districtId: "", clubId: "",
  bannerImage: "", mapLink: "",
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
  const [zoneFilter, setZoneFilter] = useState("ALL");
  const [districtFilter, setDistrictFilter] = useState("ALL");
  const [openChats, setOpenChats] = useState<Record<string, boolean>>({});

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

    const token = localStorage.getItem("token");

    // Fetch districts, zones, and clubs for tournament creation.
    // Below state level, zonal tournaments may only be held in the user's own zone.
    Promise.all([
      fetch(`${API_BASE}/districts`).then(res => res.ok ? res.json() : []),
      fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.ok ? res.json() : null).catch(() => null),
    ])
      .then(([data, profile]) => {
        if (Array.isArray(data)) {
          setDistricts(data);
          const uniqueZones = Array.from(new Set(data.map((d: any) => d.zoneName).filter(Boolean))).sort() as string[];
          const ownZone = (profile?.user?.assignedDistrict ?? profile?.user?.district)?.zoneName;
          const isStateWide = ["SUPER_ADMIN", "CEO", "STATE_PRESIDENT", "STATE_SECRETARY"].includes(profile?.role);
          const allowedZones = !isStateWide && ownZone ? [ownZone] : uniqueZones;
          if (allowedZones.length > 0) setZones(allowedZones);
        }
      })
      .catch(err => console.error("Failed to fetch districts", err));

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

  // ── Derived values ───────────────────────────────────────────────────────────
  const approvalLevel = APPROVAL_LEVEL_MAP[userRole] ?? null;
  const canCreate = CAN_CREATE_ROLES.includes(userRole);
  const hasApprovalRole = approvalLevel !== null;

  const approvalQueue = allTournaments.filter(t => inApprovalQueue(t, userRole));

  // Zone / district filters. `zones` is already limited to the user's own zone below state level;
  // district officers work in their office district only, so they get no district filter.
  const isDistrictOfficer = userRole === "DISTRICT_PRESIDENT" || userRole === "DISTRICT_SECRETARY";
  const districtOptions = isDistrictOfficer ? [] : districts
    .filter(d => d.zoneName && zones.includes(d.zoneName) && (zoneFilter === "ALL" || d.zoneName === zoneFilter))
    .sort((a, b) => a.name.localeCompare(b.name));
  const matchesPlace = (t: Tournament) => {
    if (zoneFilter !== "ALL" && tournamentZone(t) !== zoneFilter) return false;
    if (districtFilter !== "ALL") {
      const d = tournamentDistrict(t);
      const selected = districts.find(x => x.id === districtFilter);
      if (!d || (d.id ? d.id !== districtFilter : d.name !== selected?.name)) return false;
    }
    return true;
  };

  const displayedApproval = approvalQueue.filter(
    t => matchesSearch(t, searchQuery) && matchesPlace(t)
  );

  const displayedMine = myTournaments
    .filter(t => filter === "ALL" || t.status === filter)
    .filter(t => matchesSearch(t, searchQuery) && matchesPlace(t));

  const displayedApproved = approvedByMeList.filter(
    t => matchesSearch(t, searchQuery) && matchesPlace(t)
  );
  const isFiltering = !!searchQuery || zoneFilter !== "ALL" || districtFilter !== "ALL";

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
      bannerImage: t.bannerImage || "", mapLink: t.mapLink || "",
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

  // ── Counts shown in the view toggle ─────────────────────────────────────────
  const totalMine = myTournaments.length;
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

      {/* ── Toolbar: view toggle (with counts), search, create ── */}
      {/* One line on wide screens: views · zone · district · search · create (wraps on smaller screens) */}
      <div className="flex flex-wrap xl:flex-nowrap items-center gap-3">
        <div className="flex shrink-0 gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit max-w-full overflow-x-auto" role="tablist" aria-label="Tournament views">
          {[
            ...(hasApprovalRole ? [{ key: "approval" as const, label: "Approval Queue", count: pendingQueue }] : []),
            ...(canCreate ? [{ key: "mine" as const, label: "My Tournaments", count: totalMine }] : []),
            { key: "approved" as const, label: "Approved", count: approvedByMeList.length },
          ].map(tab => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors duration-300 ${
                  active ? "text-white" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tournament-view-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 rounded-md bg-[#FF7400]"
                  />
                )}
                <span className="relative">{tab.label}</span>
                <span className={`relative tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>{tab.count}</span>
              </button>
            );
          })}
        </div>

          {zones.length > 1 && (
            <div className="relative shrink-0 w-48 xl:ml-auto">
              <select
                value={zoneFilter}
                onChange={e => { setZoneFilter(e.target.value); setDistrictFilter("ALL"); }}
                aria-label="Zone"
                className={`w-full truncate appearance-none pl-3 pr-9 py-2.5 bg-white border rounded-lg text-sm font-bold focus:outline-none focus:border-[#FF7400] cursor-pointer ${
                  zoneFilter === "ALL" ? "border-slate-200 text-slate-600" : "border-orange-200 text-[#FF7400] bg-orange-50"
                }`}
              >
                <option value="ALL">All zones</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          {districtOptions.length > 1 && (
            <div className={`relative shrink-0 w-44 ${zones.length > 1 ? "" : "xl:ml-auto"}`}>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
                aria-label="District"
                className={`w-full truncate appearance-none pl-3 pr-9 py-2.5 bg-white border rounded-lg text-sm font-bold focus:outline-none focus:border-[#FF7400] cursor-pointer ${
                  districtFilter === "ALL" ? "border-slate-200 text-slate-600" : "border-orange-200 text-[#FF7400] bg-orange-50"
                }`}
              >
                <option value="ALL">All districts</option>
                {districtOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
          <div className={`relative flex-1 min-w-40 xl:max-w-72 ${zones.length > 1 || districtOptions.length > 1 ? "" : "xl:ml-auto"}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search title or location"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF7400] text-sm text-slate-700"
            />
          </div>
          {canCreate && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white font-bold rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              <Plus size={16} className="stroke-[2.5]" /> Create Tournament
            </button>
          )}
      </div>

      {/* Status toggle for My Tournaments */}
      {activeTab === "mine" && (
        <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit -mt-3" role="tablist" aria-label="Filter my tournaments by status">
          {MINE_STATUS_TABS.map(tab => {
            const active = filter === tab.id;
            const count = tab.id === "ALL" ? myTournaments.length : myTournaments.filter(t => t.status === tab.id).length;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-300 ${
                  active ? "text-[#FF7400]" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="tournament-status-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 rounded-md bg-orange-50 border border-orange-200"
                  />
                )}
                <span className="relative">{tab.label}</span>
                <span className={`relative tabular-nums ${active ? "text-[#FF7400]/70" : "text-slate-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Lists ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#FF7400]" />
        </div>
      ) : (
        <>
          {/* ════════════ APPROVAL QUEUE ════════════ */}
          {activeTab === "approval" && (
            displayedApproval.length === 0 ? (
              <EmptyState icon={<CheckCircle2 size={32} />} title={isFiltering ? "No tournaments match your filters" : "No tournaments waiting for you"} text={isFiltering ? "Try a different zone, district, title or location." : "You're all caught up."} />
            ) : (
              <div className="space-y-4">
                {displayedApproval.map(t => {
                  const approvedAbove = safeStatus(t.superAdminApproval) === "APPROVED" || safeStatus(t.ceoApproval) === "APPROVED";
                  return (
                    <motion.div key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                      <div className="h-1 bg-amber-400" />
                      <div className="p-4 flex flex-col md:flex-row gap-4">
                        <div className="flex gap-4 flex-1 min-w-0">
                          <DateBadge date={t.date} />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[15px] font-black text-slate-900 leading-snug">{t.title}</h3>
                            <TournamentMeta t={t} />
                          </div>
                        </div>
                        <div className="flex items-start gap-2 shrink-0">
                          {approvedAbove ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700">
                              <CheckCircle2 size={14} /> Approved by {safeStatus(t.superAdminApproval) === "APPROVED" ? "Super Admin" : "CEO"}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAction(t.id, "APPROVED")}
                                disabled={actionLoading === t.id}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-bold rounded-lg disabled:opacity-50"
                              >
                                {actionLoading === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve
                              </button>
                              <button
                                onClick={() => handleAction(t.id, "REJECTED")}
                                disabled={!!actionLoading}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 text-sm font-bold rounded-lg disabled:opacity-50"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Conversation with the organiser: always open here, since approvers reply from the queue */}
                      <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
                        <MessageThread messages={tMessages[t.id]} />
                        <div className="flex items-center gap-2 max-w-xl">
                          <input
                            type="text"
                            placeholder="Write a reply to the organiser…"
                            value={replyTexts[t.id] || ""}
                            onChange={(e) => setReplyTexts(prev => ({ ...prev, [t.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleSendTournamentReply(t.id)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-[#FF7400]"
                          />
                          <button
                            onClick={() => handleSendTournamentReply(t.id)}
                            disabled={!replyTexts[t.id]?.trim() || replyLoading[t.id]}
                            aria-label="Send reply"
                            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-[#FF7400] hover:border-[#FF7400] rounded-lg disabled:opacity-40"
                          >
                            {replyLoading[t.id] ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )
          )}

          {/* ════════════ APPROVED TOURNAMENTS ════════════ */}
          {activeTab === "approved" && (
            displayedApproved.length === 0 ? (
              <EmptyState icon={<Trophy size={32} />} title={isFiltering ? "No tournaments match your filters" : "No approved tournaments yet"} text={isFiltering ? "Try a different zone, district, title or location." : "Tournaments you approve will appear here."} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedApproved.map(t => (
                  <TournamentCard key={t.id} t={t} strip="bg-emerald-500"
                    status={isExpired(t)
                      ? <StatusLine tone="text-slate-500" icon={<Clock size={14} />} label="Completed" />
                      : <StatusLine tone="text-emerald-700" icon={<CheckCircle2 size={14} />} label="Approved" />}
                    faded={isExpired(t)}
                    messages={tMessages[t.id]}
                    chatOpen={!!openChats[t.id]}
                    onToggleChat={() => setOpenChats(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                    actions={
                      <>
                        <button
                          onClick={() => handleDownloadReport(t.id, t.title)}
                          disabled={downloadingReportId === t.id}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-[#FF7400] hover:border-[#FF7400] text-xs font-bold rounded-lg disabled:opacity-50"
                          title="Download tournament report"
                        >
                          {downloadingReportId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Report
                        </button>
                        <ManageLink t={t} />
                      </>
                    }
                  />
                ))}
              </div>
            )
          )}

          {/* ════════════ MY TOURNAMENTS ════════════ */}
          {activeTab === "mine" && (
            displayedMine.length === 0 ? (
              <EmptyState
                icon={<Trophy size={32} />}
                title={myTournaments.length === 0 ? "No tournaments yet" : "No tournaments match your filters"}
                text={myTournaments.length === 0 ? "Create your first tournament to get started." : "Try another status or clear the search."}
                action={myTournaments.length === 0 && canCreate ? <button onClick={() => setIsCreateOpen(true)} className="mt-3 text-sm font-bold text-[#FF7400] hover:underline">Create Tournament</button> : undefined}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displayedMine.map(t => {
                  const expired = isExpired(t);
                  const st = expired ? MINE_STATUS_STYLE.EXPIRED : MINE_STATUS_STYLE[t.status] ?? MINE_STATUS_STYLE.PENDING;
                  return (
                    <TournamentCard key={t.id} t={t} strip={st.strip} faded={expired}
                      status={<StatusLine tone={st.text} icon={st.icon} label={st.label} />}
                      remark={t.rejectionRemark}
                      messages={tMessages[t.id]}
                      chatOpen={!!openChats[t.id]}
                      onToggleChat={() => setOpenChats(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                      actions={
                        <>
                          <button
                            onClick={() => openEditModal(t)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:text-[#FF7400] hover:border-[#FF7400] text-xs font-bold rounded-lg"
                            title="Edit tournament details"
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                          <ManageLink t={t} />
                        </>
                      }
                    />
                  );
                })}
              </div>
            )
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
              className="w-full max-w-2xl lg:max-w-4xl bg-white rounded-[2px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
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
                    <EventBannerField value={formData.bannerImage} onChange={(url) => setFormData(prev => ({ ...prev, bannerImage: url }))} />
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

                  {/* From / To dates side by side, with the day count */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">From Date *</label>
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
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">To Date (optional)</label>
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
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Number of Days</label>
                    <div className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold" aria-live="polite">
                      {eventDayCount(formData.dateFrom, formData.dateTo) ? `${eventDayCount(formData.dateFrom, formData.dateTo)} day${eventDayCount(formData.dateFrom, formData.dateTo) > 1 ? "s" : ""}` : "—"}
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
                    <MapLinkField value={formData.mapLink} onChange={(url) => setFormData(prev => ({ ...prev, mapLink: url }))} inputClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50" />
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
              className="w-full max-w-2xl lg:max-w-4xl bg-white rounded-[2px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
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

                  <div className="md:col-span-2">
                    <EventBannerField value={editFormData.bannerImage} onChange={(url) => setEditFormData(prev => ({ ...prev, bannerImage: url }))} />
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

                  {/* From / To dates side by side, with the day count */}
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">From Date *</label>
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
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">To Date (optional)</label>
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
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Number of Days</label>
                    <div className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-semibold" aria-live="polite">
                      {eventDayCount(editFormData.dateFrom, editFormData.dateTo) ? `${eventDayCount(editFormData.dateFrom, editFormData.dateTo)} day${eventDayCount(editFormData.dateFrom, editFormData.dateTo) > 1 ? "s" : ""}` : "—"}
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
                    <MapLinkField value={editFormData.mapLink} onChange={(url) => setEditFormData(prev => ({ ...prev, mapLink: url }))} inputClassName="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50" />
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
