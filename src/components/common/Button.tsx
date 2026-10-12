"use client";

import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: 'primary' | 'outline';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  href, 
  onClick, 
  variant = 'primary', 
  className = '',
  size = 'md',
  type = 'button',
  disabled = false
}) => {
  const baseStyles = "flex items-center justify-center font-bold transition-all whitespace-nowrap active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  
  const variants = {
    primary: "bg-gradient-to-b from-[#ff8c00] to-[#f26522] text-white shadow-[0_4px_12px_rgba(242,101,34,0.4)] hover:shadow-[0_6px_18px_rgba(242,101,34,0.5)] hover:-translate-y-0.5",
    outline: "border border-gray-300 text-gray-800 hover:bg-gray-50"
  };

  const sizes = {
    sm: "px-4 py-1.5 text-[10px] h-[32px] rounded-md",
    md: "px-6 py-2 text-[14px] h-[40px] rounded-lg",
    lg: "px-8 py-3 text-[16px] h-[48px] rounded-xl"
  };

  const combinedClasses = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedClasses}>
        {children}
      </Link>
    );
  }

  return (
    <button 
      type={type} 
      onClick={onClick} 
      className={combinedClasses}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

export default Button;
