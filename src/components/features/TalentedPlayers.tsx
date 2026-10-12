"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const players = [
  {
    name: "BHARATHNWA J",
    role: "SENIOR MASTERS",
    quote: "SGFI National Judo Championship held at Delhi. Silver (81 Kg Category) – Bronze Medal.",
    image: "/talentplayer1.png"
  },
  {
    name: "VENKATESH PERUMAL M",
    role: "SENIOR MASTERS",
    quote: "SGFI National Judo Championship held at Delhi. Under 66 Kg Category (M) – Bronze Medal.",
    image: "/talentplayer2.png"
  },
  {
    name: "DHARANI PRIYA S",
    role: "SENIOR MASTERS",
    quote: "SGFI National Judo Championship held at Delhi. Under 57 Kg Category (W) – Silver Medal.",
    image: "/talentplayer3.png"
  },
  {
    name: "ASHWIN A",
    role: "SENIOR MASTERS",
    quote: "SGFI National Judo Championship held at Manipur. Under 63 Kg Category – Bronze Medal.",
    image: "/talentplayer4.png"
  },
  {
    name: "SOWMIYA T",
    role: "SENIOR MASTERS",
    quote: "SGFI National Judo Championship held at Manipur. Under 70 Kg Category – Silver Medal.",
    image: "/talentplayer5.png"
  },
  {
    name: "ABHINAV M",
    role: "SENIOR MASTERS",
    quote: "38th Junior National Judo Championship held at Panchkula. Under 55Kg – Gold Medal.",
    image: "/talentplayer6.png"
  },
  {
    name: "AAKASH RAJA G",
    role: "SENIOR MASTERS",
    quote: "Open Merit Inter-University Judo Championship – Gold Medal.",
    image: "/talentplayer7.png"
  },
  {
    name: "PRAVEEN KUMAR",
    role: "SENIOR MASTERS",
    quote: "Zone 8 Best Inter-University Judo Championship – Bronze Medal.",
    image: "/talentplayer8.png"
  },
  {
    name: "ESWAMOORTHY M",
    role: "SENIOR MASTERS",
    quote: "South West Inter-University Judo Championship – Silver Medal.",
    image: "/talentplayer9.png"
  },
  {
    name: "MADHUMITHA A V",
    role: "CADET NATIONALS",
    quote: "CBSE National Judo Championship – Bronze Medal.",
    image: "/talentplayer10.png"
  },
  {
    name: "NEHARGHINI",
    role: "CADET NATIONALS",
    quote: "Under 14 SGFI CISCE National Judo Championship 2025–26.",
    image: "/talentplayer11.png"
  },
  {
    name: "AADIL RAHMAN L",
    role: "CADET NATIONALS",
    quote: "Under 17 SGFI CISCE National Judo Championship – Silver Medal.",
    image: "/talentplayer12.png"
  },
  {
    name: "KANISHKA A",
    role: "CADET NATIONALS",
    quote: "CBSE National Judo Championship – Bronze Medal.",
    image: "/talentplayer13.png"
  },
  {
    name: "KEERTHIKA A",
    role: "CADET NATIONALS",
    quote: "CBSE Nationals, Rajasthan. Under 14 (Girls 48Kg) – Gold Medal.",
    image: "/talentplayer14.png"
  },
  {
    name: "ASHWATH A",
    role: "CADET NATIONALS",
    quote: "CBSE Nationals, Rajasthan. Under 14 (Boys 34Kg) – Bronze Medal.",
    image: "/talentplayer15.png"
  },
  {
    name: "RITHIK V",
    role: "CADET NATIONALS",
    quote: "CBSE Nationals, Panchkula. Under 14 (Boys 45Kg) – Gold Medal.",
    image: "/talentplayer16.png"
  },
  {
    name: "SANJITH S P",
    role: "JUNIOR CATEGORY",
    quote: "Under 14 Inter-District (Under 34Kg) – Bronze Medal.",
    image: "/talentplayer17.png"
  },
  {
    name: "RAMANIGA M",
    role: "SCHOOL CATEGORY",
    quote: "Below 14 Years (37Kg) – Bronze Medal.",
    image: "/talentplayer18.png"
  },
  {
    name: "PRANEETHA G",
    role: "SCHOOL CATEGORY",
    quote: "Under 17 (Above 40Kg) – Silver Medal.",
    image: "/talentplayer19.png"
  }

];

const TalentedPlayers = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 1000 : -1000,
      opacity: 0,
      zIndex: 0
    }),
    center: {
      zIndex: 10,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const sideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 0.25
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0
    })
  };

  const nextSlide = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % players.length);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + players.length) % players.length);
  };

  const getPrevIndex = () => (currentIndex - 1 + players.length) % players.length;
  const getNextIndex = () => (currentIndex + 1) % players.length;

  return (
    <section className="w-full py-24 bg-white overflow-hidden">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 lg:px-16 text-center">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-5xl font-extrabold text-black mb-4 tracking-tight">
            Our <span className="text-[#FF7400]">Talented</span> Players
          </h2>
          <p className="text-gray-600 font-medium italic tracking-[0.18em] md:tracking-[0.35em] text-xs sm:text-sm md:text-lg uppercase">
            Our Coaches, Our Pride
          </p>
        </motion.div>

        {/* Carousel Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative flex items-center justify-center py-10 min-h-[600px]"
        >

          {/* Main Carousel Viewport */}
          <div className="relative w-full max-w-[900px] h-[500px] flex items-center justify-center">

            {/* Previous Slide Preview (Animated) */}
            <div className="absolute right-[calc(100%+80px)] hidden lg:block w-[300px] h-[400px] pointer-events-none">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={`prev-${getPrevIndex()}`}
                  custom={direction}
                  variants={sideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="relative w-full h-full rounded-[24px] overflow-hidden border border-gray-100 shadow-xl"
                >
                  <Image
                    src={players[getPrevIndex()].image}
                    alt="Previous Player"
                    fill
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Current Slide (Animated) */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 200, damping: 26 },
                  opacity: { duration: 0.4 }
                }}
                className="absolute inset-0 w-full h-full"
              >
                {/* Card Wrapper */}
                <div
                  className="bg-white rounded-[32px] overflow-hidden flex flex-col md:flex-row border border-[#FF7400]/20 h-full"
                  style={{ boxShadow: '0px 0px 40px 0px rgba(255, 116, 0, 0.239)' }}
                >
                  {/* Left Side: Content */}
                  <div className="flex-1 p-8 md:p-12 text-left flex flex-col justify-between h-full">
                    <div>
                      <div className="mb-8 relative w-10 h-8">
                        <Image src="/homepage/vector/quote.svg" alt="Quote" fill className="object-contain" />
                      </div>

                      <p className="text-gray-800 text-sm md:text-lg leading-relaxed font-semibold italic mb-8">
                        "{players[currentIndex].quote}"
                      </p>
                    </div>

                    <div className="text-right mt-auto">
                      <h4 className="text-[#FF7400] font-black text-lg md:text-xl tracking-wider uppercase mb-1">
                        {players[currentIndex].name}
                      </h4>
                      <p className="text-gray-500 font-bold text-xs md:text-sm tracking-widest uppercase">
                        {players[currentIndex].role}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Image */}
                  <div className="w-full md:w-[48%] flex-1 relative md:min-h-full min-h-[250px] p-2">
                    <div className="relative w-full h-full rounded-[24px] overflow-hidden bg-white">
                      <Image
                        src={players[currentIndex].image}
                        alt={players[currentIndex].name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Next Slide Preview (Animated) */}
            <div className="absolute left-[calc(100%+80px)] hidden lg:block w-[300px] h-[400px] pointer-events-none">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={`next-${getNextIndex()}`}
                  custom={direction}
                  variants={sideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="relative w-full h-full rounded-[24px] overflow-hidden border border-gray-100 shadow-xl"
                >
                  <Image
                    src={players[getNextIndex()].image}
                    alt="Next Player"
                    fill
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            </div>

          </div>
        </motion.div>

        {/* Navigation Arrows */}
        <div className="flex justify-center gap-6 mt-16">
          <button
            onClick={prevSlide}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#FF7400] text-white flex items-center justify-center hover:bg-[#e06700] transition-all duration-300 shadow-md group"
          >
            <ChevronLeft size={24} strokeWidth={3} className="transition-transform group-hover:-translate-x-1" />
          </button>
          <button
            onClick={nextSlide}
            className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#FF7400] text-white flex items-center justify-center hover:bg-[#e06700] transition-all duration-300 shadow-md group"
          >
            <ChevronRight size={24} strokeWidth={3} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TalentedPlayers;
