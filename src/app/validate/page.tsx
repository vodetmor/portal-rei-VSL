'use client';
import { useState } from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ValidateIdeaInput,
  validateIdea,
  ValidateIdeaOutput,
} from '@/ai/flows/validate-idea-flow';
import { ValidationReport } from '@/components/validation-report';
import { NeonButton } from '@/components/ui/neon-button';

export default function ValidatePage() {
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ValidateIdeaOutput | null>(null);
  const { toast } = useToast();

  const handleAnalysis = async () => {
    if (idea.trim().length < 20) {
      toast({
        variant: 'destructive',
        title: 'Ideia muito curta!',
        description: 'Por favor, descreva sua ideia com mais detalhes para uma análise precisa.',
      });
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const input: ValidateIdeaInput = { ideaDescription: idea };
      const result = await validateIdea(input);
      setReport(result);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro na Análise',
        description:
          'Não foi possível analisar sua ideia. Verifique sua conexão ou tente novamente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 md:p-8 pt-24 md:pt-32">
      <div className="w-full max-w-4xl z-10">
        {!report && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Valide sua Ideia de Negócio
            </h1>
            <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto">
              Descreva seu conceito de negócio abaixo. A IA irá fornecer uma análise completa sobre a viabilidade, mercado e monetização.
            </p>

            <div className="mt-8 max-w-2xl mx-auto">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Ex: Uma plataforma de IA que cria planos de treino personalizados para atletas amadores, conectando-os com nutricionistas..."
                className="min-h-[150px] text-base bg-black/20 border-subtle-border rounded-lg"
                disabled={loading}
              />
              <NeonButton
                onClick={handleAnalysis}
                disabled={loading}
                size="lg"
                className="mt-6 w-full text-lg font-semibold text-white transition-transform hover:scale-105"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                    Analisando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analisar Ideia com IA
                  </span>
                )}
              </NeonButton>
            </div>
          </motion.div>
        )}

        {loading && !report && (
           <div className="text-center mt-16" />
        )}

        {report && (
          <motion.div
            key="report"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mt-8"
          >
             <ValidationReport report={report} onReset={() => setReport(null)} />
          </motion.div>
        )}
      </div>
    </main>
  );
}
