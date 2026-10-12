"use client";

import React from 'react';
import Image from 'next/image';

const WhatIsJudo = () => {
  return (
    <section className="pb-16 md:pb-24 pt-4 md:pt-8 px-4 md:px-8 bg-transparent overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        {/* Title Section */}
        <div className="mb-12 relative flex flex-col items-center md:items-start w-full">
          <h2 className="text-5xl md:text-[80px] font-bold text-black mb-4 tracking-tight leading-none text-center md:text-left w-full">
            What is Judo?
          </h2>
          {/* Underline */}
          <div className="relative w-full h-[1px] bg-gray-200 mt-4 md:mt-6">
            <div className="absolute top-[-1px] left-1/2 md:left-0 w-[80%] max-w-[500px] h-[3px] bg-black -translate-x-1/2 md:translate-x-0"></div>
          </div>
        </div>

        {/* Intro Paragraph */}
        <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-20 max-w-7xl font-medium text-justify">
          Judo is a modern martial art, Olympic sport, and a system of physical and mental education that focuses on skill, balance, and technique rather than brute strength.<br className="hidden md:block" />
          <span className="inline-block mt-2">It was founded in <strong className="text-black">1882 by Dr. Jigoro Kano in Tokyo, Japan.</strong> Drawing from traditional Japanese jujutsu, Dr. Kano created Judo to promote not only self-defense but also personal development and discipline.</span>
        </p>

        {/* First Content Block: Image Left, Text Right */}
        <div className="flex flex-col lg:flex-row items-center gap-12 mb-24">
          {/* Image Container with Gradient Border */}
          <div className="relative w-full lg:w-1/2 flex justify-center">
            <div className="relative p-[3px] bg-gradient-to-br from-yellow-400 to-red-500 rounded-2xl shadow-[0px_8px_24px_rgba(255,116,0,0.08)] w-full max-w-lg">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50">
                <Image
                  src="/homepage/kano.png"
                  alt="Dr. Jigoro Kano"
                  fill
                  sizes="(max-width: 768px) 100vw, 500px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="w-full lg:w-1/2 space-y-8">
            <p className="text-gray-700 text-sm md:text-base leading-relaxed text-justify">
              The term <span className="text-[#FF7400] font-bold">"Judo"</span> means <span className="text-[#FF7400] font-bold">"the gentle way"</span>. This reflects the core principle of using an opponent's energy and movement against them, instead of relying on force. Judo techniques mainly include throws (Nage-waza), ground control such as pins, joint locks, and chokeholds (Katame-waza), all practiced in a safe and controlled manner.
            </p>
            <p className="text-gray-700 text-sm md:text-base leading-relaxed text-justify">
              Judo is built on two important principles: <span className="text-[#FF7400] font-bold">"Maximum Efficiency with Minimum Effort"</span> and <span className="text-[#FF7400] font-bold">"Mutual Welfare and Benefit"</span>. These values teach respect, humility, and cooperation. Practitioners, known as judokas, develop physical fitness, mental strength, confidence, and discipline through consistent training.
            </p>
            <p className="text-gray-700 text-sm md:text-base leading-relaxed text-justify">
              Judo gained international recognition and became an official Olympic sport in the 1964 Summer Olympics. Today, it is practiced in schools, clubs, and institutions across the world, making it one of the most popular martial arts globally.
            </p>
          </div>
        </div>

        {/* Quote & Second Image Layout */}
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-12 mt-10">
          {/* Centered Quote */}
          <div className="w-full md:w-2/3 flex flex-col items-center md:items-start md:pl-20">
            <h3 className="text-[20px] font-semibold text-black leading-none tracking-[0.04em] text-center md:text-left max-w-[812px]">
              Beyond competition, Judo is a lifelong journey that helps individuals build character, respect others, and maintain a healthy body and mind.
            </h3>
          </div>

          {/* Second Image Card (Right aligned) */}
          <div className="w-full md:w-1/3 flex justify-center md:justify-end md:pr-16">
            <div className="relative p-[3px] bg-gradient-to-br from-yellow-400 to-red-500 rounded-2xl shadow-[0px_8px_24px_rgba(255,116,0,0.08)] w-full max-w-sm">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50">
                <Image
                  src="/trainer.png"
                  alt="Judo Action 2"
                  fill
                  sizes="(max-width: 768px) 100vw, 400px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhatIsJudo;
