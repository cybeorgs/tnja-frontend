"use client";

import { useState } from "react";
import { Building2, Check, Loader2, MapPin, Pencil } from "lucide-react";
import type { RegisteredPlayer } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

/**
 * Who the player plays for in this tournament: a district (may differ from the one on their
 * address) or a unit. Confirmed at weigh-in; prefilled with their home district until then.
 */
export function RepresentingBox({
  tournamentId,
  player,
  districts,
  units,
  disabled,
  onSaved,
  showToast,
}: {
  tournamentId: string;
  player: RegisteredPlayer;
  districts: string[];
  units: string[];
  disabled?: boolean;
  onSaved: (unitName?: string) => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const confirmed = player.representing === "DISTRICT" || player.representing === "UNIT";
  const [editing, setEditing] = useState(!confirmed);
  const [kind, setKind] = useState<"DISTRICT" | "UNIT">(player.representing === "UNIT" ? "UNIT" : "DISTRICT");
  const [district, setDistrict] = useState(player.representingDistrict || player.district || "");
  const [unit, setUnit] = useState(player.representingUnit || "");
  const [saving, setSaving] = useState(false);

  const value = kind === "DISTRICT" ? district : unit.trim();
  const listId = `units-${player.regId}`;

  const save = async () => {
    if (!player.regId || !value) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/${player.regId}/representing`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ representing: kind, district: kind === "DISTRICT" ? district : "", unit: kind === "UNIT" ? unit : "" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save");
      showToast(`${player.name}: ${data.message}`);
      setEditing(false);
      onSaved(kind === "UNIT" ? data.representingUnit : undefined);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save", false);
    } finally {
      setSaving(false);
    }
  };

  if (confirmed && !editing) {
    const isUnit = player.representing === "UNIT";
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg max-w-[16rem]" title="Representing">
          {isUnit ? <Building2 size={13} className="text-slate-500 shrink-0" /> : <MapPin size={13} className="text-slate-500 shrink-0" />}
          <span className="truncate">{isUnit ? player.representingUnit : `${player.representingDistrict} district`}</span>
          <Check size={13} className="text-emerald-600 shrink-0" />
        </span>
        {!disabled && (
          <button onClick={() => setEditing(true)} aria-label="Change representing" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <Pencil size={13} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Represents</span>
      <div className="inline-flex bg-slate-100 rounded-lg p-0.5" role="radiogroup" aria-label="Represents">
        {(["DISTRICT", "UNIT"] as const).map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            disabled={disabled || saving}
            className={`px-2.5 py-1 rounded-md text-xs font-black transition-colors ${kind === k ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {k === "DISTRICT" ? "District" : "Unit"}
          </button>
        ))}
      </div>
      {kind === "DISTRICT" ? (
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          disabled={disabled || saving}
          aria-label="District represented"
          className="w-40 px-2.5 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-none focus:border-[#FF7400]"
        >
          <option value="">Select district</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      ) : (
        <>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            list={listId}
            disabled={disabled || saving}
            placeholder="Unit name"
            aria-label="Unit represented"
            className="w-40 px-2.5 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:border-[#FF7400]"
          />
          <datalist id={listId}>{units.map((u) => <option key={u} value={u} />)}</datalist>
        </>
      )}
      <button
        onClick={save}
        disabled={disabled || saving || !value}
        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-40 inline-flex items-center gap-1"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {confirmed ? "Save" : "Confirm"}
      </button>
      {confirmed && (
        <button onClick={() => setEditing(false)} disabled={saving} className="text-xs font-bold text-slate-400 hover:text-slate-700 px-1">Cancel</button>
      )}
    </div>
  );
}
