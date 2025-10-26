'use client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BrainCircuit,
  Check,
  ChevronRight,
  Lightbulb,
  Lock,
  PieChart,
  Rocket,
  Sparkle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  const features = [
    {
      icon: <PieChart className="w-6 h-6" />,
      title: 'Validação Rápida',
      description:
        'Obtenha uma análise de viabilidade instantânea para sua ideia de negócio.',
      href: '/validate',
    },
    {
      icon: <Lightbulb className="w-6 h-6" />,
      title: 'Geração de Ideias',
      description:
        'Não sabe por onde começar? Gere conceitos de negócios inovadores com base em um nicho.',
      href: '/generate',
    },
    {
      icon: <Lock className="w-6 h-6" />,
      title: 'Análise de Mercado',
      description: 'Entenda a saturação do mercado e identifique seu público-alvo.',
      href: '/validate',
    },
    {
      icon: <Rocket className="w-6 h-6" />,
      title: 'Estratégia de MVP',
      description:
        'Receba recomendações sobre o Produto Mínimo Viável para lançar sua ideia.',
      href: '/generate',
    },
  ];
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Seu Co-Piloto de IA para Startups
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    Valide e gere ideias de negócios inovadoras com o poder da
                    inteligência artificial. Reduza riscos, economize tempo e
                    comece com o pé direito.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Link
                    href="/generate"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    Gerar Ideia
                  </Link>
                  <Link
                    href="/validate"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    Validar Ideia
                  </Link>
                </div>
              </div>
              <BrainCircuit className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square w-48 h-48 text-primary" />
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">
                  Funcionalidades Principais
                </div>
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                  Tudo que você precisa para começar
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  DexAI oferece um conjunto de ferramentas poderosas para
                  transformar um conceito em um plano de negócios acionável.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-2 lg:gap-12">
              <div className="grid gap-6">
                {features.slice(0, 2).map((feature) => (
                  <Link href={feature.href} key={feature.title}>
                    <Card className="hover:bg-card/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                          {feature.title}
                        </CardTitle>
                        {feature.icon}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              <div className="grid gap-6">
                {features.slice(2, 4).map((feature) => (
                  <Link href={feature.href} key={feature.title}>
                    <Card className="hover:bg-card/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">
                          {feature.title}
                        </CardTitle>
                        {feature.icon}
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Pronto para transformar sua ideia em realidade?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Comece a usar o DexAI hoje mesmo e dê o primeiro passo para
                construir uma startup de sucesso.
              </p>
            </div>
            <div className="flex justify-center">
              <Link href="/generate">
                <Button>
                  <Sparkle className="mr-2 h-4 w-4" /> Comece Agora
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 border-t">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 sm:px-10 md:gap-16 md:grid-cols-2">
              <div className="space-y-4">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm">
                  FAQ
                </div>
                <h2 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem]">
                  Perguntas Frequentes
                </h2>
              </div>
              <div className="flex flex-col items-start space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>
                      Como o DexAI valida uma ideia?
                    </AccordionTrigger>
                    <AccordionContent>
                      Nossa IA analisa sua ideia com base em vários fatores,
                      incluindo potencial de mercado, saturação, público-alvo e
                      modelos de monetização para fornecer uma pontuação de
                      viabilidade e insights detalhados.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>
                      De onde vêm os dados para a geração de ideias?
                    </AccordionTrigger>
                    <AccordionContent>
                      A IA utiliza uma combinação de seu vasto conhecimento e
                      dados de tendências de mercado para gerar ideias que são
                      relevantes e possuem alto potencial de sucesso.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>
                      O DexAI é gratuito?
                    </AccordionTrigger>
                    <AccordionContent>
                      Sim, o DexAI é totalmente gratuito para usar. Nosso
                      objetivo é ajudar empreendedores a dar os primeiros
                      passos com mais segurança.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
