
'use server';
/**
 * @fileOverview An AI agent that summarizes topics in a syllabus, potentially containing multiple subjects.
 *
 * - summarizeSyllabus - A function that handles the syllabus summarization process.
 * - SummarizeSyllabusInput - The input type for the summarizeSyllabus function.
 * - SummarizeSyllabusOutput - The return type for the summarizeSyllabus function.
 * - SubjectSummary - TypeScript type for a single subject's summary details.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeSyllabusInputSchema = z.object({
  syllabusText: z.string().describe('The complete syllabus text to summarize, potentially covering multiple subjects.'),
});
export type SummarizeSyllabusInput = z.infer<typeof SummarizeSyllabusInputSchema>;

const TopicSummarySchema = z.object({
  topicName: z.string().describe('The name of the topic. This should match a topic name parsed for this subject.'),
  summary: z.string().describe('The summary for this specific topic.'),
});

const SubjectSummarySchema = z.object({
    subjectName: z.string().describe('The name of the subject this summary pertains to. This should match a subject name from the parsing step.'),
    subjectSummary: z.string().describe('A detailed summary for this specific subject, covering its main themes, objectives, and learning outcomes.'),
    topicSummaries: z.array(TopicSummarySchema).describe('A list of topic summaries specific to this subject. Each topic name should correspond to a topic identified in the parsing step for this subject.'),
});
export type SubjectSummary = z.infer<typeof SubjectSummarySchema>;


const SummarizeSyllabusOutputSchema = z.object({
  overallSyllabusSummary: z.string().describe('A concise high-level summary of the entire syllabus document, potentially covering all subjects included.'),
  subjectsDetailedSummaries: z.array(SubjectSummarySchema).describe('An array of detailed summaries, one for each subject identified in the syllabus. Each element includes the subject name, a summary for that subject, and summaries for its specific topics.')
});
export type SummarizeSyllabusOutput = z.infer<typeof SummarizeSyllabusOutputSchema>;

export async function summarizeSyllabus(input: SummarizeSyllabusInput): Promise<SummarizeSyllabusOutput> {
  return summarizeSyllabusFlow(input);
}

const summarizeSyllabusPrompt = ai.definePrompt({
  name: 'summarizeSyllabusPrompt',
  input: {schema: SummarizeSyllabusInputSchema},
  output: {schema: SummarizeSyllabusOutputSchema},
  prompt: `You are an expert academic assistant. The provided syllabus text may cover one or more subjects. Your task is to:
1.  Provide an "overallSyllabusSummary": A concise high-level summary of the entire syllabus document, covering all subjects if multiple are present.
2.  For each subject identified in the syllabus, provide a detailed summary. This should be an array under the key "subjectsDetailedSummaries". Each element in this array should be an object containing:
    a.  "subjectName": The name of the subject. This name should match the subject name as it would be identified by a parsing process.
    b.  "subjectSummary": A detailed summary for this specific subject, covering its main themes, objectives, and learning outcomes.
    c.  "topicSummaries": An array of objects, where each object has:
        i.  "topicName": The name of a specific topic within this subject. This name should match the topic name as it would be identified by a parsing process for this subject.
        ii. "summary": A concise summary for this specific topic.

Syllabus Text: {{{syllabusText}}}

Ensure the output is a single JSON object adhering to this structure. If no subjects are clearly identifiable, the "subjectsDetailedSummaries" array can be empty, but still provide an overall summary if possible.
  `,
});

const summarizeSyllabusFlow = ai.defineFlow(
  {
    name: 'summarizeSyllabusFlow',
    inputSchema: SummarizeSyllabusInputSchema,
    outputSchema: SummarizeSyllabusOutputSchema,
  },
  async input => {
    const {output} = await summarizeSyllabusPrompt(input);
    if (!output) {
      console.error('LLM output for summarizeSyllabusPrompt was undefined. Input syllabusText length:', input.syllabusText.length);
      throw new Error('The AI model could not summarize the syllabus content as expected. The output was empty. The PDF might be unparsable or too complex.');
    }
    return output;
  }
);
