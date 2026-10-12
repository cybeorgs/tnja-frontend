"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Users, 
  Building2, 
  Search,
  ArrowRight,
  TrendingUp,
  Map as MapIcon,
  Loader2
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

export default function LocationsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [taluks, setTaluks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/admin/location-analytics`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setTaluks(data);
        }
      } catch (err) {
        console.error("Failed to fetch location analytics", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const filteredTaluks = taluks.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDistrictMembers = taluks.reduce((acc, t) => acc + t.total, 0);
  const mostActiveTaluk = taluks.length > 0 ? taluks[0] : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Location Analytics</h1>
          <p className="text-slate-500">Member distribution across district taluks</p>
        </div>
        {/* <div className="flex gap-4">
          <button className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all">
            <MapIcon size={20} />
            Map View
          </button>
        </div> */}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Taluk List */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search taluks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400] transition-all shadow-sm"
            />
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-20 text-center flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin text-[#FF7400]" />
                <p className="text-slate-400 font-medium">Analyzing locations...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider">Taluk Name</th>
                      <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Clubs</th>
                      <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Members</th>
                      <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-center">Players</th>
                      <th className="px-8 py-5 text-sm font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTaluks.map((taluk, idx) => (
                      <motion.tr 
                        key={taluk.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-50 text-[#FF7400] rounded-xl flex items-center justify-center font-bold">
                              {taluk.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-800">{taluk.name}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-sm font-medium text-slate-600 bg-purple-50 px-3 py-1 rounded-full">{taluk.clubs}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-sm font-bold text-slate-800">{taluk.members}</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="text-sm font-medium text-[#FF7400] bg-orange-50 px-3 py-1 rounded-full">{taluk.players}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button className="text-slate-400 group-hover:text-[#FF7400] transition-colors">
                            <ArrowRight size={20} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="space-y-6">
          <div className="bg-[#FF7400] rounded-3xl p-8 text-white shadow-xl shadow-orange-500/20">
            <h3 className="text-xl font-bold mb-4">Total District Registrations</h3>
            <div className="flex items-end gap-3 mb-6">
              <span className="text-5xl font-bold">{totalDistrictMembers}</span>
              <span className="text-orange-100 font-medium mb-2 flex items-center gap-1">
                <TrendingUp size={16} /> Live
              </span>
            </div>
            {mostActiveTaluk && (
              <p className="text-orange-50 text-sm leading-relaxed">
                {mostActiveTaluk.name} is currently the most active taluk with {mostActiveTaluk.total} total registrations.
              </p>
            )}
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-6">Top Regions</h3>
            <div className="space-y-6">
              {taluks.slice(0, 3).map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 ${idx === 0 ? "bg-[#FF7400]" : idx === 1 ? "bg-purple-500" : "bg-emerald-500"} rounded-full`}></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.name}</h4>
                      <p className="text-xs text-slate-400">Region</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-800">{item.total}</span>
                </div>
              ))}
              {taluks.length === 0 && !loading && (
                <p className="text-slate-400 text-sm italic">No data available.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
