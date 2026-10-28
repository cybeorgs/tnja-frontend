"use client";

import React, { useState, useEffect, startTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { TNJA_LOGO } from "@/constants/brand";
import {
  LayoutDashboard,
  User,
  Users,
  ShieldCheck,
  Calendar,
  SlidersHorizontal,
  Menu,
  X,
  Bell,
  Settings,
  IndianRupee,
  MessageSquare,
  Trophy,
  ClipboardList,
  ScrollText,
  FileCheck2,
  ChevronDown,
  ArrowLeftRight,
  Medal,
  CalendarCheck,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

/** Roles held by member accounts; their dashboard follows promotions via /auth/refresh-session. */
const MEMBER_ACCOUNT_ROLES = ["MEMBER", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"];

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)} day${seconds < 2 * 86400 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [userStatus, setUserStatus] = useState<string | null>(null);
  // Office held by a coach (e.g. DISTRICT_SECRETARY); they switch between the coach and office dashboards.
  const [officeRole, setOfficeRole] = useState<string | null>(null);
  const [isSwitchingView, setIsSwitchingView] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Profile dropdown state
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);


  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    // Load saved notifications, and reload when another part of the app changes them (e.g. Settings → Clear).
    const load = () => {
      try {
        setNotifications(JSON.parse(localStorage.getItem("tnja_notifications") || "[]"));
      } catch (err) {
        console.error(err);
      }
    };
    load();
    window.addEventListener("tnja_notifications_updated", load);
    return () => window.removeEventListener("tnja_notifications_updated", load);
  }, []);

  const saveNotifications = (newNotifs: any[]) => {
    setNotifications(newNotifs);
    localStorage.setItem("tnja_notifications", JSON.stringify(newNotifs));
    window.dispatchEvent(new Event("tnja_notifications_updated"));
  };
  const unreadCount = notifications.filter(n => !n.read).length;

  // Esc closes the notifications panel.
  useEffect(() => {
    if (!isNotifOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsNotifOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNotifOpen]);
  const router = useRouter();
  const pathname = usePathname();

  const [isMounted, setIsMounted] = useState(false);

  const switchView = async (view: "OFFICE" | "COACH") => {
    setIsSwitchingView(true);
    try {
      const res = await fetch(`${API_BASE}/auth/switch-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ view }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not switch view");
      localStorage.setItem("token", data.token);
      localStorage.setItem("userRole", data.role);
      // Full reload so every page, and the notifications socket, picks up the new role.
      window.location.assign(view === "OFFICE" ? "/dashboard/admin" : "/dashboard/member");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not switch view", "error");
      setIsSwitchingView(false);
    }
  };

  // Members: a promotion or demotion only reaches their token through a refresh.
  const refreshMemberSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      localStorage.setItem("token", data.token);
      if (data.role === localStorage.getItem("userRole")) return;
      localStorage.setItem("userRole", data.role);
      // Full reload so every page, and the notifications socket, picks up the new role.
      window.location.assign(data.role === "MEMBER" ? "/dashboard/member" : "/dashboard/admin");
    } catch {
      // Keep the current session; the next dashboard load tries again.
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("userRole");
    const name = localStorage.getItem("userName");
    const status = localStorage.getItem("userStatus");

    if (!token) {
      startTransition(() => router.push("/login"));
      return;
    }

    if (role) setUserRole(role);
    if (name) setUserName(name);
    if (status) setUserStatus(status);

    // Coaches: pick up an office assigned (or removed) since they logged in.
    const storedOffice = localStorage.getItem("officeRole");
    setOfficeRole(storedOffice);
    if (role === "COACH" || storedOffice) {
      fetch(`${API_BASE}/auth/profile`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.user) return;
          const office: string | null = data.user.officeRole ?? null;
          setOfficeRole(office);
          if (office) localStorage.setItem("officeRole", office);
          else {
            localStorage.removeItem("officeRole");
            // The office was taken away while in the office view: return to the coach view.
            if (role !== "COACH") switchView("COACH");
          }
        })
        .catch(() => {});
    } else if (role && MEMBER_ACCOUNT_ROLES.includes(role)) {
      refreshMemberSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("userRole") || "GUEST";
    if (!token) return;

    let userId = "";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      userId = payload.userId;
    } catch (e) {
      console.error("Failed to parse token payload:", e);
      return;
    }

    if (!userId) return;

    let defaultWsUrl = "ws://localhost:9000";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";
    if (apiUrl) {
      defaultWsUrl = apiUrl.replace("http://", "ws://").replace("https://", "wss://").replace("/api", "");
    }
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || defaultWsUrl;
    const socket = new WebSocket(`${wsUrl}?userId=${userId}&role=${role}`);

    socket.onopen = () => {
      console.log("[WS] Connected to notifications server");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ROLE_CHANGED") refreshMemberSession();
        if (data.message) {
          showToast(data.message, "success");
          const newNotif = {
            id: data.grievanceId || data.tournamentId || data.id || Date.now().toString(),
            message: data.message,
            createdAt: data.createdAt || new Date().toISOString(),
            read: false,
          };
          setNotifications(prev => {
            const updated = [newNotif, ...prev];
            localStorage.setItem("tnja_notifications", JSON.stringify(updated));
            window.dispatchEvent(new Event("tnja_notifications_updated"));
            return updated;
          });
        }
      } catch (err) {
        console.error("[WS] Error parsing websocket message:", err);
      }
    };

    socket.onclose = () => {};

    socket.onerror = () => {
      // Connection failed silently — backend may not be running
    };

    return () => {
      socket.close();
    };
  }, []);

  if (!isMounted) return null;

  const isPresident = userRole && [
    "STATE_PRESIDENT", "ZONE_PRESIDENT", "DISTRICT_PRESIDENT"
  ].includes(userRole);

  const isSecretary = userRole && [
    "STATE_SECRETARY", "ZONE_SECRETARY", "DISTRICT_SECRETARY"
  ].includes(userRole);

  // Tournaments has no sidebar sub-menu: its Approval Queue / My / Approved views are tabs on the page.
  const adminNavItems = [
    { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { name: "Approvals", href: "/dashboard/admin/approvals", icon: ShieldCheck },
    { name: "Events", href: "/dashboard/admin/events", icon: Calendar },
    { name: "Tournaments", href: "/dashboard/admin/tournaments", icon: Trophy },
    // Super Admin / CEO manage everyone in User Management, so they don't get the separate read-only Members List.
    { name: "User Management", href: "/dashboard/admin/users", icon: Users },
    { name: "Officials Directory", href: "/dashboard/admin/officials", icon: ShieldCheck },
    { name: "Grievances", href: "/dashboard/admin/grievances", icon: MessageSquare },
  ];

  // Add Super Admin only links
  if (userRole === "SUPER_ADMIN" || userRole === "CEO") {
    adminNavItems.push({
      name: "Payments",
      href: "/dashboard/admin/payments",
      icon: IndianRupee,
      children: [
        { name: "Event Payments", href: "/dashboard/admin/payments?purpose=EVENT" },
        { name: "Tournament Payments", href: "/dashboard/admin/payments?purpose=TOURNAMENT" },
        { name: "Registration Fees", href: "/dashboard/admin/payments?purpose=REGISTRATION" },
        { name: "All Payments", href: "/dashboard/admin/payments" },
      ],
    } as (typeof adminNavItems)[number]);
    adminNavItems.push({ name: "Configuration", href: "/dashboard/admin/configuration", icon: SlidersHorizontal });
  }

  const presidentNavItems = [
    { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { name: "Approvals", href: "/dashboard/admin/approvals", icon: FileCheck2 },
    { name: "Events", href: "/dashboard/admin/events", icon: Calendar },
    { name: "Tournaments", href: "/dashboard/admin/tournaments", icon: Trophy },
    { name: "Administrative Members List", href: "/dashboard/admin/members", icon: Users },
    { name: "Grievances", href: "/dashboard/admin/grievances", icon: MessageSquare },
  ];

  const secretaryNavItems = [
    { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { name: "Administrative Members", href: "/dashboard/admin/members", icon: Users },
    { name: "Events", href: "/dashboard/admin/events", icon: Calendar },
    { name: "Tournaments", href: "/dashboard/admin/tournaments", icon: Trophy },
    { name: "Approvals", href: "/dashboard/admin/approvals", icon: ClipboardList },
    { name: "Grievances", href: "/dashboard/admin/grievances", icon: ScrollText },
  ];

  // Zone officers approve only zonal events and tournaments (on those pages), so no Approvals entry.
  const isZoneOfficer = userRole === "ZONE_PRESIDENT" || userRole === "ZONE_SECRETARY";
  // Only state officers handle grievances; district and zone officers can still raise their own.
  const isStateOfficer = userRole === "STATE_PRESIDENT" || userRole === "STATE_SECRETARY";
  const officerNavItems = (items: typeof presidentNavItems) =>
    items
      .filter((item) => !(isZoneOfficer && item.href === "/dashboard/admin/approvals"))
      .map((item) =>
        item.href === "/dashboard/admin/grievances" && !isStateOfficer
          ? { ...item, name: "My Grievances", href: "/dashboard/grievance" }
          : item
      );

  const navItems = isPresident
    ? officerNavItems(presidentNavItems)
    : isSecretary
    ? officerNavItems(secretaryNavItems)
    : (userRole === "SUPER_ADMIN" || userRole === "CEO")
    ? adminNavItems
    : userRole === "PLAYER"
    ? [
        { name: "Dashboard", href: "/dashboard/player", icon: LayoutDashboard },
        { name: "Tournaments", href: "/dashboard/player/tournaments", icon: Trophy },
        { name: "Match History", href: "/dashboard/player/match-history", icon: ScrollText },
        { name: "Events", href: "/dashboard/member/events", icon: Calendar },
        { name: "Grievances", href: "/dashboard/grievance", icon: MessageSquare },
      ]
    : userRole === "COACH"
    ? [
        { name: "Dashboard", href: "/dashboard/member", icon: LayoutDashboard },
        { name: "My Students", href: "/dashboard/coach/students", icon: Users },
        { name: "My Mats", href: "/dashboard/coach/mats", icon: Trophy },
        { name: "Monthly Update", href: "/dashboard/coach/monthly", icon: CalendarCheck },
        { name: "Events", href: "/dashboard/member/events", icon: Calendar },
        { name: "Grievances", href: "/dashboard/grievance", icon: MessageSquare },
      ]
    : userRole === "CLUB"
    ? [
        { name: "My Profile", href: "/dashboard/member", icon: User },
        { name: "Tournaments", href: "/dashboard/club/tournaments", icon: Trophy },
        { name: "Events", href: "/dashboard/member/events", icon: Calendar },
        { name: "Grievances", href: "/dashboard/grievance", icon: MessageSquare },
      ]
    : [
        { name: "My Profile", href: "/dashboard/member", icon: User },
        { name: "Events", href: "/dashboard/member/events", icon: Calendar },
        { name: "Grievances", href: "/dashboard/grievance", icon: MessageSquare },
      ];

  const replayNavItems = [
    { name: "Resubmit Application", href: "/dashboard/resubmit", icon: FileCheck2 },
  ];

  // Everyone can see the rankings (best student, coach, club, district and zone).
  const currentNavItems = userStatus === "REPLAY" ? replayNavItems : [...navItems, { name: "Rankings", href: "/dashboard/rankings", icon: Medal }];

  return (
    <div className="tnja-dashboard min-h-screen bg-slate-50 flex overflow-hidden print:overflow-visible print:bg-white print:min-h-0 print:block">
      {/* Global Toast */}
      <AnimatePresence>
        {toast && !isNotifOpen && (
          // A live notification arrives as a card sliding in from the right; clicking it opens the panel.
          <motion.button
            type="button"
            onClick={() => { setToast(null); setIsNotifOpen(true); }}
            initial={{ x: "120%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "120%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed top-6 right-6 z-[999] w-[min(360px,calc(100vw-3rem))] flex items-start gap-3 p-4 bg-white border border-slate-200 border-l-4 border-l-[#FF7400] rounded-xl shadow-2xl text-left cursor-pointer"
          >
            <span className="w-9 h-9 rounded-full bg-orange-50 text-[#FF7400] flex items-center justify-center shrink-0">
              <Bell size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-black text-slate-400 uppercase tracking-wide">New notification</span>
              <span className="block text-sm font-semibold text-slate-800 mt-0.5 line-clamp-3">{toast.msg}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Notifications panel: slides in from the right edge */}
      <AnimatePresence>
        {isNotifOpen && (
          <>
            <motion.div
              key="notif-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotifOpen(false)}
              className="fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-[1px]"
            />
            <motion.aside
              key="notif-panel"
              role="dialog"
              aria-label="Notifications"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed top-0 right-0 z-[95] h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl flex flex-col"
            >
              <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-[#FF7400]" />
                  <h2 className="text-base font-black text-slate-800">Notifications</h2>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#FF7400] text-white text-[11px] font-black">{unreadCount} new</span>
                  )}
                </div>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  aria-label="Close notifications"
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {notifications.length > 0 && (
                <div className="px-5 py-2.5 flex items-center justify-between text-xs font-bold border-b border-slate-200 bg-white/60 shrink-0">
                  <button
                    onClick={() => saveNotifications(notifications.map(n => ({ ...n, read: true })))}
                    disabled={unreadCount === 0}
                    className="text-[#FF7400] hover:underline disabled:text-slate-300 disabled:no-underline"
                  >
                    Mark all as read
                  </button>
                  <button onClick={() => saveNotifications([])} className="text-slate-400 hover:text-red-500">
                    Clear all
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-300">
                    <Bell size={36} />
                    <p className="text-sm font-bold text-slate-500">You&apos;re all caught up</p>
                    <p className="text-xs text-slate-400">New approvals, tournaments and grievances will appear here.</p>
                  </div>
                ) : (
                  <AnimatePresence initial={true}>
                    {notifications.map((notif, i) => (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ x: 80, opacity: 0 }}
                        animate={{ x: 0, opacity: 1, transition: { delay: 0.08 + Math.min(i, 10) * 0.05, type: "spring", stiffness: 300, damping: 28 } }}
                        exit={{ x: 80, opacity: 0, transition: { duration: 0.2 } }}
                        onClick={() => !notif.read && saveNotifications(notifications.map(n => n.id === notif.id ? { ...n, read: true } : n))}
                        className={`group relative bg-white border border-slate-200 rounded-xl p-4 pr-10 shadow-sm cursor-default ${
                          notif.read ? "" : "border-l-4 border-l-[#FF7400]"
                        }`}
                      >
                        <p className={`text-sm leading-relaxed ${notif.read ? "text-slate-500" : "text-slate-800 font-semibold"}`}>
                          {notif.message}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium mt-1.5">{timeAgo(notif.createdAt)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); saveNotifications(notifications.filter(n => n.id !== notif.id)); }}
                          aria-label="Dismiss notification"
                          className="absolute top-3 right-3 p-1 text-slate-300 hover:text-slate-600 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:relative z-50 h-screen transition-all duration-300 bg-white border-r border-slate-200 flex flex-col shadow-sm print:hidden
          ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 w-64 md:w-[72px]"}
        `}
      >
        {/* Logo Header */}
        <div className={`flex items-center border-b border-slate-100 ${isSidebarOpen ? "px-4 py-4 gap-3" : "px-0 py-4 justify-center"}`}>
          {isSidebarOpen ? (
            <>
              <img src={TNJA_LOGO} alt="Tamil Nadu Judo Association logo" className="w-11 h-11 object-contain shrink-0" />
              <div className="flex-grow overflow-hidden">
                <p className="text-[11px] font-black text-slate-800 leading-tight truncate">TAMIL NADU JUDO</p>
                <p className="text-[10px] font-bold text-[#FF7400] leading-tight truncate">ASSOCIATION 329/2017</p>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg shrink-0"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={18} className="text-slate-500" />
            </button>
          )}
        </div>

        {/* Nav section. Profile details live in the avatar menu in the header, not here. */}
        <nav className="flex-grow px-3 pt-5 overflow-y-auto pb-24 scrollbar-hide">
          {isSidebarOpen && (
            <p className="text-sm font-bold text-slate-800 px-2 pb-3">Dashboard</p>
          )}
          <div className="space-y-1">
            {currentNavItems
              .map((item) => {
              const hasChildren = !!(item as any).children?.length;
              const children = (item as any).children as { name: string; href: string }[] | undefined;
              const isOnSectionRoute = pathname.startsWith(item.href);
              const isDropdownOpen = openDropdown === item.name || (hasChildren && isOnSectionRoute && openDropdown !== `${item.name}_closed`);
              // Section links (e.g. /dashboard/admin/tournaments) also stay active on their sub-pages;
              // role home links like /dashboard/admin only match exactly.
              const isActive = pathname === item.href ||
                (item.href.split("/").length > 3 && pathname.startsWith(`${item.href}/`));
              const isParentHighlighted = hasChildren ? isOnSectionRoute : isActive;

              if (hasChildren && isSidebarOpen) {
                return (
                  <div key={item.name}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenDropdown(isDropdownOpen ? `${item.name}_closed` : item.name);
                      }}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${
                        isParentHighlighted ? "bg-orange-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <div
                        style={{
                          backgroundColor: isParentHighlighted ? "#FF7400" : "#FFA726",
                          boxShadow: isParentHighlighted
                            ? "0 4px 10px rgba(255,116,0,0.3)"
                            : "0 2px 6px rgba(255,167,38,0.25)",
                        }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                      >
                        <item.icon size={17} color="#ffffff" />
                      </div>
                      <span className={`text-sm font-semibold flex-grow text-left ${
                        isParentHighlighted ? "text-[#FF7400]" : "text-slate-700"
                      }`}>
                        {item.name}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 text-slate-400 ${isDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isDropdownOpen && (
                      <div className="ml-3 mt-0.5 pl-4 border-l-2 border-orange-100 space-y-0.5">
                        {children?.map(child => (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-[#FF7400] hover:bg-orange-50 transition-all"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-[#FFA726] shrink-0" />
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${
                    isParentHighlighted
                      ? "bg-orange-50"
                      : "hover:bg-slate-50"
                  } ${!isSidebarOpen ? "justify-center" : ""}`}
                >
                  <div
                    style={{
                      backgroundColor: isParentHighlighted ? "#FF7400" : "#FFA726",
                      boxShadow: isParentHighlighted
                        ? "0 4px 10px rgba(255,116,0,0.3)"
                        : "0 2px 6px rgba(255,167,38,0.25)",
                    }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  >
                    <item.icon size={17} color="#ffffff" />
                  </div>
                  {isSidebarOpen && (
                    <span
                      className={`text-sm font-semibold ${
                        isParentHighlighted ? "text-[#FF7400]" : "text-slate-700"
                      }`}
                    >
                      {item.name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        {/* Footer: account settings (password, notifications, log out) for every role */}
        <div className={`border-t border-slate-100 p-3 ${!isSidebarOpen ? "flex flex-col items-center" : ""}`}>
          {officeRole && (
            <button
              type="button"
              onClick={() => switchView(userRole === "COACH" ? "OFFICE" : "COACH")}
              disabled={isSwitchingView}
              title={userRole === "COACH" ? `Switch to ${officeRole.replace(/_/g, " ").toLowerCase()} view` : "Switch to coach view"}
              className={`flex items-center gap-3 px-2 py-2 mb-1 rounded-xl transition-all text-slate-600 hover:bg-orange-50 hover:text-[#FF7400] disabled:opacity-60 cursor-pointer ${!isSidebarOpen ? "w-auto justify-center" : "w-full"}`}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-orange-100 text-[#FF7400]">
                <ArrowLeftRight size={17} />
              </div>
              {isSidebarOpen && (
                <span className="text-left leading-tight">
                  <span className="block text-sm font-semibold">
                    {isSwitchingView ? "Switching…" : userRole === "COACH" ? "Switch to Office View" : "Switch to Coach View"}
                  </span>
                  {userRole === "COACH" && (
                    <span className="block text-[11px] text-slate-400 capitalize">{officeRole.replace(/_/g, " ").toLowerCase()}</span>
                  )}
                </span>
              )}
            </button>
          )}
          <Link
            href="/dashboard/settings"
            onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-all ${
              pathname === "/dashboard/settings" ? "bg-orange-50 text-[#FF7400]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            } ${!isSidebarOpen ? "w-auto justify-center" : "w-full"}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pathname === "/dashboard/settings" ? "bg-[#FF7400] text-white" : "bg-slate-100 text-slate-500"}`}>
              <Settings size={17} />
            </div>
            {isSidebarOpen && <span className="text-sm font-semibold">Settings</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-grow flex flex-col h-screen overflow-hidden min-w-0 print:h-auto print:overflow-visible print:block">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-30 shrink-0 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-500 shrink-0"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg md:text-xl font-semibold text-slate-800 truncate">
              {pathname === "/dashboard/profile" ? "My Profile" : pathname === "/dashboard/settings" ? "Settings" : currentNavItems.find(i => i.href === pathname)?.name || "Dashboard"}
            </h2>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                className="p-2 text-slate-400 hover:text-[#FF7400] relative focus:outline-none transition-colors cursor-pointer"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-[#FF7400] text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

            </div>
            <div className="relative border-l pl-4 md:pl-6 border-slate-200 shrink-0">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center space-x-2 md:space-x-3 focus:outline-none hover:opacity-85 transition-opacity cursor-pointer"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-bold text-slate-800">{userName}</p>
                  <p className="text-xs text-slate-400 capitalize">{userRole?.replace("_", " ").toLowerCase()}</p>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-orange-50 rounded-full flex items-center justify-center text-[#FF7400] font-bold border-2 border-white shadow-sm shrink-0">
                  {userName.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileDropdownOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-slate-100 bg-slate-50/50 text-left">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Account</p>
                        <p className="text-sm font-extrabold text-slate-800 truncate mt-0.5">{userName}</p>
                      </div>
                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            router.push("/dashboard/profile");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-orange-50 hover:text-[#FF7400] rounded-xl transition-colors text-sm font-bold text-left cursor-pointer"
                        >
                          <User size={18} />
                          My Profile Details
                        </button>
                        <button
                          onClick={() => {
                            setIsProfileDropdownOpen(false);
                            router.push("/dashboard/settings");
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-orange-50 hover:text-[#FF7400] rounded-xl transition-colors text-sm font-bold text-left cursor-pointer"
                        >
                          <Settings size={18} />
                          Settings
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-grow overflow-y-auto p-8 bg-slate-50 print:overflow-visible print:p-0 print:bg-white print:block">
          {children}
        </main>
      </div>

    </div>
  );
}
