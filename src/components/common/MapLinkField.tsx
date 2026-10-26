"use client";

import React from "react";
import { MapPin, ExternalLink } from "lucide-react";

const MAPS_HOSTS = ["google.com", "www.google.com", "maps.google.com", "goo.gl", "maps.app.goo.gl"];

/** True for Google Maps share/place links (google.com/maps…, maps.google.com, maps.app.goo.gl, goo.gl/maps). */
export function isGoogleMapsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (!MAPS_HOSTS.includes(host) && !/^(www\.)?google\.[a-z.]+$/.test(host)) return false;
    if (host === "maps.google.com" || host === "maps.app.goo.gl") return true;
    return url.pathname.startsWith("/maps");
  } catch {
    return false;
  }
}

interface MapLinkFieldProps {
  value: string;
  onChange: (url: string) => void;
  inputClassName: string;
}

/** Optional Google Maps link shown under the venue field. */
export default function MapLinkField({ value, onChange, inputClassName }: MapLinkFieldProps) {
  const invalid = !!value.trim() && !isGoogleMapsUrl(value);
  return (
    <div className="mt-3 space-y-1.5">
      <div className="relative">
        <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Google Maps link (optional) — e.g. https://maps.app.goo.gl/…"
          aria-label="Google Maps link"
          aria-invalid={invalid}
          className={`${inputClassName} pl-10! ${invalid ? "border-red-300!" : ""}`}
        />
      </div>
      {invalid ? (
        <p className="text-xs font-semibold text-red-500">Paste a Google Maps link (google.com/maps or maps.app.goo.gl).</p>
      ) : value.trim() ? (
        <a href={value.trim()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7400] hover:underline">
          <ExternalLink size={12} /> Check the link
        </a>
      ) : (
        <p className="text-xs text-slate-400">In Google Maps: Share → Copy link, then paste it here.</p>
      )}
    </div>
  );
}

/** "Open in Google Maps" link for event/tournament details; renders nothing without a valid link. */
export function MapLink({ href, className = "" }: { href?: string | null; className?: string }) {
  if (!href || !isGoogleMapsUrl(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-xs font-bold text-[#FF7400] hover:underline ${className}`}
    >
      <MapPin size={12} /> Open in Google Maps
    </a>
  );
}
