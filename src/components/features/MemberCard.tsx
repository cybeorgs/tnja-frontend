 "use client";

import React from 'react';
import Image from 'next/image';
import { Phone, Mail, FileText, MapPin } from 'lucide-react';

interface MemberCardProps {
  name: string;
  designation: string;
  phone: string;
  email: string;
  regId: string;
  address: string;
  image: string;
}

const MemberCard: React.FC<MemberCardProps> = ({ 
  name, 
  designation, 
  phone, 
  email, 
  regId, 
  address, 
  image 
}) => {
  return (
    <div className="group flex flex-col h-full  rounded-[2rem] overflow-hidden shadow-lg border border-orange-100/50">
      {/* Image Section - Back to full width tall aspect */}
      <div className="relative aspect-[4/5] w-full p-1.5 overflow-hidden">
        <div className="relative w-full h-full rounded-[1.8rem] overflow-hidden border border-[#FF7400]">
          <Image 
            src={image} 
            alt={name}
            fill
            className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      </div>

      {/* Content Section - With vibrant gradient background */}
      <div className="p-6 pt-8 flex flex-col items-center text-center bg-gradient-to-b from-[#FFD8B1] via-[#FFF5EC] flex-grow">
        <h3 className="text-[20px] font-black text-[#FF7400] leading-tight mb-1 uppercase tracking-tight">
          {name}
        </h3>
        <p className="text-[12px] font-bold text-slate-800 uppercase tracking-[0.2em] mb-6">
          {designation}
        </p>

        {/* Contact Details */}
        <div className="w-full space-y-4 text-left px-2">
          <div className="flex items-center gap-4">
            <Phone size={18} className="text-slate-700 flex-shrink-0" />
            <span className="text-[13px] font-medium text-slate-700">{phone}</span>
          </div>
          <div className="flex items-center gap-4">
            <Mail size={18} className="text-slate-700 flex-shrink-0" />
            <span className="text-[13px] font-medium text-slate-700 break-all">{email}</span>
          </div>
          <div className="flex items-center gap-4">
            <FileText size={18} className="text-slate-700 flex-shrink-0" />
            <span className="text-[13px] font-medium text-slate-700">{regId}</span>
          </div>
          <div className="flex items-center gap-4">
            <MapPin size={18} className="text-slate-700 flex-shrink-0" />
            <span className="text-[13px] font-medium text-slate-700 leading-snug line-clamp-2">
              {address}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
