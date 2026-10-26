"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { GiTempleGate, GiWhistle, GiBlackBelt } from "react-icons/gi";
import { FaUsers } from "react-icons/fa";

const ROLES: {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  formTitle: string;
}[] = [
  { label: "Player", href: "/register/player", icon: GiBlackBelt, formTitle: "New Player Registration Form" },
  { label: "Coach", href: "/register/coach", icon: GiWhistle, formTitle: "New Coach Registration Form" },
  { label: "Administrative Member", href: "/register/member", icon: FaUsers, formTitle: "New Administrative Member Registration Form" },
  { label: "Club", href: "/register/club", icon: GiTempleGate, formTitle: "New Club Registration Form" },
];

const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

interface RegistrationLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared shell for the registration pages, rendered from register/layout.tsx so it stays
 * mounted while switching types: the highlight pill slides between tabs instead of jumping.
 */
export default function RegistrationLayout({ children }: RegistrationLayoutProps) {
  const pathname = usePathname();
  const active = ROLES.find((r) => pathname?.startsWith(r.href)) ?? ROLES[0];

  return (
    <main className="bg-white min-h-screen pb-20">
      {/* Banner Section */}
      <section className="bg-[#F6F6F6] relative overflow-hidden h-[120px] flex items-center mb-10 md:mb-12">
        <div className="max-w-[1200px] mx-auto w-full px-4 relative z-10">
          <h1 className="text-[32px] font-bold text-[#1A1A1A] tracking-tight">New Registration</h1>
        </div>
      </section>

      {/* Registration type toggle */}
      <div className="max-w-[1200px] mx-auto px-4 mb-10">
        <p className="text-center text-sm font-semibold text-slate-500 mb-4">I am registering as a</p>
        <nav aria-label="Registration type" className="flex justify-center">
          <div className="grid grid-cols-2 sm:flex gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 w-full sm:w-auto">
            {ROLES.map((r) => {
              const isActive = r.href === active.href;
              const Icon = r.icon;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  scroll={false}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative flex items-center justify-center gap-2 px-4 sm:px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors duration-300 ${
                    isActive ? "text-white" : "text-slate-600 hover:text-[#FF7400]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="registration-type-pill"
                      transition={SPRING}
                      className="absolute inset-0 rounded-xl bg-[#FF7400] shadow-md shadow-[#FF7400]/25"
                    />
                  )}
                  <Icon size={18} className={`relative z-10 transition-colors duration-300 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="relative z-10">{r.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Form header and form fade in together whenever the type changes */}
      <motion.div
        key={active.href}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="max-w-[1200px] mx-auto px-4 mb-10">
          <div className="text-center">
            <p className="text-[#FF7400] font-bold uppercase tracking-[0.25em] text-[11px] mb-4">New Registration</p>
            <h2 className="text-3xl md:text-[42px] font-bold text-[#1A1A1A] tracking-tight leading-tight">{active.formTitle}</h2>
          </div>
        </div>

        {children}
      </motion.div>
    </main>
  );
}
