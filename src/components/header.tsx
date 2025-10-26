'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { GlassFilter } from '@/components/ui/glass-filter';
import { cn } from '@/lib/utils';

export function Header() {
  return (
    <div className="fixed top-4 md:top-8 w-full flex justify-center z-50">
        <motion.nav
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 50, delay: 0.6 }}
          className={cn(
            'rounded-full border border-subtle-border shadow-lg',
            'glass-effect' // Apply the glass effect
          )}
        >
          <div className="flex items-center gap-2 px-4 p-2">
            <Link href="/" className="text-lg font-bold text-white">
              DexAI
            </Link>
            <Link href="/generate" className="text-white/80 hover:text-white transition-colors ml-4">
              Gerar Ideia
            </Link>
            <Link href="/validate" className="text-white/80 hover:text-white transition-colors">
              Validar Ideia
            </Link>
          </div>
          <GlassFilter />
        </motion.nav>
    </div>
  );
}
