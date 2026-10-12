"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const PhilosophyCarousel = () => {
  const images = [
    {
      name: "DR.\nJIGORO KANO",
      image: "/1.png"
    },
    {
      name: "SENSEI.\nELAMPARUTHI",
      image: "/2.png"
    },
    {
      name: "SENSEI.\nMANOHAR BANGERA",
      image: "/3.png"
    },
    {
      name: "SENSEI.\nJEEVAN SHARMA",
      image: "/4.png"
    },
    {
      name: "SENSEI.\nSATHISH PAHADE",
      image: "/5.png"
    },
    {
      name: "SENSEI.\nMANIKUMAR",
      image: "/6.png"
    },
    {
      name: "SENSEI.\nMATHIVANAN",
      image: "/7.png"
    },
    {
      name: "SENSEI.\nBALACHANDAR (NATIONAL MEDALIST)",
      image: "/8.png"
    },
    {
      name: "SENSEI.\n VENKATACHALAPATHI",
      image: "/9.png"
    },
    {
      name: "MR.YAZIR\n (NATIONAL MEDALIST)",
      image: "/10.png"
    },
    {
      name: "SENSEI.\nMUNNAVER",
      image: "/11.png"
    },
    {
      name: "SENSEI.\nDESAPPAN",
      image: "/12.png"
    }
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setActiveIndex((prev) => (prev + 1) % images.length);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [activeIndex, images.length]);

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const getImageAt = (offset: number) => {
    const index = (activeIndex + offset + images.length) % images.length;
    return images[index].image;
  };

  return (
    <section className="w-full bg-[#fafafa] pt-16 pb-16 md:pb-0 overflow-hidden">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="max-w-[1400px] mx-auto px-4 relative"
      >
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:hidden"
        >
          <h2 className="text-3xl md:text-5xl font-extrabold text-black tracking-tight">
            TNJA<span className="text-[#FF7400]"> Gallery</span>
          </h2>
        </motion.div>

        {/* Top Titles (Fades In First) - Desktop Only */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="hidden md:flex justify-between items-center mb-16 text-[12px] md:text-[14px] font-bold italic text-gray-500 px-4 md:px-32 relative z-20"
        >
          <div className="flex flex-col items-center gap-3">
            <span>The Legacy of Tamil Valor!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400]" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <span>The Way of Discipline!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400]" />
          </div>
          <div className="flex flex-col items-center gap-3">
            <span>The Philosophy of Judo!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400]" />
          </div>
        </motion.div>

        {/* Carousel Container */}
        <div className="relative flex items-center justify-center w-full min-h-[450px]">
          {/* Background Dotted Concentric Circles */}
          <motion.div
            initial={{ opacity: 0, rotate: 0 }}
            whileInView={{ opacity: 1, rotate: 360 }}
            transition={{ opacity: { duration: 1, delay: 1.5 }, rotate: { duration: 80, repeat: Infinity, ease: "linear" } }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full border border-[#FF7400]/20 border-dashed pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, rotate: 0 }}
            whileInView={{ opacity: 1, rotate: -360 }}
            transition={{ opacity: { duration: 1, delay: 1.5 }, rotate: { duration: 100, repeat: Infinity, ease: "linear" } }}
            className="absolute top-[8%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full border border-[#FF7400]/20 border-dashed pointer-events-none"
          />
          <motion.div
            initial={{ opacity: 0, rotate: 0 }}
            whileInView={{ opacity: 1, rotate: 360 }}
            transition={{ opacity: { duration: 1, delay: 1.5 }, rotate: { duration: 120, repeat: Infinity, ease: "linear" } }}
            className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full border border-[#FF7400]/20 border-dashed pointer-events-none"
          />

          {/* Left Navigation Arrow */}
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.6 }}
            onClick={prevSlide}
            className="hidden md:flex absolute left-4 md:left-12 z-30 w-12 h-12 rounded-full border border-[#FF7400]/30 items-center justify-center bg-white hover:border-[#FF7400] shadow-sm transition-colors text-[#FF7400]"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          {/* Right Navigation Arrow */}
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 1.6 }}
            onClick={nextSlide}
            className="hidden md:flex absolute right-4 md:right-12 z-30 w-12 h-12 rounded-full border border-[#FF7400]/30 items-center justify-center bg-white hover:border-[#FF7400] shadow-sm transition-colors text-[#FF7400]"
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>

          {/* Cards Wrapper */}
          <div className="relative flex items-center justify-center w-full h-[450px]">
            {/* Orange Glow Behind Center Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="absolute z-0 w-[400px] h-[400px] bg-[#FF7400]/15 blur-[60px] rounded-full pointer-events-none"
            />

            {/* Extreme Left (-2) */}
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.3, type: "spring", bounce: 0.2 }}
              className="hidden xl:block absolute left-[15%] z-0 transition-all duration-700"
            >
              <div className="w-[120px] h-[160px] rounded-2xl overflow-hidden opacity-40 blur-[2px] shadow-sm border border-gray-100 flex flex-col items-center bg-white">
                <div className="relative w-full h-full">
                  <Image src={getImageAt(-2)} alt="Profile" fill className="object-cover" />
                </div>
                <div className="absolute bottom-0 w-full h-[30px] bg-gradient-to-t from-white to-transparent" />
              </div>
            </motion.div>

            {/* Left (-1) */}
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.1, type: "spring", bounce: 0.3 }}
              className="hidden md:block absolute left-[25%] lg:left-[28%] z-10 transition-all duration-700"
            >
              <div className="w-[180px] h-[240px] rounded-2xl overflow-hidden opacity-70 blur-[1px] shadow-md border border-gray-200 flex flex-col items-center bg-white">
                <div className="relative w-full h-full">
                  <Image src={getImageAt(-1)} alt="Profile" fill className="object-cover" />
                </div>
                <div className="absolute bottom-0 w-full h-[40px] bg-gradient-to-t from-white to-transparent" />
              </div>
            </motion.div>

            {/* Active Center (0) */}
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(event, info) => {
                const swipeThreshold = 50;
                if (info.offset.x < -swipeThreshold) {
                  nextSlide();
                } else if (info.offset.x > swipeThreshold) {
                  prevSlide();
                }
              }}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.8, type: "spring", bounce: 0.4 }}
              className="absolute z-20 transition-all duration-700 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-2xl bg-white border border-gray-100 touch-pan-y cursor-grab active:cursor-grabbing"
            >
              <div className="w-[280px] md:w-[320px] h-[360px] md:h-[400px] flex flex-col relative overflow-hidden rounded-2xl group">
                {/* Image Section */}
                <div className="relative flex-1 bg-white">
                  <Image
                    src={getImageAt(0)}
                    alt="Active Profile"
                    fill
                    className="object-cover"
                    priority
                  />
                  {/* Bottom White Fade Gradient */}
                  <div className="absolute bottom-0 left-0 w-full h-[100px] bg-gradient-to-t from-white to-transparent" />
                </div>
              </div>
            </motion.div>

            {/* Right (+1) */}
            <motion.div
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.1, type: "spring", bounce: 0.3 }}
              className="hidden md:block absolute right-[25%] lg:right-[28%] z-10 transition-all duration-700"
            >
              <div className="w-[180px] h-[240px] rounded-2xl overflow-hidden opacity-70 blur-[1px] shadow-md border border-gray-200 flex flex-col items-center bg-white">
                <div className="relative w-full h-full">
                  <Image src={getImageAt(1)} alt="Profile" fill className="object-cover" />
                </div>
                <div className="absolute bottom-0 w-full h-[40px] bg-gradient-to-t from-white to-transparent" />
              </div>
            </motion.div>

            {/* Extreme Right (+2) */}
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.3, type: "spring", bounce: 0.2 }}
              className="hidden xl:block absolute right-[15%] z-0 transition-all duration-700"
            >
              <div className="w-[120px] h-[160px] rounded-2xl overflow-hidden opacity-40 blur-[2px] shadow-sm border border-gray-100 flex flex-col items-center bg-white">
                <div className="relative w-full h-full">
                  <Image src={getImageAt(2)} alt="Profile" fill className="object-cover" />
                </div>
                <div className="absolute bottom-0 w-full h-[30px] bg-gradient-to-t from-white to-transparent" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Title Below Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
          className="flex flex-col items-center justify-center mt-6 text-center"
        >
          <h2 className="text-xl md:text-2xl font-[900] text-black tracking-[0.2em] uppercase leading-snug whitespace-pre-line">
            {images[activeIndex].name}
          </h2>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default PhilosophyCarousel;
