"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminStudentSchema, adminClubSchema, adminMemberSchema } from "@/validation/adminEntitySchema";
import { usePincodeLookup, PincodeHint } from "@/components/features/registers/usePincodeLookup";
import {
  Search,
  User,
  Shield,
  GraduationCap,
  Building2,
  RefreshCw,
  Loader2,
  Key,
  IdCard,
  Edit,
  Save,
  X,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Plus,
  ChevronDown,
  Trash2,
  Download,
  Upload,
  Ban,
} from "lucide-react";

type UserRole = "STUDENT" | "COACH" | "MEMBER" | "CLUB" | "DISTRICT_PRESIDENT" | "DISTRICT_SECRETARY" | "ZONE_PRESIDENT" | "ZONE_SECRETARY" | "STATE_PRESIDENT" | "STATE_SECRETARY" | "CEO";

interface TNJAUser {
  id: string;
  fullName: string;
  email: string;
  mobileNumber?: string;
  districtName?: string;
  district?: { name: string };
  assignedDistrict?: { name: string };
  tempId: string;
  permanentId: string | null;
  status: string;
  role: UserRole;
  createdAt: string;
  validUntil?: string;
  wins?: number;
  losses?: number;
  draws?: number;
  coachId?: string | null;
  /** Office a coach also holds, e.g. DISTRICT_SECRETARY. */
  officeRole?: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const PROMOTABLE_ROLES = [
  { id: "MEMBER", label: "Administrative Member" },
  { id: "DISTRICT_PRESIDENT", label: "District President" },
  { id: "DISTRICT_SECRETARY", label: "District Secretary" },
  { id: "ZONE_PRESIDENT", label: "Zone President" },
  { id: "ZONE_SECRETARY", label: "Zone Secretary" },
  { id: "STATE_PRESIDENT", label: "State President" },
  { id: "STATE_SECRETARY", label: "State Secretary" },
  { id: "CEO", label: "CEO" },
];

/** Offices a coach can hold alongside coaching ("" = no office). */
const COACH_OFFICE_ROLES = PROMOTABLE_ROLES.filter((r) => r.id !== "MEMBER" && r.id !== "CEO");

const getPermanentIdLabel = (role: string) => {
  if (role === "STUDENT") return "Player ID";
  if (role === "COACH") return "Coach ID";
  if (role === "CLUB") return "Club ID";
  return "Administrative Member ID";
};


// ─── Directory UI pieces ──────────────────────────────────────────────────────

const ROLE_TABS: { id: UserRole | "ALL" | "PROMOTED"; label: string }[] = [
  { id: "ALL", label: "All users" },
  { id: "STUDENT", label: "Players" },
  { id: "COACH", label: "Coaches" },
  { id: "MEMBER", label: "Administrative Members" },
  { id: "CLUB", label: "Clubs" },
  { id: "PROMOTED", label: "Officials" },
];

const STATUS_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "APPROVED", label: "Active" },
  { id: "BLOCKED", label: "Blocked" },
];

const STATUS_BADGE: Record<string, { label: string; dot: string; text: string }> = {
  APPROVED: { label: "Active", dot: "bg-emerald-500", text: "text-emerald-700" },
  BLOCKED: { label: "Blocked", dot: "bg-red-500", text: "text-red-600" },
  PENDING: { label: "Pending", dot: "bg-amber-500", text: "text-amber-700" },
  REJECTED: { label: "Rejected", dot: "bg-red-400", text: "text-red-600" },
  REPLAY: { label: "Changes requested", dot: "bg-purple-500", text: "text-purple-700" },
  BPL_REJECTED: { label: "BPL not accepted", dot: "bg-orange-500", text: "text-orange-700" },
};

const AVATAR_TONE: Record<string, string> = {
  STUDENT: "bg-orange-100 text-[#C45A00]",
  COACH: "bg-emerald-100 text-emerald-700",
  CLUB: "bg-purple-100 text-purple-700",
};

const formatShortDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status.replace(/_/g, " ").toLowerCase(), dot: "bg-slate-400", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold capitalize ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
}

function UserCell({ u }: { u: TNJAUser }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${AVATAR_TONE[u.role] ?? "bg-amber-100 text-amber-700"}`}>
        {(u.fullName || "?").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-slate-800 truncate">{u.fullName}</p>
        <p className="text-xs text-slate-500 truncate">{u.email}</p>
        {u.mobileNumber && <p className="text-xs text-slate-400">{u.mobileNumber}</p>}
      </div>
    </div>
  );
}

/** Officials can work in a different district from the one they live in; show both when they differ. */
function DistrictCell({ u }: { u: TNJAUser }) {
  const work = u.assignedDistrict?.name;
  const home = u.district?.name || u.districtName;
  if (work && work !== home) {
    return (
      <div className="text-xs">
        <p className="font-bold text-slate-700">{work}</p>
        {home && <p className="text-slate-400">Lives in {home}</p>}
      </div>
    );
  }
  return <span className="text-xs font-semibold text-slate-600">{home || "—"}</span>;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}

function FilterSelect({ value, onChange, label, children }: FilterSelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`appearance-none pl-3 pr-8 py-2 bg-white border rounded-lg text-xs font-bold focus:outline-none focus:border-[#FF7400] cursor-pointer ${
          value === "ALL" ? "border-slate-200 text-slate-600" : "border-orange-200 text-[#FF7400] bg-orange-50"
        }`}
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function ActionButton({ icon, label, onClick, danger }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-8 h-8 inline-flex items-center justify-center rounded-md border border-transparent transition-colors ${
        danger ? "text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100" : "text-slate-400 hover:text-[#FF7400] hover:bg-orange-50 hover:border-orange-100"
      }`}
    >
      {icon}
    </button>
  );
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<TNJAUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL" | "PROMOTED">("ALL");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("APPROVED");
  const [districtFilter, setDistrictFilter] = useState<string>("ALL");
  const [promotedRoleFilter, setPromotedRoleFilter] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<TNJAUser | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPermanentId, setNewPermanentId] = useState("");
  const [promoteRole, setPromoteRole] = useState("");
  const [promoteDistrictId, setPromoteDistrictId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<TNJAUser | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [fullUserDetails, setFullUserDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Match stats and coach state
  const [wins, setWins] = useState<number>(0);
  const [losses, setLosses] = useState<number>(0);
  const [draws, setDraws] = useState<number>(0);
  const [coachId, setCoachId] = useState<string>("");
  const [coachesList, setCoachesList] = useState<any[]>([]);
  const [districtsList, setDistrictsList] = useState<any[]>([]);

  // Create User State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<"STUDENT" | "COACH">("STUDENT");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<any | null>(null);

  const handleExcelImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", importFile);

      const endpoint = importType === "STUDENT" ? "/admin/import-students" : "/admin/import-coaches";

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      
      setImportResults(data);
      showToast(`${importType === "STUDENT" ? "Player" : "Coach"} import complete!`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setImportLoading(false);
    }
  };

  const [createType, setCreateType] = useState<"STUDENT" | "CLUB" | "MEMBER">("STUDENT");
  const [createForm, setCreateForm] = useState({
    fullName: "", name: "", email: "", mobileNumber: "", districtId: "", talukId: "",
    gender: "MALE", dob: "", aadhaarNumber: "", bloodGroup: "", address: "", city: "", state: "",
    addressPincode: "", nationality: "Indian", annualIncome: "", schoolName: "", grade: "",
    areaOfInterest: "", areaOfStudy: "", preferLocation: "", clubId: "",
    address1: "", address2: "", pincode: "", president: "", secretary: "", coach: "",
    fatherName: "", addressLine1: "", addressLine2: ""
  });
  const [taluksList, setTaluksList] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      if (roleFilter !== "ALL" && roleFilter !== "PROMOTED") params.append("role", roleFilter);
      if (genderFilter !== "ALL") params.append("gender", genderFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`${API_BASE}/users/all?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch users");
      setUsers(data);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchQuery, roleFilter, genderFilter, statusFilter]);

  const fetchCoaches = async () => {
    try {
      const res = await fetch(`${API_BASE}/coaches`);
      const data = await res.json();
      if (res.ok) {
        setCoachesList(data);
      }
    } catch (err) {
      console.error("Failed to fetch coaches list:", err);
    }
  };

  const fetchDistricts = async () => {
    try {
      const res = await fetch(`${API_BASE}/districts`);
      const data = await res.json();
      if (res.ok) setDistrictsList(data);
    } catch (err) {
      console.error("Failed to fetch districts list:", err);
    }
  };

  useEffect(() => {
    fetchCoaches();
    fetchDistricts();
    
    // Decode basic role from localStorage token if available, or just get the role
    const role = localStorage.getItem("userRole");
    if (role) {
      setCurrentUserRole(role);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (createForm.districtId) {
      fetch(`${API_BASE}/districts/${createForm.districtId}/taluks`)
        .then(res => res.json())
        .then(data => setTaluksList(data))
        .catch(err => console.error(err));
    } else {
      setTaluksList([]);
    }
  }, [createForm.districtId]);

  // Clubs record a location pincode; players and members only have an address pincode.
  const { hint: pincodeHint } = usePincodeLookup(
    createType === "CLUB" ? createForm.pincode : createForm.addressPincode,
    (match, onlyTaluk) => {
      setCreateForm(prev => ({ ...prev, districtId: match.district.id, talukId: onlyTaluk?.id ?? "" }));
      setFormErrors(prev => ({ ...prev, districtId: "", talukId: "" }));
    }
  );

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const confirmDelete = (u: TNJAUser) => {
    setUserToDelete(u);
    setDeleteModalOpen(true);
  };

  const handleViewDetails = async (u: TNJAUser) => {
    setSelectedUser(u);
    setViewModalOpen(true);
    setDetailsLoading(true);
    setFullUserDetails(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/${u.role}/${u.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch details");
      setFullUserDetails(data.data);
    } catch (err: any) {
      showToast(err.message, "error");
      setViewModalOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/${userToDelete.role}/${userToDelete.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      
      showToast("User deleted successfully", "success");
      setDeleteModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockUser = async (u: TNJAUser) => {
    if (!window.confirm(`Are you sure you want to block ${u.fullName}?`)) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/${u.role}/${u.id}/block`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to block user");
      
      showToast("User blocked successfully", "success");
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (user: TNJAUser) => {
    setSelectedUser(user);
    setNewPermanentId(user.permanentId || "");
    setNewPassword("");
    setWins(user.wins || 0);
    setLosses(user.losses || 0);
    setDraws(user.draws || 0);
    setCoachId(user.coachId || "");
    setEditModalOpen(true);
  };

  const handlePromoteClick = (user: TNJAUser) => {
    setSelectedUser(user);
    setPromoteRole(user.role === "COACH" ? user.officeRole || "" : user.role);
    setPromoteDistrictId("");
    setPromoteModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/users/credentials`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          role: selectedUser.role,
          permanentId: newPermanentId,
          password: newPassword || undefined,
          wins: selectedUser.role === "STUDENT" ? wins : undefined,
          losses: selectedUser.role === "STUDENT" ? losses : undefined,
          draws: selectedUser.role === "STUDENT" ? draws : undefined,
          coachId: selectedUser.role === "STUDENT" ? (coachId || null) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      showToast("User credentials updated successfully", "success");
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePromoteConfirm = async () => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      const isCoach = selectedUser.role === "COACH";
      const res = await fetch(`${API_BASE}/${isCoach ? "coach" : "member"}/promote`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          ...(isCoach ? { coachId: selectedUser.id } : { memberId: selectedUser.id }),
          role: isCoach ? promoteRole || null : promoteRole,
          districtId: promoteDistrictId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Promotion failed");
      showToast(
        isCoach
          ? promoteRole ? `Coach is now ${getRoleLabel(promoteRole)}` : "Coach's office removed"
          : `Administrative Member promoted to ${promoteRole} successfully`,
        "success"
      );
      setPromoteModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setFormErrors({});
      let schema;
      if (createType === "STUDENT") schema = adminStudentSchema;
      else if (createType === "CLUB") schema = adminClubSchema;
      else if (createType === "MEMBER") schema = adminMemberSchema;

      if (schema) {
        schema.parse(createForm);
      }
    } catch (error: any) {
      if (error.name === "ZodError") {
        const errors: any = {};
        error.errors.forEach((err: any) => {
          if (err.path[0]) errors[err.path[0]] = err.message;
        });
        setFormErrors(errors);
        const firstErrorKey = Object.keys(errors)[0];
        showToast(errors[firstErrorKey] || "Please fill all required fields correctly.", "error");
        return;
      }
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem("token");
      let endpoint = "";
      if (createType === "STUDENT") endpoint = "/admin/create-student";
      if (createType === "CLUB") endpoint = "/admin/create-club";
      if (createType === "MEMBER") endpoint = "/admin/create-member";

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Creation failed");
      showToast(`${createType} created successfully`, "success");
      setCreateModalOpen(false);
      fetchUsers();
      setCreateForm({ 
        fullName: "", name: "", email: "", mobileNumber: "", districtId: "", talukId: "",
        gender: "MALE", dob: "", aadhaarNumber: "", bloodGroup: "", address: "", city: "", state: "",
        addressPincode: "", nationality: "Indian", annualIncome: "", schoolName: "", grade: "",
        areaOfInterest: "", areaOfStudy: "", preferLocation: "", clubId: "",
        address1: "", address2: "", pincode: "", president: "", secretary: "", coach: "",
        fatherName: "", addressLine1: "", addressLine2: ""
      });
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    // 1. Role Filter for PROMOTED
    if (roleFilter === "PROMOTED") {
      const promotedRoles = ["DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"];
      const office = u.role === "COACH" ? u.officeRole || "" : u.role;
      if (!promotedRoles.includes(office)) return false;
      
      if (promotedRoleFilter !== "ALL" && office !== promotedRoleFilter) {
        return false;
      }

      // 2. District Filter for PROMOTED
      if (districtFilter !== "ALL") {
        const selectedDistrict = districtsList.find(d => d.id === districtFilter);
        const officeDistrict = u.role === "COACH" ? u.assignedDistrict?.name ?? u.districtName : u.districtName;
        if (selectedDistrict && officeDistrict !== selectedDistrict.name) {
          return false;
        }
      }
    }

    // 3. Search Filter
    if (!debouncedSearchQuery) return true;
    const q = debouncedSearchQuery.toLowerCase();
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.mobileNumber?.includes(q) ||
      u.tempId?.toLowerCase().includes(q) ||
      u.permanentId?.toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    try {
      if (!filteredUsers || filteredUsers.length === 0) {
        showToast("No data to export", "error");
        return;
      }

      const headers = [
        "ID",
        "Full Name",
        "Role",
        "Email",
        "Mobile Number",
        "District",
        "Temporary ID",
        "Permanent ID",
        "Status",
        "Joined Date",
        "Valid Until"
      ];

      const rows = filteredUsers.map(u => {
        let createdDate = "-";
        try { createdDate = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"; } catch (e) {}

        let validDate = "-";
        try { validDate = u.validUntil ? new Date(u.validUntil).toLocaleDateString() : "-"; } catch (e) {}

        return [
          u.id,
          u.fullName || "-",
          u.role || "-",
          u.email || "-",
          u.mobileNumber || "-",
          u.districtName || "-",
          u.tempId || "-",
          u.permanentId || "-",
          u.status || "-",
          createdDate,
          validDate
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      showToast("Export failed: " + err.message, "error");
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "CLUB": return <Building2 size={16} />;
      case "STUDENT": return <GraduationCap size={16} />;
      case "COACH": return <Shield size={16} />;
      default: return <User size={16} />;
    }
  };

  const getRoleLabel = (role: string) => {
    const found = PROMOTABLE_ROLES.find(r => r.id === role);
    return found ? found.label : role;
  };

  const isMemberRole = (role: string) => {
    return ["MEMBER", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(role);
  };

  const roleColors: Record<string, string> = {
    CLUB: "bg-purple-100 text-purple-700",
    STUDENT: "bg-blue-100 text-blue-700",
    COACH: "bg-emerald-100 text-emerald-700",
    MEMBER: "bg-amber-100 text-amber-700",
    DISTRICT_PRESIDENT: "bg-orange-100 text-orange-700",
    DISTRICT_SECRETARY: "bg-orange-100 text-orange-700",
    ZONE_PRESIDENT: "bg-rose-100 text-rose-700",
    ZONE_SECRETARY: "bg-rose-100 text-rose-700",
    STATE_PRESIDENT: "bg-red-100 text-red-700",
    STATE_SECRETARY: "bg-red-100 text-red-700",
    CEO: "bg-slate-800 text-white",
  };

  const canBlock = ["SUPER_ADMIN", "CEO", "STATE_PRESIDENT", "STATE_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY"].includes(currentUserRole || "");
  const canDelete = currentUserRole === "SUPER_ADMIN" || currentUserRole === "CEO";
  const renderActions = (u: TNJAUser) => (
    <>
      <ActionButton icon={<Eye size={16} />} label="View details" onClick={() => handleViewDetails(u)} />
      <ActionButton icon={<Edit size={16} />} label="Edit ID or password" onClick={() => handleEdit(u)} />
      {isMemberRole(u.role) && <ActionButton icon={<Shield size={16} />} label="Promote" onClick={() => handlePromoteClick(u)} />}
      {u.role === "COACH" && u.status === "APPROVED" && <ActionButton icon={<Shield size={16} />} label={u.officeRole ? "Change office" : "Assign office"} onClick={() => handlePromoteClick(u)} />}
      {u.status !== "BLOCKED" && canBlock && <ActionButton icon={<Ban size={16} />} label="Block" danger onClick={() => handleBlockUser(u)} />}
      {canDelete && <ActionButton icon={<Trash2 size={16} />} label="Delete" danger onClick={() => confirmDelete(u)} />}
    </>
  );

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-200 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toolbar: role toggle + actions ── */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg overflow-x-auto scrollbar-hide w-full xl:w-fit" role="tablist" aria-label="Filter users by type">
          {ROLE_TABS.map((tab) => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setRoleFilter(tab.id)}
                className={`relative shrink-0 px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-colors duration-300 ${
                  active ? "text-white" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="user-role-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 rounded-md bg-[#FF7400]"
                  />
                )}
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2 xl:ml-auto">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white rounded-lg font-bold text-sm transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" /> Create New
          </button>
          <button
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 rounded-lg font-bold text-sm transition-colors"
          >
            <Upload size={16} /> Import
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredUsers.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 rounded-lg font-bold text-sm transition-colors disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
          >
            <Download size={16} /> Export
          </button>
          <button
            onClick={fetchUsers}
            aria-label="Refresh"
            title="Refresh"
            className="inline-flex items-center justify-center w-10 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-500 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search name, email, mobile or ID"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF7400] text-sm text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-lg" role="tablist" aria-label="Filter by status">
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s.id;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(s.id)}
                  className={`relative px-3 py-1.5 rounded-md text-xs font-bold transition-colors duration-300 ${active ? "text-[#FF7400]" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="user-status-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      className="absolute inset-0 rounded-md bg-orange-50 border border-orange-200"
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </button>
              );
            })}
          </div>

          <FilterSelect value={genderFilter} onChange={setGenderFilter} label="Gender">
            <option value="ALL">All genders</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </FilterSelect>

          {roleFilter === "PROMOTED" && (
            <>
              <FilterSelect value={promotedRoleFilter} onChange={setPromotedRoleFilter} label="Office">
                <option value="ALL">All offices</option>
                {PROMOTABLE_ROLES.filter((r) => r.id !== "MEMBER").map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </FilterSelect>
              <FilterSelect value={districtFilter} onChange={setDistrictFilter} label="District">
                <option value="ALL">All districts</option>
                {districtsList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </FilterSelect>
            </>
          )}
        </div>
      </div>

      {/* ── Directory ── */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-700">
            {loading ? "Loading users…" : `${filteredUsers.length.toLocaleString("en-IN")} ${filteredUsers.length === 1 ? "user" : "users"}`}
          </p>
          {loading && <Loader2 size={16} className="animate-spin text-[#FF7400]" />}
        </div>

        {!loading && filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">No users match these filters</p>
            <p className="text-xs text-slate-400 mt-1">Try another type or status, or clear the search.</p>
          </div>
        ) : (
          <>
            {/* Table (tablet and up) */}
            <div className={`hidden md:block overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-black text-slate-400 uppercase tracking-wider bg-slate-50">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">District</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => (
                    <tr key={`${u.role}-${u.id}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <UserCell u={u} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${roleColors[u.role] || "bg-slate-100 text-slate-600"}`}>
                          {getRoleIcon(u.role)}{getRoleLabel(u.role)}
                        </span>
                        {u.officeRole && (
                          <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${roleColors[u.officeRole] || "bg-slate-100 text-slate-600"}`}>
                            {getRoleLabel(u.officeRole)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.permanentId ? (
                          <p className="font-mono text-xs font-bold text-slate-800">{u.permanentId}</p>
                        ) : (
                          <p className="text-xs text-slate-400">No {getPermanentIdLabel(u.role)} yet</p>
                        )}
                        <p className="font-mono text-[11px] text-slate-400">{u.tempId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <DistrictCell u={u} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        <p>{formatShortDate(u.createdAt)}</p>
                        {u.validUntil && <p className="text-emerald-700">Valid to {formatShortDate(u.validUntil)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">{renderActions(u)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Compact rows (phones) */}
            <ul className={`md:hidden divide-y divide-slate-100 ${loading ? "opacity-50" : ""}`}>
              {filteredUsers.map((u) => (
                <li key={`${u.role}-${u.id}`} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <UserCell u={u} />
                    <StatusBadge status={u.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${roleColors[u.role] || "bg-slate-100 text-slate-600"}`}>
                      {getRoleIcon(u.role)}{getRoleLabel(u.role)}
                    </span>
                    {u.officeRole && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${roleColors[u.officeRole] || "bg-slate-100 text-slate-600"}`}>
                        {getRoleLabel(u.officeRole)}
                      </span>
                    )}
                    <span className="font-mono font-bold text-slate-700">{u.permanentId || u.tempId}</span>
                    {u.districtName && <span className="text-slate-500">· {u.districtName}</span>}
                  </div>
                  <div className="flex gap-1">{renderActions(u)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 text-[#FF7400] rounded-2xl">
                    <Key size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Manage Credentials</h3>
                    <p className="text-slate-500 text-sm">{selectedUser.fullName}</p>
                  </div>
                </div>
                <button onClick={() => setEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    {selectedUser ? getPermanentIdLabel(selectedUser.role) : "Permanent ID"}
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={18} />
                    <input
                      type="text"
                      value={newPermanentId}
                      readOnly
                      placeholder={selectedUser ? `Enter ${getPermanentIdLabel(selectedUser.role)}` : "Enter Permanent ID"}
                      className="w-full pl-12 pr-4 py-4 text-slate-500 bg-slate-100 border border-slate-200 rounded-2xl cursor-not-allowed focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Reset Password
                  </label>
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-black" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (leave blank to keep current)"
                      className="w-full pl-12 pr-12 py-4 text-black bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 ml-1">
                    Warning: Changing password will lock the user out until they use the new one.
                  </p>
                </div>

                {selectedUser.role === "STUDENT" && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Wins
                        </label>
                        <input
                          type="number"
                          value={wins}
                          onChange={(e) => setWins(Number(e.target.value) || 0)}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Losses
                        </label>
                        <input
                          type="number"
                          value={losses}
                          onChange={(e) => setLosses(Number(e.target.value) || 0)}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all font-bold text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Draws
                        </label>
                        <input
                          type="number"
                          value={draws}
                          onChange={(e) => setDraws(Number(e.target.value) || 0)}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all font-bold text-slate-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                        Assigned Coach
                      </label>
                      <select
                        value={coachId}
                        onChange={(e) => setCoachId(e.target.value)}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all font-bold text-slate-700"
                      >
                        <option value="">No Coach Assigned</option>
                        {coachesList.map((coach: any) => (
                          <option key={coach.id} value={coach.id}>
                            {coach.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="flex-grow py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={actionLoading}
                  className="flex-grow py-4 bg-[#FF7400] text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promote Modal */}
      <AnimatePresence>
        {promoteModalOpen && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">{selectedUser.role === "COACH" ? "Assign Office to Coach" : "Promote Administrative Member"}</h3>
                    <p className="text-slate-500 text-sm">{selectedUser.fullName}</p>
                  </div>
                </div>
                <button onClick={() => setPromoteModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Select Role
                  </label>
                  <select
                    value={promoteRole}
                    onChange={(e) => setPromoteRole(e.target.value)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                  >
                    {selectedUser.role === "COACH" && <option value="">No office (coach only)</option>}
                    {(selectedUser.role === "COACH" ? COACH_OFFICE_ROLES : PROMOTABLE_ROLES).map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  {selectedUser.role === "COACH" && (
                    <p className="text-[10px] text-slate-400 mt-3 leading-relaxed">
                      The coach keeps their students and mats, and gets a &quot;Switch to Office View&quot; button in the sidebar for their office dashboard. Zone offices cover the zone of the coach&apos;s own district.
                    </p>
                  )}
                </div>
                {["DISTRICT_PRESIDENT", "DISTRICT_SECRETARY"].includes(promoteRole) && (
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1 mt-4">
                      Assign District
                    </label>
                    <select
                      value={promoteDistrictId}
                      onChange={(e) => setPromoteDistrictId(e.target.value)}
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                    >
                      <option value="">Select District</option>
                      {districtsList.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                      Promoting a member gives them additional privileges. They will see a different dashboard corresponding to their new role and the district assigned to them.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  onClick={() => setPromoteModalOpen(false)}
                  className="flex-grow py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePromoteConfirm}
                  disabled={actionLoading}
                  className="flex-grow py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                  Confirm Promotion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl my-auto max-h-screen overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">Create New Entity</h3>
                    <p className="text-slate-500 text-sm">Force create an approved Player, Club, or Administrative Member.</p>
                  </div>
                </div>
                <button onClick={() => { setCreateModalOpen(false); setFormErrors({}); }} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                    Entity Type
                  </label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value as any)}
                    className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700"
                  >
                    <option value="STUDENT">Player</option>
                    <option value="CLUB">Club</option>
                    <option value="MEMBER">Administrative Member</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {createType === "CLUB" ? (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Club Name
                        </label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(e) => { setCreateForm({ ...createForm, name: e.target.value }); if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' })); }}
                          placeholder="Enter Club Name"
                          className="` w-full px-4 py-3 bg-white border ${formErrors.name ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Address Line 1</label>
                        <input type="text" value={createForm.address1} onChange={(e) => { setCreateForm({ ...createForm, address1: e.target.value }); if (formErrors.address1) setFormErrors(prev => ({ ...prev, address1: '' })); }} placeholder="Address Line 1" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Address Line 2 (Optional)</label>
                        <input type="text" value={createForm.address2} onChange={(e) => { setCreateForm({ ...createForm, address2: e.target.value }); if (formErrors.address2) setFormErrors(prev => ({ ...prev, address2: '' })); }} placeholder="Address Line 2" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Pincode</label>
                        <input type="text" value={createForm.pincode} onChange={(e) => { setCreateForm({ ...createForm, pincode: e.target.value.replace(/\D/g, '') }); if (formErrors.pincode) setFormErrors(prev => ({ ...prev, pincode: '' })); }} placeholder="Pincode" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        <div className="mt-1.5 ml-1"><PincodeHint hint={pincodeHint} /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">President Name</label>
                        <input type="text" value={createForm.president} onChange={(e) => { setCreateForm({ ...createForm, president: e.target.value }); if (formErrors.president) setFormErrors(prev => ({ ...prev, president: '' })); }} placeholder="President Name" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Secretary Name</label>
                        <input type="text" value={createForm.secretary} onChange={(e) => { setCreateForm({ ...createForm, secretary: e.target.value }); if (formErrors.secretary) setFormErrors(prev => ({ ...prev, secretary: '' })); }} placeholder="Secretary Name" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Coach Name</label>
                        <input type="text" value={createForm.coach} onChange={(e) => { setCreateForm({ ...createForm, coach: e.target.value }); if (formErrors.coach) setFormErrors(prev => ({ ...prev, coach: '' })); }} placeholder="Coach Name" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={createForm.fullName}
                        onChange={(e) => { setCreateForm({ ...createForm, fullName: e.target.value }); if (formErrors.fullName) setFormErrors(prev => ({ ...prev, fullName: '' })); }}
                        placeholder="Enter Full Name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={createForm.email}
                      onChange={(e) => { setCreateForm({ ...createForm, email: e.target.value }); if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' })); }}
                      placeholder="Enter Email Address"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      value={createForm.mobileNumber}
                      onChange={(e) => { setCreateForm({ ...createForm, mobileNumber: e.target.value.replace(/\D/g, '') }); if (formErrors.mobileNumber) setFormErrors(prev => ({ ...prev, mobileNumber: '' })); }}
                      placeholder="10-digit Mobile Number"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                      District
                    </label>
                    <select
                      value={createForm.districtId}
                      onChange={(e) => { setCreateForm({ ...createForm, districtId: e.target.value, talukId: "" }); if (formErrors.districtId) setFormErrors(prev => ({ ...prev, districtId: '' })); }}
                      className="` w-full px-4 py-3 bg-white border ${formErrors.districtId ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                    >
                      <option value="">Select District</option>
                      {districtsList.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                        {formErrors.name && <p className="text-red-500 text-xs mt-1.5 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500"></span>{formErrors.name}</p>}
                        {formErrors.name && <p className='text-red-500 text-[10px] mt-1 ml-1'>{formErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                      Taluk
                    </label>
                    <select
                      value={createForm.talukId}
                      onChange={(e) => { setCreateForm({ ...createForm, talukId: e.target.value }); if (formErrors.talukId) setFormErrors(prev => ({ ...prev, talukId: '' })); }}
                      className="` w-full px-4 py-3 bg-white border ${formErrors.talukId ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                    >
                      <option value="">Select Taluk</option>
                      {taluksList.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                        {formErrors.talukId && <p className="text-red-500 text-xs mt-1.5 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500"></span>{formErrors.talukId}</p>}
                        {formErrors.talukId && <p className='text-red-500 text-[10px] mt-1 ml-1'>{formErrors.talukId}</p>}
                  </div>

                  {createType !== "CLUB" && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Gender
                        </label>
                        <select
                          value={createForm.gender}
                          onChange={(e) => { setCreateForm({ ...createForm, gender: e.target.value }); if (formErrors.gender) setFormErrors(prev => ({ ...prev, gender: '' })); }}
                          className="` w-full px-4 py-3 bg-white border ${formErrors.gender ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                        {formErrors.gender && <p className="text-red-500 text-xs mt-1.5 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500"></span>{formErrors.gender}</p>}
                        {formErrors.gender && <p className='text-red-500 text-[10px] mt-1 ml-1'>{formErrors.gender}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          max={new Date(new Date().setFullYear(new Date().getFullYear() - (createType === 'STUDENT' ? 3 : 18))).toISOString().split('T')[0]}
                          value={createForm.dob}
                          onChange={(e) => { setCreateForm({ ...createForm, dob: e.target.value }); if (formErrors.dob) setFormErrors(prev => ({ ...prev, dob: '' })); }}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                          Aadhaar Number
                        </label>
                        <input
                          type="text"
                          value={createForm.aadhaarNumber}
                          onChange={(e) => { setCreateForm({ ...createForm, aadhaarNumber: e.target.value.replace(/\D/g, '') }); if (formErrors.aadhaarNumber) setFormErrors(prev => ({ ...prev, aadhaarNumber: '' })); }}
                          placeholder="12-digit Aadhaar Number"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                        />
                      </div>
                    </>
                  )}

                  {createType === "STUDENT" && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Blood Group</label>
                        <select
                          value={createForm.bloodGroup}
                          onChange={(e) => { setCreateForm({ ...createForm, bloodGroup: e.target.value }); if (formErrors.bloodGroup) setFormErrors(prev => ({ ...prev, bloodGroup: '' })); }}
                          className="` w-full px-4 py-3 bg-white border ${formErrors.bloodGroup ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                        {formErrors.bloodGroup && <p className="text-red-500 text-xs mt-1.5 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500"></span>{formErrors.bloodGroup}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Address</label>
                        <input type="text" value={createForm.address} onChange={(e) => { setCreateForm({ ...createForm, address: e.target.value }); if (formErrors.address) setFormErrors(prev => ({ ...prev, address: '' })); }} placeholder="Full Address" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">City</label>
                        <input type="text" value={createForm.city} onChange={(e) => { setCreateForm({ ...createForm, city: e.target.value }); if (formErrors.city) setFormErrors(prev => ({ ...prev, city: '' })); }} placeholder="City" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">State</label>
                        <input type="text" value={createForm.state} onChange={(e) => { setCreateForm({ ...createForm, state: e.target.value }); if (formErrors.state) setFormErrors(prev => ({ ...prev, state: '' })); }} placeholder="State" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Pincode</label>
                        <input type="text" value={createForm.addressPincode} onChange={(e) => { setCreateForm({ ...createForm, addressPincode: e.target.value.replace(/\D/g, '') }); if (formErrors.addressPincode) setFormErrors(prev => ({ ...prev, addressPincode: '' })); }} placeholder="Pincode" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        <div className="mt-1.5 ml-1"><PincodeHint hint={pincodeHint} /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Nationality</label>
                        <input type="text" value={createForm.nationality} onChange={(e) => { setCreateForm({ ...createForm, nationality: e.target.value }); if (formErrors.nationality) setFormErrors(prev => ({ ...prev, nationality: '' })); }} placeholder="Nationality" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Annual Income</label>
                        <input type="number" value={createForm.annualIncome} onChange={(e) => { setCreateForm({ ...createForm, annualIncome: e.target.value }); if (formErrors.annualIncome) setFormErrors(prev => ({ ...prev, annualIncome: '' })); }} placeholder="Annual Income" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">School Name</label>
                        <input type="text" value={createForm.schoolName} onChange={(e) => { setCreateForm({ ...createForm, schoolName: e.target.value }); if (formErrors.schoolName) setFormErrors(prev => ({ ...prev, schoolName: '' })); }} placeholder="School Name" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Grade</label>
                        <input type="text" value={createForm.grade} onChange={(e) => { setCreateForm({ ...createForm, grade: e.target.value }); if (formErrors.grade) setFormErrors(prev => ({ ...prev, grade: '' })); }} placeholder="Grade" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Area of Interest</label>
                        <input type="text" value={createForm.areaOfInterest} onChange={(e) => { setCreateForm({ ...createForm, areaOfInterest: e.target.value }); if (formErrors.areaOfInterest) setFormErrors(prev => ({ ...prev, areaOfInterest: '' })); }} placeholder="Area of Interest" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Area of Study</label>
                        <input type="text" value={createForm.areaOfStudy} onChange={(e) => { setCreateForm({ ...createForm, areaOfStudy: e.target.value }); if (formErrors.areaOfStudy) setFormErrors(prev => ({ ...prev, areaOfStudy: '' })); }} placeholder="Area of Study" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Prefer Location</label>
                        <input type="text" value={createForm.preferLocation} onChange={(e) => { setCreateForm({ ...createForm, preferLocation: e.target.value }); if (formErrors.preferLocation) setFormErrors(prev => ({ ...prev, preferLocation: '' })); }} placeholder="Prefer Location" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                    </>
                  )}

                  {createType === "MEMBER" && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Father's Name</label>
                        <input type="text" value={createForm.fatherName} onChange={(e) => { setCreateForm({ ...createForm, fatherName: e.target.value }); if (formErrors.fatherName) setFormErrors(prev => ({ ...prev, fatherName: '' })); }} placeholder="Father's Name" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Blood Group</label>
                        <select
                          value={createForm.bloodGroup}
                          onChange={(e) => { setCreateForm({ ...createForm, bloodGroup: e.target.value }); if (formErrors.bloodGroup) setFormErrors(prev => ({ ...prev, bloodGroup: '' })); }}
                          className="` w-full px-4 py-3 bg-white border ${formErrors.bloodGroup ? 'border-red-500 bg-red-50 text-red-900' : 'border-slate-200'} rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm `"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                        {formErrors.bloodGroup && <p className="text-red-500 text-xs mt-1.5 font-bold ml-1 flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-red-500"></span>{formErrors.bloodGroup}</p>}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Address Line 1</label>
                        <input type="text" value={createForm.addressLine1} onChange={(e) => { setCreateForm({ ...createForm, addressLine1: e.target.value }); if (formErrors.addressLine1) setFormErrors(prev => ({ ...prev, addressLine1: '' })); }} placeholder="Address Line 1" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Address Line 2 (Optional)</label>
                        <input type="text" value={createForm.addressLine2} onChange={(e) => { setCreateForm({ ...createForm, addressLine2: e.target.value }); if (formErrors.addressLine2) setFormErrors(prev => ({ ...prev, addressLine2: '' })); }} placeholder="Address Line 2" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">City</label>
                        <input type="text" value={createForm.city} onChange={(e) => { setCreateForm({ ...createForm, city: e.target.value }); if (formErrors.city) setFormErrors(prev => ({ ...prev, city: '' })); }} placeholder="City" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">Pincode</label>
                        <input type="text" value={createForm.addressPincode} onChange={(e) => { setCreateForm({ ...createForm, addressPincode: e.target.value.replace(/\D/g, '') }); if (formErrors.addressPincode) setFormErrors(prev => ({ ...prev, addressPincode: '' })); }} placeholder="Pincode" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                        <div className="mt-1.5 ml-1"><PincodeHint hint={pincodeHint} /></div>
                      </div>
                    </>
                  )}

                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <button
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-grow py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={actionLoading}
                  className="flex-grow py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Create {createType === "STUDENT" ? "Player" : createType === "CLUB" ? "Club" : "Administrative Member"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
     </AnimatePresence>

      {/* Excel Import Modal */}
      <AnimatePresence>
        {importModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Upload size={24} className="text-[#FF7400]" />
                  Import {importType === "STUDENT" ? "Players" : "Coaches"} (Excel)
                </h3>
                <button
                  onClick={() => {
                    setImportModalOpen(false);
                    setImportFile(null);
                    setImportResults(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-500 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {!importResults ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2 ml-1">
                      Import Type
                    </label>
                    <select
                      value={importType}
                      onChange={(e) => {
                        setImportType(e.target.value as "STUDENT" | "COACH");
                        setImportFile(null);
                        setImportResults(null);
                      }}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-semibold text-slate-700"
                    >
                      <option value="STUDENT">Players (Students)</option>
                      <option value="COACH">Coaches</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-500 text-sm">
                      Select or drag an Excel file (.xlsx or .xls) to seed {importType === "STUDENT" ? "players" : "coaches"} into the database.
                    </p>
                    <a
                      href={importType === "STUDENT" ? "/templates/students_import_template.xlsx" : "/templates/coaches_import_template.xlsx"}
                      download
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Download size={14} /> Download Template
                    </a>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100/50 transition-all cursor-pointer relative">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setImportFile(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload size={32} className="text-slate-400" />
                    {importFile ? (
                      <span className="font-bold text-slate-700 text-center break-all">{importFile.name}</span>
                    ) : (
                      <span className="text-sm font-semibold text-slate-500 text-center">Click or Drag Excel File Here</span>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider mb-1">Required Column Headers:</span>
                    {importType === "STUDENT" ? (
                      <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                          <div>• Full Name</div>
                          <div>• Email</div>
                          <div>• Mobile Number</div>
                          <div>• Aadhaar Number</div>
                          <div>• Date of Birth (YYYY-MM-DD)</div>
                          <div>• Gender (MALE/FEMALE)</div>
                          <div>• District Name</div>
                          <div>• Taluk Name</div>
                        </div>
                        <span className="text-[10px] text-slate-400 block pt-2">Note: Optional headers include: School Name, Grade, Annual Income, Weight, Height, Coach Name, Temporary ID, Permanent ID, Status.</span>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 font-medium">
                          <div>• Full Name</div>
                          <div>• Father Name</div>
                          <div>• Email</div>
                          <div>• Mobile Number</div>
                          <div>• Aadhaar Number</div>
                          <div>• Date of Birth (YYYY-MM-DD)</div>
                          <div>• Gender (MALE/FEMALE)</div>
                          <div>• District Name</div>
                          <div>• Taluk Name</div>
                        </div>
                        <span className="text-[10px] text-slate-400 block pt-2">Note: Optional headers include: Pincode, History in Judo, History in Other Martial, Present Grade in Judo, Temporary ID, Permanent ID, Status.</span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => {
                        setImportModalOpen(false);
                        setImportFile(null);
                      }}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExcelImport}
                      disabled={!importFile || importLoading}
                      className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm cursor-pointer"
                    >
                      {importLoading ? <Loader2 size={18} className="animate-spin" /> : "Start Import"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100">
                    <CheckCircle2 className="shrink-0 text-emerald-600" size={24} />
                    <div>
                      <div className="font-bold text-sm">Import Process Finished</div>
                      <div className="text-xs mt-0.5">
                        Successfully imported <span className="font-extrabold">{importResults.successCount}</span> {importType === "STUDENT" ? "players" : "coaches"}.
                        {importResults.failedCount > 0 && (
                          <span> Skip/Failed: <span className="font-extrabold text-red-600">{importResults.failedCount}</span></span>
                        )}
                      </div>
                    </div>
                  </div>

                  {importResults.defaultPassword && (
                    <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-100 text-xs">
                      <span className="font-bold">Default login password for imported accounts: </span>
                      <span className="font-mono font-extrabold bg-white px-2 py-0.5 rounded-sm border border-amber-200">{importResults.defaultPassword}</span>
                      <span> — they log in with their Temp/Permanent ID and this password, and will be prompted to set their own on first login. Share it with them; it isn't emailed automatically.</span>
                    </div>
                  )}

                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-600">Error Details:</span>
                      <div className="max-h-48 overflow-y-auto border border-red-100 rounded-2xl p-4 bg-red-50/30 space-y-2">
                        {importResults.errors.map((err: any, i: number) => (
                          <div key={i} className="text-xs text-red-600 flex gap-2">
                            <span className="font-bold shrink-0">Row {err.row}:</span>
                            <span>{err.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setImportModalOpen(false);
                      setImportFile(null);
                      setImportResults(null);
                      fetchUsers();
                    }}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-all text-sm mt-4 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && userToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Delete User?</h3>
              <p className="text-slate-500 mb-8">
                Are you sure you want to delete <strong className="text-slate-800">{userToDelete.fullName}</strong>? This action cannot be undone. 
                <br /><br />
                <span className="text-xs text-red-500">Note: Deletion will fail if the user is linked to active matches, students, or other critical data.</span>
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={actionLoading}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={18} className="animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ViewDetailsModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        user={fullUserDetails}
        loading={detailsLoading}
      />
    </div>
  );
}

function ViewDetailsModal({ 
  isOpen, 
  onClose, 
  user, 
  loading 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: any; 
  loading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <IdCard className="text-[#FF7400]" size={28} />
                User Details
              </h2>
              {user && (
                <p className="text-sm font-bold text-slate-500 mt-1">
                  {user.fullName || user.clubName || "Unknown User"} • {user.role}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-all"
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={40} className="animate-spin mb-4 text-[#FF7400]" />
                <p className="font-bold">Fetching user details...</p>
              </div>
            ) : !user ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <XCircle size={40} className="mb-4 text-slate-300" />
                <p className="font-bold">User details not found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(user)
                  .filter(([key]) => ![
                    "id", "password", "resetPasswordToken", "resetPasswordExpires",
                  ].includes(key))
                  .map(([key, val]) => {
                    if (val === null || val === undefined || val === "") return null;
                    
                    const isUploadField =
                      ["proof", "photo", "certificate", "document", "front", "back", "file", "upload"].some((k) =>
                        key.toLowerCase().includes(k)
                      ) ||
                      (typeof val === "string" && (val.startsWith("http") || val.includes("/uploads/")));

                    const isBoolean = typeof val === "boolean";
                    const isDate = typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val);

                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim();

                    let displayValue: React.ReactNode = String(val);

                    if (isBoolean) {
                      displayValue = val ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-sm">
                          <CheckCircle2 size={14} /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded-sm">
                          <XCircle size={14} /> No
                        </span>
                      );
                    } else if (isDate) {
                      displayValue = new Date(val as string).toLocaleString();
                    } else if (typeof val === "object" && val !== null) {
                      displayValue = (val as any).name || (val as any).title || JSON.stringify(val);
                    }

                    return (
                      <div
                        key={key}
                        className={`bg-slate-50 rounded-2xl p-4 border border-slate-100 ${
                          isUploadField ? "md:col-span-2" : ""
                        }`}
                      >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          {label}
                        </span>
                        {isUploadField ? (
                          <div className="mt-2">
                            {typeof val === "string" && val.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                              <a href={val} target="_blank" rel="noopener noreferrer" className="block max-w-[200px] border border-slate-200 rounded-xl overflow-hidden hover:opacity-80 transition-opacity">
                                <img src={val} alt={label} className="w-full h-auto object-cover" />
                              </a>
                            ) : (
                              <a
                                href={val as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                              >
                                View Document ↗
                              </a>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm font-bold text-slate-800 break-words">
                            {displayValue}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
