'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ValidateIdeaInput,
  validateIdea,
  ValidateIdeaOutput,
} from '@/ai/flows/validate-idea-flow';
import { ValidationReport } from '@/components/validation-report';

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

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 },
  };

  return (
    <main className="flex min-h-screen w-full flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl z-10">
        <motion.div {...fadeInUp}>
          <Link href="/" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Link>
        </motion.div>

        {!report && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-8 text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Valide sua Ideia de Negócio
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Descreva seu conceito de negócio abaixo. A IA irá fornecer uma análise completa sobre a viabilidade, mercado e monetização.
            </p>

            <div className="mt-8 max-w-2xl mx-auto">
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="Ex: Uma plataforma de IA que cria planos de treino personalizados para atletas amadores, conectando-os com nutricionistas..."
                className="min-h-[150px] text-base"
                disabled={loading}
              />
              <Button
                onClick={handleAnalysis}
                disabled={loading}
                size="lg"
                className="mt-4 w-full text-lg font-semibold"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Analisar Ideia com IA
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}

        {loading && !report && (
           <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center mt-16"
          >
            <LoaderCircle className="h-16 w-16 text-primary animate-spin mx-auto" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Gerando Relatório...</h2>
            <p className="text-muted-foreground">Isso pode levar alguns segundos.</p>
           </motion.div>
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
