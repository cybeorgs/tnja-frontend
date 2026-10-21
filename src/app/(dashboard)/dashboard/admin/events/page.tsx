"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Plus,
  MapPin,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  Video,
  User,
  Pencil
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const STATUS_TABS = [
  { id: "ALL", label: "All" },
  { id: "APPROVED", label: "Approved" },
  { id: "PENDING", label: "Pending" },
  { id: "REJECTED", label: "Rejected" },
];

const STATUS_STYLE: Record<string, { label: string; text: string; icon: React.ReactNode }> = {
  APPROVED: { label: "Approved", text: "text-emerald-700", icon: <CheckCircle2 size={14} /> },
  PENDING: { label: "Awaiting approval", text: "text-amber-700", icon: <AlertCircle size={14} /> },
  REJECTED: { label: "Rejected", text: "text-red-600", icon: <XCircle size={14} /> },
};

const LEVEL_LABEL: Record<string, string> = { CLUB: "Club", DISTRICT: "District", ZONE: "Zone", STATE: "State", NATIONAL: "National" };
const PARTICIPANT_LABEL: Record<string, string> = { PLAYER: "Players", STUDENT: "Players", COACH: "Coaches", MEMBER: "Members", CLUB: "Clubs", OFFICIAL: "Officials" };

export default function EventsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [districts, setDistricts] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("GUEST");
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [eventSections, setEventSections] = useState<string[]>([]);
  const [sectionOpen, setSectionOpen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);

  const EVENT_COLORS = [
    { label: "Black", value: "#000000", gradient: "from-black via-zinc-800 to-zinc-600" },
    { label: "Orange", value: "#FF7400", gradient: "from-orange-900 via-orange-600 to-[#FF7400]" },
    { label: "Indigo", value: "#4F46E5", gradient: "from-indigo-900 via-purple-700 to-[#FF7400]" },
    { label: "Green", value: "#16A34A", gradient: "from-green-900 via-emerald-700 to-emerald-400" },
    { label: "Red", value: "#DC2626", gradient: "from-red-900 via-red-700 to-rose-400" },
    { label: "Blue", value: "#2563EB", gradient: "from-blue-900 via-blue-700 to-sky-400" },
  ];

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    location: "",
    description: "",
    level: "DISTRICT",
    participantType: "ALL",
    districtId: "",
    zoneId: "",
    isPaid: false,
    entryFee: "",
    color: "#FF7400",
    eventSection: "",
    meetingLink: "",
  });

  const getFilteredDistrictsForCreation = useCallback(() => {
    if (!userProfile) return districts;
    const isAdmin = ["SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(userRole);
    if (isAdmin) return districts;

    const userZone = userProfile.district?.zoneName;
    const isZoneAdmin = ["ZONE_PRESIDENT", "ZONE_SECRETARY"].includes(userRole);

    if (isZoneAdmin && userZone) {
      return districts.filter(d => d.zoneName === userZone);
    }

    return districts.filter(d => d.id === userProfile.districtId);
  }, [districts, userProfile, userRole]);

  const getFilteredZonesForCreation = useCallback(() => {
    const allZones = ["Chennai Zone", "Salem Zone", "Coimbatore Zone", "Trichy Zone", "Madurai Zone"];
    if (!userProfile) return allZones;
    const isAdmin = ["SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "CEO"].includes(userRole);
    if (isAdmin) return allZones;

    const userZone = userProfile.district?.zoneName;
    if (userZone) return [userZone];
    return [];
  }, [userProfile, userRole]);

  const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/events/admin`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setEvents(json);
      }
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDistricts = async () => {
    try {
      const res = await fetch(`${API_BASE}/districts`);
      if (res.ok) setDistricts(await res.json());
    } catch (err) {
      console.error("Failed to load districts", err);
    }
  };

  const fetchEventSections = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/events/sections`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json: { name: string }[] = await res.json();
        setEventSections(
          json.map(s => s.name).filter(n => n.toLowerCase() !== "competition")
        );
      } else {
        setEventSections([]);
      }
    } catch {
      setEventSections([]);
    }
  };

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        setUserProfile(json.user);
        setUserRole(json.role);
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchDistricts();
    fetchProfile();
    fetchEventSections();
  }, [fetchEvents]);

  useEffect(() => {
    const fd = getFilteredDistrictsForCreation();
    if (formData.level === "DISTRICT" && fd.length === 1) {
      setFormData(prev => ({ ...prev, districtId: fd[0].id }));
    }
    const fz = getFilteredZonesForCreation();
    if (formData.level === "ZONE" && fz.length === 1) {
      setFormData(prev => ({ ...prev, zoneId: fz[0] }));
    }
  }, [formData.level, districts, userProfile, getFilteredDistrictsForCreation, getFilteredZonesForCreation]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node))
        setSectionOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/events/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create event");

      showToast("Event created and submitted for approval!", "success");
      setIsCreateModalOpen(false);
      setFormData({
        title: "", date: "", location: "", description: "", level: "DISTRICT", participantType: "ALL", districtId: "", zoneId: "", isPaid: false, entryFee: "", color: "#FF7400", eventSection: "", meetingLink: "",
      });
      fetchEvents();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (event: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setFormData({
      title: event.title || "",
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : "",
      location: event.location || "",
      description: event.description || "",
      level: event.level || "DISTRICT",
      participantType: event.participantType || "ALL",
      districtId: event.districtId || "",
      zoneId: event.zoneId || "",
      isPaid: event.isPaid || false,
      entryFee: event.entryFee ? String(event.entryFee) : "",
      color: event.color || "#FF7400",
      eventSection: event.eventSection || "",
      meetingLink: event.meetingLink || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setEditSubmitLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/events/${editingEvent.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update event");

      showToast("Event updated successfully!", "success");
      setIsEditModalOpen(false);
      setEditingEvent(null);
      setFormData({
        title: "", date: "", location: "", description: "", level: "DISTRICT", participantType: "ALL", districtId: "", zoneId: "", isPaid: false, entryFee: "", color: "#FF7400", eventSection: "", meetingLink: ""
      });
      fetchEvents();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setEditSubmitLoading(false);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredEvents = events.filter(ev => {
    if (filter !== "ALL" && ev.status !== filter) return false;
    if (query && !`${ev.title} ${ev.location ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const upcomingEvents = filteredEvents
    .filter(ev => new Date(ev.date).getTime() >= startOfToday)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = filteredEvents
    .filter(ev => new Date(ev.date).getTime() < startOfToday)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-8 relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-200 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar: status tabs (with counts), search, create */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex flex-wrap gap-1 p-1 bg-white border border-slate-200 rounded-lg w-fit" role="tablist" aria-label="Filter events by status">
          {STATUS_TABS.map((tab) => {
            const active = filter === tab.id;
            const count = tab.id === "ALL" ? events.length : events.filter((e) => e.status === tab.id).length;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`relative inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold transition-colors duration-300 ${
                  active ? "text-white" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="event-status-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    className="absolute inset-0 rounded-md bg-[#FF7400]"
                  />
                )}
                <span className="relative">{tab.label}</span>
                <span className={`relative tabular-nums ${active ? "text-white/80" : "text-slate-400"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 lg:ml-auto">
          <div className="relative flex-1 lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title or location"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#FF7400] text-sm text-slate-700"
            />
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF7400] hover:bg-[#E56900] text-white font-bold rounded-lg text-sm transition-colors"
          >
            <Plus size={16} className="stroke-[2.5]" />
            Create Event
          </button>
        </div>
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#FF7400]" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-lg">
          <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {events.length === 0 ? "No events yet" : "No events match your filters"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {events.length === 0 ? "Create the first event for your jurisdiction." : "Try another status or clear the search."}
          </p>
          {events.length === 0 && (
            <button onClick={() => setIsCreateModalOpen(true)} className="mt-4 text-sm font-bold text-[#FF7400] hover:underline">
              Create Event
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { title: "Upcoming", items: upcomingEvents },
            { title: "Past", items: pastEvents },
          ].filter((g) => g.items.length > 0).map((group) => (
            <section key={group.title}>
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                {group.title} <span className="text-slate-300">· {group.items.length}</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.items.map((event) => {
                  const d = new Date(event.date);
                  const st = STATUS_STYLE[event.status] ?? STATUS_STYLE.PENDING;
                  const isPast = group.title === "Past";
                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedEvent(event)}
                      className={`group relative bg-white border border-slate-200 rounded-lg overflow-hidden cursor-pointer hover:border-[#FF7400] hover:shadow-md transition-all ${isPast ? "opacity-75" : ""}`}
                    >
                      <div className="h-1" style={{ background: event.color || "#FF7400" }} />
                      <div className="p-4 flex gap-4">
                        {/* Date badge */}
                        <div className="w-14 shrink-0 text-center border border-slate-200 rounded-lg overflow-hidden h-fit">
                          <p className="text-[10px] font-black uppercase py-0.5 text-white" style={{ background: event.color || "#FF7400" }}>
                            {d.toLocaleDateString("en-IN", { month: "short" })}
                          </p>
                          <p className="text-xl font-black text-slate-800 leading-tight pt-1">{d.getDate()}</p>
                          <p className="text-[10px] font-bold text-slate-400 pb-1">{d.toLocaleDateString("en-IN", { weekday: "short" })}</p>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-[15px] font-black text-slate-900 leading-snug pr-14 line-clamp-2">{event.title}</h3>
                          <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                            <p className="flex items-center gap-1.5 truncate">
                              <MapPin size={13} className="text-slate-400 shrink-0" />
                              <span className="truncate">{event.location || "Location to be announced"}</span>
                            </p>
                            {event.meetingLink && (
                              <a href={event.meetingLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 font-bold text-[#FF7400] hover:underline w-fit">
                                <Video size={13} className="shrink-0" /> Join online meeting
                              </a>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5 mt-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">
                              {LEVEL_LABEL[event.level] ?? event.level}{event.district?.name ? ` · ${event.district.name}` : ""}
                            </span>
                            {event.participantType && event.participantType !== "ALL" && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">
                                {PARTICIPANT_LABEL[event.participantType] ?? event.participantType}
                              </span>
                            )}
                            {event.eventSection && (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold">{event.eventSection}</span>
                            )}
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${event.isPaid ? "bg-orange-50 text-[#C45A00]" : "bg-emerald-50 text-emerald-700"}`}>
                              {event.isPaid ? `₹${Number(event.entryFee || 0).toLocaleString("en-IN")}` : "Free"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status footer */}
                      <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${st.text}`}>
                          {st.icon}
                          {event.status === "APPROVED" && event.approvedBy ? `Approved by ${event.approvedBy}` : st.label}
                        </span>
                      </div>

                      <button
                        onClick={(e) => handleOpenEdit(event, e)}
                        aria-label={`Edit ${event.title}`}
                        className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:text-[#FF7400] hover:border-[#FF7400] text-[11px] font-bold rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-[2px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 mb-2">Propose New Event</h2>
                  <p className="text-slate-500">Fill in the details to propose a new event.</p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all cursor-pointer"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleCreate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* ── Event Section Dropdown ── */}
                  <div className="md:col-span-2" ref={sectionRef}>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">
                      Event Section
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setSectionOpen(o => !o)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl hover:border-[#FF7400] focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 focus:border-[#FF7400] transition-all"
                      >
                        <span className={`text-sm font-semibold ${formData.eventSection ? "text-slate-800" : "text-slate-400"}`}>
                          {formData.eventSection || "Select event section"}
                        </span>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${sectionOpen ? "rotate-180" : ""}`} />
                      </button>

                      <AnimatePresence>
                        {sectionOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full mt-1 left-0 right-0 z-150 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                          >
                            <div className="max-h-64 overflow-y-auto py-1">
                              {eventSections.map((section) => (
                                <button
                                  key={section}
                                  type="button"
                                  onClick={() => { setFormData(f => ({ ...f, eventSection: section })); setSectionOpen(false); }}
                                  className={`w-full text-left px-6 py-3 text-sm font-semibold transition-colors ${formData.eventSection === section
                                    ? "bg-[#FF7400] text-white"
                                    : "text-slate-700 hover:bg-orange-50 hover:text-[#FF7400]"
                                    }`}
                                >
                                  {section}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {formData.eventSection === "Seminar (Online)" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Meeting Link</label>
                      <input 
                        type="url" 
                        required
                        value={formData.meetingLink}
                        onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="e.g. https://meet.google.com/abc-defg-hij"
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Event Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter a descriptive title"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Date</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Location</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Nehru Stadium"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Event Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({ ...formData, level: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                    >
                      <option value="DISTRICT">District Level</option>
                      <option value="ZONE">Zone Level</option>
                      <option value="STATE">State Level</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Target Audience</label>
                    <select
                      value={formData.participantType}
                      onChange={e => setFormData({ ...formData, participantType: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                    >
                      <option value="ALL">Everyone</option>
                      <option value="STUDENT">Players Only</option>
                      <option value="COACH">Coaches/Referees Only</option>
                      <option value="MEMBER">Members Only</option>
                      <option value="CLUB">Clubs Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Entry Type</label>
                    <select
                      value={formData.isPaid ? "paid" : "free"}
                      onChange={e => setFormData({ ...formData, isPaid: e.target.value === "paid", entryFee: e.target.value === "free" ? "" : formData.entryFee })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {formData.isPaid && (
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.entryFee}
                        onChange={e => setFormData({ ...formData, entryFee: e.target.value })}
                        placeholder="Enter amount in ₹"
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                      />
                    </div>
                  )}

                  {formData.level === "DISTRICT" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Select District</label>
                      <select
                        required
                        value={formData.districtId}
                        onChange={e => setFormData({ ...formData, districtId: e.target.value })}
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                      >
                        <option value="">Select District</option>
                        {getFilteredDistrictsForCreation().map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.level === "ZONE" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Select Zone</label>
                      <select 
                        required
                        value={formData.zoneId}
                        onChange={e => setFormData({ ...formData, zoneId: e.target.value })}
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 font-semibold"
                      >
                        <option value="">Select Zone</option>
                        {getFilteredZonesForCreation().map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Event Banner Color</label>
                    <div className="flex gap-3 flex-wrap">
                      {EVENT_COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, color: c.value })}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${formData.color === c.value
                            ? "border-[#FF7400] shadow-md scale-105"
                            : "border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          <span
                            className="w-5 h-5 rounded-full border border-white/30 shadow-sm shrink-0"
                            style={{ background: c.value }}
                          />
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {/* Preview */}
                    <div
                      className="mt-3 h-12 rounded-xl overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${formData.color}dd, ${formData.color}88, ${formData.color}44)` }}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Description</label>
                    <textarea
                      required
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of the event..."
                      className="w-full h-32 px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800 resize-none"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-grow py-5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="flex-grow py-5 bg-[#FF7400] text-white font-bold rounded-2xl shadow-xl shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {submitLoading ? <Loader2 size={20} className="animate-spin" /> : "Submit for Approval"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Event Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-[2px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 mb-2">Edit Event</h2>
                  <p className="text-slate-500">Update the details of the event.</p>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all cursor-pointer"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleUpdate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* ── Event Section Dropdown ── */}
                  <div className="md:col-span-2" ref={sectionRef}>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">
                      Event Section
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setSectionOpen(o => !o)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl hover:border-[#FF7400] focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 focus:border-[#FF7400] transition-all"
                      >
                        <span className={`text-sm font-semibold ${formData.eventSection ? "text-slate-800" : "text-slate-400"}`}>
                          {formData.eventSection || "Select event section"}
                        </span>
                        <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${sectionOpen ? "rotate-180" : ""}`} />
                      </button>

                      <AnimatePresence>
                        {sectionOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full mt-1 left-0 right-0 z-[150] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
                          >
                            <div className="max-h-64 overflow-y-auto py-1">
                              {eventSections.map((section) => (
                                <button
                                  key={section}
                                  type="button"
                                  onClick={() => { setFormData(f => ({ ...f, eventSection: section })); setSectionOpen(false); }}
                                  className={`w-full text-left px-6 py-3 text-sm font-semibold transition-colors ${formData.eventSection === section
                                    ? "bg-[#FF7400] text-white"
                                    : "text-slate-700 hover:bg-orange-50 hover:text-[#FF7400]"
                                    }`}
                                >
                                  {section}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {formData.eventSection === "Seminar (Online)" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Meeting Link</label>
                      <input 
                        type="url" 
                        required
                        value={formData.meetingLink}
                        onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="e.g. https://meet.google.com/abc-defg-hij"
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Event Title</label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter a descriptive title"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Date</label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Location</label>
                    <input
                      type="text"
                      required
                      value={formData.location}
                      onChange={e => setFormData({ ...formData, location: e.target.value })}
                      placeholder="e.g. Nehru Stadium"
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all text-slate-800"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Event Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({ ...formData, level: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                    >
                      <option value="DISTRICT">District Level</option>
                      <option value="ZONE">Zone Level</option>
                      <option value="STATE">State Level</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Target Audience</label>
                    <select
                      value={formData.participantType}
                      onChange={e => setFormData({ ...formData, participantType: e.target.value })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                    >
                      <option value="ALL">Everyone</option>
                      <option value="STUDENT">Players Only</option>
                      <option value="COACH">Coaches/Referees Only</option>
                      <option value="MEMBER">Members Only</option>
                      <option value="CLUB">Clubs Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Entry Type</label>
                    <select
                      value={formData.isPaid ? "paid" : "free"}
                      onChange={e => setFormData({ ...formData, isPaid: e.target.value === "paid", entryFee: e.target.value === "free" ? "" : formData.entryFee })}
                      className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {formData.isPaid && (
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.entryFee}
                        onChange={e => setFormData({ ...formData, entryFee: e.target.value })}
                        placeholder="Enter amount in ₹"
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                      />
                    </div>
                  )}

                  {formData.level === "DISTRICT" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Select District</label>
                      <select
                        required
                        value={formData.districtId}
                        onChange={e => setFormData({ ...formData, districtId: e.target.value })}
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                      >
                        <option value="">Select District</option>
                        {getFilteredDistrictsForCreation().map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.level === "ZONE" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Select Zone</label>
                      <select
                        required
                        value={formData.zoneId}
                        onChange={e => setFormData({ ...formData, zoneId: e.target.value })}
                        className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all font-semibold text-slate-800"
                      >
                        <option value="">Select Zone</option>
                        {getFilteredZonesForCreation().map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-600 uppercase tracking-widest mb-2">Description</label>
                    <textarea
                      required
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Detailed description of the event..."
                      className="w-full h-32 px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 focus:border-[#FF7400] transition-all resize-none text-slate-800"
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-grow py-5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitLoading}
                    className="flex-grow py-5 bg-[#FF7400] text-white font-bold rounded-2xl shadow-xl shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {editSubmitLoading ? <Loader2 size={20} className="animate-spin" /> : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Event Details Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-2xl bg-white rounded-[2px] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="inline-block px-3 py-1.5 bg-[#FFEEDC] text-black text-[12px] font-bold rounded-md mb-2">
                    {selectedEvent.eventSection || "Event"}
                  </span>
                  <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">{selectedEvent.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all cursor-pointer"
                >
                  <XCircle size={28} />
                </button>
              </div>

              {/* Event Cover / Banner Preview */}
              <div
                className="h-40 rounded-3xl mb-8 relative overflow-hidden flex items-end p-6 border-b-[4px] border-[#FFDA00]"
                style={{ background: selectedEvent.color ? `linear-gradient(135deg, ${selectedEvent.color}dd, ${selectedEvent.color}88, ${selectedEvent.color}44)` : "linear-gradient(135deg, #1e1b4b, #7c3aed, #FF7400)" }}
              >
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 backdrop-blur-[1px]"></div>
                <div className="relative z-10 text-white font-bold text-sm bg-black/30 backdrop-blur-md px-4 py-2 rounded-xl">
                  {selectedEvent.level} Level Event
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF7400] flex items-center justify-center">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                    <p className="text-sm font-bold text-slate-700">{new Date(selectedEvent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF7400] flex items-center justify-center">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location / Venue</p>
                    <p className="text-sm font-bold text-slate-700">{selectedEvent.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF7400] flex items-center justify-center">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Audience</p>
                    <p className="text-sm font-bold text-slate-700">{selectedEvent.participantType === "ALL" ? "Everyone" : `${selectedEvent.participantType}s Only`}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF7400] flex items-center justify-center">
                    <span className="font-bold text-md text-[#FF7400]">₹</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Entry Fee</p>
                    <p className="text-sm font-bold text-slate-700">{selectedEvent.isPaid ? `₹ ${selectedEvent.entryFee}` : 'Free Entry'}</p>
                  </div>
                </div>

                {selectedEvent.meetingLink && (
                  <div className="flex items-center gap-3 md:col-span-2 border-t pt-4 mt-2">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF7400] flex items-center justify-center">
                      <Video size={20} />
                    </div>
                    <div className="flex-grow">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Online Meeting Link</p>
                      <a
                        href={selectedEvent.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-bold text-orange-600 hover:text-orange-700 hover:underline break-all"
                      >
                        {selectedEvent.meetingLink}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-8">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Event Details & Description</h4>
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 text-sm text-slate-600 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {selectedEvent.description || "No description provided."}
                </div>
              </div>

              {/* Close Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all font-semibold cursor-pointer"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
