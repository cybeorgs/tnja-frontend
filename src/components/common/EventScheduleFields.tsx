"use client";

import React from "react";

/** Inclusive day count between two yyyy-mm-dd dates (same day = 1); 0 when unknown or reversed. */
export function eventDayCount(from?: string | null, to?: string | null): number {
  if (!from) return 0;
  const start = new Date(String(from).slice(0, 10));
  const end = new Date(String(to || from).slice(0, 10));
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** e.g. "12 March 2026" or "12 March 2026 – 14 March 2026 · 3 days". */
export function eventDateRangeLabel(from: string, to?: string | null): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const days = eventDayCount(from, to);
  return days > 1 && to ? `${fmt(from)} – ${fmt(to)} · ${days} days` : fmt(from);
}

export const EVENT_GENDER_OPTIONS = [
  { id: "BOTH", label: "Both (Male & Female)" },
  { id: "MALE", label: "Male" },
  { id: "FEMALE", label: "Female" },
];

export const eventGenderLabel = (gender?: string | null) =>
  gender === "MALE" ? "Male" : gender === "FEMALE" ? "Female" : "Male & Female";

interface EventScheduleFieldsProps {
  date: string;
  endDate: string;
  onChange: (next: { date: string; endDate: string }) => void;
  labelClassName: string;
  inputClassName: string;
}

/**
 * From date, end date and the derived number of days. Rendered as grid cells,
 * so it drops straight into the event form's two-column grid.
 */
export default function EventScheduleFields({ date, endDate, onChange, labelClassName, inputClassName }: EventScheduleFieldsProps) {
  const today = new Date().toISOString().split("T")[0];
  const days = eventDayCount(date, endDate);

  return (
    <>
      <div>
        <label className={labelClassName}>From Date</label>
        <input
          type="date"
          required
          min={today}
          value={date}
          // Keep the end date valid when the start moves past it.
          onChange={(e) => onChange({ date: e.target.value, endDate: endDate && endDate < e.target.value ? e.target.value : endDate })}
          className={inputClassName}
        />
      </div>

      <div>
        <label className={labelClassName}>End Date</label>
        <input
          type="date"
          required
          min={date || today}
          value={endDate}
          onChange={(e) => onChange({ date, endDate: e.target.value })}
          className={inputClassName}
        />
      </div>

      <div>
        <label className={labelClassName}>Number of Days</label>
        <input
          type="text"
          readOnly
          tabIndex={-1}
          value={days ? `${days} day${days > 1 ? "s" : ""}` : "—"}
          aria-label="Number of days (calculated from the dates)"
          className={`${inputClassName} bg-slate-50! text-slate-500! cursor-default`}
        />
      </div>
    </>
  );
}
