'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type TopBarProps = {
  name: string;
  variant?: 'search' | 'title';
};

export function TopBar({ name, variant = 'title' }: TopBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-[#FAFAF8] dark:bg-[#17201e] border-b border-outline-variant dark:border-outline flex items-center justify-between px-margin-mobile md:px-margin-desktop">
      <div className="flex items-center gap-4 min-w-0">
        {variant === 'search' ? (
          <form onSubmit={submitSearch} className="relative focus-within:ring-2 focus-within:ring-primary/10 rounded-lg">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant text-[20px]">search</span>
            <input
              className="pl-10 pr-4 py-2 bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg text-body-sm focus:border-primary focus:ring-0 w-48 md:w-64 outline-none dark:text-on-surface"
              placeholder="Search projects, clients..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
        ) : (
          <span className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">BuildSmart AI</span>
        )}

        <div className="hidden md:flex items-center gap-6">
          <span className="h-4 w-px bg-outline-variant" />
          <Link className="text-label-md text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors" href="/projects">
            Projects
          </Link>
          <Link className="text-label-md text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim transition-colors" href="/documents">
            Archive
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <Link className="text-label-md text-primary dark:text-primary-fixed-dim px-4 py-1.5 border border-primary dark:border-primary-fixed-dim rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors" href="/subscription">
          Upgrade
        </Link>
        <div className="hidden md:flex items-center gap-1 text-on-surface-variant dark:text-surface-variant">
          <Link href="/notifications" className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </Link>
          <Link href="/profile" className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">apps</span>
          </Link>
        </div>
        <Link href="/profile" className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold">
          {initials}
        </Link>
      </div>
    </header>
  );
}
