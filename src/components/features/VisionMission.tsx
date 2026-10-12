"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";

const presidentMessage = `I am honoured to be associated with the Tamil Nadu Judo Association 2/5/2017, an organization that reflects the true spirit of disciplines, resilience, and national pride. Sport has the power to transform lives, and for India to emerge as a global sporting nation, it is essential to build a strong foundation at the grassroots level through collective effort, professional expertise, and a scientific approach to training.

Judo, in particular, holds immense potential for India. With the right ecosystem—structured coaching, modern infrastructure, and long-term athlete development—we can nurture world-class athletes capable of excelling on international platforms. Alongside physical training, equal importance must be given to discipline, mental strength, and character building.

The Tamil Nadu Judo Association's initiative, "Judo for All," is a significant step in this direction. By bringing Judo to schools and grassroots communities, the Association is not only identifying and nurturing young talent but also shaping confident, disciplined, and responsible individuals for the future.

Our vision is to build a strong and inclusive sporting culture that nurtures talent from grassroots to global levels, while our mission is to promote Judo across all sections of society by blending traditional values with modern sports science. Through dedicated efforts, strategic planning, and collective commitment, we aim to position Tamil Nadu as a leading force in Judo and contribute meaningfully to India's sporting excellence.`;

const ceoMessage = `At the heart of the Tamil Nadu Judo Association 2/5/2017 lies an unwavering mission—to ignite the flame of Judo in every corner of Tamil Nadu. Our goal is not merely to promote Judo as a martial art or a sport, but as a way of life—a transformative discipline that empowers individuals to stand strong both on the mat and in society. Beyond the dojo, we aim to cultivate warriors of character who are prepared to rise against immorality, resist anti-social forces, and uphold righteousness with an unwavering spirit.

In proud collaboration with the Veer Vishwa Kalma Academy, our vision expands with renewed vigor—to deliver world-class, inclusive Judo education to every child, irrespective of background. Rooted in equality, enriched by technology, and guided by the principles of transparency and accountability, we envision a future where every learner receives not just training, but a transformative experience.

Our enhanced vision is deeply cultural and profoundly patriotic. We aspire to ensure that every school-going child in Tamil Nadu is not only trained in the art of Judo but is also imbued with the rich traditions, heritage, and nationalism of our land. Through the timeless values of Judo—self-respect, respect for the deserving, courage, humility, honesty, modesty, and integrity—we aim to shape responsible citizens, elevate the soul of our state, and fortify the spirit of our great nation.

Let us build a generation that not only fights with skill but lives with purpose—a generation that makes Tamil Nadu proud and India greater.`;

export default function VisionMission() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        backgroundImage: "url('/missionvision/paper.svg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >

      {/* ══════════════════════════════════
          VISION HALF
      ══════════════════════════════════ */}
      <div className="flex max-w-[1400px] mx-auto min-h-0 relative z-10">
        {/* VISION vertical label */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="w-12 md:w-24 shrink-0 flex items-start pt-20 justify-center relative z-20"
        >
          <span
            className="text-black font-black uppercase select-none tracking-[0.45em]"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              fontSize: "clamp(1.6rem, 3vw, 2.5rem)",
            }}
          >
            VISION
          </span>
        </motion.div>

        {/* Content area */}
        <div className="flex-1 py-10 px-4 md:px-8 max-w-4xl">
          {/* Photo & Name */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col md:flex-row items-center md:items-end gap-6 relative z-10 mb-[-3rem] md:ml-4"
          >
            <div className="relative overflow-hidden rounded-2xl w-[280px] h-[340px] md:w-[320px] md:h-[380px] shrink-0">
              <Image
                src="/president.png"
                alt="Parth Jindal"
                fill
                className="object-cover object-top scale-[1.06]"
              />
            </div>
            <div className="mb-12 text-center md:text-left">
              <p className="text-[#FF7400] font-extrabold text-2xl md:text-3xl leading-tight">
                Parth Jindal
              </p>
              <p className="text-black font-bold text-sm md:text-lg">
                President
              </p>
            </div>
          </motion.div>

          {/* Message card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative z-20 bg-gradient-to-br from-[#FFFAF5] to-[#FFF0E5] border border-[#FFD0A8] rounded-2xl p-6 md:p-10 shadow-[0_8px_30px_rgba(255,116,0,0.1)] w-full max-w-[95%]"
          >
            <h2 className="text-[#FF7400] text-lg md:text-xl font-bold mb-4">
              President's Message
            </h2>
            <div className="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-line font-medium text-justify">
              {presidentMessage}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════
          & SYMBOL
      ══════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
        whileInView={{ opacity: 0.9, scale: 1, rotate: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
        className="flex items-center justify-center py-8 -mt-20 md:-mt-32 relative z-0"
      >
        <Image
          src="/missionvision/symbol.svg"
          alt="and"
          width={300}
          height={300}
        />
      </motion.div>

      {/* ══════════════════════════════════
          MISSION HALF
      ══════════════════════════════════ */}
      <div className="flex max-w-[1400px] mx-auto min-h-0 relative z-10 mt-[-2rem] md:mt-[-6rem]">
        {/* Content area */}
        <div className="flex-1 py-10 px-4 md:px-8 max-w-4xl ml-auto flex flex-col items-start md:items-end">
          {/* Photo & Name */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex flex-col-reverse md:flex-row items-start md:items-end gap-6 relative z-10 mb-[-3rem] md:mr-4"
          >
            <div className="mb-12 text-left md:text-right">
              <p className="text-[#FF7400] font-extrabold text-2xl md:text-3xl leading-tight">
                R. Vijaya Mohana Murali
              </p>
              <p className="text-black font-bold text-sm md:text-lg">
                CEO
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl w-[280px] h-[340px] md:w-[320px] md:h-[380px] shrink-0">
              <Image
                src="/ceo.png"
                alt="R. Vijaya Mohana Murali"
                fill
                className="object-cover object-top scale-[1.06]"
              />
            </div>
          </motion.div>

          {/* Message card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative z-20 bg-gradient-to-br from-[#FFFAF5] to-[#FFF0E5] border border-[#FFD0A8] rounded-2xl p-6 md:p-10 shadow-[0_8px_30px_rgba(255,116,0,0.1)] w-full max-w-[95%]"
          >
            <h2 className="text-[#FF7400] text-lg md:text-xl font-bold mb-4">
              CEO's Message
            </h2>
            <div className="text-gray-700 text-xs md:text-sm leading-relaxed whitespace-pre-line font-medium text-justify">
              {ceoMessage}
            </div>
          </motion.div>
        </div>

        {/* MISSION vertical label */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="w-12 md:w-24 shrink-0 flex items-start pt-20 justify-center relative z-20"
        >
          <span
            className="text-black font-black uppercase select-none tracking-[0.45em]"
            style={{
              writingMode: "vertical-rl",
              fontSize: "clamp(1.6rem, 3vw, 2.5rem)",
            }}
          >
            MISSION
          </span>
        </motion.div>
      </div>

    </section>
  );
}
