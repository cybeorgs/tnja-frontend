"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

interface MeritCertificateNoInputProps {
  tournamentId: string;
  regId: string;
  value: string;
  /** Called with the saved value so the parent's player list stays in sync. */
  onSaved: (value: string) => void;
  onMessage: (text: string, ok: boolean) => void;
}

/** Merit (1st–3rd) certificate number, typed by the organiser and saved when the field loses focus. */
export function MeritCertificateNoInput({ tournamentId, regId, value, onSaved, onMessage }: MeritCertificateNoInputProps) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const save = async () => {
    const next = draft.trim();
    if (next === value) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${regId}/certificate-no`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ meritCertificateNo: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save certificate number");
      const saved = data.meritCertificateNo ?? "";
      setDraft(saved);
      onSaved(saved);
      if (data.warning) onMessage(data.warning, false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setDraft(value);
      onMessage(err instanceof Error ? err.message : "Failed to save certificate number", false);
    } finally {
      setSaving(false);
    }
  };

  const missing = !draft.trim();
  return (
    <label className="relative flex items-center" title="Merit certificate number (printed on the certificate)">
      <span className="sr-only">Merit certificate number</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder="Cert No."
        maxLength={40}
        className={`w-[92px] rounded-lg border px-2 py-1 pr-6 text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100 ${
          missing ? "border-amber-300 bg-amber-50 placeholder:text-amber-500" : "border-slate-200 bg-white text-slate-700"
        } focus:border-[#FF7400]`}
      />
      <span className="pointer-events-none absolute right-1.5">
        {saving ? <Loader2 size={12} className="animate-spin text-slate-400" /> : justSaved ? <Check size={12} className="text-emerald-500" /> : null}
      </span>
    </label>
  );
}
