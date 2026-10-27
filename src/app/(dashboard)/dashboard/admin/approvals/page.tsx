"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  MessageSquare,
  RefreshCw,
  Loader2,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  X,
  MapPin,
  MoreHorizontal,
  ChevronDown,
  Shield,
  Users,
  UserCheck,
  Award,
  Calendar
} from "lucide-react";

type ApprovalType = "CLUB" | "STUDENT" | "COACH" | "MEMBER" | "EVENT";

interface Application {
  id: string;
  name: string;
  subtitle: string;
  date: string;
  status: string;
  email: string;
  phone: string;
  location: string;
  avatar: string;
  rawData: any;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const TYPE_MAP: Record<ApprovalType, string> = {
  CLUB: "club",
  STUDENT: "student",
  COACH: "coach",
  MEMBER: "member",
  EVENT: "event",
};

function resolveApplication(raw: any, type: ApprovalType): Application {
  let name = "";
  let subtitle = "";
  let email = raw.email || "";
  let phone = raw.mobileNumber || raw.contactNumber || "";
  let location = raw.district?.name || raw.city || raw.location || "—";
  let avatar = raw.profilePhoto || raw.photo || "";

  switch (type) {
    case "CLUB":
      name = raw.name;
      subtitle = `President: ${raw.president}`;
      location = raw.district?.name || "—";
      break;
    case "STUDENT":
      name = raw.fullName;
      subtitle = raw.club?.name || "No Club";
      location = raw.district?.name || raw.city || "—";
      break;
    case "COACH":
      name = raw.fullName;
      subtitle = raw.presentGradeInJudo || "Coach";
      location = raw.district?.name || "—";
      break;
    case "MEMBER":
      name = raw.fullName;
      subtitle = raw.employmentType || "Administrative Member";
      location = raw.district?.name || raw.city || "—";
      break;
    case "EVENT":
      name = raw.title;
      subtitle = `${raw.level} Level`;
      email = "—";
      phone = "—";
      location = raw.location || "—";
      break;
  }

  return {
    id: raw.id,
    name,
    subtitle,
    date: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString("en-IN") : "-",
    status: raw.status || "PENDING",
    email,
    phone,
    location,
    avatar,
    rawData: raw,
  };
}

type PaymentStage = "PAYMENT_PENDING" | "AWAITING_ID" | "PAID" | "BPL_ACTIVE";

// Same rule as the /track page: approval issues a temp ID, payment issues the permanent ID.
// BPL players with proof skip the fee.
function getPaymentStage(item: Application, type: ApprovalType): PaymentStage {
  const raw = item.rawData || {};
  const bplExempt = type === "STUDENT" && !!raw.isBPL && !!raw.bplProof;
  if (raw.permanentId) return bplExempt ? "BPL_ACTIVE" : "PAID";
  return bplExempt ? "AWAITING_ID" : "PAYMENT_PENDING";
}

const paymentStageConfig: Record<PaymentStage, { label: string; dot: string; text: string }> = {
  PAYMENT_PENDING: { label: "PAYMENT PENDING", dot: "bg-amber-500", text: "text-amber-600" },
  AWAITING_ID: { label: "AWAITING ID", dot: "bg-sky-500", text: "text-sky-600" },
  PAID: { label: "PAID", dot: "bg-emerald-500", text: "text-emerald-600" },
  BPL_ACTIVE: { label: "BPL · ACTIVE", dot: "bg-emerald-500", text: "text-emerald-600" },
};

function ApprovalsContent() {
  type StatusType = "PENDING" | "APPROVED" | "REJECTED" | "REPLAY" | "BPL_APPROVED" | "BPL_REJECTED";
  type RejectMode = "REJECTED" | "BPL_REJECTED";

  const searchParams = useSearchParams();
  // Events are approved from their own page, so this screen only covers people and clubs.
  const typeParam = searchParams?.get("type") as ApprovalType | null;
  const initialTab: ApprovalType = typeParam && typeParam !== "EVENT" ? typeParam : "STUDENT";

  const [activeTab, setActiveTab] = useState<ApprovalType>(initialTab);
  const [activeStatus, setActiveStatus] = useState<StatusType>("PENDING");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectMode, setRejectMode] = useState<RejectMode>("REJECTED");
  const [isRequestChangesModalOpen, setIsRequestChangesModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Application | null>(null);
  const [remark, setRemark] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [districtFilter, setDistrictFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const tabs: { id: ApprovalType; label: string; icon: React.ComponentType<any> }[] = [
    { id: "STUDENT", label: "Players", icon: Users },
    { id: "COACH", label: "Coaches", icon: UserCheck },
    { id: "MEMBER", label: "Administrative Members", icon: Award },
    { id: "CLUB", label: "Clubs", icon: Shield },
  ];

  const statusTabs: { id: StatusType; label: string }[] = [
    { id: "PENDING", label: "Pending Approval" },
    { id: "APPROVED", label: "Approved" },
    { id: "REJECTED", label: "Denied" },
    { id: "REPLAY", label: "Replay" },
    ...(activeTab === "STUDENT"
      ? [
          { id: "BPL_APPROVED" as StatusType, label: "BPL Approved" },
          { id: "BPL_REJECTED" as StatusType, label: "BPL Rejected" },
        ]
      : []),
  ];

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // BPL Approved is not a backend status: it is the approved players who claimed BPL.
      const bplApproved = activeStatus === "BPL_APPROVED";
      const apiStatus = bplApproved ? "APPROVED" : activeStatus;
      const res = await fetch(`${API_BASE}/applications/pending?type=${activeTab}&status=${apiStatus}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      let raw: any[] = json.data || [];
      if (bplApproved) raw = raw.filter((r) => r.isBPL);
      setApplications(raw.map((r) => resolveApplication(r, activeTab)));
    } catch {
      showToast("Failed to load applications. Is the backend running?", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeStatus]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    fetch(`${API_BASE}/districts`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setDistricts(Array.isArray(data) ? data : []))
      .catch(() => setDistricts([]));
  }, []);

  // District filter is applied client-side on the already-loaded list.
  const selectedDistrict = districts.find((d) => d.id === districtFilter);
  const districtApplications = selectedDistrict
    ? applications.filter((a) => {
        const d = a.rawData?.district;
        return (d?.id ?? a.rawData?.districtId) === selectedDistrict.id || d?.name === selectedDistrict.name;
      })
    : applications;

  // Approved people still go through payment; split them by whether the permanent ID exists yet.
  const showPaymentFilter = activeStatus === "APPROVED" || activeStatus === "BPL_APPROVED";
  const paidCount = districtApplications.filter((a) => !!a.rawData?.permanentId).length;
  const unpaidCount = districtApplications.length - paidCount;
  const visibleApplications =
    showPaymentFilter && paymentFilter !== "ALL"
      ? districtApplications.filter((a) => !!a.rawData?.permanentId === (paymentFilter === "PAID"))
      : districtApplications;
  const autoOpened = React.useRef(false);
  useEffect(() => {
    const id = searchParams?.get("id");
    if (id && applications.length > 0 && !autoOpened.current) {
      const item = applications.find((a) => a.id === id);
      if (item) {
        setSelectedItem(item);
        setIsDetailModalOpen(true);
        autoOpened.current = true;
      }
    }
  }, [applications, searchParams]);

  const handleApprove = async (item: Application) => {
    setActionLoading(item.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/application/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: item.id, type: TYPE_MAP[activeTab], status: "APPROVED" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approval failed");
      showToast(json.message || `${item.name} approved successfully!`, "success");
      fetchApplications();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (item: Application, mode: RejectMode = "REJECTED") => {
    setSelectedItem(item);
    setRejectMode(mode);
    setRemark("");
    setIsRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!remark.trim()) return showToast(rejectMode === "BPL_REJECTED" ? "Please explain why the BPL proof was not accepted" : "Please enter a rejection reason", "error");
    if (!selectedItem) return;
    setActionLoading(selectedItem.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/application/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: selectedItem.id,
          type: TYPE_MAP[activeTab],
          status: rejectMode,
          remark,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Rejection failed");
      showToast(json.message || `${selectedItem.name} rejected.`, "success");
      setIsRejectModalOpen(false);
      fetchApplications();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const openRequestChangesModal = (item: Application) => {
    setSelectedItem(item);
    setRemark("");
    setIsRequestChangesModalOpen(true);
  };

  const handleRequestChanges = async () => {
    if (!remark.trim()) return showToast("Please enter the required changes", "error");
    if (!selectedItem) return;
    setActionLoading(selectedItem.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/admin/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: selectedItem.id,
          type: TYPE_MAP[activeTab],
          remark,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to request changes");
      showToast(`${selectedItem.name} asked for changes.`, "success");
      setIsRequestChangesModalOpen(false);
      fetchApplications();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
    PENDING:  { label: "PENDING",  dot: "bg-red-600",   text: "text-red-600" },
    ACTIVE:   { label: "ACTIVE",   dot: "bg-red-600",   text: "text-red-600" },
    APPROVED: { label: "APPROVED", dot: "bg-emerald-500",  text: "text-emerald-600" },
    REJECTED: { label: "REJECTED", dot: "bg-red-500",      text: "text-red-600" },
    REPLAY:   { label: "REPLAY",   dot: "bg-amber-500",  text: "text-amber-600" },
    BPL_REJECTED: { label: "BPL REJECTED", dot: "bg-orange-500", text: "text-orange-600" },
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-200 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories Sidebar & Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Sidebar */}
        <div className="lg:col-span-1 bg-white rounded-[2px] border border-slate-100 p-4 space-y-2 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            Categories
          </p>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  // The BPL tabs only exist for players.
                  if (tab.id !== "STUDENT" && (activeStatus === "BPL_APPROVED" || activeStatus === "BPL_REJECTED")) setActiveStatus("PENDING");
                }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all text-left ${
                  isActive
                    ? "bg-[#FF7400]/10 text-[#FF7400] shadow-[0_2px_8px_-2px_rgba(255,116,0,0.15)]"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} className={isActive ? "text-[#FF7400]" : "text-slate-400"} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* Status Segmented Control + Refresh */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-fit">
              {statusTabs.map((st) => {
                const isActive = activeStatus === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      setActiveStatus(st.id);
                      setPaymentFilter("ALL");
                    }}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      isActive
                        ? "bg-[#FF7400] text-white shadow-md shadow-[#FF7400]/20"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/50"
                    }`}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  aria-label="District"
                  className={`appearance-none pl-4 pr-9 py-2.5 bg-white border rounded-xl text-sm font-semibold shadow-sm focus:outline-none focus:border-[#FF7400] cursor-pointer ${
                    districtFilter === "ALL" ? "border-slate-200 text-slate-600" : "border-orange-200 text-[#FF7400] bg-orange-50"
                  }`}
                >
                  <option value="ALL">All districts</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={fetchApplications}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-all text-sm shadow-sm"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>

          {showPaymentFilter && (
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Payment</span>
              {([
                { id: "ALL", label: "All", count: districtApplications.length },
                { id: "UNPAID", label: "Pending (Temp ID)", count: unpaidCount },
                { id: "PAID", label: "Completed (Permanent ID)", count: paidCount },
              ] as const).map((pf) => {
                const isActive = paymentFilter === pf.id;
                return (
                  <button
                    key={pf.id}
                    onClick={() => setPaymentFilter(pf.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${
                      isActive
                        ? "bg-orange-50 border-[#FF7400] text-[#FF7400]"
                        : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pf.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-[#FF7400] text-white" : "bg-slate-100 text-slate-500"}`}>
                      {pf.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* List Headers */}
          <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-4 px-8 text-[#FF7400] font-black text-[15px] mb-4">
            <div>Applicant</div>
            <div>Contact</div>
            <div>Location</div>
            <div>Status</div>
            <div className="w-[220px] text-center">Actions</div>
          </div>

          {loading ? (
            <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-[2px] border border-slate-100 shadow-sm">
              <Loader2 size={40} className="animate-spin text-[#FF7400]" />
              <p className="text-slate-400 font-medium">Fetching pending approvals...</p>
            </div>
          ) : visibleApplications.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-[2px] border border-slate-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-300">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-400">
                {selectedDistrict ? `No applications from ${selectedDistrict.name}` : "No pending applications"}
              </h3>
              <p className="text-slate-400 text-sm mt-1">
                {selectedDistrict ? "Try another district or choose All districts." : "Check back later for new applications."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {visibleApplications.map((item) => {
                  const sc = statusConfig[item.status] || statusConfig["PENDING"];
                  const ps = item.status === "APPROVED" ? paymentStageConfig[getPaymentStage(item, activeTab)] : null;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-white rounded-[2px] shadow-sm border border-slate-100 py-5 px-8 flex items-center hover:shadow-md transition-all"
                    >
                      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-4 w-full items-center">
                        {/* Applicant */}
                        <div className="flex items-center gap-3 min-w-0">
                          {item.avatar ? (
                            <img
                              src={item.avatar}
                              alt={item.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#FF7400] to-[#E56900] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                              {item.name.charAt(0)}
                            </div>
                          )}
                          <div className="flex flex-col justify-center min-w-0">
                            <p className="font-bold text-slate-800 text-[15px] flex items-center gap-1.5 min-w-0" title={item.name}>
                              <span className="truncate">{item.name}</span>
                              {activeTab === "STUDENT" && item.rawData?.isBPL && (
                                <span className="shrink-0 text-[10px] font-black uppercase tracking-wider bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-sm">BPL</span>
                              )}
                            </p>
                            {item.subtitle && item.subtitle !== "No Club" && item.subtitle !== "Administrative Member" && item.subtitle !== "Coach" && (
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{item.subtitle}</p>
                            )}
                            {item.rawData?.rejectionRemark && (
                              <p className="text-[11px] text-red-500 font-bold mt-1 bg-red-50 px-2 py-0.5 rounded-sm border border-red-100 max-w-[200px] truncate" title={item.rawData.rejectionRemark}>
                                Remark: {item.rawData.rejectionRemark}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Contact */}
                        <div className="flex flex-col gap-1.5 min-w-0">
                          {item.phone && item.phone !== "—" && (
                            <div className="flex items-center gap-3 text-[13px] text-slate-600">
                              <Phone size={16} className="text-[#FF7400] shrink-0" /> <span className="truncate">{item.phone}</span>
                            </div>
                          )}
                          {item.email && item.email !== "—" && (
                            <div className="flex items-center gap-3 text-[13px] text-slate-600">
                              <Mail size={16} className="text-[#FF7400] shrink-0" /> <span className="truncate">{item.email}</span>
                            </div>
                          )}
                          {(!item.phone || item.phone === "—") && (!item.email || item.email === "—") && (
                             <span className="text-[13px] text-slate-400 italic">No contact provided</span>
                          )}
                        </div>

                        {/* Location */}
                        <div className="text-[14px] text-slate-700 truncate">
                          {item.location}
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${(ps ?? sc).dot}`} />
                          <span className={`${(ps ?? sc).text} font-black uppercase text-[13px] tracking-widest truncate`}>{(ps ?? sc).label}</span>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center justify-start gap-2">
                          {item.status === "PENDING" ? (
                            <>
                              <button 
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDetailModalOpen(true);
                                }}
                                disabled={actionLoading === item.id}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors px-4 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                              >
                                <Eye size={13} />
                                Review
                              </button>
                              <button 
                                onClick={() => handleApprove(item)}
                                disabled={actionLoading === item.id}
                                className="bg-[#FF7400] hover:bg-orange-600 transition-colors text-white px-5 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                              >
                                {actionLoading === item.id ? <Loader2 size={13} className="animate-spin" /> : null}
                                Approve
                              </button>
                               <button 
                                onClick={() => openRequestChangesModal(item)}
                                disabled={actionLoading === item.id}
                                className="bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors px-5 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50 shrink-0"
                              >
                                Replay
                              </button>
                              {activeTab === "STUDENT" && item.rawData?.isBPL && (
                                <button
                                  onClick={() => openRejectModal(item, "BPL_REJECTED")}
                                  disabled={actionLoading === item.id}
                                  title="Approve the application but refuse the BPL claim"
                                  className="bg-sky-100 text-sky-700 hover:bg-sky-200 transition-colors px-4 py-2 rounded-lg font-bold text-sm shadow-sm disabled:opacity-50 shrink-0"
                                >
                                  Reject BPL
                                </button>
                              )}
                              <div 
                                className={`p-[1px] rounded-lg shrink-0 inline-flex ${actionLoading === item.id ? 'opacity-50' : ''}`}
                                style={{ background: 'linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)' }}
                              >
                                <button 
                                  onClick={() => openRejectModal(item)}
                                  disabled={actionLoading === item.id}
                                  className="text-slate-800 hover:bg-orange-50 transition-colors px-6 py-2 rounded-[2px] font-bold text-sm bg-white flex items-center justify-center"
                                >
                                  Deny
                                </button>
                              </div>
                            </>
                          ) : item.status === "APPROVED" ? (
                            <div className="px-5 py-1 flex flex-col min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {item.rawData?.permanentId ? "Permanent ID" : "Temp ID"}
                              </span>
                              <span className={`text-sm font-bold font-mono truncate ${item.rawData?.permanentId ? "text-emerald-600" : "text-slate-700"}`}>
                                {item.rawData?.permanentId || item.rawData?.tempId || "—"}
                              </span>
                            </div>
                          ) : (
                            <div className="px-5 py-2 flex items-center gap-1.5">
                               <span className={`text-sm font-bold ${sc.text}`}>{sc.label}</span>
                            </div>
                          )}
                          
                          <button 
                             onClick={() => { setSelectedItem(item); setIsDetailModalOpen(true); }}
                             className="w-9 h-9 flex items-center justify-center border-[2px] border-slate-800 rounded-full text-slate-800 hover:bg-slate-100 transition-colors ml-auto shrink-0 cursor-pointer"
                             title="View Details"
                          >
                            <MoreHorizontal size={18} className="stroke-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">Application Details</h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(selectedItem.rawData)
                    .filter(([k]) => !["password", "id", "districtId", "talukId", "zoneId", "clubId", "coachId", "userId", "eventId"].includes(k))
                    .map(([key, val]: any) => {
                      const isUploadUrl =
                        typeof val === "string" &&
                        (val.startsWith("http://") || val.startsWith("https://") || val.includes("/uploads/"));
                      return (
                        <tr key={key} className="border-b border-slate-100 last:border-0">
                          <td className="py-3.5 pr-4 font-semibold text-slate-500 capitalize w-44 text-xs">
                            {key.replace(/([A-Z])/g, " $1")}
                          </td>
                          <td className="py-3.5 text-slate-800 break-words text-sm">
                            {isUploadUrl ? (
                              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 w-fit">
                                {val.toLowerCase().endsWith(".pdf") ? (
                                  <div className="p-2 bg-red-50 text-red-500 rounded-lg">
                                    <FileText size={18} />
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={val} alt="doc" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <a href={val} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:text-[#FF7400] rounded-md font-semibold text-xs">
                                    <Eye size={11} /> View
                                  </a>
                                  <a href={val} download target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FF7400] text-white rounded-md font-bold text-xs">
                                    <Download size={11} /> Download
                                  </a>
                                </div>
                              </div>
                            ) : typeof val === "object" && val !== null ? (
                              (val as any).name || JSON.stringify(val)
                            ) : (
                              String(val ?? "—")
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reject Modal */}
      <AnimatePresence>
        {isRejectModalOpen && selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {rejectMode === "BPL_REJECTED" ? "Reject BPL Claim" : activeTab === "STUDENT" ? "Permanently Reject" : "Rejection Reason"}
                  </h3>
                  <p className="text-slate-500 text-sm">
                    {rejectMode === "BPL_REJECTED" ? "Approving" : "Rejecting"} <strong>{selectedItem.name}</strong>
                    {rejectMode === "BPL_REJECTED" && " without BPL"}
                  </p>
                </div>
              </div>

              {rejectMode === "BPL_REJECTED" ? (
                <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2 mb-5 text-xs text-sky-700">
                  <Mail size={14} className="mt-0.5 shrink-0" />
                  <span>
                    The application is approved, but the BPL proof is refused. <strong>{selectedItem.email}</strong> will be asked to upload new proof or continue without BPL and pay the fee.
                  </span>
                </div>
              ) : (
                <>
                  {activeTab === "STUDENT" && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 mb-3 text-xs text-red-700">
                      <XCircle size={14} className="mt-0.5 shrink-0" />
                      <span>This is permanent. The player&apos;s Aadhaar number will be <strong>blocked</strong> from registering again.</span>
                    </div>
                  )}
                  {activeTab !== "EVENT" && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 mb-5 text-xs text-amber-700">
                      <Mail size={14} className="mt-0.5 shrink-0" />
                      A rejection notification will be sent to <strong>{selectedItem.email}</strong>
                    </div>
                  )}
                </>
              )}

              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={rejectMode === "BPL_REJECTED" ? "Why was the BPL proof not accepted?" : "Enter rejection reason…"}
                className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 transition-all resize-none mb-6 text-sm"
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setIsRejectModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!!actionLoading}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
                  {rejectMode === "BPL_REJECTED" ? "Reject BPL & Notify" : activeTab === "STUDENT" ? "Reject & Block Aadhaar" : "Deny & Notify"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Changes Modal */}
      <AnimatePresence>
        {isRequestChangesModalOpen && selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                  <RefreshCw size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Replay</h3>
                  <p className="text-slate-500 text-sm">
                    Ask <strong>{selectedItem.name}</strong> to modify their application
                  </p>
                </div>
              </div>

              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Detail what needs to be changed..."
                className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all resize-none mb-6 text-sm"
              />

              <div className="flex gap-4">
                <button
                  onClick={() => setIsRequestChangesModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={!!actionLoading}
                  className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                  Send Replay
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-500 font-bold">Loading...</div>}>
      <ApprovalsContent />
    </Suspense>
  );
}
