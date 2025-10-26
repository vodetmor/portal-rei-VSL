'use client';
import { Bot, CheckCircle, DraftingCompass, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { GenerateIdeaOutput } from '@/app/generate/page';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MagicCard } from './ui/magic-card';

interface IdeaDossierProps {
  dossier: GenerateIdeaOutput;
  onReset: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
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

const iconMapping = {
    strategy: <DraftingCompass className="h-8 w-8 text-primary" />,
    mvp: <Bot className="h-8 w-8 text-primary" />,
};

export function IdeaDossier({ dossier, onReset }: IdeaDossierProps) {
  
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Dossiê da Ideia: {dossier.ideaSummary.name}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{dossier.ideaSummary.description}</p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center"
      >
        <MagicCard className="cursor-pointer">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">Potencial da Ideia</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="relative h-32 w-32 mx-auto">
                <svg className="transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
                    <motion.circle
                     cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--primary))" strokeWidth="12"
                     strokeDasharray={2 * Math.PI * 54}
                     strokeDashoffset={2 * Math.PI * 54 * (1 - dossier.ideaSummary.potentialScore / 100)}
                     initial={{ strokeDashoffset: 2 * Math.PI * 54 }}
                     animate={{ strokeDashoffset: 2 * Math.PI * 54 * (1 - dossier.ideaSummary.potentialScore / 100) }}
                     transition={{ duration: 1.5, ease: "easeInOut" }}
                     />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-bold text-primary">{dossier.ideaSummary.potentialScore}%</span>
                </div>
            </div>
          </CardContent>
        </MagicCard>
        
        <MagicCard className="md:col-span-2 cursor-pointer">
           <CardHeader>
            <CardTitle className="text-xl tracking-tight flex items-center gap-2"><TrendingUp/> Tendência de Interesse</CardTitle>
            <CardDescription>{dossier.projections.analysis}</CardDescription>
          </CardHeader>
          <CardContent className='h-48 pr-8'>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dossier.projections.interestTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}/>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--background))',
                            borderColor: 'hsl(var(--border))',
                            color: 'hsl(var(--foreground))'
                        }}
                    />
                    <Area type="monotone" dataKey="interest" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorUv)" />
                </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </MagicCard>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalysisCard icon={iconMapping.strategy} title="Estratégia e Métricas" analysis={dossier.strategy.analysis} recommendations={dossier.strategy.recommendations} />
        <AnalysisCard icon={iconMapping.mvp} title="Plano de Ação e MVP" analysis={dossier.mvp.analysis} recommendations={dossier.mvp.featureRecommendations} />
      </motion.div>

      <motion.div variants={itemVariants} className="bg-muted/50 border p-6 text-center rounded-lg">
        <h3 className="text-2xl font-bold tracking-tight text-foreground">Próximos Passos (Em breve)</h3>
        <p className="text-muted-foreground mt-2">Funcionalidades Pro para acelerar seu lançamento.</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button variant="outline" disabled size="lg">Gerar Pitch de Elevador <Badge className="ml-2">Pro</Badge></Button>
            <Button variant="outline" disabled size="lg">Criar Landing Page <Badge className="ml-2">Pro</Badge></Button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className='text-center'>
        <Button onClick={onReset} size='lg' variant="ghost" className="text-primary hover:bg-primary/10 hover:text-primary">Gerar outra ideia</Button>
      </motion.div>
    </motion.div>
  );
}


function AnalysisCard({ icon, title, analysis, recommendations }: {icon: React.ReactNode, title: string, analysis: string, recommendations: string[]}) {
    return (
        <MagicCard className="h-full cursor-pointer">
          <CardHeader>
            <div className="flex items-center gap-4">
              {icon}
              <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{analysis}</p>
            <div>
                <h4 className='font-semibold text-foreground mb-2'>Recomendações:</h4>
                <ul className='space-y-2 text-muted-foreground'>
                    {recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                           <CheckCircle className="h-5 w-5 mt-0.5 text-primary shrink-0"/> 
                           <span>{rec}</span>
                        </li>
                    ))}
                </ul>
            </div>
          </CardContent>
        </MagicCard>
    )
}
