import { SyllabusParserForm } from '@/components/syllabus/SyllabusParserForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-primary/20">
        <CardHeader>
          <CardTitle className="text-3xl font-semibold tracking-tight text-primary">Welcome to SyllabusPilot</CardTitle>
          <CardDescription className="text-lg text-foreground/80 pt-1">
            Paste your syllabus text below to get started. We'll help you organize it and track your progress.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SyllabusParserForm />
        </CardContent>
      </Card>
    </div>
  );
}
