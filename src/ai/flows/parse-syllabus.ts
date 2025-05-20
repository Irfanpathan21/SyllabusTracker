
'use server';
/**
 * @fileOverview Parses syllabus text into a structured JSON format, capable of handling multiple subjects, each with units and topics.
 *
 * - parseSyllabus - A function that accepts syllabus text and returns a structured JSON object.
 * - ParseSyllabusInput - The input type for the parseSyllabus function.
 * - ParseSyllabusOutput - The return type for the parseSyllabus function.
 * - Subject - TypeScript type for a single subject.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseSyllabusInputSchema = z.object({
  syllabusText: z
    .string()
    .describe('The complete syllabus text to be parsed.'),
});
export type ParseSyllabusInput = z.infer<typeof ParseSyllabusInputSchema>;

const SubjectSchema = z.object({
  subject: z.string().describe('The name of the subject.'),
  units: z.array(
    z.object({
      unit: z.string().describe('The name of the unit.'),
      topics: z.array(z.string().describe('A topic covered in the unit.')),
    })
  ).describe('An array of units for this subject, each containing an array of topics.'),
});
export type Subject = z.infer<typeof SubjectSchema>;

const ParseSyllabusOutputSchema = z.object({
  subjects: z.array(SubjectSchema).describe('An array of subjects extracted from the syllabus. Each subject has a name and a list of its units and topics.')
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
The syllabus might contain information for one or more subjects.
For each subject found, identify its name, its units, and the topics for each unit.
Return the information in a JSON object with a single key "subjects". The value of "subjects" should be an array, where each element represents a subject and contains:
- "subject": The name of the subject (string).
- "units": An array of objects, where each object represents a unit and contains:
  - "unit": The name of the unit (string).
  - "topics": An array of strings, where each string is a topic covered in that unit.

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
    if (!output) {
      console.error('LLM output for parseSyllabusPrompt was undefined. Input syllabusText length:', input.syllabusText.length);
      throw new Error('The AI model could not parse the syllabus content as expected. The output was empty. The PDF might be unparsable or too complex.');
    }
    return output;
  }
);
