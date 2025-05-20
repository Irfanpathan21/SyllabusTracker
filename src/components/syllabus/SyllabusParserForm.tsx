
'use client';

import { useState, useEffect, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Wand2, ArrowLeft, BookOpen, FileUp } from 'lucide-react';
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
    // Set workerSrc for pdf.js.
    // IMPORTANT: Ensure `pdf.worker.min.js` from `node_modules/pdfjs-dist/build/`
    // is copied to your `public/` folder.
    if (typeof window !== 'undefined') {
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
    setCheckedTopics({});

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result && e.target.result instanceof ArrayBuffer) {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: e.target.result }).promise;
          let fullText = '';
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            // Refined text extraction
            fullText += textContent.items
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
          
          const [parsedResult, summaryResult] = await Promise.all([
            parseSyllabus({ syllabusText: fullText }),
            summarizeSyllabus({ syllabusText: fullText })
          ]);
          
          setParsedData(parsedResult);
          setSummaryData(summaryResult);

          toast({
            title: 'Syllabus Processed!',
            description: 'Your syllabus PDF has been parsed and summarized successfully.',
            variant: 'default',
          });
        } catch (pdfError: any) {
          console.error('Error processing PDF:', pdfError);
          let errorMessage = 'Failed to process PDF. It might be corrupted, password-protected, or the PDF worker script is not loading correctly.';
          if (pdfError.message) {
            errorMessage = `PDF Processing Error: ${pdfError.message}. Check if 'pdf.worker.min.js' is in the public folder.`;
          }
          setError(errorMessage);
          toast({
            title: 'Error Processing PDF',
            description: errorMessage,
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
            Upload your syllabus PDF. Text will be extracted for processing. Ensure `pdf.worker.min.js` is in your public folder.
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

    