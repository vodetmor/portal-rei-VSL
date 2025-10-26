import React from 'react';

import { cn } from '@/lib/utils';
interface WhiteGlowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export function WhiteGlowButton({
  children,
  className,
  ...props
}: WhiteGlowButtonProps) {
  return (
    <button
      className={cn(
        'group relative inline-flex h-11 animate-white-glow cursor-pointer items-center justify-center rounded-xl border-0 bg-[length:200%] px-8 py-2 font-medium text-white transition-colors [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        // before styles
        "before:absolute before:bottom-[-20%] before:left-1/2 before:z-0 before:h-1/5 before:w-3/5 before:-translate-x-1/2 before:animate-white-glow before:bg-[linear-gradient(90deg,white,white)] before:bg-[length:200%] before:[filter:blur(calc(0.8*1rem))]",
        // dark mode colors
        "dark:bg-[linear-gradient(#0C0C0D,#0C0C0D),linear-gradient(#0C0C0D_50%,rgba(12,12,13,0.6)_80%,rgba(12,12,13,0)),linear-gradient(90deg,white,white)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
