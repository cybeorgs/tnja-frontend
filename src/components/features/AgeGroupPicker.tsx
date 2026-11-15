"use client";

import { AGE_GROUPS, type Gender } from "@/utils/tournamentCategories";

/**
 * Age-group selector for the create / edit tournament forms. Shows each group's ages, the birth years
 * they cover for the chosen start date (age = tournament year − birth year), play-up rules, and the
 * men's and women's weight classes.
 */
export default function AgeGroupPicker({ value, onChange, tournamentDate, gender = "BOTH" }: {
  value: string[];
  onChange: (next: string[]) => void;
  /** Start date (YYYY-MM-DD); used to show birth years. */
  tournamentDate?: string;
  /** Tournament gender, to show only the relevant weight classes. */
  gender?: string;
}) {
  const selected = Array.isArray(value) ? value : [];
  const year = tournamentDate && /^\d{4}/.test(tournamentDate) ? Number(tournamentDate.slice(0, 4)) : null;
  const allSelected = AGE_GROUPS.every((g) => selected.includes(g.name));
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : AGE_GROUPS.map((g) => g.name).filter((n) => n === name || selected.includes(n)));
  const genders: Gender[] = gender === "MALE" ? ["MALE"] : gender === "FEMALE" ? ["FEMALE"] : ["MALE", "FEMALE"];
  const classes = (g: (typeof AGE_GROUPS)[number], sex: Gender) => {
    const l = g.weights[sex];
    return [...l.map((x) => `-${x}`), `+${l[l.length - 1]}`].join(", ") + " kg";
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(allSelected ? [] : AGE_GROUPS.map((g) => g.name))}
        aria-pressed={allSelected}
        className={`mb-3 inline-flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${
          allSelected ? "border-[#FF7400] bg-[#FF7400] text-white" : "border-dashed border-[#FF7400]/50 bg-orange-50 text-[#FF7400] hover:border-[#FF7400]"
        }`}
      >
        All age groups
        <span className={`text-xs ${allSelected ? "text-white/80" : "text-[#FF7400]/70"}`}>{selected.length}/{AGE_GROUPS.length}</span>
      </button>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {AGE_GROUPS.map((g) => {
          const on = selected.includes(g.name);
          const open = g.maxAge >= 100;
          const ages = open ? `${g.minAge}+ yrs` : `${g.minAge}–${g.maxAge} yrs`;
          const born = year ? (open ? `Born ${year - g.minAge} or earlier` : `Born ${year - g.maxAge}–${year - g.minAge}`) : "";
          const playUp = g.playUpFrom !== undefined && g.playUpFrom < g.minAge ? `From ${g.playUpFrom} yrs can play up` : "";
          return (
            <button
              type="button"
              key={g.name}
              onClick={() => toggle(g.name)}
              aria-pressed={on}
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-all ${
                on ? "border-[#FF7400] bg-[#FF7400] text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-[#FF7400]/30 hover:bg-slate-100"
              }`}
            >
              <span className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-bold leading-snug">{g.name.replace(" Age Group ", " · Group ")}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${on ? "bg-white/20 text-white" : "bg-white text-slate-600"}`}>{ages}</span>
              </span>
              {born && <span className={`text-xs ${on ? "text-white/85" : "text-slate-500"}`}>{born}</span>}
              {playUp && <span className={`text-[11px] font-semibold ${on ? "text-white/80" : "text-emerald-700"}`}>{playUp}</span>}
              {genders.map((sex) => (
                <span key={sex} className={`text-[11px] ${on ? "text-white/75" : "text-slate-400"}`}>
                  {sex === "MALE" ? "Men" : "Women"}: {classes(g, sex)}
                </span>
              ))}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Age = tournament year minus birth year{year ? ` (${year})` : " — pick the start date to see birth years"}. Month and day of birth don&apos;t count.
      </p>
    </div>
  );
}
