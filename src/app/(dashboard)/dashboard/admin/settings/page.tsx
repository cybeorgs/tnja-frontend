"use client";

import React, { useEffect, useState } from "react";
import { 
  Save, 
  Settings, 
  CreditCard, 
  Loader2, 
  AlertCircle, 
  CheckCircle2,
  User,
  Users,
  Building2,
  BadgeCheck,
  MapPin
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function GlobalSettingsPage() {
  const [settings, setSettings] = useState({
    playerFee: 0,
    coachFee: 0,
    memberFee: 0,
    clubFee: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/global`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch settings");
      setSettings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/settings/global`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSuccess("Fees updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
        <p className="text-slate-500 font-medium">Loading settings...</p>
      </div>
    );
  }

  const feeItems = [
    { key: "playerFee", label: "Player Registration Fee", icon: User },
    { key: "coachFee", label: "Coach/Referee Registration Fee", icon: BadgeCheck },
    { key: "memberFee", label: "Member Registration Fee", icon: Users },
    { key: "clubFee", label: "Club Registration Fee", icon: Building2 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Global Settings</h1>
        <p className="text-slate-500">Manage registration fees and platform-wide configurations</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
      >
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
          <div className="p-2 bg-[#FF7400]/10 text-[#FF7400] rounded-lg">
            <CreditCard size={20} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Registration Fees (INR)</h2>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-xl flex items-center gap-3 border border-green-100">
            <CheckCircle2 size={20} />
            <span className="font-medium">{success}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {feeItems.map((item) => (
              <div key={item.key} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <item.icon size={16} className="text-[#FF7400]" />
                  {item.label}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input 
                    type="number"
                    value={(settings as any)[item.key]}
                    onChange={(e) => setSettings({ ...settings, [item.key]: parseFloat(e.target.value) })}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/20 focus:border-[#FF7400] transition-all font-bold text-slate-800"
                    placeholder="0.00"
                    required
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-[#FF7400] text-white rounded-xl font-bold hover:bg-orange-600 transition-all flex items-center gap-2 disabled:opacity-70 shadow-lg shadow-orange-500/20 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>

      <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
        <div className="flex gap-4">
          <div className="p-2 bg-orange-100 text-[#FF7400] rounded-lg h-fit">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="font-bold text-orange-800 mb-1">Important Notice</h3>
            <p className="text-orange-700 text-sm leading-relaxed">
              Updating these fees will immediately affect all new payment orders. Existing orders created but not yet paid will maintain the previous fee amount.
            </p>
          </div>
        </div>
      </div>

      <DistrictCodes />
    </div>
  );
}

interface District {
  id: string;
  name: string;
  code: string | null;
  playerIdSeq: number;
}

/** Next player ID a district will issue: CBE-A-001 … CBE-A-999, then CBE-B-001. */
function nextPlayerId(code: string, issued: number) {
  const seq = issued + 1;
  const series = String.fromCharCode(65 + Math.floor((seq - 1) / 999));
  return `${code || "???"}-${series}-${String(((seq - 1) % 999) + 1).padStart(3, "0")}`;
}

function DistrictCodes() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/districts`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load districts");
        setDistricts(data);
        setDrafts(Object.fromEntries(data.map((d: District) => [d.id, d.code || ""])));
      })
      .catch((err) => setMessage({ text: err.message, type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  const saveCode = async (district: District) => {
    setSavingId(district.id);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/admin/districts/${district.id}/code`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ code: drafts[district.id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save code");
      setDistricts((prev) => prev.map((d) => (d.id === district.id ? data.data : d)));
      setMessage({ text: data.message, type: "success" });
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const visible = districts.filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FF7400]/10 text-[#FF7400] rounded-lg">
            <MapPin size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">District Codes</h2>
            <p className="text-slate-500 text-sm">Prefix for Player IDs, e.g. CBE-A-001. Only Super Admin and CEO can change codes.</p>
          </div>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search district…"
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#FF7400] w-full sm:w-56"
        />
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${message.type === "success" ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-600 border-red-100"}`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="w-8 h-8 text-[#FF7400] animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-slate-400 font-medium">
          {districts.length === 0 ? "No districts found." : "No district matches your search."}
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {visible.map((d) => {
            const draft = drafts[d.id] ?? "";
            const changed = draft !== (d.code || "");
            return (
              <div key={d.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[140px]">
                  <p className="font-bold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-400">
                    {d.playerIdSeq} issued · next <span className="font-mono">{nextPlayerId(d.code || "", d.playerIdSeq)}</span>
                  </p>
                </div>
                <input
                  value={draft}
                  onChange={(e) => setDrafts({ ...drafts, [d.id]: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) })}
                  aria-label={`${d.name} code`}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-[#FF7400]"
                  placeholder="CODE"
                />
                <button
                  onClick={() => {
                    if (d.playerIdSeq > 0 && !confirm(`${d.name} has already issued ${d.playerIdSeq} Player IDs with code ${d.code}. New IDs will use ${draft}. Continue?`)) return;
                    saveCode(d);
                  }}
                  disabled={!changed || draft.length < 2 || savingId === d.id}
                  className="px-4 py-2 bg-[#FF7400] text-white rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-1.5"
                >
                  {savingId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
