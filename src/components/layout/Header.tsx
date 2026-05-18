'use client';

import { Bell, Search, Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/tests': 'API Tests',
  '/workflows': 'Workflows',
  '/environments': 'Environments',
  '/reports': 'Reports',
  '/monitoring': 'Live Monitoring',
  '/schedules': 'Schedules',
};

export function Header() {
  const pathname = usePathname();
  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] || 'Dashboard';

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-4 flex-shrink-0">
      <h1 className="font-semibold text-sm flex-1">{title}</h1>

      <div className="flex items-center gap-1 bg-secondary rounded-lg px-3 py-1.5 flex-1 max-w-xs">
        <Search className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          placeholder="Search tests, workflows..."
          className="bg-transparent text-xs outline-none flex-1 placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/tests/new"
          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Test
        </Link>

        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground relative">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
      </div>
    </header>
  );
}
