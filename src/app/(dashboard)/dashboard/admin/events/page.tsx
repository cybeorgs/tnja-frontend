"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Search,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Filter,
  ChevronDown,
  Video,
  User
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function EventsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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
  const filterRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    const handleScroll = () => {
      if (isFilterOpen) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // true for capture phase to catch all scrolling

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isFilterOpen]);

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

  const filteredEvents = events.filter(ev => {
    if (filter !== "ALL" && ev.status !== filter) return false;
    if (searchQuery && !ev.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const approvedCount = events.filter(e => e.status === "APPROVED").length;
  const pendingCount = events.filter(e => e.status === "PENDING").length;

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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-[#FF7400]">Events</h1>
          <p className="text-slate-500 text-sm mt-1">Create and Monitor Events within your jurisdiction</p>
        </div>
        <div
          className="p-[1.5px] rounded-[10px] shrink-0 inline-flex"
          style={{ background: 'linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)' }}
        >
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 font-bold rounded-[8.5px] hover:bg-slate-50 transition-all text-sm shadow-sm cursor-pointer"
          >
            <Plus size={18} className="stroke-[2.5]" />
            Create Event
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: "TOTAL EVENTS", value: events.length, icon: Calendar, borderColor: "border-[#FF7400] border-b-[4px]", shadowColor: "shadow-[0_14px_28px_-6px_rgba(255,116,0,0.65)]", iconColor: "text-[#FF7400]" },
          { label: "APPROVED", value: approvedCount, icon: CheckCircle2, borderColor: "border-[#FFDA00] border-b-[4px]", shadowColor: "shadow-[0_14px_28px_-6px_rgba(255,218,0,0.65)]", iconColor: "text-[#FFDA00]" },
          { label: "PENDING APPROVAL", value: pendingCount, icon: AlertCircle, borderColor: "border-[#552700] border-b-[4px]", shadowColor: "shadow-[0_14px_28px_-6px_rgba(85,39,0,0.65)]", iconColor: "text-[#8B4513]" },
        ].map((stat) => (
          <div key={stat.label} className={`bg-white p-6 rounded-[14px] transition-shadow border ${stat.borderColor} ${stat.shadowColor} flex flex-col justify-between h-[130px]`}>
            <p className="text-[11px] font-semibold text-slate-500 tracking-[0.15em]">{stat.label}</p>
            <div className="flex items-center justify-between">
              <h3 className="text-4xl font-black text-slate-900 leading-none">{stat.value}</h3>
              <div className={`w-[50px] h-[50px] bg-white rounded-full flex items-center justify-center shadow-[0_6px_12px_rgba(0,0,0,0.12),inset_0_3px_6px_rgba(0,0,0,0.12),inset_0_-3px_6px_rgba(255,255,255,1)] ${stat.iconColor}`}>
                <stat.icon size={22} className="stroke-[2.5]" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center mb-4">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events"
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-[#FF7400]/30 transition-all font-medium text-sm text-slate-700 shadow-sm"
          />
        </div>
        <div className="relative" ref={filterRef}>
          <div
            className="p-[1.5px] rounded-[10px] shrink-0 inline-flex shadow-sm"
            style={{ background: 'linear-gradient(to right, #552700 0%, #FF0E00 25%, #FFDA00 75%, #FF7400 100%)' }}
          >
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-800 font-bold rounded-[8.5px] hover:bg-slate-50 transition-all text-sm cursor-pointer"
            >
              <Filter size={16} />
              {filter === "ALL" ? "Filter" : filter}
            </button>
          </div>
          {isFilterOpen && (
            <div className="absolute top-full mt-2 right-0 bg-white border border-slate-200 shadow-xl rounded-[10px] overflow-hidden z-50 w-44">
              {["ALL", "APPROVED", "PENDING", "REJECTED"].map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setIsFilterOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${filter === f ? "bg-orange-50 text-[#FF7400]" : "text-slate-600 hover:bg-slate-50"
                    }`}
                >
                  {f === "ALL" ? "All Events" : f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin text-[#FF7400]" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-[20px] shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Calendar size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-500">No Events Found</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <motion.div
              key={event.id}
              whileHover={{ y: -5 }}
              onClick={() => setSelectedEvent(event)}
              className="bg-white rounded-[20px] shadow-xl shadow-slate-200/60 overflow-hidden flex flex-col group cursor-pointer"
            >
              <div
                className="h-44 relative overflow-hidden"
                style={{ background: event.color ? `linear-gradient(135deg, ${event.color}dd, ${event.color}88, ${event.color}44)` : "linear-gradient(135deg, #1e1b4b, #7c3aed, #FF7400)" }}
              >
                <div className="absolute inset-0 bg-black/20"></div>
                <div className="absolute inset-0 backdrop-blur-[2px]"></div>
              </div>

              <div className="p-6 flex-grow flex flex-col bg-white rounded-t-[20px] -mt-5 relative z-10 border-t-[4px] border-[#FFDA00]">
                <h3 className="text-[22px] font-bold text-black mb-5 leading-tight">
                  {event.title}
                </h3>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 text-[14px] text-slate-700">
                    <Calendar size={18} className="text-[#FF7400] stroke-[1.5]" />
                    {new Date(event.date).toLocaleDateString('en-GB')}
                  </div>
                  <div className="flex items-center gap-3 text-[14px] text-slate-700">
                    <MapPin size={18} className="text-[#FF7400] stroke-[1.5]" />
                    {event.location}
                  </div>
                  {event.meetingLink && (
                    <div className="flex items-center gap-3 text-[14px] text-slate-700">
                      <Video size={18} className="text-[#FF7400] stroke-[1.5]" />
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-orange-600 hover:text-orange-700 hover:underline font-bold transition-all"
                      >
                        Join Meeting
                      </a>
                    </div>
                  )}
                </div>

                <div className="mb-6 mt-auto">
                  <span className="inline-block px-3 py-1.5 bg-[#FFEEDC] text-black text-[12px] font-bold rounded-md">
                    {event.isPaid ? `Entry Fee : ₹ ${event.entryFee}` : 'Free Entry'}
                  </span>
                </div>

                {/* Status Box */}
                <div className={`-mx-6 pl-[20px] pr-6 py-3.5 font-bold text-[15px] ${event.status === "APPROVED" ? "bg-gradient-to-r from-[#FFF9D6] via-[#FFF9D6] to-transparent text-black border-l-[4px] border-[#FFDA00]" :
                  event.status === "PENDING" ? "bg-gradient-to-r from-[#FDF0E6] via-[#FDF0E6] to-transparent text-black border-l-[4px] border-[#FF7400]" :
                    "bg-gradient-to-r from-red-50 to-transparent text-red-600 border-l-[4px] border-red-500"
                  }`}>
                  {event.status === "APPROVED" ? `Approved by ${event.approvedBy || 'Super Admin'}` :
                    event.status === "PENDING" ? "Pending Approval" :
                      "Rejected"}
                </div>
                
                <div className="absolute top-4 right-4 z-20">
                  <button
                    onClick={(e) => handleOpenEdit(event, e)}
                    className="px-4 py-1.5 bg-white/90 backdrop-blur text-[#FF7400] text-xs font-bold rounded-full shadow-sm hover:bg-white transition-all border border-orange-100"
                  >
                    Edit Event
                  </button>
                </div>
              </div>
            </motion.div>
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
              className="w-full max-w-2xl bg-white rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
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
              className="w-full max-w-2xl bg-white rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
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
              className="w-full max-w-2xl bg-white rounded-[2.5rem] p-10 shadow-2xl overflow-y-auto max-h-[90vh]"
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
