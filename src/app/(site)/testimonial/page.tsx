"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import PageHero from "@/components/common/PageHero";

// Testimonial Data matching the user's requirements and image
const testimonials = [
  {
    id: 1,
    name: "K.MURALI",
    role: "POLICE",
    quote: "Judo keeps me fit and disciplined. The techniques I've learned help me in my daily service as a police officer. Tamil Nadu Judo Association's dedication to quality training has created an exceptional ecosystem for martial artists.",
    image: "/testimonial/t1.png",
    rotation: -2,
    offset: "lg:ml-[-120px]",
  },
  {
    id: 2,
    name: "KEVINRAJ",
    role: "JUDO COACH",
    quote: "Teaching judo to the next generation is a privilege. Seeing them grow in character and skill is the greatest reward. TNJA's support for coaches through licensing and workshops ensures we deliver world-class training.",
    image: "/testimonial/t1.png",
    rotation: 1.5,
    offset: "lg:mr-[-120px]",
  },
  {
    id: 3,
    name: "MR.SHANMUGAM",
    role: "JUDO OWNER",
    quote: "TNJA has done an incredible job organizing district and state championships. Under their leadership, judo clubs receive immense structure, enabling athletes to achieve national and international recognition.",
    image: "/testimonial/t1.png",
    rotation: -1,
    offset: "lg:ml-[-120px]",
  },
  {
    id: 4,
    name: "K.MEENA",
    role: "JUDO COACH",
    quote: "Female representation in judo has grown rapidly. TNJA's proactive support for female athletes, coaches, and safe training spaces is highly commendable. It has paved the way for many young girls to take up this martial art.",
    image: "/testimonial/t1.png",
    rotation: 2.5,
    offset: "lg:mr-[-120px]",
  },
];

// Curved connecting arrows SVG components
const ConnectorArrow = ({ direction }: { direction: "right" | "left" }) => {
  return (
    <div className="hidden lg:block relative w-full h-48 my-8 pointer-events-none z-0">
      <div 
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-4 w-[180px] h-[180px] ${
          direction === "left" ? "scale-x-[-1]" : ""
        }`}
      >
        <Image
          src="/testimonial/arrow.svg"
          alt="Connecting Arrow"
          fill
          className="object-contain animate-pulse"
        />
      </div>
    </div>
  );
};

export default function TestimonialPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      {/* Page Hero Header */}
      <PageHero
        title={
          <span>
            <span className="text-[#FF7400]">TESTI</span>MONIAL
          </span>
        }
        breadcrumbItems={[
          { label: "Home", href: "/" },
          { label: "Testimonial" },
        ]}
        backgroundImage="/images/testimonial-banner-bg.png"
      />

      <div className="container mx-auto px-4 mt-20 max-w-5xl">
        {/* Intro description */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <p className="text-[#FF7400] font-extrabold uppercase tracking-widest text-xs mb-3">
            Voices of Champions
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
            What Our Judo Community Says
          </h2>
          <div className="w-16 h-1 bg-[#FF7400] mx-auto mt-4 rounded-full"></div>
        </div>

        {/* Vertical Zigzag Testimonials Layout */}
        <div className="relative flex flex-col items-center">
          {testimonials.map((item, index) => {
            const isEven = index % 2 === 0;

            return (
              <React.Fragment key={item.id}>
                {/* Testimonial Card */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`w-full relative z-10 flex ${
                    isEven ? "justify-start lg:pl-12" : "justify-end lg:pr-12"
                  }`}
                >
                  <motion.div
                    className="w-full max-w-[580px] aspect-square relative group cursor-default"
                    style={{
                      transform: `rotate(${item.rotation}deg)`,
                    }}
                    whileHover={{
                      scale: 1.03,
                      rotate: 0,
                      transition: { duration: 0.3, ease: "easeOut" },
                    }}
                  >
                    {/* The 3D physical stacked paper background with 3D pushpin */}
                    <Image
                      src="/testimonial/testimonial.svg"
                      alt="Stacked note background"
                      fill
                      className="object-contain pointer-events-none select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.12)] group-hover:drop-shadow-[0_20px_35px_rgba(0,0,0,0.18)] transition-all duration-500 ease-out"
                      priority
                    />

                    {/* Content container aligned inside the top tilted sheet of paper */}
                    <div 
                      className="absolute inset-0 top-[12%] bottom-[16%] left-[13%] right-[13%] flex flex-col items-center justify-center rotate-[-5.2deg]"
                    >
                      {/* Polaroid Styled Photo Container */}
                      <div className="relative w-[85%] aspect-[2/1] rounded-sm overflow-hidden border-[5px] border-white shadow-[0_3px_8px_rgba(0,0,0,0.15)] bg-slate-900">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover object-top opacity-95 group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
                      </div>

                      {/* User Profile details */}
                      <div className="mt-3 w-[85%] text-left">
                        <h3 className="text-lg sm:text-xl font-extrabold text-[#FF7400] tracking-wide leading-none">
                          {item.name}
                        </h3>
                        <p className="text-[10px] sm:text-xs font-black text-gray-500 tracking-wider uppercase mt-1">
                          {item.role}
                        </p>
                        
                        {/* Quote Text */}
                        <p className="text-gray-700 text-xs sm:text-sm font-semibold italic mt-3 leading-relaxed relative pl-3 border-l-2 border-[#FF7400]/40">
                          "{item.quote}"
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Dashed orange curved connecting arrows (only between items, on desktop) */}
                {index < testimonials.length - 1 && (
                  <ConnectorArrow direction={isEven ? "right" : "left"} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </main>
  );
}
