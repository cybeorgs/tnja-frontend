"use client";

import React from 'react';
import Image from 'next/image';
import Breadcrumb from './Breadcrumb';

interface PageHeroProps {
  title: React.ReactNode;
  breadcrumbItems: { label: string; href?: string }[];
  backgroundImage: string;
}

const PageHero: React.FC<PageHeroProps> = ({ title, breadcrumbItems, backgroundImage }) => {
  return (
    <section className="relative w-full h-[400px] md:h-[500px] flex flex-col justify-end overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src={backgroundImage}
          alt="Hero Background"
          fill
          className="object-cover object-center"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      <div className="container mx-auto px-4 md:px-8 relative z-10 pb-12 md:pb-20">
        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6 uppercase">
            {title}
          </h1>
          
          <Breadcrumb 
            items={breadcrumbItems} 
            className="mt-4"
          />
        </div>
      </div>
    </section>
  );
};

export default PageHero;
