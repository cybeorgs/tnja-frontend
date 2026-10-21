"use client";

import React, { useEffect, useRef, useState } from 'react';

export interface Taluk { id: string, name: string }
export interface PincodeMatch { district: { id: string, name: string }, taluks: Taluk[] }

type Hint = { text: string, tone: 'info' | 'error' };

/**
 * Once all 6 pincode digits are in, looks up the district/taluk and hands them to
 * `onMatch` so the form can fill them in. `onlyTaluk` is set only when the pincode
 * maps to exactly one taluk, so a taluk is never guessed.
 */
export function usePincodeLookup(
  pincode: string,
  onMatch: (match: PincodeMatch, onlyTaluk: Taluk | undefined) => void | Promise<void>
) {
  const [result, setResult] = useState<{ pincode: string } & Hint | null>(null);
  // A pincode the form was pre-filled with (e.g. a resubmission) is not looked up,
  // so it cannot overwrite the district and taluk saved alongside it.
  const [prefilled] = useState(pincode);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const onMatchRef = useRef(onMatch);
  useEffect(() => { onMatchRef.current = onMatch; });

  useEffect(() => {
    if (pincode.length !== 6 || pincode === prefilled) return;
    const controller = new AbortController();
    const lookup = async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9000/api';
      try {
        const res = await fetch(`${apiUrl}/locations/pincode/${pincode}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setResult({ pincode, text: data.error || 'Pincode not found. Please select district and taluk manually.', tone: 'error' });
          return;
        }
        const match = data as PincodeMatch;
        const onlyTaluk = match.taluks.length === 1 ? match.taluks[0] : undefined;
        await onMatchRef.current(match, onlyTaluk);
        setResult({
          pincode,
          text: match.taluks.length > 1
            ? `${match.district.name} district. This pincode covers ${match.taluks.map(t => t.name).join(' / ')} — please choose your taluk.`
            : onlyTaluk
              ? `${match.district.name} district, ${onlyTaluk.name} taluk.`
              : `${match.district.name} district. Please choose your taluk.`,
          tone: 'info'
        });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error("Pincode lookup failed:", err);
        setResult({ pincode, text: 'Could not look up pincode. Please select district and taluk manually.', tone: 'error' });
      }
    };
    lookup();
    return () => controller.abort();
  }, [pincode, prefilled]);

  const hint: Hint | null =
    pincode.length !== 6 || pincode === prefilled || dismissed === pincode ? null
      : result?.pincode === pincode ? result
        : { text: 'Looking up pincode...', tone: 'info' };

  /** Hides the hint for the current pincode, e.g. once the user has picked a taluk. */
  const clearHint = () => setDismissed(pincode);

  return { hint, clearHint };
}

export function PincodeHint({ hint }: { hint: Hint | null }) {
  if (!hint) return null;
  return (
    <p className={`text-xs ${hint.tone === 'error' ? 'text-red-500' : 'text-[#FF7400] font-medium'}`}>
      {hint.text}
    </p>
  );
}
