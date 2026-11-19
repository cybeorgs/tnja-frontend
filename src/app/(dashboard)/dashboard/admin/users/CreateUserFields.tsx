"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { PincodeHint } from "@/components/features/registers/usePincodeLookup";

export type CreateType = "STUDENT" | "COACH" | "CLUB" | "MEMBER";

/** Live duplicate-check state for email / mobile / Aadhaar. */
export type DupState = { status: "idle" | "checking" | "ok" | "taken"; message?: string };

const TYPE_TABS: { key: CreateType; label: string }[] = [
  { key: "STUDENT", label: "Player" },
  { key: "COACH", label: "Coach" },
  { key: "CLUB", label: "Club" },
  { key: "MEMBER", label: "Member" },
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const inputBase =
  "w-full h-11 px-3.5 rounded-xl border bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal transition-colors focus:outline-none focus:ring-2";
const inputOk = "border-slate-200 hover:border-slate-300 focus:border-[#FF7400] focus:ring-orange-100";
const inputBad = "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-red-100";

// ── Building blocks ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <div className="mb-4">
        <h4 className="text-sm font-black text-slate-800">{title}</h4>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">{children}</div>
    </section>
  );
}

function FieldShell({ label, required, error, hint, span, children }: {
  label: string; required?: boolean; error?: string; hint?: ReactNode; span?: 1 | 2; children: ReactNode;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-bold text-slate-600 mb-1.5">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : <span className="text-slate-400 font-medium ml-1">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1 text-xs font-semibold text-red-600">
          <AlertCircle size={13} className="shrink-0 mt-px" /> {error}
        </p>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
      ) : null}
    </div>
  );
}

function DupBadge({ dup }: { dup?: DupState }) {
  if (!dup || dup.status === "idle") return null;
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
      {dup.status === "checking" && <Loader2 size={16} className="animate-spin text-slate-400" />}
      {dup.status === "ok" && <CheckCircle2 size={16} className="text-emerald-500" />}
      {dup.status === "taken" && <AlertCircle size={16} className="text-red-500" />}
    </span>
  );
}

// ── Form ─────────────────────────────────────────────────────────────────────

export function CreateUserFields({
  createType, onTypeChange, form, setField, errors, dup, districts, taluks, pincodeHint,
}: {
  createType: CreateType;
  onTypeChange: (t: CreateType) => void;
  form: Record<string, string>;
  setField: (key: string, value: string) => void;
  errors: Record<string, string>;
  dup: Record<string, DupState>;
  districts: { id: string; name: string }[];
  taluks: { id: string; name: string }[];
  pincodeHint: Parameters<typeof PincodeHint>[0]["hint"];
}) {
  const isClub = createType === "CLUB";
  const pincodeKey = isClub ? "pincode" : "addressPincode";
  /** Duplicate messages win over format messages once the format is right. */
  const err = (k: string) => (dup[k]?.status === "taken" ? dup[k].message : undefined) || errors[k] || undefined;

  const text = (key: string, label: string, opts: {
    required?: boolean; placeholder?: string; span?: 1 | 2; type?: string; digits?: number; hint?: ReactNode; autoComplete?: string;
  } = {}) => (
    <FieldShell label={label} required={opts.required} error={err(key)} hint={opts.hint} span={opts.span}>
      <div className="relative">
        <input
          type={opts.type ?? "text"}
          inputMode={opts.digits ? "numeric" : undefined}
          maxLength={opts.digits}
          value={form[key] ?? ""}
          onChange={(e) => setField(key, opts.digits ? e.target.value.replace(/\D/g, "").slice(0, opts.digits) : e.target.value)}
          placeholder={opts.placeholder}
          autoComplete={opts.autoComplete ?? "off"}
          aria-invalid={!!err(key)}
          className={`${inputBase} ${err(key) ? inputBad : inputOk} ${dup[key] ? "pr-10" : ""}`}
        />
        <DupBadge dup={dup[key]} />
      </div>
    </FieldShell>
  );

  const select = (key: string, label: string, options: { value: string; label: string }[], opts: {
    required?: boolean; placeholder?: string; span?: 1 | 2; disabled?: boolean; onChange?: (v: string) => void;
  } = {}) => (
    <FieldShell label={label} required={opts.required} error={err(key)} span={opts.span}>
      <select
        value={form[key] ?? ""}
        disabled={opts.disabled}
        onChange={(e) => (opts.onChange ? opts.onChange(e.target.value) : setField(key, e.target.value))}
        aria-invalid={!!err(key)}
        className={`${inputBase} ${err(key) ? inputBad : inputOk} pr-8 disabled:bg-slate-50 disabled:text-slate-400 ${!form[key] ? "text-slate-400" : ""}`}
      >
        {opts.placeholder !== undefined && <option value="">{opts.placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} className="text-slate-800">{o.label}</option>)}
      </select>
    </FieldShell>
  );

  /** Coaches created by an admin need only name, email, mobile and district; the rest is optional. */
  const req = createType !== "COACH";

  const dobMax = new Date(new Date().setFullYear(new Date().getFullYear() - (createType === "STUDENT" ? 3 : 18))).toISOString().split("T")[0];

  /** Pincode, district and taluk share one row so the lookup's effect is visible. */
  const locationRow = (
    <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
      {text(pincodeKey, "Pincode", { required: req, placeholder: "6-digit pincode", digits: 6, hint: <PincodeHint hint={pincodeHint} /> })}
      {select("districtId", createType === "COACH" ? "Representing district" : "District", districts.map((d) => ({ value: d.id, label: d.name })), {
        required: true, placeholder: "Select district",
        onChange: (v) => { setField("districtId", v); setField("talukId", ""); },
      })}
      {select("talukId", "Taluk", taluks.map((t) => ({ value: t.id, label: t.name })), {
        required: req, placeholder: form.districtId ? "Select taluk" : "Select district first", disabled: !form.districtId,
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Account type */}
      <div role="tablist" aria-label="Account type" className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={createType === t.key}
            onClick={() => onTypeChange(t.key)}
            className={`h-9 rounded-lg text-sm font-bold transition-colors ${
              createType === t.key ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Identity */}
      {isClub ? (
        <Section title="Club details">
          {text("name", "Club name", { required: true, placeholder: "e.g. Coimbatore Judo Academy", span: 2 })}
          {text("president", "President", { required: true, placeholder: "Full name" })}
          {text("secretary", "Secretary", { required: true, placeholder: "Full name" })}
          {text("coach", "Head coach", { required: true, placeholder: "Full name", span: 2 })}
        </Section>
      ) : (
        <Section title="Personal details">
          {text("fullName", "Full name", { required: true, placeholder: "As on Aadhaar", span: createType === "STUDENT" ? 2 : 1 })}
          {(createType === "COACH" || createType === "MEMBER") && text("fatherName", "Father's name", { required: req, placeholder: "Full name" })}
          {select("gender", "Gender", [{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }, { value: "OTHER", label: "Other" }], { required: req })}
          <FieldShell label="Date of birth" required={req} error={err("dob")}>
            <input
              type="date"
              max={dobMax}
              value={form.dob ?? ""}
              onChange={(e) => setField("dob", e.target.value)}
              aria-invalid={!!err("dob")}
              className={`${inputBase} ${err("dob") ? inputBad : inputOk} ${!form.dob ? "text-slate-400" : ""}`}
            />
          </FieldShell>
          {select("bloodGroup", "Blood group", BLOOD_GROUPS.map((g) => ({ value: g, label: g })), { required: req, placeholder: "Select" })}
          {text("aadhaarNumber", "Aadhaar number", { required: req, placeholder: "12-digit Aadhaar", digits: 12 })}
        </Section>
      )}

      {/* Contact */}
      <Section title="Contact" description="Login details are sent to this email. Each email and mobile number can be used by only one account.">
        {text("email", "Email", { required: true, type: "email", placeholder: "name@example.com" })}
        {text("mobileNumber", "Mobile number", { required: true, placeholder: "10-digit mobile", digits: 10 })}
      </Section>

      {/* Address */}
      <Section title="Address" description="Entering the pincode fills in the district and taluk.">
        {createType === "STUDENT" && (
          <>
            {text("address", "Address", { required: true, placeholder: "House no., street, area", span: 2 })}
            {text("city", "City / Town", { required: true, placeholder: "City" })}
            {text("state", "State", { required: true, placeholder: "Tamil Nadu" })}
          </>
        )}
        {createType === "MEMBER" && (
          <>
            {text("addressLine1", "Address line 1", { required: true, placeholder: "House no., street", span: 2 })}
            {text("addressLine2", "Address line 2", { placeholder: "Area, landmark", span: 2 })}
            {text("city", "City / Town", { required: true, placeholder: "City", span: 2 })}
          </>
        )}
        {isClub && (
          <>
            {text("address1", "Address line 1", { required: true, placeholder: "Building, street", span: 2 })}
            {text("address2", "Address line 2", { placeholder: "Area, landmark", span: 2 })}
          </>
        )}
        {locationRow}
      </Section>

      {/* Type-specific */}
      {createType === "STUDENT" && (
        <Section title="Education & background">
          {text("schoolName", "School / College", { required: true, placeholder: "Institution name", span: 2 })}
          {text("grade", "Class / Year", { required: true, placeholder: "e.g. 8th Std" })}
          {text("annualIncome", "Annual family income (₹)", { required: true, placeholder: "e.g. 250000", digits: 9 })}
          {text("nationality", "Nationality", { required: true, placeholder: "Indian" })}
          {text("areaOfInterest", "Area of interest", { placeholder: "e.g. Competition" })}
          {text("areaOfStudy", "Area of study", { placeholder: "e.g. Science" })}
          {text("preferLocation", "Preferred training location", { placeholder: "e.g. Coimbatore" })}
        </Section>
      )}
      {createType === "COACH" && (
        <Section title="Judo background">
          {text("presentGradeInJudo", "Present grade in Judo", { placeholder: "e.g. Black Belt 1st Dan", span: 2 })}
          {text("historyInJudo", "Highest achievement in Judo", { placeholder: "e.g. State Champion 2018" })}
          {text("historyInOtherMartial", "Highest achievement in other martial arts", { placeholder: "Type None if not applicable" })}
        </Section>
      )}
    </div>
  );
}
