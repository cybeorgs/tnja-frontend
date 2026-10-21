"use client";

import React, { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, KeyRound, Bell, SlidersHorizontal, LogOut, ChevronRight, CheckCircle2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const roleLabel = (role: string) => role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Account-level options for every role: profile, password, notifications and signing out. */
export default function SettingsPage() {
  const router = useRouter();
  // The dashboard layout only renders pages in the browser, so local storage is available here.
  const [role] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("userRole") || ""));
  const [name, setName] = useState(() => (typeof window === "undefined" ? "" : localStorage.getItem("userName") || ""));
  const [email, setEmail] = useState("");
  const [notificationCount, setNotificationCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return JSON.parse(localStorage.getItem("tnja_notifications") || "[]").length;
    } catch {
      return 0;
    }
  });
  const [notice, setNotice] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setEmail(data.user?.email || "");
        if (data.user?.fullName || data.user?.name) setName(data.user.fullName || data.user.name);
      })
      .catch(() => {});
  }, []);

  const isSuperAdmin = role === "SUPER_ADMIN";
  const canConfigure = role === "SUPER_ADMIN" || role === "CEO";

  const clearNotifications = () => {
    localStorage.setItem("tnja_notifications", "[]");
    window.dispatchEvent(new Event("tnja_notifications_updated"));
    setNotificationCount(0);
    setNotice("Notification history cleared.");
  };

  const logout = () => {
    // Keep the "remember me" login ID; everything else about this session is removed.
    const rememberedIdentifier = localStorage.getItem("rememberedIdentifier");
    localStorage.clear();
    if (rememberedIdentifier) localStorage.setItem("rememberedIdentifier", rememberedIdentifier);
    startTransition(() => router.push("/login"));
  };

  return (
    <div className="max-w-3xl space-y-6">
      {notice && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> {notice}
        </div>
      )}

      <Section title="Account">
        <Row
          icon={<User size={18} />}
          title={name || "Your account"}
          text={[roleLabel(role || "user"), email].filter(Boolean).join(" · ")}
          action={<LinkButton href="/dashboard/profile">View profile</LinkButton>}
        />
      </Section>

      <Section title="Security">
        <Row
          icon={<KeyRound size={18} />}
          title="Password"
          text={isSuperAdmin ? "The Super Admin password is set in the server configuration." : "Change the password you use to sign in."}
          action={isSuperAdmin ? undefined : <LinkButton href="/dashboard/change-password">Change password</LinkButton>}
        />
      </Section>

      <Section title="Notifications">
        <Row
          icon={<Bell size={18} />}
          title="Notification history"
          text={notificationCount > 0 ? `${notificationCount} saved on this device.` : "Nothing saved on this device."}
          action={
            <button
              onClick={clearNotifications}
              disabled={notificationCount === 0}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 text-sm font-bold rounded-lg disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
            >
              Clear
            </button>
          }
        />
      </Section>

      {canConfigure && (
        <Section title="Administration">
          <Row
            icon={<SlidersHorizontal size={18} />}
            title="Configuration"
            text="Registration fees and district codes for player IDs."
            action={<LinkButton href="/dashboard/admin/configuration">Open</LinkButton>}
          />
        </Section>
      )}

      <Section title="Session">
        <Row
          icon={<LogOut size={18} />}
          tone="danger"
          title="Log out"
          text="Sign out of TNJA on this device."
          action={
            <AnimatePresence mode="wait" initial={false}>
              {confirmLogout ? (
                <motion.div key="confirm" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex gap-2">
                  <button onClick={() => setConfirmLogout(false)} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={logout} className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg">
                    Yes, log out
                  </button>
                </motion.div>
              ) : (
                <motion.button key="ask" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setConfirmLogout(true)}
                  className="px-3.5 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold rounded-lg">
                  Log out
                </motion.button>
              )}
            </AnimatePresence>
          }
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{title}</h2>
      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">{children}</div>
    </section>
  );
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
  tone?: "danger";
}

function Row({ icon, title, text, action, tone }: RowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone === "danger" ? "bg-red-50 text-red-500" : "bg-orange-50 text-[#FF7400]"}`}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{text}</p>
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="inline-flex items-center gap-1 px-3.5 py-2 bg-white border border-slate-200 hover:border-[#FF7400] hover:text-[#FF7400] text-slate-700 text-sm font-bold rounded-lg">
      {children} <ChevronRight size={14} />
    </Link>
  );
}
