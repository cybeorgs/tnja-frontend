import type { ReactNode } from "react";

/**
 * Wraps a control with a clear hover / focus message (a dark bubble under it). Works on disabled
 * buttons too, so the message can say why the button is unavailable.
 */
export default function Tip({ text, children, align = "center" }: { text: string; children: ReactNode; align?: "center" | "start" | "end" }) {
  const pos = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full mt-2 ${pos} z-50 w-max max-w-[260px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold leading-snug text-white shadow-lg opacity-0 translate-y-1 transition-all duration-150 group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0`}
      >
        {text}
      </span>
    </span>
  );
}
