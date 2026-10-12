"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { GiTempleGate, GiWhistle, GiBlackBelt } from 'react-icons/gi';
import { FaUsers } from 'react-icons/fa';

const registrationRoles = [
  {
    title: "Register as Club",
    icon: GiTempleGate,
    href: "/register/club"
  },
  {
    title: "Register as Members",
    icon: FaUsers,
    href: "/register/member"
  },
  {
    title: "Register as Coach / Referee",
    icon: GiWhistle,
    href: "/register/coach"
  },
  {
    title: "Register as Player",
    icon: GiBlackBelt,
    href: "/register/player"
  }
];

const RegisterSelection = () => {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden py-20 px-4">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
      </div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-[#FF7400] font-bold uppercase tracking-[0.2em] text-sm mb-4">
            New Registration
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#2B1300] leading-tight max-w-3xl mx-auto">
            Create Your Account – Select Your Role
          </h1>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-20 max-w-[1000px] mx-auto mt-24">
          {registrationRoles.slice(0, 3).map((role, index) => (
            <motion.a
              key={role.title}
              href={role.href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full bg-[#F5F5F5] relative overflow-hidden flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                {/* Bottom to Top Fill Animation */}
                <div className="absolute inset-0 bg-[#FF7400] translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                
                <role.icon className="w-10 h-10 text-gray-600 relative z-10 transition-colors duration-300 group-hover:text-white" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-[#2B1300] tracking-wide text-center">
                {role.title}
              </h3>
            </motion.a>
          ))}
          
          {/* Second Row - Centered */}
          <div className="md:col-start-2 flex justify-center">
            <motion.a
              href={registrationRoles[3].href}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center group cursor-pointer"
            >
              <div className="w-24 h-24 rounded-full bg-[#F5F5F5] relative overflow-hidden flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110 shadow-sm">
                {/* Bottom to Top Fill Animation */}
                <div className="absolute inset-0 bg-[#FF7400] translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                
                <GiBlackBelt className="w-12 h-12 text-gray-600 relative z-10 transition-colors duration-300 group-hover:text-white" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-[#2B1300] tracking-wide text-center">
                {registrationRoles[3].title}
              </h3>
            </motion.a>
          </div>
        </div>
      </div>

      
    </div>
  );
};

export default RegisterSelection;
