
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Subject } from '@/ai/flows/parse-syllabus';
import type { SubjectSummary } from '@/ai/flows/summarize-syllabus';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Info, CheckCircle2, Circle, BookOpen, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


type Unit = Subject['units'][0];

interface SyllabusDisplayProps {
  subjectData: Subject;
  subjectSummaryData: SubjectSummary;
  checkedTopics: Record<string, boolean>;
  handleToggleTopic: (subjectName: string, unitName: string, topicName: string) => void;
}

export function SyllabusDisplay({ subjectData, subjectSummaryData, checkedTopics, handleToggleTopic }: SyllabusDisplayProps) {
  const [clientRendered, setClientRendered] = useState(false);
  const [activeAccordionItems, setActiveAccordionItems] = useState<string[]>([]);

  useEffect(() => {
    setClientRendered(true);
    // Initialize accordion items to be open if subjectData.units exists
    if (subjectData && subjectData.units) {
      setActiveAccordionItems(subjectData.units.map(u => u.unit));
    }
  }, [subjectData]);


  const totalTopicsCount = useMemo(() => {
    if (!subjectData || !subjectData.units) return 0;
    return subjectData.units.reduce((sum, unit) => sum + unit.topics.length, 0);
  }, [subjectData]);

  const completedTopicsCount = useMemo(() => {
    if (!subjectData || !subjectData.units) return 0;
    let count = 0;
    subjectData.units.forEach(unit => {
        unit.topics.forEach(topic => {
            if (checkedTopics[`${subjectData.subject}::${unit.unit}::${topic}`]) {
                count++;
            }
        });
    });
    return count;
  }, [checkedTopics, subjectData]);

  const subjectProgress = useMemo(() => {
    if (!clientRendered || totalTopicsCount === 0) return 0;
    return Math.round((completedTopicsCount / totalTopicsCount) * 100);
  }, [clientRendered, completedTopicsCount, totalTopicsCount]);

  const calculateUnitProgress = (unit: Unit) => {
    if (!clientRendered || unit.topics.length === 0 || !subjectData) return 0;
    const completedInUnit = unit.topics.filter(topic => checkedTopics[`${subjectData.subject}::${unit.unit}::${topic}`]).length;
    return Math.round((completedInUnit / unit.topics.length) * 100);
  };
  
  if (!clientRendered && !subjectData) { 
    return (
      <Card className="shadow-lg mt-6 animate-pulse">
        <CardHeader>
          <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6 mt-1"></div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-6 bg-muted rounded w-full"></div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="p-4 border border-muted rounded-lg">
                <div className="h-6 bg-muted rounded w-1/2 mb-3"></div>
                <div className="h-4 bg-muted rounded w-1/4 mb-3"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subjectData) { 
      return (
        <Alert variant="destructive">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Subject data is not available. Please try again.</AlertDescription>
        </Alert>
      );
  }


  return (
    <Card className="shadow-xl border-primary/30 transition-all duration-500 ease-in-out mt-6 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-10 w-10 text-primary" />
            <CardTitle className="text-3xl md:text-4xl font-bold text-primary tracking-tight">{subjectData.subject}</CardTitle>
        </div>
        {subjectSummaryData?.subjectSummary && (
           <CardDescription className="text-md text-foreground/90 pt-2 prose prose-sm max-w-none leading-relaxed">
             <strong className="font-semibold">Subject Summary:</strong> {subjectSummaryData.subjectSummary}
           </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-8 pt-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <Label htmlFor={`subject-progress-${subjectData.subject}`} className="text-lg font-medium text-foreground/90">Progress for {subjectData.subject}</Label>
            <span className="text-lg font-semibold text-accent-foreground">{subjectProgress}%</span>
          </div>
          <Progress id={`subject-progress-${subjectData.subject}`} value={subjectProgress} className="w-full h-3 [&>div]:bg-gradient-to-r [&>div]:from-accent [&>div]:to-green-400 rounded-full shadow-inner" aria-label={`Progress for ${subjectData.subject}: ${subjectProgress}%`} />
        </div>

        <Accordion type="multiple" value={activeAccordionItems} onValueChange={setActiveAccordionItems} className="w-full space-y-4">
          {subjectData.units.map((unit) => {
            const unitProgress = calculateUnitProgress(unit);
            return (
              <AccordionItem value={unit.unit} key={`${subjectData.subject}-${unit.unit}`} className="border border-border/70 rounded-lg shadow-md bg-background/70 overflow-hidden transition-shadow hover:shadow-lg">
                <AccordionTrigger className="px-4 py-3 sm:px-6 sm:py-4 hover:bg-secondary/30 transition-colors data-[state=open]:bg-secondary/20">
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between text-left gap-2 sm:gap-4">
                    <span className="text-xl font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-md shadow-sm inline-block max-w-max">
                      {unit.unit}
                    </span>
                    <div className="w-full sm:max-w-xs lg:max-w-sm mt-2 sm:mt-0">
                       <div className="flex justify-between items-center text-xs mb-0.5 text-muted-foreground">
                         <span>Unit Progress</span>
                         <span>{unitProgress}%</span>
                       </div>
                      <Progress value={unitProgress} className="h-2.5 rounded-full [&>div]:bg-gradient-to-r [&>div]:from-primary/70 [&>div]:to-primary" aria-label={`Progress for ${unit.unit}: ${unitProgress}%`} />
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 py-3 sm:px-6 sm:py-4 border-t border-border/50 bg-background/30">
                  {unit.topics.length > 0 ? (
                    <ul className="space-y-3">
                      {unit.topics.map((topic) => {
                        const topicKey = `${subjectData.subject}::${unit.unit}::${topic}`;
                        const isChecked = !!checkedTopics[topicKey];
                        const topicSummaryPair = subjectSummaryData?.topicSummaries.find(ts => ts.topicName === topic);
                        const topicSummaryText = topicSummaryPair ? topicSummaryPair.summary : undefined;
                        return (
                          <li key={topicKey} className="flex items-center space-x-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors group">
                            <Checkbox
                              id={topicKey}
                              checked={isChecked}
                              onCheckedChange={() => handleToggleTopic(subjectData.subject, unit.unit, topic)}
                              aria-labelledby={`${topicKey}-label`}
                              className="border-primary/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent-foreground"
                            />
                            <Label htmlFor={topicKey} id={`${topicKey}-label`} className={`flex-1 text-sm cursor-pointer ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground/90'}`}>
                              {topic}
                            </Label>
                            {topicSummaryText && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary rounded-full">
                                    <Info className="h-4 w-4" />
                                    <span className="sr-only">More info about {topic}</span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 shadow-xl p-4 bg-popover border-border rounded-lg">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold leading-none text-primary">{topic}</h4>
                                    <p className="text-sm text-popover-foreground/80 leading-relaxed">
                                      {topicSummaryText}
                                    </p>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {isChecked ? <CheckCircle2 className="h-5 w-5 text-accent transition-transform group-hover:scale-110" /> : <Circle className="h-5 w-5 text-muted-foreground/30 transition-transform group-hover:scale-110" />}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-2">No topics listed for this unit.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}

