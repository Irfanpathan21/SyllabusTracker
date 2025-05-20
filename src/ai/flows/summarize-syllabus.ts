'use server';
/**
 * @fileOverview An AI agent that summarizes topics in a syllabus.
 *
 * - summarizeSyllabus - A function that handles the syllabus summarization process.
 * - SummarizeSyllabusInput - The input type for the summarizeSyllabus function.
 * - SummarizeSyllabusOutput - The return type for the summarizeSyllabus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeSyllabusInputSchema = z.object({
  syllabusText: z.string().describe('The complete syllabus text to summarize.'),
});
export type SummarizeSyllabusInput = z.infer<typeof SummarizeSyllabusInputSchema>;

const SummarizeSyllabusOutputSchema = z.object({
  summary: z.string().describe('A summary of the entire syllabus.'),
  topicSummaries: z.record(z.string(), z.string()).describe('A map of topic names to their summaries.'),
});
export type SummarizeSyllabusOutput = z.infer<typeof SummarizeSyllabusOutputSchema>;

export async function summarizeSyllabus(input: SummarizeSyllabusInput): Promise<SummarizeSyllabusOutput> {
  return summarizeSyllabusFlow(input);
}

const summarizeSyllabusPrompt = ai.definePrompt({
  name: 'summarizeSyllabusPrompt',
  input: {schema: SummarizeSyllabusInputSchema},
  output: {schema: SummarizeSyllabusOutputSchema},
  prompt: `You are an expert academic assistant. Your task is to summarize a college syllabus and extract key topics and their summaries.

Syllabus Text: {{{syllabusText}}}

Output a JSON object containing a summary of the entire syllabus, and a map of topic names to their individual summaries.`,
});

const summarizeSyllabusFlow = ai.defineFlow(
  {
    name: 'summarizeSyllabusFlow',
    inputSchema: SummarizeSyllabusInputSchema,
    outputSchema: SummarizeSyllabusOutputSchema,
  },
  async input => {
    const {output} = await summarizeSyllabusPrompt(input);
    return output!;
  }
);
