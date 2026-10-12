"use client";

import React, { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Loader2 } from "lucide-react";

const Field = ({
  label,
  value,
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
  onChange?: (v: string) => void;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-slate-500">{label}</label>
    <input
      type="text"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium text-slate-700 focus:outline-none transition-all ${
        readOnly
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : "bg-white border-slate-200 focus:border-[#FF7400] focus:ring-2 focus:ring-[#FF7400]/10"
      }`}
    />
  </div>
);

export default function PlayerProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

  useEffect(() => {
    setUserRole(localStorage.getItem("userRole") || "");
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setProfileData(data.user);
        setFormData(buildForm(data.user));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const buildForm = (u: any) => {
    const full: string = u?.fullName || "";
    const spaceIdx = full.indexOf(" ");
    return {
      firstName: spaceIdx > -1 ? full.slice(0, spaceIdx) : full,
      lastName: spaceIdx > -1 ? full.slice(spaceIdx + 1) : "",
      tempId: u?.tempId || "",
      fatherName: u?.fatherName || "",
      age: u?.age ? String(u.age) : "",
      bloodGroup: u?.bloodGroup || "",
      dob: u?.dob ? formatDate(u.dob) : "",
      gender: u?.gender || "",
      height: u?.height || "",
      weight: u?.weight || "",
      mobileNumber: u?.mobileNumber || "",
      email: u?.email || "",
      city: u?.city || u?.district?.name || "",
    };
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const payload = {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        fatherName: formData.fatherName,
        bloodGroup: formData.bloodGroup,
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        mobileNumber: formData.mobileNumber,
      };
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.user || { ...profileData, ...payload };
        setProfileData(updated);
        setFormData(buildForm(updated));
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = (role: string) => {
    if (role.includes("PRESIDENT")) return "PRESIDENT";
    if (role.includes("SECRETARY")) return "SECRETARY";
    if (role === "SUPER_ADMIN") return "SUPER ADMIN";
    if (role === "CEO") return "CEO";
    return role.replace(/_/g, " ");
  };

  const set = (key: string) => (v: string) =>
    setFormData((p: any) => ({ ...p, [key]: v }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#FF7400]" size={36} />
      </div>
    );
  }

  const displayName =
    profileData?.fullName ||
    `${formData.firstName || ""} ${formData.lastName || ""}`.trim() ||
    "—";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Profile Card ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #FF7400 0%, #FFB020 100%)",
          padding: "2px",
          borderRadius: "18px",
        }}
      >
        <div className="bg-white rounded-[16px] p-6 relative">
          {/* Role badge */}
          <div className="absolute top-4 left-4">
            <span
              style={{ backgroundColor: "#FF7400" }}
              className="text-white text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg"
            >
              {getRoleLabel(userRole)}
            </span>
          </div>

          {/* Edit Profile button */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:border-[#FF7400] hover:text-[#FF7400] transition-all"
            >
              Edit Profile
            </button>
          </div>

          {/* Avatar + name */}
          <div className="flex flex-col items-center pt-6 pb-4">
            <div
              style={{
                background: "linear-gradient(135deg, #FF7400, #FFB020)",
                padding: "3px",
                borderRadius: "9999px",
              }}
            >
              <div className="w-24 h-24 rounded-full bg-white overflow-hidden flex items-center justify-center">
                {profileData?.profilePhoto ? (
                  <img
                    src={profileData.profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-black text-[#FF7400]">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">{displayName}</h2>
            <p className="text-sm text-slate-400 font-semibold mt-0.5">
              {profileData?.permanentId || profileData?.tempId || "—"}
            </p>
          </div>

          {/* Contact row */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-around flex-wrap gap-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail size={15} className="text-slate-400" />
              <span>{profileData?.email || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone size={15} className="text-slate-400" />
              <span>{profileData?.mobileNumber || "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin size={15} className="text-slate-400" />
              <span>
                {profileData?.city || profileData?.district?.name || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Form ── */}
      {isEditing && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <h3 className="text-base font-bold text-[#FF7400]">Personal Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="First Name" value={formData.firstName} onChange={set("firstName")} />
            <Field label="Last Name" value={formData.lastName} onChange={set("lastName")} />
            <Field label="Student ID (Temporary ID)" value={formData.tempId} readOnly />
            <Field label="Father's Name" value={formData.fatherName} onChange={set("fatherName")} />
            <Field label="Age" value={formData.age} readOnly />
            <Field label="Blood Group" value={formData.bloodGroup} onChange={set("bloodGroup")} />
            <Field label="D.O.B" value={formData.dob} readOnly />
            <Field label="Gender" value={formData.gender} onChange={set("gender")} />
            <Field label="Height" value={formData.height} onChange={set("height")} />
            <Field label="Weight" value={formData.weight} onChange={set("weight")} />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData(buildForm(profileData));
              }}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ backgroundColor: "#FF7400" }}
              className="px-5 py-2.5 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-all disabled:opacity-60 shadow-lg shadow-orange-200 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
