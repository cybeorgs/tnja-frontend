import React from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

const EventsSection = () => {
  return (
    <section className="w-full bg-[#fafafa] pt-6 md:pt-16 pb-12 px-4 md:px-8">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center">
        
        {/* Title row */}
        <div className="flex items-center justify-center gap-4 mb-10 w-full max-w-sm">
          <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[#FF7400]/50 relative">
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#FF7400] rounded-full" />
          </div>
          <span className="text-[#FF7400] text-[12px] font-bold tracking-[0.2em] uppercase whitespace-nowrap">
            Upcoming Events
          </span>
          <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[#FF7400]/50 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-[#FF7400] rounded-full" />
          </div>
        </div>

        {/* Events Card */}
        <div className="w-full max-w-[1050px] bg-white rounded-[32px] p-4 md:p-6 flex flex-col md:flex-row items-center justify-between shadow-[0_15px_40px_rgba(0,0,0,0.03)] border border-gray-100/50">
          
          {/* Left Event */}
          <div className="flex items-center gap-5 flex-1 w-full px-6 py-4 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group">
            <div className="w-[60px] h-[60px] rounded-full bg-[#fff4eb] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-[#FF7400]" />
            </div>
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">July 25, 2026</span>
              <h3 className="text-[17px] md:text-[19px] font-bold text-[#111]">
                District-level Judo Meet
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-[#FF7400] group-hover:translate-x-1 transition-transform" />
          </div>

          {/* Divider */}
          <div className="hidden md:block w-[1px] h-16 bg-gray-200 mx-4" />
          <div className="block md:hidden w-full h-[1px] bg-gray-200 my-2" />

          {/* Right Event */}
          <div className="flex items-center gap-5 flex-1 w-full px-6 py-4 hover:bg-gray-50 rounded-2xl transition-colors cursor-pointer group">
            <div className="w-[60px] h-[60px] rounded-full bg-[#fff4eb] flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-[#FF7400]" />
            </div>
            <div className="flex flex-col flex-1 gap-1">
              <span className="text-gray-500 text-[11px] font-bold uppercase tracking-widest">July 20, 2026</span>
              <h3 className="text-[17px] md:text-[19px] font-bold text-[#111]">
                Coaches Workshop Registration
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-[#FF7400] group-hover:translate-x-1 transition-transform" />
          </div>

        </div>
      </div>
    </section>
  );
};

export default EventsSection;
