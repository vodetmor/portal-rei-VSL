import React from 'react';
import { Slot } from "@radix-ui/react-slot"
import { cn } from '@/lib/utils';

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export function AuthButton({
  children,
  className,
  asChild = false,
  ...props
}: AuthButtonProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(
        'group relative inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border-0 bg-[length:200%] px-8 py-2 font-medium text-white transition-colors [background-clip:padding-box,border-box,border-box] [background-origin:border-box] [border:calc(0.08*1rem)_solid_transparent] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        "dark:bg-[linear-gradient(#0C0C0D,#0C0C0D),linear-gradient(#0C0C0D_50%,rgba(12,12,13,0.6)_80%,rgba(12,12,13,0)),linear-gradient(90deg,hsl(var(--primary)),hsl(var(--primary)))]",
        'disabled:cursor-not-allowed disabled:opacity-70',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
