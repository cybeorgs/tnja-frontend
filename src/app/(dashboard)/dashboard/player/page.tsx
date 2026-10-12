"use client";

import React, { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  CreditCard,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BadgeCheck,
  ShieldCheck,
  ArrowRight,
  Trophy,
  XCircle,
  Scale,
  Contact,
  Award,
  Calendar,
  Swords,
  Hash,
  UserCheck,
  Download,
  Bell,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { exportMatchToPDF } from "@/utils/pdfExport";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

const Field = ({
  label,
  value,
  readOnly = false,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  readOnly?: boolean;
  onChange?: (v: string) => void;
  type?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-slate-500">{label}</label>
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full px-3 py-2.5 border rounded-lg text-sm font-medium text-slate-700 focus:outline-none transition-all ${
        readOnly
          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
          : "bg-white border-slate-200 focus:border-[#FF7400] focus:ring-2 focus:ring-[#FF7400]/10"
      }`}
    />
  </div>
);

export default function PlayerDashboard() {
  const [playerData, setPlayerData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [playerNotifications, setPlayerNotifications] = useState<any[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
  const [completedMatches, setCompletedMatches] = useState<any[]>([]);
  const [registeredCategories, setRegisteredCategories] = useState<{ tournamentId: string; tournamentName: string; category: string; status: string; ageGroup: string; gender: string; weightCategory: string; }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [categoryParticipants, setCategoryParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [tournamentWins, setTournamentWins] = useState<{ tournamentId: string; tournamentName: string; category: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [editRequest, setEditRequest] = useState<{ id: string; status: string } | null>(null);
  const [requestingEdit, setRequestingEdit] = useState(false);

  const buildForm = (u: any) => {
    return {
      fullName: u?.fullName || "",
      fatherName: u?.fatherName || "",
      bloodGroup: u?.bloodGroup || "",
      gender: u?.gender || "",
      height: u?.height || "",
      weight: u?.weight || "",
      mobileNumber: u?.mobileNumber || "",
      address: u?.address || "",
      city: u?.city || "",
      state: u?.state || "",
      addressPincode: u?.addressPincode || "",
      dob: u?.dob ? new Date(u.dob).toISOString().split('T')[0] : "",
      email: u?.email || "",
      tempId: u?.tempId || "",
    };
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayerData(data.user);
        setFormData(buildForm(data.user));
        setIsEditing(false);
        setEditRequest(null);
        alert("Profile updated successfully!");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update profile");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEdit = async () => {
    setRequestingEdit(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/profile-edit-requests`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      if (res.ok) {
        setEditRequest({ id: data.id, status: "PENDING" });
        alert("Edit request sent to your coach. You will be notified when it is approved.");
      } else {
        alert(data.error || "Failed to send request");
      }
    } catch (err) {
      console.error(err);
      alert("Error sending request");
    } finally {
      setRequestingEdit(false);
    }
  };

  const setF = (key: string) => (v: string) =>
    setFormData((p: any) => ({ ...p, [key]: v }));
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const loadNotifs = () => {
      const saved = localStorage.getItem("tnja_notifications");
      if (saved) {
        try {
          setPlayerNotifications(JSON.parse(saved));
        } catch (err) {
          console.error(err);
        }
      }
    };
    loadNotifs();

    window.addEventListener("tnja_notifications_updated", loadNotifs);
    return () => {
      window.removeEventListener("tnja_notifications_updated", loadNotifs);
    };
  }, []);

  const handleCategoryClick = async (cat: any) => {
    setSelectedCategory(cat);
    setLoadingParticipants(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/tournaments/player/category-participants?tournamentId=${cat.tournamentId}&ageGroup=${cat.ageGroup}&gender=${cat.gender}&weightCategory=${cat.weightCategory}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategoryParticipants(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please login again.");
        setLoading(false);
        return;
      }

      // Fetch profile and settings in parallel
      const [profileRes, settingsRes, editReqRes] = await Promise.all([
        fetch(`${API_BASE}/auth/profile`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/settings/global`),
        fetch(`${API_BASE}/profile-edit-requests/my`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
      ]);

      const profileData = await profileRes.json();
      const settingsData = await settingsRes.json();

      if (!profileRes.ok) throw new Error(profileData.error || "Failed to fetch profile");
      if (!settingsRes.ok) throw new Error(settingsData.error || "Failed to fetch settings");

      setPlayerData(profileData.user);
      setFormData(buildForm(profileData.user));
      setSettings(settingsData);

      if (editReqRes.ok) {
        const editReqData = await editReqRes.json();
        if (editReqData && editReqData.id) {
          setEditRequest({ id: editReqData.id, status: editReqData.status });
        }
      }

      // Fetch tournaments & draws for upcoming matches
      try {
        const trnRes = await fetch(`${API_BASE}/tournaments/player`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const pubRes = await fetch(`${API_BASE}/tournaments/player/matches`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        let tournaments: any[] = [];
        
        if (trnRes.ok) {
          const clubTournaments = await trnRes.json();
          tournaments = [...tournaments, ...clubTournaments];
        }
        
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          tournaments = [
            ...tournaments,
            ...(pubData.district || []),
            ...(pubData.zonal || []),
            ...(pubData.stateAndNational || [])
          ];
        }

        const matches: any[] = [];
        const completed: any[] = [];
        const cats: { tournamentId: string; tournamentName: string; category: string; status: string; ageGroup: string; gender: string; weightCategory: string; }[] = [];

          for (const trn of tournaments) {
            if (trn.myRegistrations && trn.myRegistrations.length > 0) {
              trn.myRegistrations.forEach((reg: any) => {
                cats.push({
                  tournamentId: trn.id,
                  tournamentName: trn.title,
                  category: `${reg.ageGroup} ${reg.gender} - ${reg.weightCategory}kg`,
                  status: reg.status,
                  ageGroup: reg.ageGroup,
                  gender: reg.gender,
                  weightCategory: reg.weightCategory
                });
              });
            } else if (trn.myRegistration) {
              cats.push({
                tournamentId: trn.id,
                tournamentName: trn.title,
                category: `${trn.myRegistration.ageGroup} ${trn.myRegistration.gender} - ${trn.myRegistration.weightCategory}kg`,
                status: trn.myRegistration.status,
                ageGroup: trn.myRegistration.ageGroup,
                gender: trn.myRegistration.gender,
                weightCategory: trn.myRegistration.weightCategory
              });
            }

            if (trn.myRegistration && (trn.myRegistration.status === "APPROVED" || trn.myRegistration.status === "PENDING")) {
              const drawRes = await fetch(`${API_BASE}/tournaments/${trn.id}/draws`, {
                headers: { "Authorization": `Bearer ${token}` }
              });
              if (drawRes.ok) {
                const draws = await drawRes.json();
                for (const draw of draws) {
                  if (draw.rounds) {
                    let roundsArr = draw.rounds;
                    if (typeof roundsArr === "string") {
                      try { roundsArr = JSON.parse(roundsArr); } catch { continue; }
                    }
                    if (!Array.isArray(roundsArr)) continue;

                    for (let rIdx = 0; rIdx < roundsArr.length; rIdx++) {
                      const round = roundsArr[rIdx];
                      if (!Array.isArray(round)) continue;
                      for (const match of round) {
                        const isPlayerInvolved = match.slotA?.playerId === profileData.user.id || match.slotB?.playerId === profileData.user.id;
                        if (!isPlayerInvolved) continue;

                        const opponent = match.slotA.playerId === profileData.user.id ? match.slotB : match.slotA;
                        const matchInfo = {
                          tournamentId: trn.id,
                          tournamentName: trn.title,
                          tournamentDate: trn.date,
                          tournamentLocation: trn.location,
                          tournamentLevel: trn.level || "CLUB",
                          opponent,
                          roundNum: rIdx + 1,
                          matNumber: match.matNumber,
                          matchNumber: match.matchNumber,
                          refereeName: match.referee?.fullName || match.refereeName || null,
                          refereeId: match.refereeId || match.referee?.id || null,
                          rawMatch: match,
                          winnerSlot: match.winnerId === match.slotA.playerId ? match.slotA : match.slotB,
                          loserSlot: match.winnerId === match.slotA.playerId ? match.slotB : match.slotA,
                          nextMatchInfo: null, // simple stub
                          weightCategory: draw.weightCategory,
                          ageGroup: draw.ageGroup,
                          gender: draw.gender
                        };

                        if (match.status !== "COMPLETED") {
                          const existingMatchForTrn = matches.find(m => m.tournamentId === trn.id);
                          if (!existingMatchForTrn || existingMatchForTrn.roundNum > (rIdx + 1)) {
                            if (existingMatchForTrn) {
                              const index = matches.indexOf(existingMatchForTrn);
                              matches[index] = matchInfo;
                            } else {
                              matches.push(matchInfo);
                            }
                          }
                        } else {
                          completed.push(matchInfo);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          setUpcomingMatches(matches);
          setCompletedMatches(completed.sort((a, b) => new Date(b.tournamentDate).getTime() - new Date(a.tournamentDate).getTime()));
          setRegisteredCategories(cats);

          // Detect tournament wins (player won the final round)
          const wins: { tournamentId: string; tournamentName: string; category: string }[] = [];
          for (const trn of tournaments) {
            if (trn.myRegistration?.status !== "APPROVED") continue;
            const drawRes2 = await fetch(`${API_BASE}/tournaments/${trn.id}/draws`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            if (!drawRes2.ok) continue;
            const draws2 = await drawRes2.json();
            for (const draw of draws2) {
              let roundsArr = draw.rounds;
              if (typeof roundsArr === "string") {
                try { roundsArr = JSON.parse(roundsArr); } catch { continue; }
              }
              if (!Array.isArray(roundsArr) || roundsArr.length === 0) continue;
              
              const finalRound = roundsArr[roundsArr.length - 1];
              if (!Array.isArray(finalRound)) continue;

              for (const match of finalRound) {
                if (match?.status === "COMPLETED" && match?.winnerId === profileData.user.id) {
                  wins.push({
                    tournamentId: trn.id,
                    tournamentName: trn.title,
                    category: `${draw.ageGroup} ${draw.gender} ${draw.weightCategory}kg`,
                  });
                }
              }
            }
          }
          setTournamentWins(wins);
      } catch (err) {
        console.error("Error fetching upcoming matches:", err);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    setPaying(true);
    try {
      const token = localStorage.getItem("token");
      const resScript = await loadRazorpayScript();
      if (!resScript) throw new Error("Razorpay SDK failed to load.");

      const orderRes = await fetch(`${API_BASE}/application/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: playerData.id,
          type: "student"
          // Amount is now handled by the backend from GlobalSettings
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      // 3. Open Razorpay Checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Tamil Nadu Judo Association",
        description: "Membership Registration Fee",
        order_id: orderData.id,
        handler: async function (response: any) {
          // 4. Verify Payment on Backend
          try {
            const verifyRes = await fetch(`${API_BASE}/application/verify-payment`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                id: playerData.id,
                type: "student",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");

            // Success!
            alert("Payment successful! Your Player ID has been issued. You will now be logged out. Please log in using your new Player ID to change your password and secure your account.");
            localStorage.clear();
            window.location.href = "/login";
          } catch (err: any) {
            alert("Payment verification failed: " + err.message);
          }
        },
        prefill: {
          name: playerData.fullName,
          email: playerData.email,
          contact: playerData.mobileNumber,
        },
        theme: {
          color: "#FF7400",
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err: any) {
      alert(err.message || "Payment initialization failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
        <p className="text-gray-500 font-medium">Loading your dashboard...</p>
      </div>
    );
  }

  if (error || !playerData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center gap-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Unable to load dashboard</h2>
        <p className="text-gray-500">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-2 px-6 py-2 bg-[#FF7400] text-white rounded-full font-bold">
          Try Again
        </button>
      </div>
    );
  }

  // Check if payment is required
  const needsPayment = !playerData.isBPL && !playerData.isPaid;

  const infoGroups = [
    {
      title: "Basic Information",
      icon: User,
      items: [
        { label: "Name", value: playerData.fullName, icon: User },
        { label: "Father's Name", value: playerData.fatherName, icon: User },
        { label: "Date of Birth", value: playerData.dob ? new Date(playerData.dob).toLocaleDateString() : "N/A", icon: Calendar },
        { label: "Blood Group", value: playerData.bloodGroup, icon: ShieldCheck },
      ]
    },
    {
      title: "Contact & Address",
      icon: MapPin,
      items: [
        { label: "Email", value: playerData.email, icon: Mail },
        { label: "Mobile Number", value: playerData.mobileNumber, icon: Phone },
        { label: "Address", value: playerData.address, icon: MapPin },
        { label: "City", value: playerData.city, icon: MapPin },
      ]
    },
    {
      title: "Physical Attributes",
      icon: Trophy,
      items: [
        { label: "Height (cm)", value: playerData.height, icon: Award },
        { label: "Weight (kg)", value: playerData.weight, icon: Scale },
        { label: "Gender", value: playerData.gender, icon: User },
      ]
    }
  ];

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Player Dashboard</h1>
          <p className="text-slate-500">Welcome back, {playerData.fullName.split(" ")[0]}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Header Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-8"
        >
        <div className="relative">
          <div className="w-32 h-32 bg-gradient-to-br from-[#FF7400] to-[#FF9100] rounded-2xl flex items-center justify-center text-white text-5xl font-bold shadow-xl shadow-[#FF7400]/20 overflow-hidden">
            {playerData.profilePhoto ? (
              <img 
                src={playerData.profilePhoto} 
                alt={playerData.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              playerData.fullName.charAt(0)
            )}
          </div>
          {playerData.permanentId && (
            <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white">
              <BadgeCheck size={20} />
            </div>
          )}
        </div>

        <div className="flex-grow text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold text-[#1A1A1A]">{playerData.fullName}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-fit mx-auto md:mx-0 ${
              playerData.permanentId ? "bg-green-100 text-green-600" : "bg-orange-100 text-[#FF7400]"
            }`}>
              {playerData.permanentId ? "Active Member" : "Application Approved"}
            </span>
          </div>
          <p className="text-gray-500 font-medium">
            {playerData.permanentId ? `Player ID: ${playerData.permanentId}` : `Temporary Player ID: ${playerData.tempId}`}
          </p>
          {playerData.validUntil && (
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-sm font-semibold">
                <Calendar size={14} /> Valid until: {new Date(playerData.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          )}
        </div>
        
        <div className="md:ml-auto flex flex-col items-end gap-2">
          {isEditing ? (
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData(buildForm(playerData));
              }}
              className="px-6 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Cancel Editing
            </button>
          ) : editRequest?.status === "APPROVED" ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-6 py-2.5 bg-white border border-[#FF7400] text-[#FF7400] rounded-xl font-bold hover:bg-orange-50 transition-all flex items-center gap-2"
            >
              Edit Profile
            </button>
          ) : editRequest?.status === "PENDING" ? (
            <div className="px-6 py-2.5 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl font-bold text-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Edit Request Pending Coach Approval
            </div>
          ) : !playerData.coach ? (
            <div className="px-6 py-2.5 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl font-bold text-sm">
              No Coach Assigned — Cannot Request Edit
            </div>
          ) : (
            <button
              onClick={handleRequestEdit}
              disabled={requestingEdit}
              className="px-6 py-2.5 bg-white border border-[#FF7400] text-[#FF7400] rounded-xl font-bold hover:bg-orange-50 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {requestingEdit ? <Loader2 size={16} className="animate-spin" /> : null}
              {requestingEdit ? "Sending Request..." : "Request Profile Edit"}
            </button>
          )}
          {editRequest?.status === "REJECTED" && (
            <p className="text-xs text-red-500 font-semibold">Your last request was rejected. You may send a new request.</p>
          )}
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="space-y-8">
          {needsPayment ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 border-2 border-[#FF7400]/20 shadow-xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-[#FF7400]/10 text-[#FF7400] rounded-2xl">
                  <CreditCard size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-[#1A1A1A]">Payment Required</h3>
                  <p className="text-gray-500">Complete your membership to receive your Player ID</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8">
                <div className="flex justify-between items-center mb-4 pb-4 border-b">
                  <span className="text-gray-500 font-medium">Membership Fee</span>
                  <span className="text-3xl font-bold text-[#FF7400]">₹ {settings?.playerFee || 500}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Processing Fee</span>
                  <span className="text-gray-400">Included</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 size={18} className="text-green-500" />
                  Instant issue of Player ID
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 size={18} className="text-green-500" />
                  Access to all TNJA State Events
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-600">
                  <CheckCircle2 size={18} className="text-green-500" />
                  Downloadable Membership Card
                </li>
              </ul>

              <button 
                onClick={handlePayment}
                disabled={paying}
                className="w-full py-4 bg-[#FF7400] text-white rounded-2xl font-bold text-lg shadow-lg shadow-[#FF7400]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {paying ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Processing Secure Payment...
                  </>
                ) : (
                  <>
                    Pay Membership Fee
                    <ArrowRight size={24} />
                  </>
                )}
              </button>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Profile Information / Edit Form */}
              {isEditing ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
                  <h3 className="text-xl font-bold text-[#FF7400] flex items-center gap-2">
                    <User size={24} />
                    Edit Personal Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Full Name" value={formData.fullName} onChange={setF("fullName")} />
                    <Field label="Father's Name" value={formData.fatherName} onChange={setF("fatherName")} />
                    <Field label="Blood Group" value={formData.bloodGroup} onChange={setF("bloodGroup")} />
                    <Field label="Gender" value={formData.gender} onChange={setF("gender")} />
                    <Field label="Height (cm)" type="number" value={formData.height} onChange={setF("height")} />
                    <Field label="Weight (kg)" type="number" value={formData.weight} onChange={setF("weight")} />
                    <Field label="Mobile Number" value={formData.mobileNumber} onChange={setF("mobileNumber")} />
                    <Field label="Date of Birth" type="date" value={formData.dob} readOnly />
                    <Field label="Email Address" value={formData.email} readOnly />
                    <Field label="Student ID (Temporary)" value={formData.tempId} readOnly />
                  </div>
                  
                  <h3 className="text-xl font-bold text-[#FF7400] flex items-center gap-2 mt-8 border-t pt-8">
                    <MapPin size={24} />
                    Address Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Address" value={formData.address} onChange={setF("address")} />
                    <Field label="City" value={formData.city} onChange={setF("city")} />
                    <Field label="State" value={formData.state} onChange={setF("state")} />
                    <Field label="Pincode" value={formData.addressPincode} onChange={setF("addressPincode")} />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData(buildForm(playerData));
                      }}
                      className="px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="px-6 py-3 bg-[#FF7400] text-white rounded-xl font-bold hover:bg-[#E56900] transition-all disabled:opacity-60 shadow-lg shadow-orange-200 flex items-center gap-2"
                    >
                      {saving && <Loader2 size={18} className="animate-spin" />}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {infoGroups.map((group, groupIdx) => (
                    <motion.div 
                      key={group.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.1 }}
                      className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-200 ${groupIdx === 2 ? "md:col-span-2" : ""}`}
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-orange-50 text-[#FF7400] rounded-lg">
                          <group.icon size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{group.title}</h2>
                      </div>

                      <div className={`grid gap-6 ${groupIdx === 2 ? "md:grid-cols-3" : "grid-cols-1"}`}>
                        {group.items.map((item) => (
                          <div key={item.label} className="space-y-1">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                            <div className="flex items-center gap-2 text-slate-700">
                              <item.icon size={16} className="text-slate-300" />
                              <p className="font-medium">{item.value || "N/A"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Tournament Champion Banner */}
              {tournamentWins.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl overflow-hidden shadow-2xl shadow-yellow-500/20"
                >
                  <div className="bg-gradient-to-r from-yellow-400 via-[#FF7400] to-yellow-500 px-8 py-5 flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                      <Trophy size={28} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white/80 text-xs font-black uppercase tracking-widest">Congratulations</p>
                      <h2 className="text-2xl font-black text-white leading-tight">Tournament Champion!</h2>
                    </div>
                  </div>
                  <div className="bg-white border border-yellow-200 divide-y divide-yellow-100">
                    {tournamentWins.map((win, idx) => (
                      <div key={idx} className="flex items-center justify-between px-8 py-4">
                        <div>
                          <p className="font-black text-slate-800">{win.tournamentName}</p>
                          <p className="text-xs font-semibold text-slate-400 mt-0.5">{win.category}</p>
                        </div>
                        <span className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-black">
                          <Trophy size={13} /> 1st Place
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Match Statistics Card Grid */}
              {(() => {
                let totalWins = 0;
                let totalLosses = 0;
                let totalDraws = 0;
                
                if (playerData?.id) {
                  completedMatches.forEach(match => {
                    const isWin = match.rawMatch?.winnerId === playerData.id;
                    const isDraw = !match.rawMatch?.winnerId; // Depending on how draws are handled
                    
                    if (isDraw) totalDraws++;
                    else if (isWin) totalWins++;
                    else totalLosses++;
                  });
                }
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Wins Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-3xl p-6 shadow-sm flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-600/80 uppercase tracking-wider">Total Wins</p>
                    <h3 className="text-4xl font-black text-emerald-700">{totalWins}</h3>
                  </div>
                  <div className="p-4 bg-emerald-500/10 text-emerald-600 rounded-2xl">
                    <Trophy size={28} />
                  </div>
                </motion.div>

                {/* Losses Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-3xl p-6 shadow-sm flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-rose-600/80 uppercase tracking-wider">Total Losses</p>
                    <h3 className="text-4xl font-black text-rose-700">{totalLosses}</h3>
                  </div>
                  <div className="p-4 bg-rose-500/10 text-rose-600 rounded-2xl">
                    <XCircle size={28} />
                  </div>
                </motion.div>

                {/* Draws Card */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-slate-50 to-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Draws</p>
                    <h3 className="text-4xl font-black text-slate-700">{totalDraws}</h3>
                  </div>
                  <div className="p-4 bg-slate-500/10 text-slate-600 rounded-2xl">
                    <Scale size={28} />
                  </div>
                </motion.div>
              </div>
              );
            })()}

              {/* Upcoming Matches Card */}
              {upcomingMatches.length > 0 && (
                <div className="bg-white rounded-3xl p-8 border border-[#FF7400]/20 shadow-lg shadow-orange-500/5 space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                  
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 relative z-10">
                    <div className="p-2.5 bg-orange-100 text-[#FF7400] rounded-xl">
                      <Swords size={20} />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1A1A]">Upcoming Matches</h3>
                  </div>

                  <div className="space-y-4 relative z-10">
                    {upcomingMatches.map((match, idx) => (
                      <div key={idx} className="p-5 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                        
                        <div className="flex-1 space-y-3">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Tournament</span>
                            <h4 className="font-bold text-slate-800 text-lg leading-tight">{match.tournamentName}</h4>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                            {match.ageGroup && match.weightCategory && (
                              <div className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm font-black">
                                <Scale size={14} /> {match.ageGroup} {match.gender} - {match.weightCategory}kg
                              </div>
                            )}
                            {match.rawMatch?.status === "LIVE" && (
                              <div className="flex items-center gap-1.5 bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-black shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span> LIVE
                              </div>
                            )}
                            {match.rawMatch?.status === "PENDING" && (
                              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold shadow-sm">
                                PENDING
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                              <Calendar size={14} className="text-[#FF7400]" />
                              {new Date(match.tournamentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                              <MapPin size={14} className="text-[#FF7400]" />
                              {match.tournamentLocation}
                            </div>
                            <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm text-orange-700 font-black">
                              Mat {match.matNumber}
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                              <Hash size={13} className="text-[#FF7400]" />
                              Match {match.matchNumber}
                            </div>
                          </div>

                          {/* Referee */}
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold w-fit ${
                            match.refereeName
                              ? "bg-blue-50 border border-blue-100 text-blue-700"
                              : "bg-slate-50 border border-slate-100 text-slate-400"
                          }`}>
                            <UserCheck size={14} className={match.refereeName ? "text-blue-500" : "text-slate-300"} />
                            <span>
                              <span className="font-black uppercase tracking-wider text-[10px] mr-1">Referee:</span>
                              {match.refereeName || "Not yet assigned"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 md:text-right p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider block mb-1">
                            Opponent — Round {match.roundNum}
                          </span>
                          {match.opponent?.playerId ? (
                            <div>
                              <p className="font-extrabold text-slate-800 text-lg">{match.opponent.playerName}</p>
                              <p className="text-xs font-bold text-slate-500">{match.opponent.club || "No Club"}</p>
                            </div>
                          ) : match.opponent?.isBye ? (
                            <p className="font-extrabold text-emerald-600 text-lg">BYE (Auto-Advance)</p>
                          ) : (
                            <p className="font-extrabold text-slate-400 text-lg">To Be Decided</p>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Matches Card */}
              {completedMatches.length > 0 && (
                <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 relative z-10">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                      <CheckCircle2 size={20} />
                    </div>
                    <h3 className="text-xl font-black text-[#1A1A1A]">Completed Matches & Reports</h3>
                  </div>

                  <div className="space-y-4 relative z-10">
                    {completedMatches.map((match, idx) => {
                      const isWin = match.rawMatch.winnerId === playerData.id;
                      return (
                        <div key={idx} className="p-5 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all">
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3 mb-1">
                              {isWin ? (
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">WIN</span>
                              ) : (
                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">LOSS</span>
                              )}
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tournament</span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-lg leading-tight">{match.tournamentName}</h4>
                            
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                              {match.ageGroup && match.weightCategory && (
                                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 shadow-sm font-black">
                                  <Scale size={14} /> {match.ageGroup} {match.gender} - {match.weightCategory}kg
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm"><Calendar size={14} className="text-[#FF7400]"/> {new Date(match.tournamentDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                              <span className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm"><MapPin size={14} className="text-[#FF7400]" /> {match.tournamentLocation}</span>
                              <span className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md"><Hash size={14} /> Round {match.roundNum}</span>
                            </div>
                          </div>

                          <div className="hidden md:block w-px h-16 bg-slate-200" />

                          <div className="flex-1 md:text-right space-y-3 flex flex-col items-start md:items-end">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Opponent</span>
                              <span className="font-bold text-slate-800 text-lg">{match.opponent?.playerName || "Unknown"}</span>
                            </div>
                            
                            <button
                              onClick={() => {
                                exportMatchToPDF(
                                  match.rawMatch,
                                  match.winnerSlot,
                                  match.loserSlot,
                                  { title: match.tournamentName, date: match.tournamentDate, level: match.tournamentLevel, location: match.tournamentLocation },
                                  match.roundNum - 1,
                                  match.nextMatchInfo
                                );
                              }}
                              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-[#FF7400] text-slate-600 hover:text-white rounded-xl text-xs font-bold transition-all md:ml-auto w-full md:w-fit"
                            >
                              <Download size={15} /> Download Match Report
                            </button>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coach Assignment Card */}
              <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="p-2.5 bg-orange-100 text-[#FF7400] rounded-xl">
                    <Contact size={20} />
                  </div>
                  <h3 className="text-lg font-black text-[#1A1A1A]">Assigned Coach</h3>
                </div>

                {playerData.coach ? (
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 bg-slate-50/70 border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-[#FF7400] text-white rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-orange-500/10">
                        {playerData.coach.fullName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-lg leading-tight">{playerData.coach.fullName}</h4>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <Award size={14} className="text-[#FF7400]" />
                          <span>{playerData.coach.presentGradeInJudo || "Certified Judo Coach"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 text-sm text-slate-500 font-medium">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-black" />
                        <span>{playerData.coach.email}</span>
                      </div>
                      {playerData.coach.mobileNumber && (
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-black" />
                          <span>{playerData.coach.mobileNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 px-4 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl space-y-3">
                    <p className="text-slate-400 font-semibold text-sm">No Coach Assigned</p>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                      Please contact your district administrator or club secretary to assign a certified coach to your profile.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Registered Categories Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm md:col-span-2">
            <h4 className="font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
              <Scale size={20} className="text-[#FF7400]" /> 
              Registered Weight Categories
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {registeredCategories.length > 0 ? (
                registeredCategories.map((cat, idx) => (
                  <div key={idx} onClick={() => handleCategoryClick(cat)} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer hover:border-[#FF7400] hover:shadow-md transition-all group">
                    <p className="text-sm font-bold text-slate-800 mb-1">{cat.tournamentName}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold px-2 py-1 bg-orange-100 text-orange-700 rounded-md whitespace-nowrap">
                        {cat.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap ${
                        cat.status === "APPROVED" ? "bg-green-100 text-green-700" :
                        cat.status === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {cat.status}
                      </span>
                    </div>
                    <div className="mt-3 text-xs font-bold text-[#FF7400] flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Users size={14} /> View Participants
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-6">
                  <p className="text-sm text-gray-500">No categories registered yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h4 className="font-bold text-[#1A1A1A] mb-4">Membership Status</h4>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl mb-4">
              <div className={`p-2 rounded-xl ${playerData.permanentId ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                {playerData.permanentId ? <ShieldCheck size={20} /> : <Loader2 size={20} className="animate-spin" />}
              </div>
              <p className="text-sm font-bold text-gray-700">
                {playerData.permanentId ? "Verified Member" : "Verification Pending"}
              </p>
            </div>
            <p className="text-[13px] text-gray-500 leading-relaxed">
              {playerData.permanentId 
                ? "Your membership is active. You can now participate in all TNJA sanctioned events."
                : "Your application has been approved. Complete your payment to activate your permanent membership."}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h4 className="font-bold text-[#1A1A1A] mb-4">Recent Notifications</h4>
            <div className="space-y-4">
              {playerNotifications && playerNotifications.length > 0 ? (
                playerNotifications.slice(0, 3).map((notif: any) => (
                  <div key={notif.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="p-2 bg-white rounded-lg text-[#FF7400] shadow-sm shrink-0">
                      <Bell size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{notif.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notif.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <div className="inline-flex p-3 bg-gray-50 rounded-full text-gray-400 mb-3">
                    <Bell size={24} />
                  </div>
                  <p className="text-sm text-gray-500">No recent notifications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>

      <AnimatePresence>
        {selectedCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Users size={24} className="text-[#FF7400]" />
                    Participants List
                  </h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">{selectedCategory.tournamentName}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-orange-100 text-[#FF7400] text-xs font-black rounded-lg uppercase tracking-wider">
                    {selectedCategory.category}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-white flex-1">
                {loadingParticipants ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-[#FF7400]" />
                    <p className="text-sm font-bold">Loading participants...</p>
                  </div>
                ) : categoryParticipants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Users size={48} className="opacity-20" />
                    <p className="font-bold text-lg text-slate-500">No participants yet</p>
                    <p className="text-sm text-slate-400 text-center max-w-sm">No one else has registered for this weight category yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2 mb-2">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Player Info</span>
                      <span className="text-xs font-black text-slate-400 uppercase tracking-wider">{categoryParticipants.length} Participants</span>
                    </div>
                    {categoryParticipants.map((p, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 hover:border-[#FF7400]/30 hover:bg-orange-50/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{p.name}</h4>
                            <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mt-1">
                              <MapPin size={12} /> {p.district} • {p.club}
                            </p>
                          </div>
                        </div>
                        {p.name === playerData.fullName && (
                          <span className="px-3 py-1 bg-[#FF7400]/10 text-[#FF7400] text-xs font-bold rounded-lg border border-[#FF7400]/20 self-start sm:self-auto">
                            You
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
