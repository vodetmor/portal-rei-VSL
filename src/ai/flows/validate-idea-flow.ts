'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ValidateIdeaInputSchema = z.object({
  ideaDescription: z.string().describe('A descrição detalhada da ideia de negócio a ser validada.'),
});
export type ValidateIdeaInput = z.infer<typeof ValidateIdeaInputSchema>;

const ValidateIdeaOutputSchema = z.object({
  viabilityScore: z.number().min(0).max(100).describe('Uma pontuação de 0 a 100 representando a viabilidade geral da ideia.'),
  marketSaturation: z.enum(['Baixa', 'Média', 'Alta']).describe('O nível de saturação do mercado para esta ideia.'),
  targetAudience: z.object({
    analysis: z.string().describe('Análise detalhada do público-alvo potencial.'),
    recommendations: z.array(z.string()).describe('Recomendações sobre como alcançar esse público.'),
  }),
  monetizationModels: z.object({
    analysis: z.string().describe('Análise dos possíveis modelos de monetização.'),
    recommendations: z.array(z.string()).describe('Recomendações dos modelos mais adequados.'),
  }),
  competitors: z.object({
    analysis: z.string().describe('Análise dos principais concorrentes, diretos e indiretos.'),
    recommendations: z.array(z.string()).describe('Recomendações sobre como se diferenciar.'),
  }),
  mvp: z.object({
    analysis: z.string().describe('Análise sobre o que seria um Produto Mínimo Viável (MVP) para esta ideia.'),
    featureRecommendations: z.array(z.string()).describe('Recomendações de funcionalidades essenciais para o MVP.'),
  }),
  overallRecommendation: z.string().describe("Um parágrafo curto e direto com a recomendação geral e o veredito. Ex: 'A ideia é promissora, mas requer validação de mercado.' ou 'Alto risco, mercado saturado. Recomendo pivotar.'"),
});
export type ValidateIdeaOutput = z.infer<typeof ValidateIdeaOutputSchema>;


const validateIdeaFlow = ai.defineFlow(
  {
    name: 'validateIdeaFlow',
    inputSchema: ValidateIdeaInputSchema,
    outputSchema: ValidateIdeaOutputSchema,
  },
  async (input) => {
    const prompt = await ai.generate({
        output: { schema: ValidateIdeaOutputSchema },
        system: `Você é DexAI, um especialista em startups e capital de risco com décadas de experiência em análise de novos negócios.
Sua tarefa é analisar a ideia de negócio fornecida pelo usuário de forma crítica, objetiva e construtiva.
Avalie todos os aspectos e forneça uma análise detalhada.
A pontuação de viabilidade deve refletir uma combinação de inovação, potencial de mercado, clareza do problema resolvido e escalabilidade.
Seja honesto e direto em sua análise. O objetivo é ajudar o empreendedor a tomar a melhor decisão, seja ela seguir em frente, pivotar ou abandonar a ideia.
IMPORTANTE: A 'overallRecommendation' deve ser um resumo muito curto e acionável, com no máximo 2-3 frases.
Retorne sua análise estritamente no formato JSON solicitado.`,
        prompt: `Analise a seguinte ideia de negócio: ${input.ideaDescription}`,
      });

    const { output } = prompt;
    if (!output) {
      throw new Error('A análise da IA não retornou um resultado válido.');
    }
    return output;
  }
);


export async function validateIdea(input: ValidateIdeaInput): Promise<ValidateIdeaOutput> {
  return await validateIdeaFlow(input);
}
