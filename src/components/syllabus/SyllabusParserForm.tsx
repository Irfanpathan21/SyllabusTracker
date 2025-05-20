'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseSyllabus, type ParseSyllabusOutput } from '@/ai/flows/parse-syllabus';
import { summarizeSyllabus, type SummarizeSyllabusOutput } from '@/ai/flows/summarize-syllabus';
import { SyllabusDisplay } from './SyllabusDisplay';

export function SyllabusParserForm() {
  const [syllabusText, setSyllabusText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParseSyllabusOutput | null>(null);
  const [summaryData, setSummaryData] = useState<SummarizeSyllabusOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!syllabusText.trim()) {
      setError('Syllabus text cannot be empty.');
      toast({
        title: 'Input Error',
        description: 'Syllabus text cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setSummaryData(null);

    try {
      // Using Promise.all to run both AI flows concurrently
      const [parsedResult, summaryResult] = await Promise.all([
        parseSyllabus({ syllabusText }),
        summarizeSyllabus({ syllabusText })
      ]);
      
      setParsedData(parsedResult);
      setSummaryData(summaryResult);

      toast({
        title: 'Syllabus Processed!',
        description: 'Your syllabus has been parsed and summarized successfully.',
        variant: 'default', // Explicitly 'default' which is green based on our theme now
      });
    } catch (e: any) {
      console.error('Error processing syllabus:', e);
      const errorMessage = e.message || 'Failed to process syllabus. Please check the console for more details.';
      setError(errorMessage);
      toast({
        title: 'Error Processing Syllabus',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextAreaChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setSyllabusText(event.target.value);
    if (error) setError(null); // Clear error when user types
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Textarea
            placeholder="Paste your full syllabus text here..."
            value={syllabusText}
            onChange={handleTextAreaChange}
            rows={15}
            className="border-input focus:ring-primary text-sm shadow-sm rounded-md p-3"
            disabled={isLoading}
            aria-label="Syllabus Text Input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            The more complete the syllabus, the better the parsing and summarization results.
          </p>
        </div>
        <Button type="submit" disabled={isLoading || !syllabusText.trim()} className="w-full sm:w-auto text-base py-3 px-6 shadow-md hover:shadow-lg transition-shadow duration-200">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-5 w-5" />
              Parse Syllabus
            </>
          )}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {parsedData && summaryData && !isLoading && (
        <div className="mt-10 pt-6 border-t border-border">
          <SyllabusDisplay parsedSyllabus={parsedData} syllabusSummary={summaryData} />
        </div>
      )}
    </div>
  );
}
