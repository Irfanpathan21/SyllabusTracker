
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
  const [syllabusTextContent, setSyllabusTextContent] = useState<string | null>(null);


  useEffect(() => {
    setClientRendered(true);
    if (typeof window !== 'undefined') {
      // Ensure this path correctly points to the worker script in your public folder
      pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.js`;
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
        setParsedData(null); // Reset previous results
        setSummaryData(null);
        setSelectedSubjectName(null);
        setSyllabusTextContent(null); // Reset text content
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
    setSyllabusTextContent(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result && e.target.result instanceof ArrayBuffer) {
        let extractedText = '';
        try {
          console.log('Attempting to load PDF worker from:', pdfjsLib.GlobalWorkerOptions.workerSrc);
          const pdfDoc = await pdfjsLib.getDocument({ data: e.target.result }).promise;
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            extractedText += (textContent.items || [])
                .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
                .join(' ') + '\n';
          }

          if (!extractedText.trim()) {
            setError('No text could be extracted from the PDF. It might be an image-based PDF, empty, or too complex for text extraction.');
            toast({
              title: 'Empty PDF Content',
              description: 'Could not extract any text from the PDF. Please ensure it is a text-based PDF.',
              variant: 'destructive',
            });
            setIsLoading(false);
            return;
          }
          setSyllabusTextContent(extractedText); // Store extracted text

          // Call AI flows
          let parsedResult, summaryResult;
          try {
            parsedResult = await parseSyllabus({ syllabusText: extractedText });
          } catch (aiError: any) {
            console.error("Error from parseSyllabus AI flow:", aiError);
            const message = aiError.message || 'Unknown AI error during parsing';
            throw new Error(`Syllabus parsing failed: ${message}. This could be due to the PDF content complexity or an issue with the AI model's response.`);
          }

          try {
            summaryResult = await summarizeSyllabus({ syllabusText: extractedText });
          } catch (aiError: any) {
            console.error("Error from summarizeSyllabus AI flow:", aiError);
            const message = aiError.message || 'Unknown AI error during summarization';
            throw new Error(`Syllabus summarization failed: ${message}. This could be due to the PDF content complexity or an issue with the AI model's response.`);
          }
          
          setParsedData(parsedResult);
          setSummaryData(summaryResult);

          toast({
            title: 'Syllabus Processed!',
            description: 'Your syllabus PDF has been parsed and summarized successfully.',
            variant: 'default',
          });

        } catch (processError: any) {
          console.error('Error during PDF processing or AI interaction:', processError);
          let userErrorMessage = processError.message || 'An unexpected error occurred during processing. Please try a different PDF or check the console.';
          
          const errStr = String(processError.message).toLowerCase();
          const nameStr = String(processError.name).toLowerCase();

          if (errStr.includes('worker') || errStr.includes('pdf.worker.min.js') || nameStr.includes('worker')) {
            userErrorMessage = 'PDF Processing Error: Failed to load or use the PDF worker script (`pdf.worker.min.js`). This is critical for reading PDFs. '+
                               'Please take these steps: \n1. Verify `pdf.worker.min.js` is in your `public/` folder. \n2. Open your browser\'s Developer Tools (Network tab), try uploading again, and check the request for `/pdf.worker.min.js`. Is its status 200 OK? If it\'s 403 (Forbidden), 404 (Not Found), or another error, your server is not serving this file correctly. This is a server configuration issue that must be fixed in your deployment environment (e.g., Cloud Workstations).';
          } else if (nameStr === 'missingpdfexception' || nameStr === 'invalidpdfexception' || errStr.includes('invalid pdf') ) {
            userErrorMessage = 'The PDF file seems to be missing, invalid, or corrupted. Please try a different file.';
          } else if (processError instanceof SyntaxError && (errStr.includes("json") || errStr.includes("unexpected token")) && extractedText && extractedText.trim().startsWith('%PDF-')) {
            console.error("Detailed SyntaxError (likely PDF content returned as JSON from AI):", processError);
            userErrorMessage = "An AI service returned an unexpected response that was not valid JSON; it may have returned PDF content. This can occur if the PDF is very complex or triggers an unhandled error on the server during AI processing. Please try a different PDF, or check server logs and the browser's Network tab for specific details on the AI service's response.";
          } else if (errStr.includes('parsing failed') || errStr.includes('summarization failed')) {
             userErrorMessage = `An AI processing step failed. This could be due to the content of the PDF. Details: ${processError.message}`;
          } else if (errStr.includes('password')) {
            userErrorMessage = 'The PDF appears to be password-protected. Please use a non-protected PDF.';
          }
          
          setError(userErrorMessage);
          toast({
            title: 'Processing Error',
            description: userErrorMessage,
            variant: 'destructive',
            duration: 15000, // Keep this important message visible longer
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        setError('Failed to read PDF file content. The file might be corrupted or not a valid ArrayBuffer.');
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
      setError('Failed to read the file. An unexpected error occurred during file reading.');
      toast({
        title: 'File Reading Error',
        description: 'An error occurred while trying to read the file. Check browser console for details.',
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
            Upload your syllabus PDF. The file `pdf.worker.min.js` must be in your `public/` folder and correctly served by your server for this to work.
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
    

    