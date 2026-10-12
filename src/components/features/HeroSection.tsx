"use client";

import Image from "next/image";
import { ChevronRight, ArrowDown } from "lucide-react";

const HeroSection = () => {
  const handleScrollDown = () => {
    const heroSection = document.getElementById('hero-section');
    if (heroSection && heroSection.nextElementSibling) {
      heroSection.nextElementSibling.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="hero-section" className="relative w-full bg-[#fafafa] overflow-hidden pt-5 pb-4 px-4 md:px-8">
      {/* Background Decor */}
      <div className="absolute top-10 left-10 w-24 h-24 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#f26522 2px, transparent 2px)', backgroundSize: '16px 16px' }} />
      <div className="absolute top-1/4 -right-20 w-64 h-64 rounded-full border border-orange-100 opacity-50 pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-32 h-32 rounded-full border border-orange-100 opacity-50 pointer-events-none" />

      {/* Curved lines and dots background */}
      <div className="absolute left-0 bottom-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <svg viewBox="0 0 1440 600" className="absolute bottom-0 w-full h-auto text-orange-50/50 opacity-50" preserveAspectRatio="none">
          <path fill="currentColor" d="M0,400 C300,500 600,200 1440,350 L1440,600 L0,600 Z" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10 flex flex-col items-center">
        {/* Header (Logo & Title) */}
        <div className="hidden xl:flex flex-col items-center mb-16">
          <Image
            src="/navbar/Logo.png"
            alt="TNJA Logo"
            width={80}
            height={80}
            className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-sm mb-4"
          />
          <h1 className="text-xl md:text-2xl font-bold text-[#FF7400] tracking-wider text-center uppercase">
            TAMIL NADU JUDO ASSOCIATION 329/2017
          </h1>
          <div className="mt-3 w-2 h-2 rounded-full bg-[#FF7400] shadow-[0_0_8px_rgba(255,116,0,0.6)]" />
        </div>

        {/* 3-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-12 lg:gap-8 items-center w-full">

          {/* Left Column */}
          <div className="flex flex-col items-start pr-0 lg:pr-8">
            <h2 className="text-4xl lg:text-[50px] font-bold text-black mb-4 tracking-tight leading-[1.1]">
              What is Judo?
            </h2>
            <div className="relative w-48 h-[2px] bg-gray-200 mt-2 mb-8">
              <div className="absolute top-0 left-0 w-24 h-[3px] bg-black"></div>
            </div>

            <p className="text-gray-600 text-[15px] leading-relaxed mb-6 text-justify">
              Judo is a modern martial art, Olympic sport, and a system of
              physical and mental education that focuses on skill, balance, and
              technique rather than brute strength.
            </p>

            <p className="text-gray-600 text-[15px] leading-relaxed mb-10 text-justify">
              It was founded in <strong className="text-black font-semibold">1882 by Dr. Jigoro Kano in Tokyo, Japan.</strong> Drawing
              from traditional Japanese jujutsu, Dr. Kano created Judo to promote
              not only self-defense but also personal development and discipline.
            </p>

            <button className="group relative flex items-center justify-between w-40 h-12 bg-gradient-to-r from-[#FF7400] to-[#FF9500] rounded-full text-white font-semibold text-sm shadow-[0_8px_20px_rgba(255,116,0,0.3)] transition-transform hover:scale-105">
              <span className="pl-6">Learn More</span>
              <div className="absolute right-1 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <ChevronRight className="w-5 h-5 text-[#FF7400]" />
              </div>
            </button>
          </div>

          {/* Middle Column (Portrait) */}
          <div className="relative flex justify-center w-full px-4 lg:px-0">
            {/* Background Glow and Orbit */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] rounded-full bg-[#FF7400]/15 blur-[40px] -z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-[#FF7400]/20 -z-10" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] h-[440px] rounded-full border border-[#FF7400]/10 -z-10" />
            <div className="absolute -top-4 -right-4 w-4 h-4 rounded-full bg-[#FF7400] opacity-50 shadow-[0_0_10px_rgba(255,116,0,0.5)]" />

            {/* Image Frame */}
            <div className="relative w-full max-w-[340px] lg:w-[350px] aspect-[4/5] rounded-3xl p-[3px] bg-gradient-to-b from-[#FF7400] to-[#FFB266] shadow-[0_20px_50px_rgba(255,116,0,0.15)] overflow-hidden">
              <div className="relative w-full h-full rounded-[22px] overflow-hidden bg-[#e6d9c8]">
                <Image
                  src="/homepage/kano.png"
                  alt="Dr. Jigoro Kano"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="relative pl-0 lg:pl-12 flex flex-col gap-8">
            {/* Vertical Line */}
            <div className="hidden lg:block absolute left-4 top-2 bottom-2 w-[2px] bg-gray-200" />

            {/* Point 1 */}
            <div className="relative pl-0 lg:pl-10">
              <div className="hidden lg:block absolute left-[-23px] top-1.5 w-3 h-3 rounded-full bg-[#FF7400] shadow-[0_0_8px_rgba(255,116,0,0.5)]" />
              <p className="text-gray-600 text-[14px] leading-[1.8] text-justify">
                The term "Judo" means <span className="text-[#FF7400] font-semibold">"the gentle way"</span>.
                This reflects the core principle of using an
                opponent's energy and movement against
                them, instead of relying on force. Judo
                techniques mainly include throws (Nage-waza), ground control such as pins, joint
                locks, and chokeholds (Katame-waza), all
                practiced in a safe and controlled manner.
              </p>
            </div>

            {/* Point 2 */}
            <div className="relative pl-0 lg:pl-10">
              <div className="hidden lg:block absolute left-[-23px] top-1.5 w-3 h-3 rounded-full bg-[#FF7400] shadow-[0_0_8px_rgba(255,116,0,0.5)]" />
              <p className="text-gray-600 text-[14px] leading-[1.8] text-justify">
                Judo is built on two important principles:
                <span className="text-[#FF7400] font-semibold"> "Maximum Efficiency with Minimum Effort"</span>
                and <span className="text-[#FF7400] font-semibold">"Mutual Welfare and Benefit"</span>. These
                values teach respect, humility, and
                cooperation. Practitioners, known as
                judokas, develop physical fitness, mental
                strength, confidence, and discipline through
                consistent training.
              </p>
            </div>

            {/* Point 3 */}
            <div className="relative pl-0 lg:pl-10">
              <div className="hidden lg:block absolute left-[-23px] top-1.5 w-3 h-3 rounded-full bg-[#FF7400] shadow-[0_0_8px_rgba(255,116,0,0.5)]" />
              <p className="text-gray-600 text-[14px] leading-[1.8] text-justify">
                Judo gained international recognition and
                became an official Olympic sport in the 1964
                Summer Olympics. Today, it is practiced in
                schools, clubs, and institutions across the
                world, making it one of the most popular
                martial arts globally.
              </p>
            </div>
          </div>
        </div>

        {/* Scroll Down */}
        <button
          onClick={handleScrollDown}
          className="mt-8 mb-4 flex flex-col items-center gap-3 group focus:outline-none"
        >
          <span className="text-[#FF7400] text-sm font-semibold tracking-widest uppercase transition-colors group-hover:text-[#e66800]">
            Scroll Down
          </span>
          <div className="w-10 h-10 rounded-full border border-[#FF7400]/40 flex items-center justify-center text-[#FF7400] transition-colors group-hover:bg-[#FF7400] group-hover:text-white">
            <ArrowDown className="w-5 h-5" />
          </div>
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
