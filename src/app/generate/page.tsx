'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { GenerateIdeaInput, generateIdea, GenerateIdeaOutput } from '@/ai/flows/generate-idea-flow';
import { IdeaDossier } from '@/components/idea-dossier';

export default function GeneratePage() {
  const [niche, setNiche] = useState('');
  const [investmentLevel, setInvestmentLevel] = useState<'Baixo' | 'Médio' | 'Alto'>('Baixo');
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<GenerateIdeaOutput | null>(null);
  const { toast } = useToast();

  const handleGeneration = async () => {
    if (niche.trim().length < 5) {
      toast({
        variant: 'destructive',
        title: 'Nicho muito vago!',
        description: 'Por favor, descreva o nicho com mais detalhes para uma geração precisa.',
      });
      return;
    }
    setLoading(true);
    setDossier(null);
    try {
      const input: GenerateIdeaInput = { niche, investmentLevel };
      const result = await generateIdea(input);
      setDossier(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro na Geração',
        description:
          'Não foi possível gerar sua ideia. Verifique sua conexão ou tente novamente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-grid-small-white/[0.2] p-4 md:p-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

      <div className="w-full max-w-4xl z-10">
        <motion.div {...fadeInUp}>
          <Link href="/" className="flex items-center text-neutral-300 hover:text-accent transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </motion.div>

        {!dossier && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold font-space-grotesk bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400">
              Gere uma Ideia de Negócio
            </h1>
            <p className="mt-4 text-lg text-neutral-300 max-w-2xl mx-auto">
              Defina um nicho e um nível de investimento. A IA criará um conceito de negócio inovador para você.
            </p>

            <div className="mt-8 max-w-2xl mx-auto text-left space-y-6">
              <div>
                <Label htmlFor="niche" className="text-lg font-semibold text-neutral-200">
                  Nicho de Mercado
                </Label>
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: IA para pets, Fintech para Geração Z, Edtech para crianças"
                  className="mt-2 text-base"
                  disabled={loading}
                />
              </div>

              <div>
                <Label className="text-lg font-semibold text-neutral-200">Nível de Investimento</Label>
                <RadioGroup
                  value={investmentLevel}
                  onValueChange={(value: 'Baixo' | 'Médio' | 'Alto') => setInvestmentLevel(value)}
                  className="mt-3 grid grid-cols-3 gap-4"
                  disabled={loading}
                >
                  {['Baixo', 'Médio', 'Alto'].map((level) => (
                    <Label
                      key={level}
                      htmlFor={`level-${level}`}
                      className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent/20 hover:text-accent-foreground [&:has([data-state=checked])]:border-accent"
                    >
                      <RadioGroupItem value={level} id={`level-${level}`} className="sr-only" />
                      <span className="text-lg font-semibold">{level}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <Button
                onClick={handleGeneration}
                disabled={loading}
                size="lg"
                className="mt-4 w-full text-lg font-semibold bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Gerar Ideia com IA
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {loading && !dossier && (
           <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mt-16"
          >
            <LoaderCircle className="h-16 w-16 text-accent animate-spin mx-auto" />
            <h2 className="mt-4 text-2xl font-space-grotesk text-neutral-200">Criando Dossiê da Ideia...</h2>
            <p className="text-neutral-400">A IA está pesquisando tendências e formulando um plano. Isso pode levar alguns segundos.</p>
           </motion.div>
        )}

        {dossier && (
          <motion.div
            key="dossier"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mt-8"
          >
             <IdeaDossier dossier={dossier} onReset={() => setDossier(null)} />
          </motion.div>
        )}
      </div>
    </main>
  );
}
