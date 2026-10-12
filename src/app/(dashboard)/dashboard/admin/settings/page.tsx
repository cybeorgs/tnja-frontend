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
  BadgeCheck
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
    </div>
  );
}
