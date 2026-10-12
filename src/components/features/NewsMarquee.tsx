"use client";

import React from 'react';
import Image from 'next/image';

const NewsMarquee = () => {
  const newsItems = [
    "District-level Judo Meet - July 25",
    "Coaches Workshop - Registration closes July 20",
    "State Championship Finals - August 10",
    "Junior Judo Training Camp - Starts July 15",
  ];



  return (
    <div className="w-full bg-white py-16 overflow-hidden relative">
      {/* Top Border Line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1280px] h-[12px]">
        <Image 
          src="/homepage/banner/Line.svg" 
          alt="Separator" 
          fill
          sizes="1280px"
          className="object-cover"
        />
      </div>

      {/* Centered Content Container */}
      <div className="max-w-[1280px] mx-auto overflow-hidden">
        {/* The Scrolling Content Container */}
        <div className="flex items-center whitespace-nowrap animate-marquee-horizontal">
          {/* Double the items to create a seamless loop */}
          {[...newsItems, ...newsItems, ...newsItems].map((item, index) => (
            <div key={index} className="flex items-center gap-4 px-10 group cursor-pointer">
              <Image 
                src="/homepage/banner/judo.svg" 
                alt="Judo Icon" 
                width={24} 
                height={24}
                className="flex-shrink-0"
              />
              <span className="text-[#FF7400] font-extrabold text-lg md:text-xl uppercase tracking-tighter hover:text-black transition-colors duration-300">
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Border Line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[1280px] h-[12px]">
        <Image 
          src="/homepage/banner/Line.svg" 
          alt="Separator" 
          fill
          sizes="1280px"
          className="object-cover"
        />
      </div>

      <style jsx global>{`
        @keyframes marquee-horizontal {
          0% { transform: translateX(-33.33%); }
          100% { transform: translateX(0); }
        }
        .animate-marquee-horizontal {
          display: flex;
          width: fit-content;
          animation: marquee-horizontal 40s linear infinite;
        }
        .animate-marquee-horizontal:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default NewsMarquee;
