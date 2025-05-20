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

const TopicSummarySchema = z.object({
  topicName: z.string().describe('The name of the topic.'),
  summary: z.string().describe('The summary for this topic.'),
});

const SummarizeSyllabusOutputSchema = z.object({
  summary: z.string().describe('A summary of the entire syllabus.'),
  topicSummaries: z.array(TopicSummarySchema).describe('A list of topics, where each topic has a name and its summary.'),
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

Output a JSON object containing:
1. "summary": A summary of the entire syllabus.
2. "topicSummaries": A list of objects, where each object has a "topicName" (string) and its corresponding "summary" (string).`,
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
