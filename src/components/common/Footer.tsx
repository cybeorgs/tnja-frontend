"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaTwitter, FaInstagram, FaFacebookF, FaLinkedinIn } from "react-icons/fa";
import { MapPin, Phone, Mail } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { TNJA_LOGO, TNJA_LOGO_WIDTH, TNJA_LOGO_HEIGHT } from "@/constants/brand";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Latest News", href: "#" },
  { label: "Upcoming Events", href: "#" },
  { label: "Courses", href: "#" },
  { label: "Gallery", href: "/gallery" },
  { label: "Administrative Members", href: "#" },
  { label: "Committee", href: "#" },
];

const SOCIALS = [
  { label: "Facebook", icon: FaFacebookF },
  { label: "Instagram", icon: FaInstagram },
  { label: "LinkedIn", icon: FaLinkedinIn },
  { label: "Twitter", icon: FaTwitter },
];

const Footer = () => {
  const pathname = usePathname();

  const isDashboard = pathname?.startsWith("/dashboard");
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isDashboard || isAuthPage) return null;

  return (
    <footer className="w-full bg-[#030712] border-t border-neutral-900 text-neutral-300">
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#FF7400] to-transparent opacity-70" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6 }}
        className="max-w-[1400px] mx-auto px-6 md:px-12 pt-16 pb-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-10"
      >
        {/* Brand */}
        <div className="sm:col-span-2 lg:col-span-4 flex flex-col items-start">
          <div className="flex items-center gap-4">
            {/* The logo is wide with a white background, so it sits on a white rounded card rather than a circle. */}
            <div className="shrink-0 rounded-2xl bg-white p-2 shadow-lg shadow-black/40">
              <Image
                src={TNJA_LOGO}
                alt="Tamil Nadu Judo Association logo"
                width={TNJA_LOGO_WIDTH}
                height={TNJA_LOGO_HEIGHT}
                sizes="96px"
                className="w-20 md:w-24 h-auto"
              />
            </div>
            <div>
              <h2 className="font-bold text-lg md:text-xl tracking-wide text-white leading-tight">Tamil Nadu Judo</h2>
              <p className="text-[#FF7400] font-semibold text-sm tracking-wider mt-1">Association · Reg. 329/2017</p>
            </div>
          </div>

          <p className="text-neutral-400 text-sm leading-relaxed mt-6 max-w-sm">
            Empowering Tamil Nadu through the spirit of Judo. Building champions with discipline, respect and excellence.
          </p>

          <div className="flex items-center gap-3 mt-6">
            {SOCIALS.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-300 hover:bg-[#FF7400] hover:border-[#FF7400] hover:text-white transition-colors duration-300"
              >
                <Icon size={14} />
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="lg:col-span-2">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Quick Links</h3>
          <ul className="flex flex-col gap-3">
            {QUICK_LINKS.map(({ label, href }) => (
              <li key={label}>
                <Link href={href} className="text-sm text-neutral-400 hover:text-[#FF7400] transition-colors">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* About */}
        <div className="lg:col-span-3">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">About TNJA</h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Tamil Nadu Judo Association is dedicated to promoting the art and discipline of Judo across the state. We nurture athletes of all levels through structured training, championships, and a strong foundation in values.
          </p>
        </div>

        {/* Contact */}
        <div className="sm:col-span-2 lg:col-span-3">
          <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-5">Contact</h3>
          <ul className="flex flex-col gap-4 text-sm">
            <li className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#FF7400] mt-0.5 shrink-0" />
              <span className="text-neutral-400 leading-relaxed">
                12/1, Ground floor, 1st Cross St, Jeth Nagar, RA Puram, Chennai - 600028
              </span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-[#FF7400] shrink-0" />
              <a href="tel:9003713500" className="text-neutral-400 hover:text-[#FF7400] transition-colors">9003713500</a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#FF7400] shrink-0" />
              <a href="mailto:tnja.adoffice@gmail.com" className="text-neutral-400 hover:text-[#FF7400] transition-colors break-all">
                tnja.adoffice@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-800/70">
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <p>© {new Date().getFullYear()} Tamil Nadu Judo Association. All rights reserved.</p>

          <div className="flex items-center gap-5">
            <Link href="#" className="hover:text-[#FF7400] transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-[#FF7400] transition-colors">Privacy Policy</Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="uppercase tracking-wider">Supported by</span>
            {/* The logo has a white background, so it sits on a white badge against the dark footer. */}
            <div className="rounded-md bg-white px-2.5 py-1">
              <Image src="/images/cybeorgs-logo.png" alt="Cybeorgs logo" width={120} height={36} className="h-6 w-auto object-contain" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
