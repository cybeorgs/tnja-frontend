"use client";

/**
 * Entry fee for the create / edit tournament forms, with a Free option.
 * The value is the fee in rupees as typed; "0" means a free tournament (players register without paying).
 */
export default function EntryFeeField({ value, onChange, inputClassName }: {
  value: string;
  onChange: (fee: string) => void;
  inputClassName: string;
}) {
  const isFree = value === "0";
  const pill = (on: boolean) =>
    `flex-1 rounded-lg px-4 py-2 text-sm font-bold transition-all ${on ? "bg-[#FF7400] text-white shadow" : "text-slate-500 hover:text-slate-800"}`;

  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Fee *</label>
      <div className="mb-2 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label="Entry fee">
        <button type="button" role="radio" aria-checked={!isFree} className={pill(!isFree)} onClick={() => isFree && onChange("")}>
          Paid
        </button>
        <button type="button" role="radio" aria-checked={isFree} className={pill(isFree)} onClick={() => onChange("0")}>
          Free
        </button>
      </div>
      {isFree ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Free tournament: players register without paying.
        </p>
      ) : (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-slate-400">₹</span>
          <input
            required
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={value}
            placeholder="e.g. 500"
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))}
            className={`${inputClassName} !pl-9`}
          />
        </div>
      )}
    </div>
  );
}
