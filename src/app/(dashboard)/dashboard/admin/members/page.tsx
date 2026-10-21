"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  MoreVertical,
  MoreHorizontal, 
  Mail, 
  Phone,
  ArrowUpDown,
  Loader2,
  Eye,
  X,
  FileText
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function MembersListPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [genderFilter, setGenderFilter] = useState<"ALL" | "MALE" | "FEMALE">("ALL");
  const [members, setMembers] = useState<any[]>([]);
  const [districtName, setDistrictName] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        
        const [membersRes, profileRes] = await Promise.all([
          fetch(`${API_BASE}/users/all`, {
            headers: { "Authorization": `Bearer ${token}` }
          }),
          fetch(`${API_BASE}/auth/profile`, {
            headers: { "Authorization": `Bearer ${token}` }
          })
        ]);

        const membersData = await membersRes.json();
        const profileData = await profileRes.json();

        if (membersRes.ok) {
          const approved = membersData.filter((u: any) => u.status === "APPROVED");
          setMembers(approved);
        }

        if (profileRes.ok && profileData.user?.district) {
          setDistrictName(profileData.user.district.name);
        }
      } catch (err) {
        console.error("Failed to fetch directory data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMembers = members.filter(m => {
    const matchesSearch = 
      m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.permanentId && m.permanentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      m.email.toLowerCase().includes(searchTerm.toLowerCase());
      
    const mGender = (m.gender || "MALE").toUpperCase();
    const matchesGender = genderFilter === "ALL" || mGender === genderFilter;

    return matchesSearch && matchesGender;
  });

  const handleExportCSV = () => {
    try {
      if (!filteredMembers || filteredMembers.length === 0) {
        alert("No data to export");
        return;
      }

      const headers = [
        "Full Name",
        "Role",
        "Gender",
        "Email",
        "Mobile Number",
        "District",
        "Taluk",
        "Permanent ID",
        "Joined Date"
      ];

      const rows = filteredMembers.map(m => {
        let createdDate = "-";
        try { createdDate = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "-"; } catch (e) {}

        return [
          m.fullName || "-",
          m.role || "-",
          m.gender || "-",
          m.email || "-",
          m.mobileNumber || "-",
          m.districtName || "-",
          m.talukName || "-",
          m.permanentId || "-",
          createdDate
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
      link.setAttribute("download", `members_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#FF7400]">Members List</h1>
          <p className="text-slate-600 text-[13px] font-medium mt-1">Manage all registered members in your location</p>
        </div>
        <div 
          className="p-[1.5px] rounded-[2px] shrink-0 inline-flex"
          style={{ background: 'linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)' }}
        >
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 font-bold rounded-[2px] hover:bg-slate-50 transition-all text-sm shadow-sm cursor-pointer"
          >
            <FileText size={18} className="stroke-[2.5]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Search Members"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[2px] focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 transition-all text-[13px] font-medium shadow-sm"
          />
        </div>
        <div className="flex gap-2 shrink-0 bg-slate-100 p-1.5 rounded-[2px]">
          {(["ALL", "MALE", "FEMALE"] as const).map(g => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-5 py-2 text-[13px] font-bold rounded-[2px] transition-all cursor-pointer ${
                genderFilter === g 
                  ? "bg-white text-[#FF7400] shadow-sm" 
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              }`}
            >
              {g === "ALL" ? "All Genders" : g === "MALE" ? "Male" : "Female"}
            </button>
          ))}
        </div>
      </div>

      {/* List Headers */}
      <div className="mt-4 hidden md:block">
        <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1.8fr_1fr_1fr_60px] gap-6 px-8 text-[#FF7400] font-black text-[14px] mb-4">
          <div>Member</div>
          <div>Temporary Id</div>
          <div>Role</div>
          <div>Contact</div>
          <div>Location</div>
          <div>Status</div>
          <div className="text-right"></div>
        </div>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-20 text-center flex flex-col items-center gap-4 bg-white rounded-2xl shadow-sm border border-slate-100">
            <Loader2 size={40} className="animate-spin text-[#FF7400]" />
            <p className="text-slate-400 font-medium">Loading directory...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-20 text-center text-slate-400 font-medium bg-white rounded-2xl shadow-sm border border-slate-100">
            No members found matching your search.
          </div>
        ) : (
          filteredMembers.map((member, idx) => (
            <motion.div 
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-[2px] shadow-sm hover:shadow-md transition-all p-4 px-8 flex flex-col md:grid md:grid-cols-[1.2fr_1.2fr_1fr_1.8fr_1fr_1fr_60px] md:items-center gap-6 border border-slate-100"
            >
              {/* Member */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-200 overflow-hidden text-slate-600 rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                  {member.profilePhoto ? <img src={member.profilePhoto} className="w-full h-full object-cover" /> : <Users size={16}/>}
                </div>
                <div>
                  <h4 className="font-medium text-slate-700 text-[13px]">{member.fullName}</h4>
                  <span className="text-[10px] font-bold text-slate-400">{(member.gender || "Male").toUpperCase()}</span>
                </div>
              </div>
              
              {/* Temporary ID */}
              <div>
                <p className="text-[12px] font-black text-black">
                  {member.permanentId || member.tempId}
                </p>
              </div>

              {/* Role */}
              <div>
                <span className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black text-[#FFDA00] inline-block text-center whitespace-pre-line leading-tight">
                  {member.role.replace("_", "\n")}
                </span>
              </div>

              {/* Contact */}
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
                  <Phone size={13} className="text-[#FF7400] stroke-[2] shrink-0" /> {member.mobileNumber}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 min-w-0">
                  <Mail size={13} className="text-[#FF7400] stroke-[2] shrink-0" /> <span className="truncate">{member.email}</span>
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-0.5">
                {member.assignedDistrict?.name && member.assignedDistrict?.name !== member.district?.name ? (
                  <>
                    <span className="text-[12px] text-slate-800 font-bold">
                      <span className="text-slate-400 font-medium mr-1 text-[10px]">WORK:</span>
                      {member.assignedDistrict.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      <span className="text-slate-400 font-medium mr-1 text-[10px]">NATIVE:</span>
                      {member.district?.name || "Chennai"}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-slate-600 font-medium">{member.talukName || member.districtName || "Chennai"}</span>
                )}
              </div>

              {/* Status */}
              <div>
                <span className="flex items-center gap-1.5 text-[12px] font-black text-red-600 uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                  ACTIVE
                </span>
              </div>

              {/* Action */}
              <div className="flex items-center justify-end">
                <button
                  onClick={() => {
                    setSelectedMember(member);
                    setIsDetailModalOpen(true);
                  }}
                  className="w-8 h-8 flex items-center justify-center border-[2px] border-slate-800 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <MoreHorizontal size={16} className="text-slate-800" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* ── Detail Modal for Approved Member ───────────────────────────────────── */}
      <AnimatePresence>
        {isDetailModalOpen && selectedMember && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto scrollbar-hide"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-100 text-[#FF7400] rounded-2xl flex items-center justify-center font-bold text-xl overflow-hidden relative">
                    {selectedMember.profilePhoto ? (
                      <img src={selectedMember.profilePhoto} alt={selectedMember.fullName} className="w-full h-full object-cover" />
                    ) : (
                      selectedMember.fullName.charAt(0)
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-slate-800">{selectedMember.fullName}</h3>
                    <p className="text-xs text-slate-500 font-medium">Approved {selectedMember.role.replace("_", " ")}</p>
                  </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer">
                  <X size={22} className="text-slate-500" />
                </button>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(selectedMember)
                    .filter(([k]) => !["password", "id", "district", "taluk", "districtId", "talukId"].includes(k))
                    .map(([key, val]: any) => {
                      const isUploadUrl = typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://") || val.includes("/uploads/"));
                      return (
                        <tr key={key} className="border-b border-slate-100 last:border-0">
                          <td className="py-3.5 pr-4 font-semibold text-slate-500 capitalize w-44">
                            {key.replace(/([A-Z])/g, " $1")}
                          </td>
                          <td className="py-3.5 text-slate-800 break-words">
                            {isUploadUrl ? (
                              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-150 w-fit animate-in fade-in duration-200">
                                {val.toLowerCase().endsWith(".pdf") ? (
                                  <div className="p-2.5 bg-red-50 text-red-500 rounded-lg">
                                    <FileText size={20} />
                                  </div>
                                ) : (
                                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                    <img src={val} alt="Preview" className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="flex flex-col gap-1 pr-2">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Document File</span>
                                  <div className="flex gap-2">
                                    <a 
                                      href={val} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:text-[#FF7400] hover:border-[#FF7400] rounded-md transition-all font-semibold text-xs shadow-sm"
                                    >
                                      <Eye size={12} />
                                      View
                                    </a>
                                    <a 
                                      href={val} 
                                      download
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#FF7400] text-white hover:bg-[#E56900] rounded-md transition-all font-bold text-xs shadow-sm"
                                    >
                                      <Download size={12} />
                                      Download
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ) : typeof val === "object" && val !== null ? (
                              (val as any).name || JSON.stringify(val)
                            ) : (
                              String(val ?? "-")
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
    </div>
  );
}
