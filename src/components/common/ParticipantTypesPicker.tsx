"use client";

import React from "react";
import { Check } from "lucide-react";

export const PARTICIPANT_OPTIONS = [
  { id: "STUDENT", label: "Players" },
  { id: "COACH", label: "Coaches" },
  { id: "MEMBER", label: "Administrative Members" },
  { id: "CLUB", label: "Clubs" },
];

/** An event's eligible groups; older events only carry the single participantType. */
export function eventParticipantTypes(event: { participantTypes?: string[]; participantType?: string }): string[] {
  const list = event.participantTypes?.length ? event.participantTypes : [event.participantType || "ALL"];
  return list.includes("ALL") ? ["ALL"] : list;
}

/** "Everyone", or the chosen groups joined, e.g. "Players, Coaches". */
export function participantTypesLabel(types: string[]): string {
  if (types.length === 0 || types.includes("ALL")) return "Everyone";
  return types.map((t) => PARTICIPANT_OPTIONS.find((o) => o.id === t)?.label ?? t).join(", ");
}

interface ParticipantTypesPickerProps {
  value: string[];
  onChange: (types: string[]) => void;
}

/**
 * Multi-select for eligible participants. "Everyone" and the specific groups are
 * mutually exclusive: picking one group clears "Everyone", and clearing every
 * group (or picking all of them) falls back to "Everyone".
 */
export default function ParticipantTypesPicker({ value, onChange }: ParticipantTypesPickerProps) {
  const everyone = value.length === 0 || value.includes("ALL");

  const toggle = (id: string) => {
    const current = everyone ? [] : value;
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    onChange(next.length === 0 || next.length === PARTICIPANT_OPTIONS.length ? ["ALL"] : next);
  };

  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
      active ? "border-[#FF7400] bg-orange-50 text-[#C45A00]" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
    }`;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Eligible participants">
      <button type="button" aria-pressed={everyone} onClick={() => onChange(["ALL"])} className={chip(everyone)}>
        {everyone && <Check size={14} className="stroke-[3]" />} Everyone
      </button>
      {PARTICIPANT_OPTIONS.map((o) => {
        const active = !everyone && value.includes(o.id);
        return (
          <button key={o.id} type="button" aria-pressed={active} onClick={() => toggle(o.id)} className={chip(active)}>
            {active && <Check size={14} className="stroke-[3]" />} {o.label}
          </button>
        );
      })}
    </div>
  );
}
