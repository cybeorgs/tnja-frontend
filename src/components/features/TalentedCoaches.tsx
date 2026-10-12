"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const coaches = [
  {
    name: "DR. JIGORO KANO",
    role: "FOUNDER & CEO",
    quote: "Our talented coaches, like Dr. Jigoro Kano, the visionary founder of Judo, laid the foundation for a discipline that transcends sport and becomes a way of life. His philosophy of 'maximum efficiency with minimum effort' and 'mutual welfare and benefit' continues to guide millions around the world. A true pioneer, he transformed traditional martial arts into a modern system of education, character building and self-improvement. His legacy lives on in every judoka who steps onto the mat with respect, discipline, and determination.",
    image: "/homepage/kano.png"
  },
  {
    name: "SENSEI ILAMPARUTHI",
    role: "SAN-DAN, NSNIS JUDO COACH",
    quote: "Sensei Elamparuthi is a dedicated and highly respected Judo coach, and a valued pillar of the Tamil Nadu Judo community. Notably, he is the first NSNIS-certified Judo coach in Tamil Nadu, marking a significant milestone in the development of the sport in the state. Beyond teaching techniques, he shapes his students with discipline, loyalty, and integrity, nurturing them into confident and responsible individuals. His commitment to developing future generations ensures that his values and teachings continue through his students. Sensei Elamparuthi sir will live in our hearts—then, now, and forever.",
    image: "/talent2.png"
  },
  {
    name: "VIJAY",
    role: "CARDIO TRAINER",
    quote: `The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.`,
    image: "/talent3.png"
  },
  {
    name: "SURESH KUMAR",
    role: "CARDIO TRAINER",
    quote: `The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.`,
    image: "/talent4.png"
  },
  {
    name: "SHANMUGAM",
    role: "CARDIO TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent5.png"
  },
  {
    name: "SAGTHA BABU",
    role: "CARDIO TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent6.png"
  },
  {
    name: "PRASANNA",
    role: "CARDIO TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent7.png"
  },
  {
    name: "JAYALAL",
    role: "CROSS TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent8.png"
  },
  {
    name: "MURUGAN",
    role: "SENIOR TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent10.png"
  },
  {
    name: "MOORTHY KRISHNAN",
    role: "CROSS TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent11.png"
  },
  {
    name: "MANIKANDAN",
    role: "CARDIO TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent12.png"
  },
  {
    name: "MURALI",
    role: "CROSS TRAINER",
    quote: "The questions are compiled from genuine questions that people ask. When the same or similar question is asked by many people, we add it to this page.",
    image: "/talent13.png"
  }
];

const TalentedCoaches = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const nextSlide = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % coaches.length);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + coaches.length) % coaches.length);
  };

  const getPrevIndex = () => (currentIndex - 1 + coaches.length) % coaches.length;
  const getNextIndex = () => (currentIndex + 1) % coaches.length;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    })
  };

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
            Our <span className="text-[#FF7400]">Talented</span> Coaches
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
          className="relative flex items-center justify-between gap-4 min-h-[500px]"
        >

          {/* Left Peeking Image */}
          <div className="hidden xl:block w-[150px] h-[450px] relative rounded-[20px] overflow-hidden shadow-[0_0_30px_rgba(255,116,0,0.2)]">
            <Image
              src={coaches[getPrevIndex()].image}
              alt=""
              fill
              className="object-cover sepia-[0.3]"
            />
          </div>

          {/* Active Content Group */}
          <div className="flex-1 max-w-[1000px] flex flex-col md:flex-row items-stretch gap-6 relative">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex flex-col md:flex-row items-stretch gap-6 w-full"
              >
                {/* Left Card: Profile Image & Name */}
                <div className="w-full md:w-[320px] flex flex-col">
                  <div className="relative aspect-square rounded-[24px] overflow-hidden shadow-lg border-2 border-orange-50 mb-4">
                    <Image
                      src={coaches[currentIndex].image}
                      alt={coaches[currentIndex].name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="text-center md:text-left py-4 px-2">
                    <h4 className="text-[#FF7400] font-black text-xl tracking-wider uppercase mb-1">
                      {coaches[currentIndex].name}
                    </h4>
                    <p className="text-gray-500 font-bold text-sm tracking-widest uppercase">
                      {coaches[currentIndex].role}
                    </p>
                  </div>
                </div>

                {/* Right Card: Quote Box */}
                <div className="flex-1 bg-gradient-to-br from-white via-white to-orange-50 rounded-[24px] p-8 md:p-12 relative border border-[#FF7400]/20 shadow-sm flex flex-col justify-center">
                  {/* Quote Icon in Top Right */}
                  <div className="md:absolute md:top-8 md:right-8 relative mb-4 md:mb-0 w-12 h-10 opacity-80 shrink-0">
                    <Image src="/homepage/vector/quote.svg" alt="Quote" fill className="object-contain" />
                  </div>

                  <p className="text-gray-800 text-sm md:text-base leading-relaxed font-semibold italic text-left">
                    {coaches[currentIndex].quote}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Peeking Image */}
          <div className="hidden xl:block w-[150px] h-[450px] relative rounded-[20px] overflow-hidden shadow-[0_0_30px_rgba(255,116,0,0.2)]">
            <Image
              src={coaches[getNextIndex()].image}
              alt=""
              fill
              className="object-cover sepia-[0.3]"
            />
          </div>

        </motion.div>

        {/* Custom Navigation & Progress Bar */}
        <div className="mt-20 max-w-[800px] mx-auto flex items-center gap-4">
          <button
            onClick={prevSlide}
            className="w-10 h-10 rounded-full bg-[#FF7400] text-white flex items-center justify-center hover:bg-black transition-all shadow-md"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>

          {/* Progress Bar Line */}
          <div className="flex-1 h-[6px] bg-gray-200 rounded-full relative overflow-hidden">
            <motion.div
              className="absolute h-full bg-[#FF7400] rounded-full"
              initial={false}
              animate={{
                width: `${(100 / coaches.length)}%`,
                left: `${(currentIndex * (100 / coaches.length))}%`
              }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          <button
            onClick={nextSlide}
            className="w-10 h-10 rounded-full bg-[#FF7400] text-white flex items-center justify-center hover:bg-black transition-all shadow-md"
          >
            <ChevronRight size={24} strokeWidth={3} />
          </button>
        </div>
      </div>
    </section>
  );
};

export default TalentedCoaches;
