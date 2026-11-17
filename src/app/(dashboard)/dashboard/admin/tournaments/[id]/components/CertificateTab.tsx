"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, Award, CheckCircle2, Eye, ImagePlus, Loader2, Plus, RotateCcw, Save, Trash2, Upload, X,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
const MAX_SIGNATORIES = 6;
/** PDF certificates can only embed PNG and JPG pictures. */
const ACCEPT = ["image/png", "image/jpeg"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Signatory {
  name: string;
  qualification: string;
  designation: string;
  organisation: string;
  signature: string;
}

interface CertificateConfig {
  referenceNo: string;
  championshipTitle: string;
  hostedBy: string;
  coSponsoredBy: string;
  venueName: string;
  venueAddress: string;
  dateText: string;
  leftLogo: string;
  rightLogo: string;
  signatories: Signatory[];
}

const auth = (): Record<string, string> => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const emptySignatory = (): Signatory => ({ name: "", qualification: "", designation: "", organisation: "", signature: "" });

const normalise = (c: Partial<CertificateConfig> | undefined): CertificateConfig => ({
  referenceNo: c?.referenceNo ?? "",
  championshipTitle: c?.championshipTitle ?? "",
  hostedBy: c?.hostedBy ?? "",
  coSponsoredBy: c?.coSponsoredBy ?? "",
  venueName: c?.venueName ?? "",
  venueAddress: c?.venueAddress ?? "",
  dateText: c?.dateText ?? "",
  leftLogo: c?.leftLogo ?? "",
  rightLogo: c?.rightLogo ?? "",
  signatories: (c?.signatories ?? []).map((s) => ({ ...emptySignatory(), ...s })),
});

async function uploadImage(file: File): Promise<string> {
  if (!ACCEPT.includes(file.type)) throw new Error("Choose a PNG or JPG image.");
  if (file.size > MAX_BYTES) throw new Error("This image is over 5 MB. Choose a smaller one.");
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

// ── Small building blocks ────────────────────────────────────────────────────

function Field({ label, hint, value, onChange, placeholder }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-[#FF7400] focus:ring-2 focus:ring-orange-100"
      />
      {hint && <span className="mt-1 block text-[11px] font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

function ImagePicker({ label, hint, value, onChange, tall }: {
  label: string; hint: string; value: string; onChange: (url: string) => void; tall?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file?: File) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className={`mt-1 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-2 ${tall ? "min-h-[84px]" : "min-h-[64px]"}`}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className={`${tall ? "h-16" : "h-12"} max-w-[160px] object-contain bg-white rounded-lg border border-slate-100 p-1`} />
        ) : (
          <div className={`${tall ? "h-16" : "h-12"} w-24 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-300`}>
            <ImagePlus size={20} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#FF7400] disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 hover:underline">
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
      <span className="mt-1 block text-[11px] font-medium text-slate-400">{hint}</span>
      {error && <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500"><AlertCircle size={12} /> {error}</span>}
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function CertificateTab({ tournamentId }: { tournamentId: string }) {
  const [config, setConfig] = useState<CertificateConfig | null>(null);
  const [defaults, setDefaults] = useState<CertificateConfig | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<"" | "FIRST" | "PARTICIPATION">("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate-config`, { headers: auth() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load certificate settings");
      setConfig(normalise(data.config));
      setDefaults(normalise(data.defaults));
      setIsSaved(!!data.isSaved);
      setDirty(false);
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Failed to load certificate settings" });
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<CertificateConfig>) => {
    setConfig((c) => (c ? { ...c, ...patch } : c));
    setDirty(true);
    setMessage(null);
  };

  const updateSignatory = (i: number, patch: Partial<Signatory>) =>
    update({ signatories: config!.signatories.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) });

  const moveSignatory = (i: number, dir: -1 | 1) => {
    const list = [...config!.signatories];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ signatories: list });
  };

  const save = async () => {
    if (!config) return;
    const unnamed = config.signatories.findIndex((s) => !s.name.trim());
    if (unnamed >= 0) {
      setMessage({ ok: false, text: `Signatory ${unnamed + 1} has no name. Add a name or remove that signatory.` });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate-config`, {
        method: "PUT",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setConfig(normalise(data.config));
      setIsSaved(true);
      setDirty(false);
      setMessage({ ok: true, text: "Certificate settings saved. Every certificate for this tournament now uses them." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const preview = async (placement: "FIRST" | "PARTICIPATION") => {
    if (!config) return;
    // Opened synchronously so the popup blocker treats it as part of the click
    const win = window.open("", "_blank");
    setPreviewing(placement);
    try {
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/certificate-preview`, {
        method: "POST",
        headers: { ...auth(), "Content-Type": "application/json" },
        body: JSON.stringify({ config, placement }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate preview");
      }
      const url = URL.createObjectURL(new Blob([await res.blob()], { type: "application/pdf" }));
      if (win) win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      win?.close();
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Failed to generate preview" });
    } finally {
      setPreviewing("");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-400 font-semibold text-sm">
        <Loader2 size={18} className="animate-spin" /> Loading certificate settings…
      </div>
    );
  }
  if (!config) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-semibold text-red-600 flex items-center gap-2">
        <AlertCircle size={16} /> {message?.text || "Certificate settings could not be loaded."}
      </div>
    );
  }

  const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

  return (
    <div className="space-y-5">
      {/* Header / actions */}
      <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7400] flex items-center justify-center shrink-0"><Award size={20} /></div>
          <div>
            <h3 className="text-lg font-black text-slate-800">Certificate Settings</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Used on every certificate for this tournament. 1st–3rd place get a <strong>Merit Certificate</strong>; everyone else gets a <strong>Participation Certificate</strong>.
            </p>
            {!isSaved && (
              <p className="text-xs font-bold text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={13} /> Not saved yet — certificates use the defaults shown below until you save.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => preview("FIRST")}
            disabled={!!previewing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#FF7400] disabled:opacity-60"
          >
            {previewing === "FIRST" ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Preview Merit
          </button>
          <button
            type="button"
            onClick={() => preview("PARTICIPATION")}
            disabled={!!previewing}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-[#FF7400] disabled:opacity-60"
          >
            {previewing === "PARTICIPATION" ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />} Preview Participation
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || (!dirty && isSaved)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
          </button>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${message.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
          {message.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {message.text}
        </div>
      )}

      {/* Event details */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Event details</h4>
          {defaults && (
            <button
              type="button"
              onClick={() => update({ championshipTitle: defaults.championshipTitle, venueName: defaults.venueName, dateText: defaults.dateText })}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#FF7400]"
              title="Fill championship name, venue and dates from the tournament details"
            >
              <RotateCcw size={13} /> Fill from tournament
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Championship name" value={config.championshipTitle} onChange={(v) => update({ championshipTitle: v })}
              placeholder="STATE SUPER TROPHY JUDO CHAMPIONSHIP 2026-27" hint="Printed in red capitals under the association name." />
          </div>
          <Field label="Hosted by" value={config.hostedBy} onChange={(v) => update({ hostedBy: v })}
            placeholder="Tiruppur District Judo Association, Reg.No. 206/2025" hint={'Printed as "Hosted By - …". Leave empty to hide.'} />
          <Field label="Co-sponsored by" value={config.coSponsoredBy} onChange={(v) => update({ coSponsoredBy: v })}
            placeholder="Veer Viveka Namo Academy" hint={'Printed as "Co-sponsored by : …". Leave empty to hide.'} />
          <Field label="Venue" value={config.venueName} onChange={(v) => update({ venueName: v })} placeholder="Kangeyam Institute of Technology" />
          <Field label="Venue address" value={config.venueAddress} onChange={(v) => update({ venueAddress: v })} placeholder="Nathakadiyur, Kangeyam, Tiruppur." />
          <Field label="Date line" value={config.dateText} onChange={(v) => update({ dateText: v })}
            placeholder="20-11-2026 Friday & 21-11-2026 Saturday" hint="Printed on the Date row exactly as typed." />
          <Field label="Reference number (top right)" value={config.referenceNo} onChange={(v) => update({ referenceNo: v })}
            placeholder="TNJA329/2017/SUBJUN@2026 P :" hint="Small text beside the JSW logo. Optional." />
        </div>
      </div>

      {/* Logos */}
      <div className={card}>
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-1">Side logos</h4>
        <p className="text-xs text-slate-500 mb-4">Shown either side of the venue — e.g. host or sponsor logos. The association logos at the top are fixed.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <ImagePicker label="Left logo" value={config.leftLogo} onChange={(v) => update({ leftLogo: v })} hint="PNG or JPG, up to 5 MB." />
          <ImagePicker label="Right logo" value={config.rightLogo} onChange={(v) => update({ rightLogo: v })} hint="PNG or JPG, up to 5 MB." />
        </div>
      </div>

      {/* Signatories */}
      <div className={card}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">Signatories ({config.signatories.length}/{MAX_SIGNATORIES})</h4>
          <button
            type="button"
            onClick={() => update({ signatories: [...config.signatories, emptySignatory()] })}
            disabled={config.signatories.length >= MAX_SIGNATORIES}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#FF7400] bg-orange-50 hover:bg-orange-100 disabled:opacity-40"
          >
            <Plus size={14} /> Add signatory
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Order sets the position: the first three sit on the top row, the next two on the second row, the sixth centred at the bottom.
          For signatures, a PNG with a transparent background looks best.
        </p>

        {config.signatories.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-center text-sm font-semibold text-slate-400">No signatories — the signature area will be empty.</p>
        )}

        <div className="space-y-3">
          {config.signatories.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500">
                  #{i + 1} · {i < 3 ? "Top row" : i < 5 ? "Second row" : "Bottom centre"}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveSignatory(i, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => moveSignatory(i, 1)} disabled={i === config.signatories.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => update({ signatories: config.signatories.filter((_, idx) => idx !== i) })} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50" aria-label="Remove signatory"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_220px]">
                <div className="space-y-3">
                  <Field label="Name" value={s.name} onChange={(v) => updateSignatory(i, { name: v })} placeholder="R. VIJAYA MOHANA MURALI" />
                  <Field label="Qualification" value={s.qualification} onChange={(v) => updateSignatory(i, { qualification: v })} placeholder="M.Com.," />
                </div>
                <div className="space-y-3">
                  <Field label="Designation" value={s.designation} onChange={(v) => updateSignatory(i, { designation: v })} placeholder="Chief Executive Officer, TNJA Reg.No. 329/2017" />
                  <Field label="Organisation (optional 2nd line)" value={s.organisation} onChange={(v) => updateSignatory(i, { organisation: v })} placeholder="Tiruppur District Judo Association" />
                </div>
                <ImagePicker label="Signature" value={s.signature} onChange={(v) => updateSignatory(i, { signature: v })} hint="Optional." tall />
              </div>
            </div>
          ))}
        </div>
      </div>

      {defaults && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { if (window.confirm("Replace every field with the defaults? Unsaved changes will be lost.")) update(defaults); }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500"
          >
            <RotateCcw size={13} /> Reset all to defaults
          </button>
        </div>
      )}
    </div>
  );
}
