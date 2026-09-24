'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Skeleton } from '@/Frontend/components/architect/ui';
import RoomagenDeveloperConsole from '@/Frontend/components/roomagen/RoomagenDeveloperConsole';
import { Palette, Terminal } from 'lucide-react';

function RoomagenDeveloperPageContent() {
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project') || undefined;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Roomagen Developer Interface"
          subtitle="Interactive API console, chained transformation pipelines, webhook simulator, and architectural schema catalog."
          crumbs={['Architect', 'Design Studio', 'Roomagen Developer']}
        />

        {/* Studio Switcher Link */}
        <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs">
          <Link
            href={preselectedProject ? `/architect/floor-plan-studio?project=${preselectedProject}` : '/architect/floor-plan-studio'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <Palette className="w-3.5 h-3.5" />
            Visual Studio
          </Link>
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
            <Terminal className="w-3.5 h-3.5" />
            Developer Console
          </span>
        </div>
      </div>

      <RoomagenDeveloperConsole initialProjectId={preselectedProject} />
    </div>
  );
}

export default function RoomagenDeveloperPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-[1600px] mx-auto space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      }
    >
      <RoomagenDeveloperPageContent />
    </Suspense>
  );
}
