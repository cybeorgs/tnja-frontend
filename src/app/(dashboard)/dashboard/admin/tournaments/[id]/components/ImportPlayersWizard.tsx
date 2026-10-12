"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Upload, ChevronRight, X, Download, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export function ImportPlayersWizard({
  tournamentId,
  onClose,
  onSuccess,
}: {
  tournamentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<"upload" | "validating" | "summary" | "importing" | "complete">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [validateBefore, setValidateBefore] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<{ successCount: number; failedCount: number; errors: { row: number; error: string }[]; totalRows: number } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep("upload"); setFile(null); setProgress(0); setResult(null); setErrorMsg(""); setElapsedSeconds(0); };
  const handleClose = () => { if (step === "validating" || step === "importing") return; reset(); onClose(); };

  const simulateProgress = (next: "summary") => {
    let v = 0;
    const iv = setInterval(() => {
      v += Math.floor(Math.random() * 15) + 8;
      if (v >= 100) { v = 100; clearInterval(iv); setTimeout(() => setStep(next), 300); }
      setProgress(v);
    }, 120);
  };

  const doImport = async () => {
    if (!file) return;
    setStep("importing"); setProgress(0); setElapsedSeconds(0);
    const progIv = setInterval(() => setProgress(p => Math.min(p + 4, 85)), 200);
    const elapsedIv = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/registrations/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      clearInterval(elapsedIv);
      const data = await res.json();
      clearInterval(progIv);
      setProgress(100);
      setTimeout(() => {
        if (res.ok) {
          setResult({ successCount: data.successCount || 0, failedCount: data.failedCount || 0, errors: data.errors || [], totalRows: (data.successCount || 0) + (data.failedCount || 0) });
          setStep("complete");
          onSuccess();
        } else {
          setErrorMsg(data.error || "Server error during import.");
          setStep("upload");
        }
      }, 400);
    } catch {
      clearInterval(progIv);
      clearInterval(elapsedIv);
      setErrorMsg("Network error. Please try again.");
      setStep("upload");
    }
  };

  const onFileChange = (f: File | null) => { if (!f) return; setFile(f); setErrorMsg(""); };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(15,23,42,0.7)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ background: "#fff", borderRadius: "24px", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", width: "100%", maxWidth: "700px", display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden" }}>
        
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", background: "#eff6ff", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Upload size={18} style={{ color: "#2563eb" }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>Player Bulk Import</h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Upload Excel to add players to this tournament</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
            <span style={{ color: step === "upload" ? "#2563eb" : "#10b981", padding: "4px 10px", background: step === "upload" ? "#eff6ff" : "#f0fdf4", borderRadius: "20px" }}>1. Upload</span>
            <ChevronRight size={14} style={{ color: "#94a3b8" }} />
            <span style={{ color: (step === "validating" || step === "summary") ? "#2563eb" : (step === "importing" || step === "complete") ? "#10b981" : "#94a3b8", padding: "4px 10px", background: (step === "validating" || step === "summary") ? "#eff6ff" : (step === "importing" || step === "complete") ? "#f0fdf4" : "transparent", borderRadius: "20px" }}>2. Validate</span>
            <ChevronRight size={14} style={{ color: "#94a3b8" }} />
            <span style={{ color: step === "importing" ? "#2563eb" : step === "complete" ? "#10b981" : "#94a3b8", padding: "4px 10px", background: step === "importing" ? "#eff6ff" : step === "complete" ? "#f0fdf4" : "transparent", borderRadius: "20px" }}>3. Import</span>
          </div>
          {step !== "validating" && step !== "importing" && (
            <button type="button" onClick={handleClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px", borderRadius: "8px", display: "flex", alignItems: "center", color: "#64748b" }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <a
                href="/templates/players_import_template.xlsx"
                download
                style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#2563eb", background: "#eff6ff", padding: "8px 14px", borderRadius: "10px", textDecoration: "none" }}
              >
                <Download size={14} /> Download Excel Template
              </a>
              {errorMsg && (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", color: "#dc2626", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={16} /> {errorMsg}
                </div>
              )}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onFileChange(f); }}
                style={{ border: `2px dashed ${file ? "#10b981" : "#cbd5e1"}`, borderRadius: "20px", padding: "48px 24px", textAlign: "center", background: file ? "#f0fdf4" : "#f8fafc", cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <>
                    <CheckCircle2 size={48} style={{ color: "#10b981", margin: "0 auto 12px" }} />
                    <p style={{ fontSize: "16px", fontWeight: 900, color: "#065f46", margin: "0 0 4px" }}>{file.name}</p>
                    <p style={{ fontSize: "12px", color: "#059669", fontWeight: 600, margin: "0 0 12px" }}>{(file.size / 1024 / 1024).toFixed(2)} MB — Ready to import</p>
                    <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }} style={{ fontSize: "12px", color: "#ef4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove File</button>
                  </>
                ) : (
                  <>
                    <Upload size={48} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
                    <p style={{ fontSize: "16px", fontWeight: 900, color: "#334155", margin: "0 0 8px" }}>Click or Drag & Drop your Excel file here</p>
                    <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Supported: .xlsx, .xls, .csv — Max 5 MB</p>
                  </>
                )}
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} style={{ display: "none" }} onChange={e => onFileChange(e.target.files?.[0] || null)} />

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>Import Options</p>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={validateBefore} onChange={e => setValidateBefore(e.target.checked)} style={{ width: "16px", height: "16px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Validate file before importing (Recommended)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                  <input type="checkbox" checked={updateExisting} onChange={e => setUpdateExisting(e.target.checked)} style={{ width: "16px", height: "16px" }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Create new player profile if Aadhaar not found</span>
                </label>
              </div>
            </div>
          )}

          {/* STEP 2/4: Progress */}
          {(step === "validating" || step === "importing") && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Loader2 size={56} style={{ color: "#2563eb", margin: "0 auto 20px", animation: "spin 1s linear infinite" }} />
              <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", margin: "0 0 8px" }}>
                {step === "validating" ? "Validating Your File..." : "Importing Players..."}
              </h3>
              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 24px" }}>{file?.name}</p>
              <div style={{ background: "#e2e8f0", borderRadius: "999px", height: "10px", maxWidth: "400px", margin: "0 auto 12px", overflow: "hidden" }}>
                <div style={{ background: "#2563eb", height: "100%", borderRadius: "999px", width: `${progress}%`, transition: "width 0.3s ease" }} />
              </div>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#2563eb", margin: "0 0 8px" }}>{progress}%</p>
              {step === "importing" && (
                <>
                  <p style={{ fontSize: "13px", color: "#334155", fontWeight: 700, margin: "0 0 4px" }}>
                    Still working — {elapsedSeconds}s elapsed{elapsedSeconds > 20 ? " (large files can take a few minutes)" : ""}
                  </p>
                  <p style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700 }}>Please do not close this window...</p>
                </>
              )}
            </div>
          )}

          {/* STEP 3: Summary */}
          {step === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "16px", padding: "16px", display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <CheckCircle2 size={24} style={{ color: "#2563eb", flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: "0 0 4px", fontWeight: 900, color: "#1e3a8a" }}>File Scanned Successfully</h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "#1d4ed8" }}>File looks valid. Click "Confirm & Import" to begin importing players into the tournament database.</p>
                </div>
              </div>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>File</p><p style={{ margin: 0, fontWeight: 700, color: "#334155" }}>{file?.name}</p></div>
                <div><p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase" }}>Size</p><p style={{ margin: 0, fontWeight: 700, color: "#334155" }}>{((file?.size || 0) / 1024 / 1024).toFixed(2)} MB</p></div>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {step === "complete" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: result.failedCount === 0 ? "#f0fdf4" : "#fffbeb", border: `1px solid ${result.failedCount === 0 ? "#bbf7d0" : "#fde68a"}`, borderRadius: "20px", padding: "24px", display: "flex", gap: "16px", alignItems: "center" }}>
                <CheckCircle2 size={48} style={{ color: result.failedCount === 0 ? "#10b981" : "#f59e0b", flexShrink: 0 }} />
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: result.failedCount === 0 ? "#065f46" : "#92400e" }}>Import Complete!</h3>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: result.failedCount === 0 ? "#059669" : "#b45309" }}>Processed {result.totalRows} rows from {file?.name}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, color: "#059669" }}>Successfully Imported</p>
                  <p style={{ margin: 0, fontSize: "36px", fontWeight: 900, color: "#047857" }}>{result.successCount}</p>
                </div>
                <div style={{ background: result.failedCount > 0 ? "#fef2f2" : "#f8fafc", border: `1px solid ${result.failedCount > 0 ? "#fecaca" : "#e2e8f0"}`, borderRadius: "16px", padding: "20px", textAlign: "center" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "12px", fontWeight: 700, color: result.failedCount > 0 ? "#dc2626" : "#64748b" }}>Failed Rows</p>
                  <p style={{ margin: 0, fontSize: "36px", fontWeight: 900, color: result.failedCount > 0 ? "#b91c1c" : "#334155" }}>{result.failedCount}</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 10px", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}><AlertCircle size={16} style={{ color: "#ef4444" }} /> Row Errors</h4>
                  <div style={{ border: "1px solid #fecaca", borderRadius: "12px", overflow: "hidden", maxHeight: "200px", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead><tr style={{ background: "#fee2e2" }}><th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 900, color: "#b91c1c", width: "60px" }}>Row</th><th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 900, color: "#b91c1c" }}>Error</th></tr></thead>
                      <tbody>{result.errors.map((e, i) => <tr key={i} style={{ borderTop: "1px solid #fecaca" }}><td style={{ padding: "8px 12px", fontWeight: 900, color: "#dc2626" }}>{e.row}</td><td style={{ padding: "8px 12px", color: "#dc2626" }}>{e.error}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {step === "complete" && <button type="button" onClick={reset} style={{ fontSize: "13px", fontWeight: 700, color: "#2563eb", background: "none", border: "none", cursor: "pointer" }}>+ Import Another File</button>}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            {(step === "upload" || step === "summary") && (
              <button type="button" onClick={handleClose} style={{ padding: "10px 20px", borderRadius: "12px", fontWeight: 700, fontSize: "13px", background: "none", border: "1px solid #e2e8f0", cursor: "pointer", color: "#64748b" }}>Cancel</button>
            )}
            {step === "upload" && (
              <button type="button" onClick={() => { if (!file) return; if (validateBefore) { setStep("validating"); simulateProgress("summary"); } else doImport(); }} disabled={!file}
                style={{ padding: "10px 24px", borderRadius: "12px", fontWeight: 900, fontSize: "13px", background: file ? "#2563eb" : "#94a3b8", color: "#fff", border: "none", cursor: file ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: "6px" }}>
                Continue <ChevronRight size={16} />
              </button>
            )}
            {step === "summary" && (
              <button type="button" onClick={doImport} style={{ padding: "10px 24px", borderRadius: "12px", fontWeight: 900, fontSize: "13px", background: "#059669", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={16} /> Confirm & Import
              </button>
            )}
            {step === "complete" && (
              <button type="button" onClick={handleClose} style={{ padding: "10px 24px", borderRadius: "12px", fontWeight: 900, fontSize: "13px", background: "#0f172a", color: "#fff", border: "none", cursor: "pointer" }}>
                Close &amp; View Players
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
