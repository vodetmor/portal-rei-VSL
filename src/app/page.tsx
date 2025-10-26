'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import BlurText from '@/components/ui/blur-text';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { WhiteGlowButton } from '@/components/ui/white-glow-button';
import { PricingSection } from '@/components/pricing-section';
import { TextShimmer } from '@/components/ui/text-shimmer';

export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  };
  
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-dark-bg flex flex-col items-center justify-center">
      <div
        className="animate-background-pan absolute inset-0 z-0 h-full w-full bg-[linear-gradient(to_right,#FFFFFF_1px,transparent_1px),linear-gradient(to_bottom,#FFFFFF_1px,transparent_1px)] bg-[size:100px_100px] 
                   [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"
      ></div>

      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex w-full flex-col items-center justify-center px-4 text-center pt-32"
      >
        <BlurText
          text="Seu Co-Piloto de IA para Startups"
          className="text-5xl md:text-7xl font-bold max-w-4xl tracking-tighter text-zinc-50 mb-6"
          animateBy="words"
        />

        <motion.div variants={itemVariants}>
          <TextShimmer
            className='text-lg max-w-2xl [--base-color:theme(colors.zinc.400)] dark:[--base-color:theme(colors.zinc.400)] [--base-gradient-color:theme(colors.white)]'
          >
            Valide e gere ideias de negócios inovadoras com o poder da inteligência artificial. Reduza riscos, economize tempo e comece com o pé direito.
          </TextShimmer>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Link href="/generate">
            <RainbowButton>
              Gerar Ideia com IA
            </RainbowButton>
          </Link>
          <Link href="/validate">
            <WhiteGlowButton>
              Validar minha Ideia
            </WhiteGlowButton>
          </Link>
        </motion.div>
      </motion.section>
      
      <PricingSection />
    </div>
  );
}
