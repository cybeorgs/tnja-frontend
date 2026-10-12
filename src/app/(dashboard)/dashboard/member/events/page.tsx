"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  Plus, 
  MapPin, 
  Clock, 
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Video,
  User
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function MemberEventsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
  
  const [activeSection, setActiveSection] = useState<"active" | "mine">("active");
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any | null>(null);
  const [editSubmitLoading, setEditSubmitLoading] = useState(false);

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

  const [toast, setToast] = useState<{msg: string, type: "success" | "error"} | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/events/active`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
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

  const fetchMyEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await fetch(`${API_BASE}/events/my`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setMyEvents(await res.json());
      }
    } catch (err) {
      console.error("Failed to load my events", err);
    }
  }, []);

  const fetchDistricts = async () => {
    try {
      const res = await fetch(`${API_BASE}/districts`);
      if (res.ok) {
        const json = await res.json();
        setDistricts(json);
      }
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
      }
    } catch (err) {
      console.error("Failed to load user profile", err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserRole(payload.role);
      } catch (e) {
        console.error("Failed to decode token", e);
      }
    }
    fetchEvents();
    fetchDistricts();
    fetchProfile();
    fetchEventSections();
    fetchMyEvents();
  }, [fetchEvents, fetchMyEvents]);

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

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleApply = async (event: any) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast("You must be logged in to apply", "error");
        return;
      }

      if (event.isPaid) {
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          showToast("Razorpay SDK failed to load. Are you offline?", "error");
          return;
        }

        const orderRes = await fetch(`${API_BASE}/events/create-payment-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ eventId: event.id }),
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok) {
          throw new Error(orderData.error || "Failed to create payment order");
        }

        const userName = localStorage.getItem("userName") || "";
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Tamil Nadu Judo Association",
          description: `Entry Fee for ${event.title}`,
          order_id: orderData.id,
          handler: async function (response: any) {
            try {
              const verifyRes = await fetch(`${API_BASE}/events/verify-payment`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                  eventId: event.id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                }),
              });

              const verifyData = await verifyRes.json();
              if (!verifyRes.ok) {
                throw new Error(verifyData.error || "Verification failed");
              }

              showToast("Payment successful! Applied for the event.", "success");
              fetchEvents();
            } catch (err: any) {
              showToast("Payment verification failed: " + err.message, "error");
            }
          },
          prefill: {
            name: userName,
          },
          theme: {
            color: "#FF7400",
          },
        };

        const paymentObject = new (window as any).Razorpay(options);
        paymentObject.open();

      } else {
        const res = await fetch(`${API_BASE}/events/apply`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ eventId: event.id }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to apply for event");
        
        showToast("Successfully applied for this event!", "success");
        fetchEvents();
      }
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    }
  };

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
      if (!res.ok) throw new Error(json.error || "Failed to propose event");
      
      showToast("Event created and submitted for approval! It will appear here once approved.", "success");
      setIsCreateModalOpen(false);
      setFormData({
        title: "", date: "", location: "", description: "", level: "DISTRICT", participantType: "ALL", districtId: "", zoneId: "", isPaid: false, entryFee: "", color: "#FF7400", eventSection: "", meetingLink: ""
      });
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (event: any) => {
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
      fetchMyEvents();
      fetchEvents();
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setEditSubmitLoading(false);
    }
  };

  const filteredEvents = events.filter(ev => {
    if (searchQuery && !ev.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 relative">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-200 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-white font-bold text-sm ${
              toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
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
          <h1 className="text-3xl font-bold text-slate-800">Events Directory</h1>
          <p className="text-slate-500">View upcoming events or propose a new one</p>
        </div>
        {["CLUB", "SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "CEO"].includes(userRole) && (
          <button 
            onClick={() => {
              setFormData({ title: "", date: "", location: "", description: "", level: "DISTRICT", participantType: "ALL", districtId: "", zoneId: "", isPaid: false, entryFee: "", color: "#FF7400", eventSection: "", meetingLink: "" });
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-4 bg-[#FF7400] text-white font-bold rounded-2xl shadow-lg shadow-[#FF7400]/20 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={20} />
            Propose Event
          </button>
        )}
      </div>

      {["CLUB", "SUPER_ADMIN", "STATE_PRESIDENT", "STATE_SECRETARY", "ZONE_PRESIDENT", "ZONE_SECRETARY", "DISTRICT_PRESIDENT", "DISTRICT_SECRETARY", "CEO"].includes(userRole) && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveSection("active")}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeSection === "active" ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Active Events ({events.length})
          </button>
          <button
            onClick={() => setActiveSection("mine")}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeSection === "mine" ? "bg-white text-[#FF7400] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            My Proposed Events ({myEvents.length})
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search active events..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
        />
      </div>

      {/* Events List */}
      {activeSection === "active" && (
        <>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin text-[#FF7400]" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Calendar size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-500">No Active Events</h3>
          <p className="text-slate-400 text-sm mt-2">There are currently no upcoming approved events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <motion.div 
              key={event.id}
              whileHover={{ y: -5 }}
              onClick={() => setSelectedEvent(event)}
              className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col group cursor-pointer"
            >
              <div className="h-32 bg-slate-100 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FF7400]/20 to-[#FFDA00]/20 group-hover:opacity-100 transition-opacity"></div>
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-slate-800 shadow-sm flex items-center gap-2">
                  <span>{event.level} LEVEL</span>
                  <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                  <span className="text-[#FF7400]">{event.participantType}</span>
                </div>
              </div>

              <div className="p-8 -mt-10 relative flex-grow">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-[#FF7400] mb-6 border border-slate-50">
                  <Calendar size={32} />
                </div>

                <h3 className="text-xl font-bold text-slate-800 mb-4 line-clamp-2 leading-tight">
                  {event.title}
                </h3>

                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <Clock size={16} className="text-[#FF7400]" />
                    {new Date(event.date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                    <MapPin size={16} className="text-[#FF7400]" />
                    {event.location}
                  </div>
                  {event.meetingLink && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      <Video size={16} className="text-[#FF7400]" />
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
                  <div className="flex items-center gap-2 text-sm text-slate-500 font-medium pt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${event.isPaid ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                      {event.isPaid ? `Entry Fee: ₹${event.entryFee}` : 'Free Entry'}
                    </span>
                  </div>
                  {(event.district?.name || event.zoneId) && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mt-1">
                      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center">
                        <MapPin size={10} className="text-slate-400" />
                      </div>
                      <span className="text-xs">Region: {event.district?.name || event.zoneId}</span>
                    </div>
                  )}
                  {event.approvedBy && (
                    <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium mt-3 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                      <CheckCircle2 size={16} />
                      <span className="text-xs">Approved by <strong>{event.approvedBy}</strong></span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3 pt-6 border-t border-slate-100">
                  {userRole !== "CLUB" && (
                    (() => {
                      const userReg = event.registrations?.[0];
                      if (userReg) {
                        const statusColors: Record<string, string> = {
                          PENDING: "bg-amber-50 text-amber-700 border-amber-200",
                          APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
                          REJECTED: "bg-red-50 text-red-700 border-red-200",
                        };
                        const statusColor = statusColors[userReg.status] || "bg-slate-50 text-slate-700 border-slate-200";
                        return (
                          <div className={`w-full py-3 border text-center text-sm font-bold rounded-xl ${statusColor}`}>
                            Applied 
                          </div>
                        );
                      }
                      return (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleApply(event); }}
                          className="w-full py-3 bg-[#FF7400] text-white text-sm font-bold rounded-xl shadow-md shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          Apply Now
                        </button>
                      );
                    })()
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </>
      )}

      {activeSection === "mine" && (
        <>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={40} className="animate-spin text-[#FF7400]" />
          </div>
        ) : myEvents.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Calendar size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-500">No Proposed Events</h3>
            <p className="text-slate-400 text-sm mt-2">You haven't proposed any events yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {myEvents.map((event) => (
              <motion.div 
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-[#FF7400]/10 text-[#FF7400] rounded-2xl shrink-0">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-slate-800">{event.title}</h3>
                      <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full border ${
                        event.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        event.status === "REJECTED" ? "bg-red-50 text-red-600 border-red-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {event.status === "APPROVED" ? <><CheckCircle2 size={12}/> Approved</> :
                         event.status === "REJECTED" ? <><XCircle size={12}/> Rejected</> : 
                         <><Clock size={12}/> Pending</>}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5"><Clock size={14} className="text-[#FF7400]" />{new Date(event.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={14} className="text-[#FF7400]" />{event.location}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEdit(event)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-xl transition-all text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm"
                  >
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        </>
      )}

      {/* Create Event Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm ">
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
                  <div className="md:col-span-2" ref={sectionRef}>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Event Section
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setSectionOpen(o => !o)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#FF7400]/60 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 transition-all"
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
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Meeting Link</label>
                      <input 
                        type="url" 
                        required
                        value={formData.meetingLink}
                        onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="e.g. https://meet.google.com/abc-defg-hij"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Event Title</label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder="Enter a descriptive title"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Date</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Location</label>
                    <input 
                      type="text" 
                      required
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      placeholder="e.g. Nehru Stadium"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Event Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({...formData, level: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="DISTRICT">District Level</option>
                      <option value="ZONE">Zone Level</option>
                      <option value="STATE">State Level</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Target Audience</label>
                    <select
                      value={formData.participantType}
                      onChange={e => setFormData({...formData, participantType: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="ALL">Everyone</option>
                      <option value="STUDENT">Players Only</option>
                      <option value="COACH">Coaches/Referees Only</option>
                      <option value="MEMBER">Members Only</option>
                      <option value="CLUB">Clubs Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Type</label>
                    <select
                      value={formData.isPaid ? "paid" : "free"}
                      onChange={e => setFormData({...formData, isPaid: e.target.value === "paid", entryFee: e.target.value === "free" ? "" : formData.entryFee})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {formData.isPaid && (
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={formData.entryFee}
                        onChange={e => setFormData({...formData, entryFee: e.target.value})}
                        placeholder="Enter amount in ₹"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                      />
                    </div>
                  )}

                  {formData.level === "DISTRICT" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Select District</label>
                      <select 
                        required
                        value={formData.districtId}
                        onChange={e => setFormData({...formData, districtId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
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
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Select Zone</label>
                      <select 
                        required
                        value={formData.zoneId}
                        onChange={e => setFormData({...formData, zoneId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                      >
                        <option value="">Select Zone</option>
                        {getFilteredZonesForCreation().map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                    <textarea 
                      required
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Detailed description of the event..."
                      className="w-full h-32 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all resize-none"
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
                  <p className="text-slate-500">Update the details of your proposed event.</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all cursor-pointer"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <form className="space-y-6" onSubmit={handleUpdate}>
                {/* Same form fields as Create */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2" ref={sectionRef}>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Event Section
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setSectionOpen(o => !o)}
                        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-[#FF7400]/60 focus:outline-none focus:ring-2 focus:ring-[#FF7400]/40 transition-all"
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
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Meeting Link</label>
                      <input 
                        type="url" 
                        required
                        value={formData.meetingLink}
                        onChange={e => setFormData({ ...formData, meetingLink: e.target.value })}
                        placeholder="e.g. https://meet.google.com/abc-defg-hij"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Event Title</label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      placeholder="Enter a descriptive title"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Date</label>
                    <input 
                      type="date" 
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Location</label>
                    <input 
                      type="text" 
                      required
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      placeholder="e.g. Nehru Stadium"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Event Level</label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData({...formData, level: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="DISTRICT">District Level</option>
                      <option value="ZONE">Zone Level</option>
                      <option value="STATE">State Level</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Target Audience</label>
                    <select
                      value={formData.participantType}
                      onChange={e => setFormData({...formData, participantType: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="ALL">Everyone</option>
                      <option value="STUDENT">Players Only</option>
                      <option value="COACH">Coaches/Referees Only</option>
                      <option value="MEMBER">Members Only</option>
                      <option value="CLUB">Clubs Only</option>
                    </select>
                  </div>

                  <div className="md:col-span-1">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Type</label>
                    <select
                      value={formData.isPaid ? "paid" : "free"}
                      onChange={e => setFormData({...formData, isPaid: e.target.value === "paid", entryFee: e.target.value === "free" ? "" : formData.entryFee})}
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                    >
                      <option value="free">Free</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>

                  {formData.isPaid && (
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Entry Fee (₹)</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        value={formData.entryFee}
                        onChange={e => setFormData({...formData, entryFee: e.target.value})}
                        placeholder="Enter amount in ₹"
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                      />
                    </div>
                  )}

                  {formData.level === "DISTRICT" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Select District</label>
                      <select 
                        required
                        value={formData.districtId}
                        onChange={e => setFormData({...formData, districtId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
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
                      <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Select Zone</label>
                      <select 
                        required
                        value={formData.zoneId}
                        onChange={e => setFormData({...formData, zoneId: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all font-semibold"
                      >
                        <option value="">Select Zone</option>
                        {getFilteredZonesForCreation().map(z => (
                          <option key={z} value={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                    <textarea 
                      required
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="Detailed description of the event..."
                      className="w-full h-32 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all resize-none"
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
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
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
                  className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-full transition-all"
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

              {/* Close / Action Button */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="flex-grow py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all font-semibold"
                >
                  Close Details
                </button>
                {userRole !== "CLUB" && !selectedEvent.registrations?.[0] && (
                  <button
                    onClick={() => {
                      handleApply(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="flex-grow py-4 bg-[#FF7400] text-white font-bold rounded-2xl shadow-xl shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold"
                  >
                    Apply Now
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
