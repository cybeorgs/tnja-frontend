"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, EyeOff, Key, Loader2, Save, UserCog, X } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

type FieldType = "text" | "email" | "tel" | "textarea" | "date" | "int" | "float" | "bool" | "gender" | "bloodGroup" | "district" | "taluk" | "club" | "coach";
interface ProfileField { key: string; label: string; type: FieldType; section: string; required?: boolean }
type Option = { id: string; name: string };

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"];

const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 focus:border-[#FF7400]/50 disabled:opacity-50";
const labelCls = "block text-[11px] font-black text-slate-400 uppercase tracking-wide mb-1.5";

/** Stored value → form string */
function toInput(type: FieldType, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (type === "date") return String(v).slice(0, 10);
  if (type === "bool") return v ? "true" : "false";
  return String(v);
}

/**
 * Admin edit of any account: every profile field (built from the list the backend sends), plus the
 * login password and, for players, match record and coach.
 */
export function EditUserModal({
  user,
  onClose,
  onSaved,
  showToast,
}: {
  user: { id: string; role: string; fullName: string; wins?: number; losses?: number; draws?: number; coachId?: string | null };
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type: "success" | "error") => void;
}) {
  const [tab, setTab] = useState<"profile" | "login">("profile");
  const [fields, setFields] = useState<ProfileField[]>([]);
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [districts, setDistricts] = useState<Option[]>([]);
  const [taluks, setTaluks] = useState<Option[]>([]);
  const [clubs, setClubs] = useState<Option[]>([]);
  const [coaches, setCoaches] = useState<Option[]>([]);

  // Login & stats
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [wins, setWins] = useState(user.wins ?? 0);
  const [losses, setLosses] = useState(user.losses ?? 0);
  const [draws, setDraws] = useState(user.draws ?? 0);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
  const has = (type: FieldType) => fields.some((f) => f.type === type);

  // Load the account and its editable fields
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/users/${user.role}/${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load this account");
        if (cancelled) return;
        const list: ProfileField[] = data.fields ?? [];
        const vals = Object.fromEntries(list.map((f) => [f.key, toInput(f.type, data.data?.[f.key])]));
        setFields(list);
        setInitial(vals);
        setValues(vals);
      } catch (e) {
        // Officers below Super Admin / CEO can't load or edit profiles, only the login details.
        if (!cancelled) {
          setTab("login");
          setError(e instanceof Error ? `${e.message}. You can still reset the password here.` : "Could not load this account");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user.id, user.role, token]);

  // Lists for the dropdowns
  useEffect(() => {
    if (!has("district")) return;
    fetch(`${API_BASE}/districts`).then((r) => (r.ok ? r.json() : [])).then((l) => setDistricts(l.map((d: Option) => ({ id: d.id, name: d.name })))).catch(() => {});
  }, [fields]); // eslint-disable-line react-hooks/exhaustive-deps
  const districtId = values.districtId || "";
  useEffect(() => {
    if (!districtId) return; // the taluk / club / coach selects are disabled until a district is picked
    fetch(`${API_BASE}/districts/${districtId}/taluks`).then((r) => (r.ok ? r.json() : [])).then((l) => setTaluks(l.map((t: Option) => ({ id: t.id, name: t.name })))).catch(() => {});
    if (has("club")) fetch(`${API_BASE}/clubs?districtId=${districtId}`).then((r) => (r.ok ? r.json() : [])).then((l) => setClubs(l.map((c: Option) => ({ id: c.id, name: c.name })))).catch(() => {});
    if (has("coach")) fetch(`${API_BASE}/coaches?districtId=${districtId}`).then((r) => (r.ok ? r.json() : [])).then((l) => setCoaches(l.map((c: { id: string; fullName: string }) => ({ id: c.id, name: c.fullName })))).catch(() => {});
  }, [districtId, fields]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    const map = new Map<string, ProfileField[]>();
    for (const f of fields) map.set(f.section, [...(map.get(f.section) ?? []), f]);
    return [...map.entries()];
  }, [fields]);

  const changed = fields.filter((f) => values[f.key] !== initial[f.key]);
  const set = (key: string, v: string) =>
    setValues((p) => (key === "districtId" ? { ...p, districtId: v, talukId: "", ...(has("club") && { clubId: "" }), ...(has("coach") && { coachId: "" }) } : { ...p, [key]: v }));

  const saveProfile = async () => {
    const missing = fields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) return setError(`${missing.label} can't be empty`);
    if (!changed.length) return setError("Nothing has changed.");
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { userId: user.id, role: user.role };
      for (const f of changed) body[f.key] = values[f.key];
      const res = await fetch(`${API_BASE}/users/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save");
      setInitial(values);
      showToast(`${values.fullName || values.name || user.fullName}: ${changed.length} field${changed.length === 1 ? "" : "s"} updated`, "success");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const saveLogin = async () => {
    setSaving(true);
    setError("");
    try {
      const isStudent = user.role === "STUDENT";
      const res = await fetch(`${API_BASE}/users/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: user.id,
          role: user.role,
          password: password || undefined,
          wins: isStudent ? wins : undefined,
          losses: isStudent ? losses : undefined,
          draws: isStudent ? draws : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save");
      setPassword("");
      showToast(password ? "Password reset and details saved" : "Saved", "success");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (f: ProfileField) => {
    const v = values[f.key] ?? "";
    const common = { id: `f-${f.key}`, disabled: saving };
    const label = (
      <label htmlFor={common.id} className={labelCls}>
        {f.label}{f.required ? " *" : ""}
        {values[f.key] !== initial[f.key] && <span className="ml-1.5 normal-case tracking-normal text-[#FF7400]">• changed</span>}
      </label>
    );
    let input: React.ReactNode;
    switch (f.type) {
      case "textarea":
        input = <textarea {...common} rows={2} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />;
        break;
      case "date":
        input = <input {...common} type="date" value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />;
        break;
      case "int":
      case "float":
        input = <input {...common} type="number" min={0} step={f.type === "int" ? 1 : "any"} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />;
        break;
      case "bool":
        input = (
          <select {...common} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        );
        break;
      case "gender":
        input = (
          <select {...common} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
            <option value="">Select</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        );
        break;
      case "bloodGroup":
        input = (
          <select {...common} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
            <option value="">Select</option>
            {[...new Set([...BLOOD_GROUPS, ...(v ? [v] : [])])].map((g) => <option key={g} value={g}>{g === "UNKNOWN" ? "Not known" : g}</option>)}
          </select>
        );
        break;
      case "district":
      case "taluk":
      case "club":
      case "coach": {
        const opts = f.type === "district" ? districts : f.type === "taluk" ? taluks : f.type === "club" ? clubs : coaches;
        const needsDistrict = f.type !== "district" && !districtId;
        input = (
          <select {...common} value={v} disabled={saving || needsDistrict} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
            <option value="">{needsDistrict ? "Select district first" : f.required ? "Select" : "None"}</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            {v && !opts.some((o) => o.id === v) && <option value={v}>Current</option>}
          </select>
        );
        break;
      }
      default:
        input = <input {...common} type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} value={v} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />;
    }
    return <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>{label}{input}</div>;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-orange-100 text-[#FF7400] rounded-xl"><UserCog size={20} /></div>
            <div className="min-w-0">
              <h3 id="edit-user-title" className="text-lg font-black text-slate-800 truncate">Edit {user.fullName}</h3>
              <p className="text-xs font-semibold text-slate-500">{user.role.replace(/_/g, " ").toLowerCase()}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} className="text-slate-400" /></button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3">
          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            {([["profile", "Profile"], ["login", user.role === "STUDENT" ? "Login & match record" : "Login"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => { setTab(k); setError(""); }} className={`px-4 py-1.5 rounded-lg text-sm font-black ${tab === k ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && (
            <div className="px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {tab === "profile" ? (
            loading ? (
              <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-[#FF7400]" size={28} /></div>
            ) : (
              sections.map(([section, list]) => (
                <section key={section}>
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">{section}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{list.map(renderField)}</div>
                </section>
              ))
            )
          ) : (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Reset password</label>
                <div className="relative">
                  <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (leave blank to keep the current one)"
                    className={`${inputCls} pl-10 pr-10`}
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-slate-400 mt-1.5">The user must use the new password from their next login.</p>
              </div>
              {user.role === "STUDENT" && (
                <div className="grid grid-cols-3 gap-3">
                  {([["Wins", wins, setWins], ["Losses", losses, setLosses], ["Draws", draws, setDraws]] as const).map(([l, v, setV]) => (
                    <div key={l}>
                      <label className={labelCls}>{l}</label>
                      <input type="number" min={0} value={v} onChange={(e) => setV(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs font-semibold text-slate-400">The ID is issued by the system and can&apos;t be changed.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500">
            {tab === "profile" && !loading ? (changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes") : ""}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100">Close</button>
            <button
              onClick={tab === "profile" ? saveProfile : saveLogin}
              disabled={saving || (tab === "profile" && (loading || !changed.length))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
