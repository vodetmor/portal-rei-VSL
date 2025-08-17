"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Youtube, Layers, Film, Clapperboard, MonitorPlay, Sparkles } from "lucide-react"
import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const skills = [
  {
    icon: <Youtube className="h-10 w-10 text-primary" />,
    title: "Edição para YouTube",
    description: "Edição completa para vídeos do YouTube, otimizada para engajamento e retenção da audiência."
  },
  {
    icon: <Layers className="h-10 w-10 text-primary" />,
    title: "Motion Graphics",
    description: "Criação de animações e elementos gráficos para dar mais vida e dinamismo aos seus vídeos."
  },
  {
    icon: <Film className="h-10 w-10 text-primary" />,
    title: "Edição de Highlights",
    description: "Transformo suas melhores jogadas em clipes impactantes, perfeitos para redes sociais."
  },
  {
    icon: <Clapperboard className="h-10 w-10 text-primary" />,
    title: "Storytelling Visual",
    description: "Estruturo narrativas visuais coesas que contam uma história e conectam com o público."
  },
   {
    icon: <MonitorPlay className="h-10 w-10 text-primary" />,
    title: "Edição de Vlogs",
    description: "Edição dinâmica e criativa para vlogs, mantendo um ritmo cativante do início ao fim."
  },
  {
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    title: "Efeitos Visuais (VFX)",
    description: "Aplicação de efeitos visuais básicos para elevar a qualidade e o impacto do seu conteúdo."
  }
];

export function SkillsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return (
    <section id="habilidades" className="bg-background">
       <div ref={ref} className={cn('transition-all duration-1000 ease-out container mx-auto px-4 md:px-6', isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10')}>
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Minhas Habilidades</h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                    Especializado em criar conteúdo de vídeo cativante que se destaca.
                </p>
            </div>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill, index) => (
            <Card key={index} className="flex flex-col items-center text-center p-6 border-border/50 hover:border-primary/50 hover:bg-card/80 transition-all duration-300 ease-in-out hover:scale-105 shadow-lg hover:shadow-primary/20">
              <CardHeader className="p-0 mb-4">
                {skill.icon}
              </CardHeader>
              <CardTitle className="mb-2 text-xl font-bold">{skill.title}</CardTitle>
              <CardContent className="p-0">
                <p className="text-muted-foreground">{skill.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
