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
  MapPin,
  Map as MapIcon,
  Pencil,
  X,
  Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { RankingPointsConfig } from "./RankingPointsConfig";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type ConfigTab = "fees" | "points" | "codes" | "zones";

const CONFIG_TABS: { id: ConfigTab; label: string; icon: typeof CreditCard }[] = [
  { id: "fees", label: "Registration Fees", icon: CreditCard },
  { id: "points", label: "Ranking Points", icon: Trophy },
  { id: "codes", label: "District Codes", icon: MapPin },
  { id: "zones", label: "Zone Names", icon: MapIcon },
];

export default function ConfigurationPage() {
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
  const [tab, setTab] = useState<ConfigTab>("fees");

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
    { key: "coachFee", label: "Coach Registration Fee", icon: BadgeCheck },
    { key: "memberFee", label: "Administrative Member Registration Fee", icon: Users },
    { key: "clubFee", label: "Club Registration Fee", icon: Building2 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div role="tablist" aria-label="Configuration sections" className="flex bg-white p-1 rounded-2xl border border-slate-200 overflow-x-auto">
        {CONFIG_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              tab === id ? "bg-[#FF7400] text-white shadow-lg shadow-orange-500/20" : "text-slate-500 hover:bg-slate-50"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {tab === "points" && <RankingPointsConfig />}
      {tab === "codes" && <DistrictCodes />}
      {tab === "zones" && <ZoneNames />}

      {tab === "fees" && (
      <>
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
      </>
      )}
    </div>
  );
}

interface District {
  id: string;
  name: string;
  code: string | null;
  /** IDs issued so far under the current code, per type code. */
  idSeq?: Partial<Record<IdType, number>>;
  zoneName: string | null;
}

type IdType = "STU" | "MEM" | "CLB" | "COH";

const ID_TYPES: { type: IdType; label: string }[] = [
  { type: "STU", label: "Players" },
  { type: "MEM", label: "Members" },
  { type: "CLB", label: "Clubs" },
  { type: "COH", label: "Coaches" },
];

/** Next ID a district will issue for a type: CBE-STU-A001 … CBE-STU-A999, then CBE-STU-B001. */
function nextPermanentId(code: string, type: IdType, issued: number) {
  const seq = issued + 1;
  const series = String.fromCharCode(65 + Math.floor((seq - 1) / 999));
  return `${code || "???"}-${type}-${series}${String(((seq - 1) % 999) + 1).padStart(3, "0")}`;
}

const totalIssued = (d: District) => ID_TYPES.reduce((sum, { type }) => sum + (d.idSeq?.[type] ?? 0), 0);

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
            <p className="text-slate-500 text-sm">Prefix for permanent IDs: CBE-STU-A001 (player), CBE-MEM-A001 (member), CBE-CLB-A001 (club), CBE-COH-A001 (coach). Only Super Admin and CEO can change codes.</p>
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
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    {ID_TYPES.map(({ type, label }) => {
                      const issued = d.idSeq?.[type] ?? 0;
                      return (
                        <span key={type} title={`${issued} ${label} IDs issued`}>
                          next <span className="font-mono text-slate-500">{nextPermanentId(d.code || "", type, issued)}</span>
                        </span>
                      );
                    })}
                  </div>
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
                    if (totalIssued(d) > 0 && !confirm(`${d.name} has already issued ${totalIssued(d)} IDs with code ${d.code}. Those IDs stay as they are; new IDs will use ${draft}. Continue?`)) return;
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

const NEW_ZONE = "__new__";

/** Zones are named groups of districts; zone officers and zonal events/tournaments follow them. */
function ZoneNames() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [newZoneFor, setNewZoneFor] = useState<{ districtId: string; name: string } | null>(null);

  const load = () =>
    fetch(`${API_BASE}/districts`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load districts");
        setDistricts(data);
      })
      .catch((err) => setMessage({ text: err.message, type: "error" }))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const call = async (key: string, path: string, body: object) => {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setMessage({ text: data.message, type: "success" });
      await load();
      return true;
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to save", type: "error" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const moveDistrict = async (d: District, zoneName: string) => {
    if (zoneName === NEW_ZONE) return setNewZoneFor({ districtId: d.id, name: "" });
    if (!confirm(`Move ${d.name} to ${zoneName}? Its zone officers and zonal events/tournaments will follow the new zone.`)) return;
    await call(d.id, `/admin/districts/${d.id}/zone`, { zoneName });
  };

  const zones = Array.from(new Set(districts.map((d) => d.zoneName).filter(Boolean) as string[])).sort();
  const groups = [
    ...zones.map((zone) => ({ zone, list: districts.filter((d) => d.zoneName === zone) })),
    { zone: null as string | null, list: districts.filter((d) => !d.zoneName) },
  ].filter((g) => g.list.length > 0);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="p-2 bg-[#FF7400]/10 text-[#FF7400] rounded-lg">
          <MapIcon size={20} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Zone Names</h2>
          <p className="text-slate-500 text-sm">
            Rename a zone, or move a district to another zone. Renaming also updates that zone&apos;s events and tournaments. Only Super Admin and CEO can change zones.
          </p>
        </div>
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
      ) : (
        <div className="space-y-6">
          {groups.map(({ zone, list }) => (
            <section key={zone ?? "none"} className="rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                {zone && renaming?.from === zone ? (
                  <form
                    className="flex flex-wrap items-center gap-2 w-full"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await call(`zone:${zone}`, "/admin/zones/rename", { from: zone, to: renaming.to })) setRenaming(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.to}
                      onChange={(e) => setRenaming({ from: zone, to: e.target.value })}
                      aria-label={`New name for ${zone}`}
                      maxLength={40}
                      className="flex-1 min-w-[160px] px-3 py-2 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-[#FF7400]"
                    />
                    <button
                      type="submit"
                      disabled={busy === `zone:${zone}` || renaming.to.trim().length < 2 || renaming.to.trim() === zone}
                      className="px-4 py-2 bg-[#FF7400] text-white rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                    >
                      {busy === `zone:${zone}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Rename
                    </button>
                    <button type="button" onClick={() => setRenaming(null)} aria-label="Cancel rename" className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X size={16} />
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="font-bold text-slate-800">
                      {zone ?? <span className="text-amber-600">No zone</span>}
                      <span className="ml-2 text-xs font-medium text-slate-400">{list.length} district{list.length === 1 ? "" : "s"}</span>
                    </p>
                    {zone && (
                      <button
                        onClick={() => setRenaming({ from: zone, to: zone })}
                        className="flex items-center gap-1.5 text-sm font-bold text-[#FF7400] hover:text-orange-600 cursor-pointer"
                      >
                        <Pencil size={14} /> Rename zone
                      </button>
                    )}
                  </>
                )}
              </div>

              <div className="divide-y divide-slate-100">
                {list.map((d) => (
                  <div key={d.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                    <p className="flex-1 min-w-[140px] font-semibold text-slate-700">{d.name}</p>
                    {newZoneFor?.districtId === d.id ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (await call(d.id, `/admin/districts/${d.id}/zone`, { zoneName: newZoneFor.name })) setNewZoneFor(null);
                        }}
                      >
                        <input
                          autoFocus
                          value={newZoneFor.name}
                          onChange={(e) => setNewZoneFor({ districtId: d.id, name: e.target.value })}
                          placeholder="New zone name"
                          aria-label={`New zone for ${d.name}`}
                          maxLength={40}
                          className="w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold focus:outline-none focus:border-[#FF7400]"
                        />
                        <button
                          type="submit"
                          disabled={busy === d.id || newZoneFor.name.trim().length < 2}
                          className="px-3 py-2 bg-[#FF7400] text-white rounded-lg text-sm font-bold disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                        >
                          {busy === d.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          Save
                        </button>
                        <button type="button" onClick={() => setNewZoneFor(null)} aria-label="Cancel" className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                          <X size={16} />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        {busy === d.id && <Loader2 size={14} className="animate-spin text-[#FF7400]" />}
                        <select
                          value={d.zoneName ?? ""}
                          disabled={busy === d.id}
                          onChange={(e) => moveDistrict(d, e.target.value)}
                          aria-label={`Zone for ${d.name}`}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#FF7400] cursor-pointer"
                        >
                          {!d.zoneName && <option value="">Select zone…</option>}
                          {zones.map((z) => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                          <option value={NEW_ZONE}>+ New zone…</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
