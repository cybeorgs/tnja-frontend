"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Calendar, 
  Tag, 
  Maximize2,
  ChevronRight as BreadcrumbRight
} from "lucide-react";

interface GalleryItem {
  id: number;
  src: string;
  title: string;
  category: string;
  date: string;
  year: number;
  gridClass: string;
}

const GALLERY_DATA: GalleryItem[] = [
  // 2023 Images (Matching the exact mockup asymmetrical grid of 7 images)
  {
    id: 1,
    src: "/images/gallery/gallery-1.png",
    title: "Tamil Nadu State Judo Championship 2023 - 2024",
    category: "Championships",
    date: "November 12, 2023",
    year: 2023,
    gridClass: "md:col-span-2 h-[280px] md:h-[350px]"
  },
  {
    id: 2,
    src: "/images/gallery/gallery-2.png",
    title: "Spectacular Overhead Shoulder Throw Demonstration",
    category: "Action",
    date: "October 05, 2023",
    year: 2023,
    gridClass: "md:col-span-1 h-[280px] md:h-[350px]"
  },
  {
    id: 3,
    src: "/images/gallery/gallery-3.png",
    title: "Technical Sparring & Speed Training Session",
    category: "Training",
    date: "September 18, 2023",
    year: 2023,
    gridClass: "md:col-span-1 h-[280px] md:h-[280px]"
  },
  {
    id: 4,
    src: "/images/gallery/gallery-4.png",
    title: "Mega Martial Arts Seminar & Assembly",
    category: "Seminars",
    date: "August 24, 2023",
    year: 2023,
    gridClass: "md:col-span-1 h-[280px] md:h-[280px]"
  },
  {
    id: 5,
    src: "/images/gallery/gallery-5.png",
    title: "Official State Referees & Coaches Delegation",
    category: "Ceremonies",
    date: "July 15, 2023",
    year: 2023,
    gridClass: "md:col-span-1 h-[280px] md:h-[280px]"
  },
  {
    id: 6,
    src: "/images/gallery/gallery-6.png",
    title: "Youth Judo Development Summer Training Camp",
    category: "Training",
    date: "June 10, 2023",
    year: 2023,
    gridClass: "md:col-span-1 h-[280px] md:h-[350px]"
  },
  {
    id: 7,
    src: "/images/gallery/gallery-7.png",
    title: "Tamil Nadu Judo Association Executive Committee Meeting",
    category: "Ceremonies",
    date: "May 22, 2023",
    year: 2023,
    gridClass: "md:col-span-2 h-[280px] md:h-[350px]"
  },

  // 2024 Images (Different configurations to showcase year filtering)
  {
    id: 8,
    src: "/images/gallery/gallery-2.png",
    title: "State Selection Trials & Championship",
    category: "Championships",
    date: "January 14, 2024",
    year: 2024,
    gridClass: "md:col-span-2 h-[280px] md:h-[350px]"
  },
  {
    id: 9,
    src: "/images/gallery/gallery-3.png",
    title: "National Judo Camp Advanced Techniques",
    category: "Training",
    date: "February 20, 2024",
    year: 2024,
    gridClass: "md:col-span-1 h-[280px] md:h-[350px]"
  },
  {
    id: 10,
    src: "/images/gallery/gallery-5.png",
    title: "State Level Referees Licensing Program",
    category: "Ceremonies",
    date: "March 18, 2024",
    year: 2024,
    gridClass: "md:col-span-1 h-[280px] md:h-[280px]"
  },
  {
    id: 11,
    src: "/images/gallery/gallery-6.png",
    title: "Summer Cadet Training Development Program",
    category: "Training",
    date: "April 05, 2024",
    year: 2024,
    gridClass: "md:col-span-2 h-[280px] md:h-[280px]"
  },

  // 2025 Images
  {
    id: 12,
    src: "/images/gallery/gallery-1.png",
    title: "TNJA Golden Jubilee Gala & Honor Awards",
    category: "Ceremonies",
    date: "January 10, 2025",
    year: 2025,
    gridClass: "md:col-span-1 h-[280px] md:h-[350px]"
  },
  {
    id: 13,
    src: "/images/gallery/gallery-4.png",
    title: "International Judo Masterclass Coaching Clinic",
    category: "Seminars",
    date: "February 22, 2025",
    year: 2025,
    gridClass: "md:col-span-2 h-[280px] md:h-[350px]"
  }
];

const YEARS = [2023, 2024, 2025];

export default function GalleryPage() {
  const [selectedYear, setSelectedYear] = useState<number>(2023);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filter items based on selected Year
  const filteredItems = GALLERY_DATA.filter((item) => {
    return item.year === selectedYear;
  });

  const handlePrevYear = () => {
    const currentIndex = YEARS.indexOf(selectedYear);
    const prevIndex = (currentIndex - 1 + YEARS.length) % YEARS.length;
    setSelectedYear(YEARS[prevIndex]);
  };

  const handleNextYear = () => {
    const currentIndex = YEARS.indexOf(selectedYear);
    const nextIndex = (currentIndex + 1) % YEARS.length;
    setSelectedYear(YEARS[nextIndex]);
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(null);
  };

  const navigateLightbox = (direction: "prev" | "next") => {
    if (lightboxIndex === null) return;
    const count = filteredItems.length;
    if (direction === "prev") {
      setLightboxIndex((lightboxIndex - 1 + count) % count);
    } else {
      setLightboxIndex((lightboxIndex + 1) % count);
    }
  };

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") navigateLightbox("prev");
      if (e.key === "ArrowRight") navigateLightbox("next");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex]);

  // Split Year string into prefix and last digit for mockup visual style
  const yearStr = selectedYear.toString();
  const yearPrefix = yearStr.slice(0, 3);
  const yearLastDigit = yearStr.slice(3);

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-[#FFF5ED] via-white to-white pb-20">
      {/* 1. Cinematic Banner */}
      <div className="relative w-full h-[250px] md:h-[380px] bg-black overflow-hidden flex items-center">
        {/* Banner Image with dark overlay */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/images/gallery/gallery-hero.png" 
            alt="Gallery Banner" 
            fill 
            priority
            className="object-cover opacity-45 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
        </div>

        <div className="container mx-auto px-6 md:px-12 relative z-10 text-white">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#FF7400] uppercase drop-shadow-lg">
              Gallery
            </h1>
            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-300 font-bold">
              <Link href="/" className="hover:text-[#FF7400] transition-colors">Home</Link>
              <BreadcrumbRight size={14} className="text-gray-500" />
              <span className="text-[#FF7400]">Gallery</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 2. Content & Grid Section */}
      <div className="container mx-auto px-4 md:px-12 mt-16 max-w-[1300px]">
        {/* Dynamic Year Navigation */}
        <div className="flex flex-col items-center justify-center mb-12">
          <div className="flex items-center gap-6 md:gap-12">
            {/* Left Button */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handlePrevYear}
              className="w-10 h-10 md:w-12 md:h-12 bg-[#FF7400] hover:bg-black text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 transition-colors duration-300"
            >
              <ChevronLeft size={24} />
            </motion.button>

            {/* Year Display */}
            <div className="flex items-center select-none">
              <span className="text-6xl md:text-8xl font-black text-black tracking-tighter">
                {yearPrefix}
              </span>
              <motion.span 
                key={selectedYear}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-6xl md:text-8xl font-black text-orange-200/90 tracking-tighter"
              >
                {yearLastDigit}
              </motion.span>
            </div>

            {/* Right Button */}
            <motion.button 
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleNextYear}
              className="w-10 h-10 md:w-12 md:h-12 bg-[#FF7400] hover:bg-black text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 transition-colors duration-300"
            >
              <ChevronRight size={24} />
            </motion.button>
          </div>

          {/* Subtitle */}
          <p className="text-gray-400 font-bold text-sm uppercase tracking-widest mt-2">
            Browse through memories of {selectedYear}
          </p>
        </div>



        {/* 3. Asymmetrical Image Grid */}
        <motion.div 
          layout 
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className={`group relative overflow-hidden rounded-[2rem] bg-white border border-orange-100/30 shadow-md shadow-orange-500/5 cursor-pointer ${item.gridClass}`}
                onClick={() => openLightbox(idx)}
              >
                {/* Image */}
                <Image 
                  src={item.src} 
                  alt={item.title} 
                  fill 
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />

                {/* Light Orange/Peach Gradient on Top Edge */}
                <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[#FFF5ED]/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                {/* Dark Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-6 md:p-8">
                  {/* Category Tag */}
                  <span className="flex items-center gap-1.5 text-xs text-[#FF7400] font-black uppercase tracking-wider mb-2">
                    <Tag size={12} />
                    {item.category}
                  </span>

                  {/* Title */}
                  <h3 className="text-white text-lg md:text-xl font-bold leading-tight mb-2 tracking-tight group-hover:translate-y-0 translate-y-4 transition-transform duration-500">
                    {item.title}
                  </h3>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-4 text-gray-400 text-xs mt-2 group-hover:opacity-100 opacity-0 transition-opacity duration-500 delay-100">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {item.date}
                    </span>
                    <span className="p-1 rounded bg-[#FF7400]/20 text-[#FF7400]">
                      <Maximize2 size={12} />
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full py-20 flex flex-col items-center justify-center text-center gap-4 bg-white/50 backdrop-blur border border-orange-100/50 rounded-3xl"
          >
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">
              No images found for {selectedYear}
            </p>
          </motion.div>
        )}
      </div>

      {/* 4. Fullscreen Lightbox Modal */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4"
          >
            {/* Close Button */}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={closeLightbox}
              className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-[110]"
            >
              <X size={24} />
            </motion.button>

            {/* Left Navigation */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigateLightbox("prev")}
              className="absolute left-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-[110]"
            >
              <ChevronLeft size={24} />
            </motion.button>

            {/* Right Navigation */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => navigateLightbox("next")}
              className="absolute right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-[110]"
            >
              <ChevronRight size={24} />
            </motion.button>

            {/* Content Body */}
            <div className="max-w-5xl w-full flex flex-col items-center">
              <motion.div
                key={lightboxIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-[55vh] md:h-[70vh] rounded-3xl overflow-hidden shadow-2xl"
              >
                <Image
                  src={filteredItems[lightboxIndex].src}
                  alt={filteredItems[lightboxIndex].title}
                  fill
                  className="object-contain"
                />
              </motion.div>

              {/* Text Description Box */}
              <motion.div 
                key={`desc-${lightboxIndex}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl text-center mt-6 text-white space-y-2 px-4"
              >
                <div className="flex items-center justify-center gap-2 text-xs text-[#FF7400] font-black uppercase tracking-widest">
                  <Tag size={12} />
                  <span>{filteredItems[lightboxIndex].category}</span>
                  <span className="text-gray-600">•</span>
                  <Calendar size={12} className="text-gray-400" />
                  <span className="text-gray-400">{filteredItems[lightboxIndex].date}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold leading-tight">
                  {filteredItems[lightboxIndex].title}
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                  Image {lightboxIndex + 1} of {filteredItems.length}
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
