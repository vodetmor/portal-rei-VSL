'use client';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const cardVariants = {
    hover: {
      y: -10,
      boxShadow: '0px 20px 30px hsla(var(--secondary) / 0.2)',
      transition: { type: 'spring', stiffness: 300 },
    },
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grid-small-white/[0.05] p-4 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center z-10"
      >
        <h1 className="text-5xl md:text-7xl font-bold font-space-grotesk bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 bg-opacity-50">
          DexAI
        </h1>
        <p className="mt-4 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Your AI co-pilot for turning brilliant concepts into data-driven, viable businesses.
        </p>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full z-10">
        <motion.div variants={cardVariants} whileHover="hover">
          <Link href="/validate">
            <Card className="glass-card cursor-pointer h-full group">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <BrainCircuit className="h-10 w-10 text-secondary-foreground" />
                  <CardTitle className="text-2xl font-space-grotesk">Validate Idea</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-muted-foreground">
                  Have a business idea? Get an instant, AI-powered analysis of its viability, market saturation, and monetization models.
                </CardDescription>
                <div className="mt-6 flex items-center justify-end text-sm font-semibold text-secondary-foreground group-hover:translate-x-1 transition-transform">
                  Analyze Idea <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div variants={cardVariants} whileHover="hover">
          <Link href="/generate">
            <Card className="glass-card cursor-pointer h-full group">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Lightbulb className="h-10 w-10 text-secondary-foreground" />
                  <CardTitle className="text-2xl font-space-grotesk">Generate Idea</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-muted-foreground">
                  Define a niche and investment level. Our AI will generate a novel business concept based on real-time market trends.
                </CardDescription>
                <div className="mt-6 flex items-center justify-end text-sm font-semibold text-secondary-foreground group-hover:translate-x-1 transition-transform">
                  Generate with AI <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
