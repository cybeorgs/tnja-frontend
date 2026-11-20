"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Deterministic pseudo-random in [0, 1) for piece i (same layout every render, no Math.random). */
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Winner celebration: confetti raining over the screen plus two side bursts. Colours lean to the
 * winner's side (white or blue). Pointer-events none, so the buttons under it stay usable.
 */
export function Confetti({ side }: { side: "A" | "B" }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const palette = side === "A"
    ? ["#ffffff", "#facc15", "#f97316", "#fde68a", "#e5e7eb", "#22c55e"]
    : ["#3b82f6", "#60a5fa", "#facc15", "#f97316", "#1d4ed8", "#ffffff"];

  const rain = Array.from({ length: 90 }, (_, i) => ({
    left: rand(i, 1) * 100,
    delay: rand(i, 2) * 1.2,
    duration: 2.6 + rand(i, 3) * 2.2,
    drift: (rand(i, 4) - 0.5) * 240,
    spin: (rand(i, 5) > 0.5 ? 1 : -1) * (360 + rand(i, 6) * 720),
    w: 6 + rand(i, 7) * 7,
    h: 10 + rand(i, 8) * 10,
    round: rand(i, 9) > 0.7,
    color: palette[i % palette.length],
  }));

  // bursts from the lower left and right corners
  const burst = (from: "left" | "right") => Array.from({ length: 36 }, (_, i) => {
    const angle = (from === "left" ? -75 : -105) + (rand(i, from === "left" ? 11 : 12) - 0.5) * 50;
    const power = 380 + rand(i, 13) * 420;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * power, y: Math.sin(rad) * power,
      delay: rand(i, 14) * 0.25,
      spin: (rand(i, 15) - 0.5) * 900,
      size: 7 + rand(i, 16) * 7,
      color: palette[(i + 2) % palette.length],
    };
  });

  return (
    <div className="pointer-events-none fixed inset-0 z-[101] overflow-hidden" aria-hidden>
      {rain.map((p, i) => (
        <motion.span
          key={`r${i}`}
          className="absolute top-0 block"
          style={{ left: `${p.left}%`, width: p.w, height: p.round ? p.w : p.h, background: p.color, borderRadius: p.round ? "50%" : 2 }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
      {(["left", "right"] as const).map((from) =>
        burst(from).map((p, i) => (
          <motion.span
            key={`${from}${i}`}
            className="absolute bottom-0 block rounded-sm"
            style={{ [from]: "4%", width: p.size, height: p.size * 1.6, background: p.color }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: [0, p.x, p.x * 1.15], y: [0, p.y, p.y + 520], rotate: p.spin, opacity: [1, 1, 0] }}
            transition={{ duration: 2.4, delay: p.delay, times: [0, 0.4, 1], ease: "easeOut" }}
          />
        ))
      )}
    </div>
  );
}

/** Trophy badge with expanding glow rings. */
export function TrophyPop({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative mb-4 sm:mb-6 shrink-0">
      {!reduce && [0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute inset-0 rounded-full border-2 border-yellow-400"
          initial={{ scale: 1, opacity: 0.7 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 2, delay: 0.4 + i * 0.6, repeat: Infinity, ease: "easeOut" }}
        />
      ))}
      <motion.div
        initial={reduce ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.15 }}
        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-yellow-300 bg-gradient-to-br from-yellow-500/30 to-orange-600/20 ring-4 ring-yellow-400/40 shadow-[0_0_40px_rgba(250,204,21,0.45)]"
      >
        <motion.span
          animate={reduce ? undefined : { rotate: [0, -8, 8, -4, 0] }}
          transition={{ duration: 1.2, delay: 0.7, repeat: Infinity, repeatDelay: 2.2 }}
          className="flex"
        >
          {children}
        </motion.span>
      </motion.div>
    </div>
  );
}

/** Winner's name rising in with a gold shine sweeping across it. */
export function WinnerName({ name }: { name: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.h1
      initial={reduce ? false : { y: 24, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.35 }}
      className="relative text-4xl sm:text-6xl font-black mb-2 sm:mb-3 leading-tight break-words bg-clip-text text-transparent bg-[length:200%_100%] bg-gradient-to-r from-white via-yellow-300 to-white drop-shadow-lg"
      style={reduce ? undefined : { animation: "winner-shine 2.6s linear 0.9s infinite" }}
    >
      {name}
      <style>{`@keyframes winner-shine { from { background-position: 200% 0; } to { background-position: -200% 0; } }`}</style>
    </motion.h1>
  );
}
