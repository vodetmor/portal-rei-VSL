'use client';
import { Briefcase, CheckCircle, DollarSign, Lightbulb, Target, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ValidateIdeaOutput } from '@/ai/flows/validate-idea-flow';
import { MagicCard } from './ui/magic-card';
import { RainbowButton } from './ui/rainbow-button';

interface ValidationReportProps {
  report: ValidateIdeaOutput;
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

const saturationColors: Record<string, string> = {
  'Baixa': 'border-primary/50 text-foreground bg-primary/20',
  'Média': 'border-yellow-500/50 text-black bg-yellow-500/20',
  'Alta': 'border-red-500/50 text-black bg-red-500/20',
};

const iconMapping = {
    targetAudience: <Target className="h-8 w-8 text-primary" />,
    monetizationModels: <DollarSign className="h-8 w-8 text-primary" />,
    competitors: <Users className="h-8 w-8 text-primary" />,
    mvp: <Lightbulb className="h-8 w-8 text-primary" />,
    overallRecommendation: <Briefcase className="h-8 w-8 text-primary" />,
};

export function ValidationReport({ report, onReset }: ValidationReportProps) {
  const viabilityData = [
    { name: 'Viability', value: report.viabilityScore },
    { name: 'Remaining', value: 100 - report.viabilityScore },
  ];
  const COLORS = ['hsl(var(--primary))', 'hsl(var(--muted))'];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Relatório de Validação</h1>
        <p className="mt-2 text-lg text-muted-foreground">Análise gerada por DexAI</p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center"
      >
        <MagicCard className='cursor-pointer'>
          <CardHeader>
            <CardTitle className="text-xl tracking-tight">Pontuação de Viabilidade</CardTitle>
          </CardHeader>
          <CardContent className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={viabilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  startAngle={90}
                  endAngle={450}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {viabilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-4xl font-bold text-primary">{report.viabilityScore}%</p>
            </div>
          </CardContent>
        </MagicCard>
        
        <MagicCard className='cursor-pointer'>
           <CardHeader>
            <CardTitle className="text-xl tracking-tight">Saturação de Mercado</CardTitle>
          </CardHeader>
          <CardContent className='flex items-center justify-center h-48'>
             <Badge className={`text-2xl px-6 py-3 ${saturationColors[report.marketSaturation]}`}>
                {report.marketSaturation}
            </Badge>
          </CardContent>
        </MagicCard>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6">
        <MagicCard className='cursor-pointer'>
           <CardHeader>
            <CardTitle className="text-xl tracking-tight text-center">Recomendação Geral</CardTitle>
          </CardHeader>
          <CardContent className='flex items-center justify-center'>
            <p className='text-muted-foreground px-4 text-center'>
                {report.overallRecommendation}
            </p>
          </CardContent>
        </MagicCard>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalysisCard icon={iconMapping.targetAudience} title="Público-Alvo" analysis={report.targetAudience.analysis} recommendations={report.targetAudience.recommendations} />
        <AnalysisCard icon={iconMapping.monetizationModels} title="Modelos de Monetização" analysis={report.monetizationModels.analysis} recommendations={report.monetizationModels.recommendations} />
        <AnalysisCard icon={iconMapping.competitors} title="Concorrentes" analysis={report.competitors.analysis} recommendations={report.competitors.recommendations} />
        <AnalysisCard icon={iconMapping.mvp} title="Plano de MVP" analysis={report.mvp.analysis} recommendations={report.mvp.featureRecommendations} />
      </motion.div>
      <motion.div variants={itemVariants} className='text-center'>
        <RainbowButton onClick={onReset} className="text-white">Analisar outra ideia</RainbowButton>
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
