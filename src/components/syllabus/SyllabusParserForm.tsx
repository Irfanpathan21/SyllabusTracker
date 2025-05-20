
'use client';

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, ArrowLeft, BookOpen, FileUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseSyllabus, type ParseSyllabusOutput, type Subject } from '@/ai/flows/parse-syllabus';
import { summarizeSyllabus, type SummarizeSyllabusOutput, type SubjectSummary } from '@/ai/flows/summarize-syllabus';
import { SyllabusDisplay } from './SyllabusDisplay';
import * as pdfjsLib from 'pdfjs-dist';

export function SyllabusParserForm() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParseSyllabusOutput | null>(null);
  const [summaryData, setSummaryData] = useState<SummarizeSyllabusOutput | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const [selectedSubjectName, setSelectedSubjectName] = useState<string | null>(null);
  const [checkedTopics, setCheckedTopics] = useState<Record<string, boolean>>({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [clientRendered, setClientRendered] = useState(false);

  useEffect(() => {
    setClientRendered(true);
    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
      // pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
  }, []);

  const handleToggleTopic = (subjectName: string, unitName: string, topicName: string) => {
    const key = `${subjectName}::${unitName}::${topicName}`;
    setCheckedTopics((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const calculateSubjectProgress = (subjectItem: Subject, currentCheckedTopics: Record<string, boolean>): number => {
    if (!clientRendered) return 0;
    const totalTopics = subjectItem.units.reduce((sum, unit) => sum + unit.topics.length, 0);
    if (totalTopics === 0) return 0;
    const completedTopics = subjectItem.units.reduce((unitSum, unit) => {
      return unitSum + unit.topics.filter(topic => currentCheckedTopics[`${subjectItem.subject}::${unit.unit}::${topic}`]).length;
    }, 0);
    return Math.round((completedTopics / totalTopics) * 100);
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

    if (totalTopicsOverall === 0) {
      setOverallProgress(0);
    } else {
      setOverallProgress(Math.round((completedTopicsOverall / totalTopicsOverall) * 100));
    }
  }, [clientRendered, parsedData, checkedTopics]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/pdf") {
        setSelectedFile(file);
        if (error) setError(null);
      } else {
        setSelectedFile(null);
        setError("Please select a PDF file.");
        toast({
          title: 'Invalid File Type',
          description: 'Please select a PDF file.',
          variant: 'destructive',
        });
      }
    } else {
      setSelectedFile(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF file to upload.');
      toast({
        title: 'Input Error',
        description: 'No PDF file selected.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setSummaryData(null);
    setSelectedSubjectName(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result && e.target.result instanceof ArrayBuffer) {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: e.target.result }).promise;
          let fullText = '';
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            fullText += (textContent.items || [])
                .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
                .join(' ') + '\n';
          }

          if (!fullText.trim()) {
            setError('No text could be extracted from the PDF. It might be an image-based PDF or empty.');
            toast({
              title: 'Empty PDF Content',
              description: 'Could not extract any text from the PDF. Please ensure it is a text-based PDF.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }
          
          let parsedResult, summaryResult;
          try {
            parsedResult = await parseSyllabus({ syllabusText: fullText });
          } catch (aiError: any) {
            console.error("Error from parseSyllabus AI flow:", aiError);
            const message = aiError.message || 'Unknown AI error during parsing';
             throw new Error(`Syllabus parsing failed: ${message}`);
          }

          try {
            summaryResult = await summarizeSyllabus({ syllabusText: fullText });
          } catch (aiError: any) {
            console.error("Error from summarizeSyllabus AI flow:", aiError);
            const message = aiError.message || 'Unknown AI error during summarization';
            throw new Error(`Syllabus summarization failed: ${message}`);
          }
          
          setParsedData(parsedResult);
          setSummaryData(summaryResult);

          toast({
            title: 'Syllabus Processed!',
            description: 'Your syllabus PDF has been parsed and summarized successfully.',
            variant: 'default',
          });

        } catch (processError: any)
        {
          console.error('Error during PDF processing or AI interaction:', processError);
          let userErrorMessage = processError.message || 'An unexpected error occurred during processing. Please check the console for more details or try a different PDF.';
          
          if (typeof processError.message === 'string') {
            if (processError.message.toLowerCase().includes('password')) {
              userErrorMessage = 'The PDF appears to be password-protected. Please use a non-protected PDF.';
            } else if (processError.message.includes('workerSrc') || processError.message.includes('pdf.worker.min.js') || processError.message.includes('Failed to fetch dynamically imported module')) {
              userErrorMessage = 'Failed to load the PDF processing script (pdf.worker.min.js). This is very often a server configuration or permissions issue. Please ensure `pdf.worker.min.js` exists in your `public/` folder and your server can serve `.js` files from there (check for 403 Forbidden or 404 Not Found errors in the browser\'s Network tab for `pdf.worker.min.js`).';
            } else if (processError.message.includes('Unknown action from worker')) {
                 userErrorMessage = 'PDF processing failed due to an "Unknown action from worker" error. This strongly indicates that `pdf.worker.min.js` could not be loaded or initialized correctly. Please verify it is in your `public/` folder and that your server environment is serving it correctly (check for 403/404 errors for this file in the browser Network tab). This is likely a server configuration or deployment issue.';
            } else if (processError.name === 'MissingPDFException' || processError.name === 'InvalidPDFException') {
              userErrorMessage = 'The PDF file seems to be missing, invalid, or corrupted. Please try a different file.';
            } else if (processError instanceof SyntaxError && (processError.message.toLowerCase().includes("json") || processError.message.toLowerCase().includes("unexpected token") || processError.message.toLowerCase().includes("%pdf-"))) {
              console.error("Detailed SyntaxError (likely PDF content returned as JSON):", processError, "Raw response might have been non-JSON (e.g., PDF content).");
              userErrorMessage = "The AI service returned an unexpected response that was not valid JSON; it appears to be PDF content. This can occur if the PDF is very complex or triggers an unhandled error on the server during AI processing. Please try a different PDF, or check server logs and the browser's Network tab for specific details on the AI service's response.";
            } else if (processError.message.includes('parsing failed') || processError.message.includes('summarization failed')) {
               userErrorMessage = `An AI processing step failed. This could be due to the content of the PDF. Details: ${processError.message}`;
            }
          }
          
          setError(userErrorMessage);
          toast({
            title: 'Processing Error',
            description: userErrorMessage,
            variant: 'destructive',
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setError('Failed to read PDF file content. The file might be corrupted.');
        toast({
            title: 'File Reading Error',
            description: 'Could not read the selected file content.',
            variant: 'destructive',
        });
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      console.error('File reading error.');
      setError('Failed to read the file. An unexpected error occurred.');
      toast({
        title: 'File Reading Error',
        description: 'An error occurred while trying to read the file.',
        variant: 'destructive',
      });
      setIsLoading(false);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const selectedSubjectData: Subject | undefined = useMemo(() => {
    if (!selectedSubjectName || !parsedData) return undefined;
    return parsedData.subjects.find(s => s.subject === selectedSubjectName);
  }, [selectedSubjectName, parsedData]);

  const selectedSubjectSummaryData: SubjectSummary | undefined = useMemo(() => {
    if (!selectedSubjectName || !summaryData) return undefined;
    return summaryData.subjectsDetailedSummaries.find(sds => sds.subjectName === selectedSubjectName);
  }, [selectedSubjectName, summaryData]);


  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="syllabus-upload" className="text-sm font-medium">Syllabus PDF</Label>
          <div className="mt-1 flex items-center space-x-2">
            <Input
              id="syllabus-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="flex-grow border-input focus:ring-primary text-sm shadow-sm rounded-md p-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              disabled={isLoading}
              aria-label="Syllabus PDF Upload"
            />
          </div>
           {selectedFile && <p className="text-xs text-muted-foreground mt-1">Selected: {selectedFile.name}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            Upload your syllabus PDF. Crucial: `pdf.worker.min.js` must be in your `public/` folder and correctly served.
          </p>
        </div>
        <Button type="submit" disabled={isLoading || !selectedFile} className="w-full sm:w-auto text-base py-3 px-6 shadow-md hover:shadow-lg transition-shadow duration-200">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing PDF...
            </>
          ) : (
            <>
              <FileUp className="mr-2 h-5 w-5" />
              Parse Syllabus PDF
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

          {selectedSubjectName && selectedSubjectData && selectedSubjectSummaryData ? (
            <div>
              <Button onClick={() => setSelectedSubjectName(null)} variant="outline" className="mb-6 shadow-sm hover:shadow-md transition-shadow">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to All Subjects
              </Button>
              <SyllabusDisplay
                subjectData={selectedSubjectData}
                subjectSummaryData={selectedSubjectSummaryData}
                checkedTopics={checkedTopics}
                handleToggleTopic={handleToggleTopic}
              />
            </div>
          ) : (
            <>
              {parsedData.subjects.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle>No Subjects Found</AlertTitle>
                  <AlertDescription>The AI could not identify distinct subjects in the provided text. The overall summary might still be useful.</AlertDescription>
                </Alert>
              )}
              {parsedData.subjects.length > 0 && (
                <div>
                  <h2 className="text-2xl font-semibold text-primary mb-4">Subjects Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {parsedData.subjects.map((subjectItem) => {
                      const subjectProgress = calculateSubjectProgress(subjectItem, checkedTopics);
                      const subjectDetailedSummary = summaryData.subjectsDetailedSummaries.find(
                        sds => sds.subjectName === subjectItem.subject
                      );

                      return (
                        <Card
                          key={subjectItem.subject}
                          onClick={() => setSelectedSubjectName(subjectItem.subject)}
                          className="cursor-pointer hover:shadow-xl hover:border-accent transition-all duration-200 ease-in-out transform hover:-translate-y-1 bg-card/80 backdrop-blur-sm border-border/50"
                        >
                          <CardHeader>
                            <div className="flex items-center gap-3">
                                <BookOpen className="h-7 w-7 text-primary"/>
                                <CardTitle className="text-xl font-semibold text-primary">{subjectItem.subject}</CardTitle>
                            </div>
                            {subjectDetailedSummary?.subjectSummary && (
                                <CardDescription className="text-xs text-foreground/80 pt-1 line-clamp-2">
                                    {subjectDetailedSummary.subjectSummary}
                                </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <Progress value={subjectProgress} className="w-full h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-primary/70 [&>div]:to-primary shadow-inner" aria-label={`Progress for ${subjectItem.subject}: ${subjectProgress}%`} />
                            <p className="text-sm font-medium text-muted-foreground text-right">{subjectProgress}% Complete</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
    
