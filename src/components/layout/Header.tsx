import Link from 'next/link';
import { BookMarked } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
          <BookMarked className="h-7 w-7" />
          <h1 className="text-2xl font-bold tracking-tight">SyllabusPilot</h1>
        </Link>
        {/* Future navigation items can go here */}
      </div>
    </header>
  );
}
