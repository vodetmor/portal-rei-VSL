
'use client';
import { useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { z } from 'zod';
import { generateIdea } from '@/ai/flows/generate-idea-flow';
import { IdeaDossier } from '@/components/idea-dossier';
import { NeonButton } from '@/components/ui/neon-button';

const GenerateIdeaInputSchema = z.object({
  niche: z.string().describe('A área de interesse ou nicho de mercado para a nova ideia de negócio.'),
  investmentLevel: z.enum(['Baixo', 'Médio', 'Alto']).describe('O nível de capital de investimento inicial disponível (Baixo, Médio, Alto).'),
});
type GenerateIdeaInput = z.infer<typeof GenerateIdeaInputSchema>;

const GenerateIdeaOutputSchema = z.object({
    ideaSummary: z.object({
        name: z.string().describe('Um nome criativo e curto para o negócio.'),
        description: z.string().describe('Uma descrição concisa e atraente da ideia de negócio (1-2 frases).'),
        potentialScore: z.number().min(0).max(100).describe('Uma pontuação de 0 a 100 representando o potencial de sucesso da ideia.'),
    }),
    projections: z.object({
        analysis: z.string().describe('Uma análise sobre a tendência de interesse no nicho, justificando o potencial da ideia.'),
        interestTrend: z.array(z.object({
            month: z.string(),
            interest: z.number().min(0).max(100),
        })).describe('Uma série de dados mensais simulando a tendência de interesse no mercado nos últimos 6 meses.'),
    }),
    strategy: z.object({
        analysis: z.string().describe('Análise de estratégias de go-to-market, marketing e métricas de sucesso (KPIs), adaptadas ao nível de investimento.'),
        recommendations: z.array(z.string()).describe('Recomendações estratégicas e acionáveis.'),
    }),
    mvp: z.object({
        analysis: z.string().describe('Análise do que seria um Produto Mínimo Viável (MVP) e os custos estimados, adaptados ao nível de investimento.'),
        featureRecommendations: z.array(z.string()).describe('Recomendações de funcionalidades essenciais para o MVP.'),
    })
});
export type GenerateIdeaOutput = z.infer<typeof GenerateIdeaOutputSchema>;


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

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 md:p-8 pt-24 md:pt-32">
      <div className="w-full max-w-4xl z-10">
        {!dossier && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Gere uma Ideia de Negócio
            </h1>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              Defina um nicho e um nível de investimento. A IA criará um conceito de negócio inovador para você.
            </p>

            <div className="mt-8 max-w-2xl mx-auto text-left space-y-6">
              <div>
                <Label htmlFor="niche" className="text-lg font-semibold text-white">
                  Nicho de Mercado
                </Label>
                <Input
                  id="niche"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Ex: IA para pets, Fintech para Geração Z, Edtech para crianças"
                  className="mt-2 text-base bg-black/20 border-subtle-border rounded-lg"
                  disabled={loading}
                />
              </div>

              <div>
                <Label className="text-lg font-semibold text-white">Nível de Investimento</Label>
                <RadioGroup
                  value={investmentLevel}
                  onValueChange={(value: 'Baixo' | 'Médio' | 'Alto') => setInvestmentLevel(value)}
                  className="mt-3 grid grid-cols-3 gap-4"
                  disabled={loading}
                >
                  {['Baixo', 'Médio', 'Alto'].map((level) => (
                    <motion.div key={level} whileTap={{ scale: 0.95 }}>
                      <Label
                        htmlFor={`level-${level}`}
                        className="cursor-pointer flex flex-col items-center justify-center rounded-md border-2 border-subtle-border bg-black/20 p-4 hover:bg-white/10 [&:has([data-state=checked])]:border-primary-cyan"
                      >
                        <RadioGroupItem value={level} id={`level-${level}`} className="sr-only" />
                        <span className="text-lg font-semibold">{level}</span>
                      </Label>
                    </motion.div>
                  ))}
                </RadioGroup>
              </div>

              <NeonButton
                onClick={handleGeneration}
                disabled={loading}
                size="lg"
                className="mt-4 w-full text-lg font-semibold text-white transition-transform hover:scale-105"
              >
                {loading ? (
                  <span className="flex items-center">
                    <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                    Gerando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Sparkles className="mr-2 h-5 w-5" />
                    Gerar Ideia com IA
                  </span>
                )}
              </NeonButton>
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
            <LoaderCircle className="h-16 w-16 text-primary-cyan animate-spin mx-auto" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">Criando Dossiê da Ideia...</h2>
            <p className="text-zinc-400">A IA está pesquisando tendências e formulando um plano. Isso pode levar alguns segundos.</p>
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
