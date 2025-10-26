'use client';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Globe } from '@/components/ui/globe';
import ShinyText from '@/components/ShinyText';

const AuroraBackground = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`absolute inset-0 -z-10 transition-transform duration-300 ease-in-out ${className}`}
    style={{
      backgroundImage: 'radial-gradient(125% 125% at 50% 10%, #000 40%, #14F7FF 100%)',
      opacity: 0.1,
      filter: 'blur(40px)',
    }}
    {...props}
  />
);

export default function Home() {
  const title = "Seu Co-Piloto de IA para Startups";

  return (
    <main className="flex min-h-screen flex-col items-center">
      <section className="relative flex w-full flex-col items-center justify-center min-h-screen overflow-hidden px-4 text-center">
        <AuroraBackground />
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-5xl md:text-7xl font-bold max-w-4xl tracking-tighter"
        >
          <ShinyText 
            text={title}
            speed={5}
            className='custom-class' 
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="mt-6 text-lg text-zinc-400 max-w-2xl"
        >
          Valide e gere ideias de negócios inovadoras com o poder da
          inteligência artificial. Reduza riscos, economize tempo e
          comece com o pé direito.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 50, delay: 1.8 }}
          className="mt-8 flex flex-col sm:flex-row gap-4"
        >
          <Link href="/generate" passHref>
            <Button size="lg" className="w-full sm:w-auto text-lg font-semibold px-8 py-3 bg-primary-cyan text-black rounded-full hover:scale-105 transition-transform hover:bg-primary-cyan/90">
              Gerar Ideia com IA
            </Button>
          </Link>
          <Link href="/validate" passHref>
            <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg font-semibold text-white bg-transparent border-subtle-border rounded-full hover:scale-105 hover:bg-white/10 transition-all">
              Validar minha Ideia
            </Button>
          </Link>
        </motion.div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="relative flex h-[550px] w-full flex-col items-center justify-center overflow-hidden"
      >
        <div className="relative flex h-full w-full items-center justify-center">
            <Globe />
        </div>
        <div className="pointer-events-none absolute inset-0 h-full bg-[radial-gradient(circle_at_50%_200%,rgba(0,0,0,0.2),rgba(255,255,255,0))]" />
      </motion.section>

      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="w-full max-w-4xl py-24 px-4"
      >
        <h2 className="text-4xl font-bold text-center mb-12">Perguntas Frequentes</h2>
         <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger className='text-lg'>Como o DexAI valida uma ideia?</AccordionTrigger>
            <AccordionContent className='text-base text-zinc-400'>
              Nossa IA analisa sua ideia com base em vários fatores,
              incluindo potencial de mercado, saturação, público-alvo e
              modelos de monetização para fornecer uma pontuação de
              viabilidade e insights detalhados.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger className='text-lg'>De onde vêm os dados para a geração de ideias?</AccordionTrigger>
            <AccordionContent className='text-base text-zinc-400'>
              A IA utiliza uma combinação de seu vasto conhecimento e
              análise de tendências de mercado para gerar ideias que são
              relevantes e possuem alto potencial de sucesso.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger className='text-lg'>O DexAI é gratuito?</AccordionTrigger>
            <AccordionContent className='text-base text-zinc-400'>
              Sim, o DexAI é totalmente gratuito para usar. Nosso
              objetivo é ajudar empreendedores a dar os primeiros
              passos com mais segurança.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.section>

       <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        className="w-full text-center py-32 px-4"
      >
         <h2 className="text-4xl md:text-5xl font-bold mb-4">Pronto para começar?</h2>
         <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-8">Dê o primeiro passo para construir uma startup de sucesso hoje mesmo.</p>
         <Link href="/generate" passHref>
            <Button size="lg" className="text-lg font-semibold px-8 py-3 bg-primary-green text-black rounded-full hover:scale-105 transition-transform hover:bg-primary-green/90">
              Gerar Minha Primeira Ideia
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
       </motion.section>

    </main>
  );
}