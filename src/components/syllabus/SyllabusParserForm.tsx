
'use client';

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Edit3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { parseSyllabus, type ParseSyllabusOutput, type Subject } from '@/ai/flows/parse-syllabus';
import { summarizeSyllabus, type SummarizeSyllabusOutput, type SubjectSummary } from '@/ai/flows/summarize-syllabus';
import { SyllabusDisplay } from './SyllabusDisplay';
// TODO: Import Firestore functions if implementing persistence
// import { doc, setDoc, getDoc } from 'firebase/firestore';
// import { db } from '@/lib/firebase';


export function SyllabusParserForm() {
  const { user, loading: authLoading } = useAuth(); // Get user from auth context
  const [syllabusText, setSyllabusText] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParseSyllabusOutput | null>(null);
  const [summaryData, setSummaryData] = useState<SummarizeSyllabusOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [checkedTopics, setCheckedTopics] = useState<Record<string, boolean>>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [clientRendered, setClientRendered] = useState(false);

  useEffect(() => {
    setClientRendered(true);
    // TODO: If user is logged in, try to load saved syllabus and progress from Firestore
    // This is a placeholder. Actual implementation would fetch data.
    if (user && !authLoading) {
      console.log("User is logged in. Placeholder for loading saved syllabus.");
      // Example: loadSavedSyllabusForUser(user.uid);
    } else if (!user && !authLoading) {
      // Clear data if user logs out
      setParsedData(null);
      setSummaryData(null);
      setCheckedTopics({});
    }
  }, [user, authLoading]);


  const handleToggleTopic = (subjectName: string, unitName: string, topicName: string) => {
    const key = `${subjectName}::${unitName}::${topicName}`;
    setCheckedTopics((prev) => {
      const newCheckedTopics = {
        ...prev,
        [key]: !prev[key],
      };
      // TODO: If user is logged in, save newCheckedTopics to Firestore
      if (user) {
        console.log("User logged in. Placeholder for saving topic progress to Firestore:", newCheckedTopics);
        // Example: saveProgressForUser(user.uid, newCheckedTopics);
      }
      return newCheckedTopics;
    });
  };

  useEffect(() => {
    if (!clientRendered || !parsedData || !parsedData.subjects || parsedData.subjects.length === 0) {
      setOverallProgress(0);
      return;
    }
    let totalTopicsOverall = 0;
    let completedTopicsOverall = 0;
    parsedData.subjects.forEach(subjectItem => {
      const subjectTotalTopics = subjectItem.units.reduce((sum, unit) => sum + unit.topics.length, 0);
      totalTopicsOverall += subjectTotalTopics;
      const subjectCompletedTopics = subjectItem.units.reduce((unitSum, unit) => {
        return unitSum + unit.topics.filter(topic => checkedTopics[`${subjectItem.subject}::${unit.unit}::${topic}`]).length;
      }, 0);
      completedTopicsOverall += subjectCompletedTopics;
    });
    setOverallProgress(totalTopicsOverall === 0 ? 0 : Math.round((completedTopicsOverall / totalTopicsOverall) * 100));
  }, [clientRendered, parsedData, checkedTopics]);

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setSyllabusText(event.target.value);
    if (event.target.value.trim() !== '') {
        if (error) setError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!syllabusText.trim()) {
      setError('Please paste your syllabus text.');
      toast({ title: 'Input Error', description: 'Syllabus text cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    setError(null);
    setParsedData(null); // Clear previous results
    setSummaryData(null);
    setCheckedTopics({}); // Reset progress for new syllabus

    try {
      let parsedResult, summaryResult;
      try {
        parsedResult = await parseSyllabus({ syllabusText });
      } catch (aiError: any) {
        console.error("Error from parseSyllabus AI flow:", aiError);
        throw new Error(`Syllabus parsing failed: ${aiError.message || 'Unknown AI error during parsing'}.`);
      }
      try {
        summaryResult = await summarizeSyllabus({ syllabusText });
      } catch (aiError: any) {
        console.error("Error from summarizeSyllabus AI flow:", aiError);
        throw new Error(`Syllabus summarization failed: ${aiError.message || 'Unknown AI error during summarization'}.`);
      }
      
      setParsedData(parsedResult);
      setSummaryData(summaryResult);

      // TODO: If user is logged in, save parsedResult and summaryResult to Firestore
      if (user) {
        console.log("User logged in. Placeholder for saving new syllabus to Firestore.");
        // Example: saveSyllabusForUser(user.uid, { syllabusText, parsedResult, summaryResult });
      }

      toast({
        title: 'Syllabus Processed!',
        description: 'Your syllabus text has been parsed and summarized successfully.',
        variant: 'default',
      });

    } catch (processError: any) {
      console.error('Error during AI interaction:', processError);
      let userErrorMessage = processError.message || 'An unexpected error occurred. Please try again.';
      if (String(processError.message).toLowerCase().includes("unexpected token '%' in json") || String(processError.message).toLowerCase().includes("%pdf-")) {
        userErrorMessage = "The AI service returned unexpected data (possibly PDF content instead of JSON). This can happen with complex or malformed syllabus text. Please try simplifying your input or check if the AI models are processing it correctly.";
      } else if (processError.message?.includes('parsing failed') || processError.message?.includes('summarization failed')) {
         userErrorMessage = `An AI processing step failed. Details: ${processError.message}`;
      }
      setError(userErrorMessage);
      toast({ title: 'Processing Error', description: userErrorMessage, variant: 'destructive', duration: 10000 });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading && !clientRendered) { // Show loading indicator if auth is loading initially
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="syllabus-text" className="text-sm font-medium">Syllabus Text</Label>
          <Textarea
            id="syllabus-text"
            value={syllabusText}
            onChange={handleTextChange}
            placeholder="Paste your syllabus text here..."
            rows={10}
            className="mt-1 w-full border-input focus:ring-primary text-sm shadow-sm rounded-md p-2"
            disabled={isLoading}
            aria-label="Syllabus Text Input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Paste the full text of your syllabus into the area above.
          </p>
        </div>
        <Button type="submit" disabled={isLoading || !syllabusText.trim()} className="w-full sm:w-auto text-base py-3 px-6 shadow-md hover:shadow-lg transition-shadow duration-200">
          {isLoading ? (
            <> <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Text... </>
          ) : (
            <> <Edit3 className="mr-2 h-5 w-5" /> Parse Syllabus Text </>
          )}
        </Button>
      </form>

      {error && (
        <Alert variant="destructive" className="shadow-md">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {parsedData && summaryData && !isLoading && (
        <div className="mt-10 pt-6 border-t border-border space-y-8">
          <Card className="shadow-md bg-card/70 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-primary">Overall Syllabus Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summaryData.overallSyllabusSummary && (
                <CardDescription className="text-foreground/90 leading-relaxed">
                  {summaryData.overallSyllabusSummary}
                </CardDescription>
              )}
              {parsedData.subjects.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <Label htmlFor="overall-syllabus-progress" className="text-lg font-medium text-foreground/90">Overall Syllabus Progress</Label>
                    <span className="text-lg font-semibold text-accent-foreground">{overallProgress}%</span>
                  </div>
                  <Progress id="overall-syllabus-progress" value={overallProgress} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-green-400 rounded-full shadow-inner" aria-label={`Overall syllabus progress: ${overallProgress}%`} />
                </div>
              )}
            </CardContent>
          </Card>

          {parsedData.subjects.length === 0 && (
            <Alert>
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>No Subjects Found</AlertTitle>
              <AlertDescription>The AI could not identify distinct subjects in the provided text. The overall summary might still be useful.</AlertDescription>
            </Alert>
          )}

          {parsedData.subjects.length > 0 && (
            <Tabs defaultValue={parsedData.subjects[0].subject} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 h-auto p-1">
                {parsedData.subjects.map((subjectItem) => (
                  <TabsTrigger key={subjectItem.subject} value={subjectItem.subject} className="text-xs sm:text-sm whitespace-normal break-words h-auto py-2 px-2">
                    {subjectItem.subject}
                  </TabsTrigger>
                ))}
              </TabsList>
              {parsedData.subjects.map((subjectItem) => {
                const subjectDetailedSummary = summaryData.subjectsDetailedSummaries.find(
                  sds => sds.subjectName === subjectItem.subject
                );
                return (
                  <TabsContent key={subjectItem.subject} value={subjectItem.subject}>
                    {subjectDetailedSummary ? (
                      <SyllabusDisplay
                        subjectData={subjectItem}
                        subjectSummaryData={subjectDetailedSummary}
                        checkedTopics={checkedTopics}
                        handleToggleTopic={handleToggleTopic}
                      />
                    ) : (
                       <Alert variant="destructive">
                         <AlertTriangle className="h-5 w-5" />
                         <AlertTitle>Summary Not Found</AlertTitle>
                         <AlertDescription>Could not find the detailed summary for {subjectItem.subject}.</AlertDescription>
                       </Alert>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      )}
    </div>
  );
}
