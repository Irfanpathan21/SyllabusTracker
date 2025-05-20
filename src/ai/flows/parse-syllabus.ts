//The entire output should be enclosed in one valid JSON object.
'use server';
/**
 * @fileOverview Parses syllabus text into a structured JSON format with subjects, units, and topics.
 *
 * - parseSyllabus - A function that accepts syllabus text and returns a structured JSON object.
 * - ParseSyllabusInput - The input type for the parseSyllabus function.
 * - ParseSyllabusOutput - The return type for the parseSyllabus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseSyllabusInputSchema = z.object({
  syllabusText: z
    .string()
    .describe('The complete syllabus text to be parsed.'),
});
export type ParseSyllabusInput = z.infer<typeof ParseSyllabusInputSchema>;

const ParseSyllabusOutputSchema = z.object({
  subject: z.string().describe('The name of the subject.'),
  units: z.array(
    z.object({
      unit: z.string().describe('The name of the unit.'),
      topics: z.array(z.string().describe('A topic covered in the unit.')),
    })
  ).describe('An array of units, each containing an array of topics.'),
});
export type ParseSyllabusOutput = z.infer<typeof ParseSyllabusOutputSchema>;

export async function parseSyllabus(input: ParseSyllabusInput): Promise<ParseSyllabusOutput> {
  return parseSyllabusFlow(input);
}

const parseSyllabusPrompt = ai.definePrompt({
  name: 'parseSyllabusPrompt',
  input: {schema: ParseSyllabusInputSchema},
  output: {schema: ParseSyllabusOutputSchema},
  prompt: `You are an AI assistant designed to parse syllabus text and extract structured information.
  Given the following syllabus text, extract the subject name, units, and topics for each unit.
  Return the information in JSON format.

  Syllabus Text: {{{syllabusText}}}
  `,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH',
      },
    ],
  },
});

const parseSyllabusFlow = ai.defineFlow(
  {
    name: 'parseSyllabusFlow',
    inputSchema: ParseSyllabusInputSchema,
    outputSchema: ParseSyllabusOutputSchema,
  },
  async input => {
    const {output} = await parseSyllabusPrompt(input);
    return output!;
  }
);
