'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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
type GenerateIdeaOutput = z.infer<typeof GenerateIdeaOutputSchema>;


const generateIdeaFlow = ai.defineFlow(
    {
        name: 'generateIdeaFlow',
        inputSchema: GenerateIdeaInputSchema,
        outputSchema: GenerateIdeaOutputSchema,
    }, async (input) => {
        const prompt = await ai.generate({
            output: { schema: GenerateIdeaOutputSchema },
            system: `Você é DexAI, um especialista em inovação e estratégia de negócios que gera novas ideias de startups.
Sua tarefa é criar um conceito de negócio detalhado e acionável com base no nicho e no nível de investimento fornecidos pelo usuário.

PONTO CRÍTICO: Todas as suas sugestões de custos, ferramentas, estratégias de marketing e escopo do MVP devem ser estritamente adaptadas ao Nível de Investimento fornecido (${input.investmentLevel}).
- Baixo: Foco em ferramentas gratuitas, crescimento orgânico, MVP extremamente enxuto.
- Médio: Permite algumas ferramentas pagas, anúncios modestos, MVP com mais funcionalidades.
- Alto: Permite equipe pequena, marketing mais agressivo, produto mais robusto.

Analise tendências atuais para garantir que a ideia seja relevante.
Gere dados simulados para o gráfico de tendência de interesse que pareçam realistas e justifiquem a análise.
Retorne sua análise estritamente no formato JSON solicitado.`,
            prompt: `Gere uma nova ideia de negócio para o nicho de "${input.niche}" com um nível de investimento "${input.investmentLevel}".`,
          });
        
          const { output } = prompt;
          if (!output) {
            throw new Error('A IA não conseguiu gerar uma ideia válida.');
          }
          return output;
    }
);


export async function generateIdea(input: any): Promise<any> {
  return generateIdeaFlow(input);
}
