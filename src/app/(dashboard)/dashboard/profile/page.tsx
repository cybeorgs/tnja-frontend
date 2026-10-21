"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Pencil,
  Save,
  X,
  Lock,
  BadgeCheck,
  Mail,
  Phone,
  MapPin,
  User,
  Trophy,
  Building2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MEMBER_ROLES = ["MEMBER", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"];

/** Fields each role may change here. Name, gender, mobile and email are verified at registration and stay locked. */
const EDITABLE: Record<string, { key: string; label: string; type?: "blood" }[]> = {
  COACH: [
    { key: "fatherName", label: "Father's name" },
    { key: "bloodGroup", label: "Blood group", type: "blood" },
  ],
  MEMBER: [
    { key: "fatherName", label: "Father's name" },
    { key: "bloodGroup", label: "Blood group", type: "blood" },
  ],
  CLUB: [
    { key: "president", label: "President" },
    { key: "secretary", label: "Secretary" },
    { key: "coach", label: "Coach" },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any>;

const roleLabel = (role: string) => role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function ProfilePage() {
  const [role, setRole] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load your profile");
        setRole(data.role || data.user?.role || localStorage.getItem("userRole") || "");
        setProfile(data.user);
      })
      .catch((err) => setError(err.message || "Could not load your profile"))
      .finally(() => setLoading(false));
  }, []);

  const editGroup = role === "COACH" ? "COACH" : role === "CLUB" ? "CLUB" : MEMBER_ROLES.includes(role) ? "MEMBER" : null;
  const editable = editGroup ? EDITABLE[editGroup] : [];

  const startEditing = () => {
    setForm(Object.fromEntries(editable.map((f) => [f.key, profile?.[f.key] ?? ""])));
    setMessage(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save your changes");
      setProfile((prev) => ({ ...prev, ...data.user }));
      setEditing(false);
      setMessage({ text: "Your profile has been updated.", type: "success" });
    } catch (err) {
      setMessage({ text: (err as Error).message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] gap-3 text-slate-400">
        <Loader2 size={28} className="animate-spin text-[#FF7400]" />
        <span className="text-sm font-semibold">Loading your profile…</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-slate-500 text-sm font-semibold">{error || "Profile not found"}</p>
        <button onClick={() => window.location.reload()} className="px-5 py-2.5 bg-[#FF7400] text-white font-bold rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isPlayer = role === "PLAYER";
  const isClub = role === "CLUB";
  const name = profile.fullName || profile.name || "—";
  const district = profile.assignedDistrict?.name || profile.district?.name;
  const address = [profile.address || profile.address1 || profile.addressLine1, profile.address2 || profile.addressLine2, profile.city, profile.state]
    .filter(Boolean).join(", ");
  const pincode = profile.addressPincode || profile.pincode;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Identity */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-orange-50 border-2 border-[#FF7400] text-[#FF7400] flex items-center justify-center text-2xl font-black shrink-0 overflow-hidden">
          {profile.profilePhoto ? <img src={profile.profilePhoto} alt="" className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 truncate">{name}</h1>
            <span className="px-2 py-0.5 rounded bg-[#FF7400] text-white text-[11px] font-black uppercase tracking-wide">{roleLabel(role || "User")}</span>
            {profile.status && !isSuperAdmin && (
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold uppercase">{profile.status.replace(/_/g, " ")}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-slate-500">
            {profile.email && <span className="inline-flex items-center gap-1.5"><Mail size={14} />{profile.email}</span>}
            {profile.mobileNumber && <span className="inline-flex items-center gap-1.5"><Phone size={14} />{profile.mobileNumber}</span>}
            {(district || isSuperAdmin) && <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{district || "Tamil Nadu"}</span>}
          </div>
        </div>
        {editable.length > 0 && !editing && (
          <button onClick={startEditing}
            className="self-start md:self-center inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-bold rounded-lg transition-colors">
            <Pencil size={15} /> Edit Profile
          </button>
        )}
      </section>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-semibold ${message.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-600"}`}>
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <section className="bg-white border-2 border-[#FF7400] rounded-xl p-6 space-y-5">
          <h2 className="text-sm font-black text-slate-800">Edit your details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {editable.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-bold text-slate-500">{f.label}</span>
                {f.type === "blood" ? (
                  <select value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#FF7400]">
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <input value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="mt-1 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#FF7400]" />
                )}
              </label>
            ))}
          </div>
          <p className="flex items-start gap-2 text-xs text-slate-500">
            <Lock size={13} className="mt-0.5 shrink-0" />
            Your name, gender, mobile number and email were verified when you registered and can only be changed by the TNJA office.
          </p>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white text-sm font-bold rounded-lg disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
            </button>
            <button onClick={() => setEditing(false)} disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50">
              <X size={15} /> Cancel
            </button>
          </div>
        </section>
      )}

      {isSuperAdmin && (
        <Notice>The Super Admin account is set up in the server configuration, so it has no editable profile here. To change its email or password, update the backend settings on the server.</Notice>
      )}
      {isPlayer && (
        <Notice>
          To change your details, send an edit request from your <Link href="/dashboard/player" className="font-bold text-[#FF7400] hover:underline">player dashboard</Link>. Your coach approves it before you can edit.
        </Notice>
      )}

      {!isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card title="Membership" icon={<BadgeCheck size={16} />}>
            <Field label={isPlayer ? "Player ID" : isClub ? "Club ID" : "Permanent ID"} value={profile.permanentId} mono emptyText="Not issued yet" />
            <Field label="Temporary ID" value={profile.tempId} mono />
            <Field label="Valid until" value={fmtDate(profile.validUntil)} />
            <Field label="Approved on" value={fmtDate(profile.approvedAt)} />
          </Card>

          <Card title={isClub ? "Club details" : "Personal details"} icon={isClub ? <Building2 size={16} /> : <User size={16} />}>
            {isClub ? (
              <>
                <Field label="President" value={profile.president} />
                <Field label="Secretary" value={profile.secretary} />
                <Field label="Coach" value={profile.coach} />
                <Field label="Students" value={profile.noOfStudents} />
              </>
            ) : (
              <>
                <Field label="Date of birth" value={fmtDate(profile.dob)} />
                <Field label="Age" value={profile.age ? `${profile.age} years` : ""} />
                <Field label="Gender" value={profile.gender ? roleLabel(profile.gender) : ""} />
                <Field label="Blood group" value={profile.bloodGroup} />
                {"fatherName" in profile && <Field label="Father's name" value={profile.fatherName} />}
                <Field label="Nationality" value={profile.nationality} />
              </>
            )}
          </Card>

          <Card title="Address" icon={<MapPin size={16} />}>
            <Field label="Address" value={address} wide />
            <Field label="Pincode" value={pincode} />
            <Field label="District" value={district} />
            <Field label="Taluk" value={profile.taluk?.name} />
          </Card>

          {isPlayer && (
            <Card title="Judo" icon={<Trophy size={16} />}>
              <Field label="Club" value={profile.club?.name} emptyText="Independent" />
              <Field label="Coach" value={profile.coach?.fullName} emptyText="No coach assigned" />
              <Field label="Belt" value={profile.belt} />
              <Field label="Height / Weight" value={[profile.height && `${profile.height} cm`, profile.weight && `${profile.weight} kg`].filter(Boolean).join(" · ")} />
              <Field label="Record (W / L / D)" value={`${profile.wins ?? 0} / ${profile.losses ?? 0} / ${profile.draws ?? 0}`} />
            </Card>
          )}

          {role === "COACH" && (
            <Card title="Judo" icon={<Trophy size={16} />}>
              <Field label="Present grade" value={profile.presentGradeInJudo} />
              <Field label="Club" value={profile.club?.name} emptyText="Independent" />
              <Field label="History in judo" value={profile.historyInJudo} wide />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-black text-slate-800 mb-4">
        <span className="text-[#FF7400]">{icon}</span>{title}
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">{children}</dl>
    </section>
  );
}

interface FieldProps {
  label: string;
  value?: string | number | null;
  mono?: boolean;
  wide?: boolean;
  emptyText?: string;
}

function Field({ label, value, mono, wide, emptyText = "—" }: FieldProps) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className={`text-sm mt-0.5 break-words ${empty ? "text-slate-400" : "font-semibold text-slate-800"} ${mono && !empty ? "font-mono" : ""}`}>
        {empty ? emptyText : value}
      </dd>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
      <Lock size={15} className="mt-0.5 shrink-0 text-slate-400" />
      <p>{children}</p>
    </div>
  );
}
