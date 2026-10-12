"use client";

import React from 'react';
import { motion } from 'framer-motion';

const PhilosophySection = () => {
  const cards = [
    {
      id: "01",
      text: "Tamil Nadu is a land of valour, discipline, and unwavering spirit from the courage of ancient Tamil warriors to the resilience of todays athletes. The Tamil Nadu Judo Association (TNJA) carries this proud legacy forward through the art and philosophy of Judo.",
      reverse: false
    },
    {
      id: "02",
      text: "From village dojos to national and international arenas, we nurture talent through structured training, ethical competition, and continuous guidance by certified coaches and officials. Our mission is to build champions who uphold Tamil pride, sporting excellence, and global standards.",
      reverse: true
    },
    {
      id: "03",
      text: "Born in 1882, Judo made its way to Indian soil in 1929. Since then, it has blossomed through generations thanks to the passionate efforts of stalwarts like Sensei N.T. Bangera, Sensei Khanewala, Behram Mistry, and more recently, Sensei Mukesh.",
      reverse: false
    }
  ];

  return (
    <section className="w-full bg-[#fafafa] pt-16 md:pt-0 pb-16 overflow-hidden">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="max-w-[1400px] mx-auto px-4 relative"
      >
        {/* Top Titles (Fades In First) - Mobile Only */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex md:hidden justify-between items-start mb-16 text-[10px] sm:text-[12px] font-bold italic text-gray-500 px-2 sm:px-4 relative z-20 w-full gap-2 text-center"
        >
          <div className="flex-1 flex flex-col items-center gap-3">
            <span className="text-center w-full leading-normal">The Legacy of<br />Tamil Valor!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400] shrink-0" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-3">
            <span className="text-center w-full leading-normal">The Way of<br />Discipline!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400] shrink-0" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-3">
            <span className="text-center w-full leading-normal">The Philosophy<br />of Judo!</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF7400] shrink-0" />
          </div>
        </motion.div>

        {/* Numbered Info Cards */}
        <div className="flex flex-col gap-10 max-w-[1100px] mx-auto px-4 md:px-0 relative z-20">
          {cards.map((card, index) => (
             <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 + index * 0.2 }}
              className={`relative flex flex-col md:flex-row items-stretch bg-white rounded-[16px] border border-gray-200/60 overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.03)] ${card.reverse ? 'md:flex-row-reverse' : ''}`}
            >
              {/* Number Block */}
              <div className="relative z-10 flex items-center justify-center min-w-[100px] md:min-w-[220px] m-0 md:m-2 rounded-t-[15px] rounded-b-none md:rounded-[12px] bg-[#171717] md:bg-[#1a0e05] py-4 md:py-0">
                <span className="text-4xl md:text-[75px] font-bold text-[#ffb000] leading-none tracking-tighter">
                  {card.id}
                </span>
              </div>

              {/* Content Body */}
              <div className="relative z-10 flex-1 px-8 py-8 md:py-10 md:px-12 flex items-center justify-center bg-white text-center">
                <p className="text-gray-600 text-[16px] md:text-[15px] font-medium leading-[1.8] max-w-3xl">
                  {card.text}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default PhilosophySection;
