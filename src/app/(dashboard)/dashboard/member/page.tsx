"use client";

import React, { useEffect, useState, Suspense } from "react";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  IdCard,
  Building2,
  BadgeCheck,
  Loader2,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Users,
  ClipboardEdit,
  Check,
  X,
} from "lucide-react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

function MemberDashboardContent() {
  const [memberData, setMemberData] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const idLabel = userRole.toLowerCase() === "coach" 
    ? "Coach ID" 
    : userRole.toLowerCase() === "club" 
      ? "Club ID" 
      : "Member ID";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("No authentication token found. Please login again.");
        setLoading(false);
        return;
      }

      // Fetch profile and settings in parallel
      const [profileRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/auth/profile`, {
          headers: { "Authorization": `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/settings/global`)
      ]);

      const profileData = await profileRes.json();
      const settingsData = await settingsRes.json();

      if (!profileRes.ok) throw new Error(profileData.error || "Failed to fetch profile");
      if (!settingsRes.ok) throw new Error(settingsData.error || "Failed to fetch settings");

      setMemberData(profileData.user);
      setUserRole(profileData.role);
      setSettings(settingsData);

      if (profileData.role === "COACH") {
        try {
          const reqRes = await fetch(`${API_BASE}/profile-edit-requests/coach`, {
            headers: { "Authorization": `Bearer ${token}` },
          });
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            setEditRequests(Array.isArray(reqData) ? reqData : []);
          }
        } catch {
          // non-critical, ignore
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequestAction = async (requestId: string, action: "approve" | "reject") => {
    setProcessingRequestId(requestId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/profile-edit-requests/${requestId}/${action}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        setEditRequests(prev =>
          prev.map(r => r.id === requestId ? { ...r, status: action === "approve" ? "APPROVED" : "REJECTED" } : r)
        );
      } else {
        const data = await res.json();
        alert(data.error || `Failed to ${action} request`);
      }
    } catch {
      alert("Error processing request");
    } finally {
      setProcessingRequestId(null);
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
      if (!resScript) {
        throw new Error("Razorpay SDK failed to load.");
      }

      // Determine backend type from userRole
      let type = "member";
      if (userRole.toLowerCase() === "coach") type = "coach";
      if (userRole.toLowerCase() === "club") type = "club";

      const orderRes = await fetch(`${API_BASE}/application/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          id: memberData.id,
          type: type
          // Amount is now handled by the backend from GlobalSettings
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || "Failed to create order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Tamil Nadu Judo Association",
        description: `${userRole} Membership Fee`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch(`${API_BASE}/application/verify-payment`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                id: memberData.id,
                type: type,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || "Verification failed");

            alert(`Payment successful! Your ${idLabel} has been issued. You will now be logged out. Please log in using your new ${idLabel} to change your password and secure your account.`);
            localStorage.clear();
            window.location.href = "/login";
          } catch (err: any) {
            alert("Payment verification failed: " + err.message);
          }
        },
        prefill: {
          name: memberData.fullName || memberData.name,
          email: memberData.email,
          contact: memberData.mobileNumber,
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
        <p className="text-slate-500 font-medium">Loading your profile...</p>
      </div>
    );
  }

  if (error || !memberData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center gap-4">
        <div className="p-4 bg-red-50 text-red-600 rounded-full">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Unable to load profile</h2>
        <p className="text-slate-500">{error || "User data not found"}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-2 bg-[#FF7400] text-white rounded-full font-bold hover:bg-[#E56900] transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const needsPayment = !memberData.isPaid;

  const infoGroups = [
    {
      title: "Basic Information",
      icon: User,
      items: [
        { label: "Name", value: memberData.fullName || memberData.name, icon: User },
        { label: "Date of Birth", value: memberData.dob ? new Date(memberData.dob).toLocaleDateString() : "N/A", icon: Calendar },
        { label: "Email", value: memberData.email, icon: Mail },
        { label: "Mobile Number", value: memberData.mobileNumber, icon: Phone },
      ]
    },
    {
      title: "Address Details",
      icon: MapPin,
      items: [
        { label: "Address", value: memberData.addressLine1 || memberData.address, icon: MapPin },
        { label: "Taluk", value: memberData.taluk?.name || "N/A", icon: Building2 },
        { label: "District", value: memberData.district?.name || "N/A", icon: MapPin },
        { label: "Pincode", value: memberData.pincode, icon: IdCard },
      ]
    },
    {
      title: userRole === "CLUB" ? "Club Details" : "Professional Details",
      icon: Briefcase,
      items: userRole === "CLUB" ? [
        { label: "President", value: memberData.president, icon: User },
        { label: "Secretary", value: memberData.secretary, icon: User },
        { label: "Coach", value: memberData.coach, icon: User },
        { label: "Players Count", value: memberData.noOfStudents.toString(), icon: Users },
      ] : [
        { label: "Employment Type", value: memberData.employmentType || "N/A", icon: Briefcase },
        { label: "Company Name", value: memberData.companyName || "N/A", icon: Building2 },
        { label: "Designation", value: memberData.designation || "N/A", icon: BadgeCheck },
        { label: "Work Location", value: memberData.workLocation || "N/A", icon: MapPin },
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{userRole.replace("_", " ")} Dashboard</h1>
          <p className="text-slate-500">Welcome back, {(memberData.fullName || memberData.name).split(" ")[0]}</p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Header Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center md:items-start gap-8"
        >
          <div className="relative">
            <div className="w-32 h-32 bg-[#FF7400] rounded-2xl flex items-center justify-center text-white text-5xl font-bold shadow-xl shadow-orange-500/20 overflow-hidden">
              {memberData.profilePhoto ? (
                <img 
                  src={memberData.profilePhoto} 
                  alt={memberData.fullName || memberData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                (memberData.fullName || memberData.name)?.charAt(0)
              )}
            </div>
            {memberData.permanentId && (
              <div className="absolute -bottom-2 -right-2 bg-green-500 text-white p-1.5 rounded-full border-4 border-white">
                <BadgeCheck size={20} />
              </div>
            )}
          </div>

          <div className="flex-grow text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-slate-800">{memberData.fullName || memberData.name}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider w-fit mx-auto md:mx-0 ${
                memberData.permanentId ? "bg-green-100 text-green-600" : "bg-orange-100 text-[#FF7400]"
              }`}>
                {memberData.permanentId ? "Active Member" : "Application Approved"}
              </span>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4 mb-4">
              <p className="text-slate-500 flex items-center gap-2">
                <IdCard size={16} />
                {memberData.permanentId ? `${idLabel}: ${memberData.permanentId}` : `Temporary ${idLabel}: ${memberData.tempId}`}
              </p>
              {memberData.validUntil && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-sm font-semibold">
                  <Calendar size={14} /> Valid until: {new Date(memberData.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl">
                <Mail size={18} className="text-[#FF7400]" />
                <span className="text-sm font-medium">{memberData.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl">
                <Phone size={18} className="text-[#FF7400]" />
                <span className="text-sm font-medium">{memberData.mobileNumber}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Payment Required Section */}
        {needsPayment && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-[#FF7400] to-[#E56900] rounded-3xl p-8 text-white shadow-xl shadow-orange-500/20"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <CreditCard size={24} />
                  </div>
                  <h3 className="text-2xl font-bold">Membership Fee Required</h3>
                </div>
                <p className="text-blue-100 leading-relaxed">
                  To activate your official TNJA membership and receive your {idLabel}, please complete the one-time registration fee payment.
                </p>
                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                    <CheckCircle2 size={16} className="text-orange-200" />
                    Permanent Identity
                  </div>
                  <div className="flex items-center gap-2 text-sm bg-white/10 px-3 py-1.5 rounded-full">
                    <CheckCircle2 size={16} className="text-orange-200" />
                    State Eligibility
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl p-6 text-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-slate-500 font-medium">One-time Fee</span>
                  <span className="text-3xl font-bold text-[#FF7400]">
                    ₹ {(settings?.[(userRole?.toLowerCase() === 'coach' ? 'coach' : userRole?.toLowerCase() === 'club' ? 'club' : 'member') + 'Fee'] || 1000).toLocaleString()}
                  </span>
                </div>
                <button 
                  onClick={handlePayment}
                  disabled={paying}
                  className="w-full py-4 bg-[#FF7400] text-white rounded-xl font-bold text-lg hover:bg-[#E56900] transition-all flex items-center justify-center gap-3 disabled:opacity-70 shadow-lg shadow-orange-500/10"
                >
                  {paying ? (
                    <>
                      <Loader2 size={24} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Pay Now to Activate
                      <ArrowRight size={24} />
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-slate-400 mt-4">
                  Secure payment powered by Razorpay
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Profile Edit Requests — Coach Only */}
        {userRole === "COACH" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <div className="p-2 bg-orange-50 text-[#FF7400] rounded-lg">
                <ClipboardEdit size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-800">Player Profile Edit Requests</h2>
            </div>

            {editRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-semibold">
                No profile edit requests from your players.
              </div>
            ) : (
              <div className="space-y-3">
                {editRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{req.player?.fullName || "Player"}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {req.player?.tempId || req.player?.permanentId || ""} &bull;{" "}
                        {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === "PENDING" ? (
                        <>
                          <button
                            onClick={() => handleEditRequestAction(req.id, "approve")}
                            disabled={processingRequestId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-all disabled:opacity-60"
                          >
                            {processingRequestId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Approve
                          </button>
                          <button
                            onClick={() => handleEditRequestAction(req.id, "reject")}
                            disabled={processingRequestId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition-all disabled:opacity-60"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </>
                      ) : req.status === "APPROVED" ? (
                        <span className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl text-sm font-bold">
                          <Check size={14} /> Approved
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 border border-red-100 rounded-xl text-sm font-bold">
                          <X size={14} /> Rejected
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

              <div className={`grid gap-6 ${groupIdx === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
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
      </div>
    </div>
  );
}

export default function MemberDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
      </div>
    }>
      <MemberDashboardContent />
    </Suspense>
  );
}
