'use client';

import React from 'react';
import { cn } from '@/Backend/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children, 
  ...props 
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-[#315C4C] hover:bg-[#264B3E] text-white shadow-sm",
    secondary: "border border-[#DDE2E0] hover:bg-[#eaf7f1] dark:hover:bg-[#31403b] text-[#17201E] dark:text-white",
    ghost: "hover:bg-[#eaf7f1] dark:hover:bg-[#31403b] text-[#414944]",
    outline: "border border-[#DDE2E0] hover:bg-white dark:hover:bg-[#25312e]",
  };

  const sizes = {
    sm: "text-xs px-3.5 py-2",
    md: "text-sm px-5 py-2.5",
    lg: "text-[15px] px-8 py-3.5",
  };

  return (
    <button 
      className={cn(base, variants[variant], sizes[size], className)} 
      {...props}
    >
      {children}
    </button>
  );
}
