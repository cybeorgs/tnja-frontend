"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Trophy,
  Target,
  TrendingUp,
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000/api";

interface StudentPerformance {
  id: string;
  fullName: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  profilePhoto?: string;
  permanentId?: string;
  tempId: string;
  performance: {
    wins: number;
    losses: number;
    draws: number;
    totalMatches: number;
    winRate: number;
  };
  tournamentCount: number;
}

export default function CoachStudentsPage() {
  const [students, setStudents] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/coach/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load students");
      }

      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error("Error fetching students:", err);
      setError("Failed to load students. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter((student) =>
    student.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate overall statistics
  const totalStudents = students.length;
  const totalWins = students.reduce((sum, s) => sum + s.performance.wins, 0);
  const totalMatches = students.reduce((sum, s) => sum + s.performance.totalMatches, 0);
  const averageWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
  const totalTournaments = students.reduce((sum, s) => sum + s.tournamentCount, 0);

  // Get performance rating
  const getPerformanceRating = (winRate: number): { label: string; color: string } => {
    if (winRate >= 80) return { label: "Excellent", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (winRate >= 60) return { label: "Good", color: "bg-blue-50 text-blue-700 border-blue-200" };
    if (winRate >= 40) return { label: "Average", color: "bg-amber-50 text-amber-700 border-amber-200" };
    return { label: "Needs Improvement", color: "bg-red-50 text-red-700 border-red-200" };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-800">My Students</h1>
        <p className="text-slate-500 mt-1 text-sm">Track your students' performance and progress</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Total Students", value: totalStudents, color: "bg-blue-50 text-blue-600" },
          { icon: Trophy, label: "Total Wins", value: totalWins, color: "bg-emerald-50 text-emerald-600" },
          { icon: Target, label: "Average Win Rate", value: `${averageWinRate}%`, color: "bg-amber-50 text-amber-600" },
          { icon: TrendingUp, label: "Tournaments", value: totalTournaments, color: "bg-purple-50 text-purple-600" },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-xl`}>
                <stat.icon size={24} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search students by name..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF7400]/50 transition-all"
        />
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3"
        >
          <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">{error}</p>
            <button
              onClick={fetchStudents}
              className="text-red-600 underline text-sm mt-1 hover:text-red-700 font-semibold"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      )}

      {/* Students List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={40} className="animate-spin text-[#FF7400]" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl">
          <Users size={40} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-500">No Students Found</h3>
          <p className="text-slate-400 text-sm mt-2">
            {students.length === 0 ? "You don't have any approved students yet." : "No students match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredStudents.map((student, idx) => {
              const ratingInfo = getPerformanceRating(student.performance.winRate);
              return (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  {/* Header with Profile Photo */}
                  <div className="h-24 bg-gradient-to-br from-[#FF7400]/20 to-orange-100 relative">
                    {student.profilePhoto && (
                      <img
                        src={student.profilePhoto}
                        alt={student.fullName}
                        className="absolute bottom-0 left-4 w-16 h-16 rounded-full border-4 border-white object-cover"
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 pt-12">
                    {/* Name and Age */}
                    <h3 className="text-lg font-bold text-slate-800">{student.fullName}</h3>
                    <div className="flex gap-3 mt-1 text-xs text-slate-500 font-medium">
                      <span>Age: {student.age}</span>
                      <span>•</span>
                      <span>{student.gender === "FEMALE" ? "Female" : "Male"}</span>
                    </div>

                    {/* Performance Metrics */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500 uppercase">Win Rate</span>
                        <span className="text-lg font-bold text-slate-800">{student.performance.winRate}%</span>
                      </div>

                      {/* Win Rate Bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF7400] to-orange-400 transition-all"
                          style={{ width: `${student.performance.winRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Match Stats */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-emerald-600 font-semibold">Wins</p>
                        <p className="text-xl font-bold text-emerald-700 mt-1">{student.performance.wins}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xs text-red-600 font-semibold">Losses</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{student.performance.losses}</p>
                      </div>
                      <div className="bg-slate-100 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-600 font-semibold">Draws</p>
                        <p className="text-xl font-bold text-slate-700 mt-1">{student.performance.draws}</p>
                      </div>
                    </div>

                    {/* Tournament & Rating Info */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Total Matches</span>
                        <span className="font-bold text-slate-800">{student.performance.totalMatches}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 font-medium">Tournaments</span>
                        <span className="font-bold text-slate-800">{student.tournamentCount}</span>
                      </div>
                    </div>

                    {/* Performance Rating Badge */}
                    <div className={`mt-4 px-3 py-2 rounded-xl border text-xs font-bold text-center ${ratingInfo.color}`}>
                      {ratingInfo.label}
                    </div>

                    {/* ID Info */}
                    {student.permanentId && (
                      <p className="mt-3 text-[10px] text-slate-400 text-center">{student.permanentId}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
