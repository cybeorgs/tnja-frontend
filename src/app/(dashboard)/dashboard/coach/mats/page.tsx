"use client";

import React, { useEffect, useState } from "react";
import { Trophy, Calendar, Loader2, ArrowRight, Monitor, Search } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

interface Tournament {
  id: string;
  title: string;
  date: string;
  status: string;
  location: string;
}

interface MatAssignment {
  tournamentId: string;
  matNumber: number;
  tournament: Tournament;
}

export default function MyMatsPage() {
  const [assignments, setAssignments] = useState<MatAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchMats = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE}/referees/my-mats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAssignments(data.mats);
        }
      } catch (error) {
        console.error("Error fetching mats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-[#FF7400] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-6">
        <div className="w-16 h-16 bg-orange-100 text-[#FF7400] rounded-2xl flex items-center justify-center shrink-0">
          <Monitor size={32} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-black text-slate-800">My Referee Assignments</h1>
          <p className="text-slate-500 font-semibold mt-1">
            Tournaments where you have been assigned as a Mat Referee
          </p>
        </div>
      </div>

      {/* Search / Filter */}
      {assignments.length > 0 && (
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-700 font-semibold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow outline-none shadow-sm"
            placeholder="Search tournaments by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
            <Trophy className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-black text-slate-700">No Assignments Yet</h3>
          <p className="text-slate-500 font-semibold mt-2 max-w-md">
            You haven't been assigned to any mats yet. When the administrator assigns you to a tournament mat, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.filter(a => a.tournament.title.toLowerCase().includes(searchQuery.toLowerCase())).map((assignment, index) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={`${assignment.tournamentId}-${assignment.matNumber}`}
              className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all group flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-[#FF7400] transition-colors shrink-0">
                  <Trophy size={24} />
                </div>
                <div className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-orange-200">
                  <Monitor size={14} /> Mat {assignment.matNumber}
                </div>
              </div>

              <div className="flex-1 space-y-3">
                <h3 className="font-black text-slate-800 text-lg leading-tight group-hover:text-[#FF7400] transition-colors line-clamp-2">
                  {assignment.tournament.title}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-slate-500 font-semibold">
                  <Calendar size={14} className="text-slate-400" />
                  {new Date(assignment.tournament.date).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric"
                  })}
                </div>
              </div>

              <Link
                href={`/dashboard/coach/mats/${assignment.tournamentId}?mat=${assignment.matNumber}`}
                className="mt-6 flex items-center justify-center gap-2 w-full py-3.5 bg-slate-50 text-slate-700 font-bold rounded-xl group-hover:bg-[#FF7400] group-hover:text-white transition-all"
              >
                Open Mat Dashboard <ArrowRight size={18} />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
