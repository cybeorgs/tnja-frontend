"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, Search, UserPlus, Users, X } from "lucide-react";
import type { StudentSearchResult } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type District = { id: string; name: string };
type Taluk = { id: string; name: string };
type ClubOption = { id: string; name: string };
type CoachOption = { id: string; fullName: string };

const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 focus:border-[#FF7400]/50";
const labelCls = "block text-[10.5px] font-black text-slate-400 uppercase tracking-wide mb-1.5";

export function AddPlayerModal({
  tournamentId,
  onClose,
  onSuccess,
}: {
  tournamentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"search" | "create">("search");

  // ── Search-existing-player state ──────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selected, setSelected] = useState<StudentSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Shared registration fields ────────────────────────────────────────────
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [belt, setBelt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Create-new-player state ───────────────────────────────────────────────
  const [districts, setDistricts] = useState<District[]>([]);
  const [taluks, setTaluks] = useState<Taluk[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [talukId, setTalukId] = useState("");
  const [clubId, setClubId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");

  useEffect(() => {
    if (mode !== "create" || districts.length > 0) return;
    fetch(`${API_BASE}/districts`)
      .then((res) => (res.ok ? res.json() : []))
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, [mode, districts.length]);

  const handleDistrictChange = async (id: string) => {
    setDistrictId(id);
    setTalukId(""); setClubId(""); setCoachId("");
    setTaluks([]); setClubs([]); setCoaches([]);
    if (!id) return;
    try {
      const [talukRes, clubRes, coachRes] = await Promise.all([
        fetch(`${API_BASE}/districts/${id}/taluks`),
        fetch(`${API_BASE}/clubs?districtId=${id}`),
        fetch(`${API_BASE}/coaches?districtId=${id}`),
      ]);
      if (talukRes.ok) setTaluks(await talukRes.json());
      if (clubRes.ok) setClubs(await clubRes.json());
      if (coachRes.ok) setCoaches(await coachRes.json());
    } catch {
      // leave dropdowns empty — the selects just show no options, not fatal
    }
  };

  // ── Search-existing-player: debounced lookup ──────────────────────────────
  useEffect(() => {
    if (mode !== "search") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setDropdownOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/students/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setResults(res.ok ? (data.students || []) : []);
        setDropdownOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mode, query]);

  const pickStudent = (s: StudentSearchResult) => {
    setSelected(s);
    setWeight(s.weight || "");
    setHeight(s.height || "");
    setBelt(s.belt || "");
    setQuery("");
    setResults([]);
    setDropdownOpen(false);
    setErrorMsg("");
  };

  const submitRegistration = async (body: Record<string, unknown>) => {
    setSubmitting(true);
    setErrorMsg("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(data.error || "Failed to add player.");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddExisting = () => {
    if (!selected) return;
    submitRegistration({ studentId: selected.id, weight, height, belt });
  };

  const canCreate = fullName.trim() && gender && dob && aadhaarNumber.trim() && mobileNumber.trim() && districtId && talukId;

  const handleCreateAndAdd = () => {
    if (!canCreate) {
      setErrorMsg("Please fill in all required fields (marked *).");
      return;
    }
    submitRegistration({
      newPlayer: {
        fullName: fullName.trim(),
        gender,
        dob,
        aadhaarNumber: aadhaarNumber.trim(),
        mobileNumber: mobileNumber.trim(),
        email: email.trim() || undefined,
        districtId,
        talukId,
        clubId: clubId || undefined,
        coachId: coachId || undefined,
        schoolName: schoolName.trim() || undefined,
        bloodGroup: bloodGroup || undefined,
      },
      weight, height, belt,
    });
  };

  return createPortal(
    <div className="fixed inset-0 w-screen h-screen bg-slate-900/70 z-[999999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <Users size={18} className="text-[#FF7400]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Add Player</h2>
              <p className="text-xs text-slate-500 font-semibold">Attach an existing player, or register a brand-new one</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-700 p-1.5 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 pt-4">
          <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
            <button
              type="button"
              onClick={() => { setMode("search"); setErrorMsg(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                mode === "search" ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500"
              }`}
            >
              <Search size={13} /> Search Existing
            </button>
            <button
              type="button"
              onClick={() => { setMode("create"); setErrorMsg(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-black transition-all ${
                mode === "create" ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500"
              }`}
            >
              <UserPlus size={13} /> Create New Player
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-[13px] font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {errorMsg}
            </div>
          )}

          {mode === "search" ? (
            !selected ? (
              <div className="relative">
                <label className={labelCls}>Search Player — name or ID</label>
                <div className="relative">
                  <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (results.length) setDropdownOpen(true); }}
                    placeholder="Start typing... e.g. Arjun or TMP4F2A"
                    autoComplete="off"
                    className={`${inputCls} pl-10`}
                  />
                  {searching && <Loader2 size={17} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
                </div>
                {dropdownOpen && (
                  <div className="absolute z-10 top-[calc(100%+6px)] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                    {results.length === 0 ? (
                      <div className="px-4 py-3.5 text-[13px] font-bold text-slate-400">
                        {searching ? "Searching…" : `No player matches "${query}"`}
                      </div>
                    ) : (
                      results.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pickStudent(s)}
                          className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-orange-50/50 text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-orange-50 text-[#FF7400] flex items-center justify-center font-black text-xs shrink-0">
                            {s.name.split(" ").map((p) => p[0]).slice(-2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 text-[13.5px] truncate">{s.name}</p>
                            <p className="text-[11.5px] text-slate-400 font-bold truncate">{s.refId} · {s.club}, {s.district}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-400 font-semibold mt-2">Only approved players appear here. Use &quot;Create New Player&quot; if they&apos;re not registered in the system yet.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div>
                    <p className="font-black text-emerald-800 text-[15px]">{selected.name}</p>
                    <p className="text-[11.5px] text-emerald-600 font-bold">{selected.refId} · {selected.club}, {selected.district}</p>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="text-xs font-black text-[#FF7400]">
                    Change
                  </button>
                </div>
                <RegistrationFields weight={weight} setWeight={setWeight} height={height} setHeight={setHeight} belt={belt} setBelt={setBelt} />
              </>
            )
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Arjun Kumar" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                    <option value="">Select</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date of Birth *</label>
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Aadhaar Number *</label>
                  <input value={aadhaarNumber} onChange={(e) => setAadhaarNumber(e.target.value)} placeholder="12-digit number" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mobile Number *</label>
                  <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="10-digit number" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>District *</label>
                  <select value={districtId} onChange={(e) => handleDistrictChange(e.target.value)} className={inputCls}>
                    <option value="">Select district</option>
                    {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Taluk *</label>
                  <select value={talukId} onChange={(e) => setTalukId(e.target.value)} disabled={!districtId} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">{districtId ? "Select taluk" : "Select district first"}</option>
                    {taluks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Club (optional)</label>
                  <select value={clubId} onChange={(e) => setClubId(e.target.value)} disabled={!districtId} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">None</option>
                    {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Coach (optional)</label>
                  <select value={coachId} onChange={(e) => setCoachId(e.target.value)} disabled={!districtId} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">None</option>
                    {coaches.map((c) => <option key={c.id} value={c.id}>{c.fullName}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>School Name</label>
                  <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="optional" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Blood Group</label>
                  <input value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. O+" className={inputCls} />
                </div>
              </div>
              <div className="pt-1 border-t border-slate-100" />
              <RegistrationFields weight={weight} setWeight={setWeight} height={height} setHeight={setHeight} belt={belt} setBelt={setBelt} />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2.5">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-black text-[13px] bg-slate-100 text-slate-600">
            Cancel
          </button>
          {mode === "search" ? (
            <button
              type="button"
              onClick={handleAddExisting}
              disabled={!selected || submitting}
              className="px-6 py-2.5 rounded-xl font-black text-[13px] bg-[#FF7400] text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Add to Tournament
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreateAndAdd}
              disabled={!canCreate || submitting}
              className="px-6 py-2.5 rounded-xl font-black text-[13px] bg-[#FF7400] text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Create & Add to Tournament
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function RegistrationFields({
  weight, setWeight, height, setHeight, belt, setBelt,
}: {
  weight: string; setWeight: (v: string) => void;
  height: string; setHeight: (v: string) => void;
  belt: string; setBelt: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className={labelCls}>Weight (kg)</label>
        <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 48" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Height (cm)</label>
        <input value={height} onChange={(e) => setHeight(e.target.value)} placeholder="e.g. 160" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Belt</label>
        <input value={belt} onChange={(e) => setBelt(e.target.value)} placeholder="e.g. Blue" className={inputCls} />
      </div>
    </div>
  );
}
