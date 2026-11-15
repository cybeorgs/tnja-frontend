"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Download, ImageIcon, Loader2, Move, RefreshCw, Upload, X, ZoomIn, ZoomOut } from "lucide-react";

/** Every event banner is saved at exactly this size so cards and pages crop consistently. */
export const EVENT_BANNER_SIZE = { width: 1200, height: 600 };
export const EVENT_BANNER_TEMPLATE = "/templates/event-banner-template-1200x600.png";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_ZOOM = 3;

interface EventBannerFieldProps {
  value: string;
  onChange: (url: string) => void;
}

type Source = { url: string; img: HTMLImageElement; name: string; type: string };

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
    img.src = url;
  });

/**
 * Banner picker: any PNG/JPG/WEBP is accepted. A picture that is already 1200 × 600 is uploaded
 * as it is; any other size opens a crop step (drag to position, zoom) and is saved at 1200 × 600.
 */
export default function EventBannerField({ value, onChange }: EventBannerFieldProps) {
  const { width: OUT_W, height: OUT_H } = EVENT_BANNER_SIZE;
  const ratio = OUT_W / OUT_H;

  const [source, setSource] = useState<Source | null>(null);
  const [zoom, setZoom] = useState(1);
  /** Point of the image (0–1) at the centre of the frame */
  const [focus, setFocus] = useState({ x: 0.5, y: 0.5 });
  const [frameW, setFrameW] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Track the crop frame's on-screen width
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setFrameW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [source]);

  useEffect(() => () => { if (source) URL.revokeObjectURL(source.url); }, [source]);

  /** Image placement inside a frame of width w (cover-fit × zoom), with the focus clamped so no empty edge shows. */
  const layout = useCallback((w: number, img: HTMLImageElement, z: number, f: { x: number; y: number }) => {
    const h = w / ratio;
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * z;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const fx = Math.min(Math.max(f.x, w / 2 / dw), 1 - w / 2 / dw);
    const fy = Math.min(Math.max(f.y, h / 2 / dh), 1 - h / 2 / dh);
    return { dw, dh, left: w / 2 - fx * dw, top: h / 2 - fy * dh, fx, fy };
  }, [ratio]);

  const upload = async (blob: Blob, name: string) => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", blob, name);
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      onChange(data.url);
      setSource(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    setError("");
    if (!ACCEPT.includes(file.type)) return setError("Choose a PNG, JPG or WEBP image.");
    if (file.size > MAX_SOURCE_BYTES) return setError("This image is over 15 MB. Choose a smaller one.");
    try {
      const img = await loadImage(file);
      // Already the right size and small enough: upload as it is.
      if (img.naturalWidth === OUT_W && img.naturalHeight === OUT_H && file.size <= 5 * 1024 * 1024) {
        URL.revokeObjectURL(img.src);
        return upload(file, file.name);
      }
      setZoom(1);
      setFocus({ x: 0.5, y: 0.5 });
      setSource({ url: img.src, img, name: file.name, type: file.type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read this image.");
    }
  };

  const applyCrop = () => {
    if (!source) return;
    const { dw, dh, left, top } = layout(OUT_W, source.img, zoom, focus);
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = OUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setError("Your browser could not crop this image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source.img, left, top, dw, dh);
    const type = source.type === "image/png" ? "image/png" : "image/jpeg";
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("Could not crop this image.");
        const base = source.name.replace(/\.[^.]+$/, "") || "banner";
        upload(blob, `${base}-1200x600.${type === "image/png" ? "png" : "jpg"}`);
      },
      type,
      0.9,
    );
  };

  // ── Drag to reposition ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !source || !frameW) return;
    const { dw, dh, fx, fy } = layout(frameW, source.img, zoom, focus);
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    setFocus({ x: fx - dx / dw, y: fy - dy / dh });
  };
  const onPointerUp = () => { drag.current = null; };

  const smallImage = source && (source.img.naturalWidth < OUT_W || source.img.naturalHeight < OUT_H);

  // ── Crop step ────────────────────────────────────────────────────────────────
  if (source) {
    const pos = frameW ? layout(frameW, source.img, zoom, focus) : null;
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Banner Image (Optional)</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">Position your banner</p>
            <span className="text-xs font-semibold text-slate-400">
              {source.img.naturalWidth} × {source.img.naturalHeight} px → saved as {OUT_W} × {OUT_H} px
            </span>
          </div>

          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full overflow-hidden rounded-xl bg-slate-900 cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}
          >
            {pos && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source.url}
                alt="Banner crop preview"
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{ width: pos.dw, height: pos.dh, left: pos.left, top: pos.top }}
              />
            )}
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[11px] font-bold text-white">
              <Move size={12} /> Drag to position
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom out">
              <ZoomOut size={16} />
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-[#FF7400]"
            />
            <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Zoom in">
              <ZoomIn size={16} />
            </button>
          </div>

          {smallImage && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertCircle size={14} /> This picture is smaller than {OUT_W} × {OUT_H} px, so it may look a little soft.
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><AlertCircle size={14} /> {error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setSource(null); setError(""); }}
              disabled={uploading}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyCrop}
              disabled={uploading || !pos}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black text-white bg-[#FF7400] hover:bg-orange-600 disabled:opacity-60"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Use this banner
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Picker / uploaded preview ────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">Banner Image (Optional)</p>
      <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />

      {value ? (
        <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" style={{ aspectRatio: `${OUT_W} / ${OUT_H}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Tournament banner" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute right-3 top-3 flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow hover:bg-white"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Replace
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-bold text-red-600 shadow hover:bg-white"
            >
              <X size={13} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-[#FF7400] bg-orange-50" : error ? "border-red-300 bg-red-50/20" : "border-orange-200 bg-gray-50/50 hover:border-[#FF7400]"
          }`}
        >
          <div className="rounded-full bg-orange-50 p-3 text-[#FF7400]">
            {uploading ? <Loader2 size={24} className="animate-spin" /> : dragOver ? <ImageIcon size={24} /> : <Upload size={24} />}
          </div>
          <div>
            <span className="text-sm font-bold text-[#FF7400]">{uploading ? "Uploading…" : "Click to upload"}</span>
            {!uploading && <span className="text-sm font-medium text-gray-500"> or drag and drop</span>}
          </div>
          <p className="text-xs font-medium text-gray-400">
            Any PNG, JPG or WEBP picture · we&apos;ll help you crop it to {OUT_W} × {OUT_H} px
          </p>
        </div>
      )}

      {error && !source && (
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500"><AlertCircle size={14} /> {error}</p>
      )}
      <a href={EVENT_BANNER_TEMPLATE} download className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF7400] hover:underline">
        <Download size={14} /> Download banner template ({OUT_W} × {OUT_H} px)
      </a>
    </div>
  );
}
