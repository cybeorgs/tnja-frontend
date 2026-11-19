"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

/** District name (lower-case) → short code, e.g. "coimbatore" → "CBE". */
export type DistrictCodes = Record<string, string>;

let cache: Promise<DistrictCodes> | null = null;

/** Fetches the district codes once per page load and shares them. */
export function loadDistrictCodes(): Promise<DistrictCodes> {
  if (!cache) {
    cache = fetch(`${API_BASE}/districts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { name?: string; code?: string | null }[]) =>
        Object.fromEntries(
          (Array.isArray(list) ? list : [])
            .filter((d) => d.name && d.code)
            .map((d) => [d.name!.trim().toLowerCase(), d.code!.trim().toUpperCase()])
        )
      )
      .catch(() => {
        cache = null; // try again next time
        return {};
      });
  }
  return cache;
}

export function useDistrictCodes(): DistrictCodes {
  const [codes, setCodes] = useState<DistrictCodes>({});
  useEffect(() => {
    let alive = true;
    loadDistrictCodes().then((c) => { if (alive) setCodes(c); });
    return () => { alive = false; };
  }, []);
  return codes;
}

/** First three letters of a name, as a fallback code. */
const abbrev = (name: string) => name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

/**
 * Who a player represents in a tournament, with its short code: the district confirmed at
 * weigh-in, else their home district; a unit uses the first letters of its name.
 */
export function representingOf(
  p: { representing?: string; representingDistrict?: string; representingUnit?: string; district?: string },
  codes: DistrictCodes
): { name: string; code: string } | null {
  if (p.representing === "UNIT" && p.representingUnit) {
    return { name: p.representingUnit, code: abbrev(p.representingUnit) };
  }
  const district = (p.representingDistrict || p.district || "").trim();
  if (!district) return null;
  return { name: district, code: codes[district.toLowerCase()] || abbrev(district) };
}
