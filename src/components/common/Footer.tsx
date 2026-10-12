"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaTwitter, FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { Link2, Users, PhoneCall, ChevronRight, MapPin, Phone, Mail } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Footer = () => {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDashboard = pathname?.startsWith("/dashboard");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isDashboard || isAuthPage) return null;

  return (
    <footer className="w-full bg-[#030712] relative pt-20 border-t border-neutral-900 overflow-hidden text-neutral-300">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-10 right-10 opacity-5 pointer-events-none text-9xl font-bold select-none text-white tracking-widest">
        柔道
      </div>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-950/20 via-[#030712] to-[#030712] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 pb-16 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8"
        >
          
          {/* Column 1: Logo and Socials (Col Span 3) */}
          <div className="flex flex-col items-center text-center lg:col-span-3 lg:pr-8 lg:border-r border-neutral-800/60">
            <div className="relative w-20 h-20 md:w-28 md:h-28 mb-4">
              {/* Mobile view logo (using the transparent high-res Logo_2) */}
              <div className="block md:hidden relative w-full h-full">
                <Image src="/navbar/Logo_2.png" alt="TNJA Logo Mobile" fill sizes="80px" className="object-contain" />
              </div>
              {/* Desktop view logo (using original Logo) */}
              <div className="hidden md:block relative w-full h-full">
                <Image src="/navbar/Logo.png" alt="TNJA Logo Desktop" fill sizes="112px" className="object-contain drop-shadow-[0_0_15px_rgba(255,116,0,0.3)]" />
              </div>
            </div>
            
            <h2 className="font-bold text-xl tracking-wide text-white mt-2">TAMIL NADU JUDO</h2>
            <p className="text-[#FF7400] font-bold text-sm tracking-wider mt-1 mb-6">ASSOCIATION 329/2017</p>
            
            <p className="text-neutral-400 text-xs leading-[1.8] mb-8">
              Empowering Tamil Nadu through the spirit of Judo. Building champions with discipline, respect and excellence.
            </p>
            
            <div className="flex items-center gap-4 w-full justify-center mb-6">
              <div className="h-[1px] flex-1 bg-neutral-800"></div>
              <span className="text-white text-xs font-bold tracking-widest uppercase">Follow Us</span>
              <div className="h-[1px] flex-1 bg-neutral-800"></div>
            </div>

            <div className="flex items-center gap-3">
              <a href="#" className="w-10 h-10 rounded-full border border-[#FF7400] flex items-center justify-center text-white hover:bg-[#FF7400] transition-colors duration-300">
                <FaFacebookF size={14} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#FF7400] flex items-center justify-center text-white hover:bg-[#FF7400] transition-colors duration-300">
                <FaInstagram size={14} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#FF7400] flex items-center justify-center text-white hover:bg-[#FF7400] transition-colors duration-300">
                <FaLinkedinIn size={14} />
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-[#FF7400] flex items-center justify-center text-white hover:bg-[#FF7400] transition-colors duration-300">
                <FaTwitter size={14} />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links (Col Span 3) */}
          <div className="flex flex-col lg:col-span-3 lg:px-8 lg:border-r border-neutral-800/60">
            <div className="flex items-center gap-3 mb-2">
              <Link2 className="w-6 h-6 text-[#FF7400]" />
              <h3 className="text-white font-bold text-lg uppercase tracking-wider">Quick Links</h3>
            </div>
            <div className="w-12 h-[2px] bg-[#FF7400] mb-8"></div>
            
            <div className="flex flex-col">
              {[
                "Home", "Latest News", "Upcoming Events", "Courses", 
                "Gallery", "Members", "Committee", "Terms of Services", "Privacy Policy"
              ].map((item, index) => (
                <Link 
                  key={item} 
                  href={item === 'Home' ? '/' : (item === 'Gallery' ? '/gallery' : '#')} 
                  className={`flex items-center gap-3 py-3 text-sm text-neutral-300 hover:text-[#FF7400] transition-colors ${index !== 8 ? 'border-b border-dashed border-neutral-800' : ''}`}
                >
                  <ChevronRight className="w-4 h-4 text-[#FF7400]" />
                  {item}
                </Link>
              ))}
            </div>
          </div>

          {/* Column 3: About TNJA (Col Span 3) */}
          <div className="flex flex-col lg:col-span-3 lg:px-8 lg:border-r border-neutral-800/60">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-6 h-6 text-[#FF7400]" />
              <h3 className="text-white font-bold text-lg uppercase tracking-wider">About TNJA</h3>
            </div>
            <div className="w-12 h-[2px] bg-[#FF7400] mb-8"></div>
            
            <p className="text-white font-bold text-sm leading-[1.8] mb-4">
              Empowering Tamil Nadu Through the Spirit of Judo
            </p>
            <p className="text-neutral-400 text-xs leading-[1.9]">
              Tamil Nadu Judo Association is dedicated to promoting the art and discipline of Judo across the state. We nurture athletes of all levels through structured training, championships, and a strong foundation in values.
            </p>
          </div>

          {/* Column 4: Contact With Us (Col Span 3) */}
          <div className="flex flex-col lg:col-span-3 lg:pl-8">
            <div className="flex items-center gap-3 mb-2">
              <PhoneCall className="w-6 h-6 text-[#FF7400]" />
              <h3 className="text-white font-bold text-lg uppercase tracking-wider">Contact With Us</h3>
            </div>
            <div className="w-12 h-[2px] bg-[#FF7400] mb-8"></div>
            
            <div className="flex flex-col gap-6 text-sm">
              <div className="flex items-start gap-4 pb-6 border-b border-dashed border-neutral-800">
                <div className="w-12 h-12 rounded-xl bg-neutral-900/80 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 border border-neutral-800">
                  <MapPin className="w-5 h-5 text-[#FF7400]" />
                </div>
                <div className="flex flex-col gap-1.5 mt-1">
                  <p className="text-white font-bold">Address</p>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    TamilNadu Judo Association <br />
                    12/1, Ground floor, 1st Cross st, <br />
                    Jeth nagar, RA Puram, <br />
                    Chennai - 600028
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 pb-6 border-b border-dashed border-neutral-800">
                <div className="w-12 h-12 rounded-xl bg-neutral-900/80 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 border border-neutral-800">
                  <Phone className="w-5 h-5 text-[#FF7400]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-bold">Call Us</p>
                  <p className="text-neutral-400 text-xs">9003713500</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-neutral-900/80 shadow-[inset_0_1px_3px_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 border border-neutral-800">
                  <Mail className="w-5 h-5 text-[#FF7400]" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-white font-bold">Mail Us</p>
                  <p className="text-neutral-400 text-xs">tnja.adoffice@gmail.com</p>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
