'use client';
import { BarChart, Briefcase, DollarSign, Lightbulb, Target, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ValidateIdeaOutput } from '@/ai/flows/validate-idea-flow';
import { Button } from './ui/button';

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
  'Baixa': 'border-green-500/50 text-green-400',
  'Média': 'border-yellow-500/50 text-yellow-400',
  'Alta': 'border-red-500/50 text-red-400',
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
  const COLORS = ['#00ffff', '#262626'];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      <motion.div variants={itemVariants} className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold font-space-grotesk text-neutral-100">Relatório de Validação</h1>
        <p className="mt-2 text-lg text-neutral-300">Análise gerada por DexAI</p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center"
      >
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl font-space-grotesk">Pontuação de Viabilidade</CardTitle>
          </CardHeader>
          <CardContent className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={viabilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
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
            <p className="text-4xl font-bold font-space-grotesk text-primary -translate-y-28">{report.viabilityScore}%</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
           <CardHeader>
            <CardTitle className="text-xl font-space-grotesk">Saturação de Mercado</CardTitle>
          </CardHeader>
          <CardContent className='flex items-center justify-center h-40'>
             <Badge className={`text-2xl px-6 py-3 ${saturationColors[report.marketSaturation]}`}>
                {report.marketSaturation}
            </Badge>
          </CardContent>
        </Card>

        <Card className="glass-card">
           <CardHeader>
            <CardTitle className="text-xl font-space-grotesk">Recomendação Geral</CardTitle>
          </CardHeader>
          <CardContent className='flex items-center justify-center h-40'>
            <p className='text-neutral-300 px-4'>
                {report.overallRecommendation}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnalysisCard icon={iconMapping.targetAudience} title="Público-Alvo" analysis={report.targetAudience.analysis} recommendations={report.targetAudience.recommendations} />
        <AnalysisCard icon={iconMapping.monetizationModels} title="Modelos de Monetização" analysis={report.monetizationModels.analysis} recommendations={report.monetizationModels.recommendations} />
        <AnalysisCard icon={iconMapping.competitors} title="Concorrentes" analysis={report.competitors.analysis} recommendations={report.competitors.recommendations} />
        <AnalysisCard icon={iconMapping.mvp} title="Plano de MVP" analysis={report.mvp.analysis} recommendations={report.mvp.featureRecommendations} />
      </motion.div>
      <motion.div variants={itemVariants} className='text-center'>
        <Button onClick={onReset} size='lg'>Analisar outra ideia</Button>
      </motion.div>
    </motion.div>
  );
}


function AnalysisCard({ icon, title, analysis, recommendations }: {icon: React.ReactNode, title: string, analysis: string, recommendations: string[]}) {
    return (
        <Card className="glass-card h-full">
          <CardHeader>
            <div className="flex items-center gap-4">
              {icon}
              <CardTitle className="text-2xl font-space-grotesk">{title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-neutral-300">{analysis}</p>
            <div>
                <h4 className='font-semibold text-neutral-100 mb-2'>Recomendações:</h4>
                <ul className='list-disc list-inside space-y-1 text-neutral-300'>
                    {recommendations.map((rec, index) => <li key={index}>{rec}</li>)}
                </ul>
            </div>
          </CardContent>
        </Card>
    )
}
