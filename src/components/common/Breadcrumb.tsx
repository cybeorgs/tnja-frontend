"use client";

import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = "" }) => {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center space-x-2 text-[11px] text-black font-bold tracking-wide">
        {items.map((item, index) => (
          <li key={index} className="flex items-center space-x-2">
            {index > 0 && (
              <span className="text-black opacity-60 text-[12px] font-bold mx-1">&gt;</span>
            )}
            {item.href ? (
              <Link 
                href={item.href} 
                className="text-black hover:text-[#FF7400] transition-colors whitespace-nowrap"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[#FF7400] whitespace-nowrap">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumb;
