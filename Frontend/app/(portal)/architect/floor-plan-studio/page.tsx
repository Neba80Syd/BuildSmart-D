'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { FloorPlanStudio } from '@/Frontend/components/roomagen/FloorPlanStudio';

function FloorPlanStudioContent() {
  const searchParams = useSearchParams();
  const preselectedProject = searchParams.get('project') || undefined;

  const { data, loading } = useApi<{ projects: any[] }>('/api/architect/projects');
  const projects = data?.projects || [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1500px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Floor Plan Studio"
          subtitle="AI-assisted architectural floor plan generation, 3D visualization, and colorization powered by Roomagen."
          crumbs={['Architect', 'Design Studio', 'Floor Plan Studio']}
        />

        {/* Studio / Dev Switcher */}
        <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs self-start md:self-auto">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            Visual Studio
          </span>
          <Link
            href={preselectedProject ? `/architect/roomagen-developer?project=${preselectedProject}` : '/architect/roomagen-developer'}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Developer Console
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96" />
            <Skeleton className="h-96 lg:col-span-2" />
          </div>
        </div>
      ) : (
        <FloorPlanStudio
          projects={projects}
          initialProjectId={preselectedProject}
        />
      )}
    </div>
  );
}

export default function ArchitectFloorPlanStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="p-margin-mobile md:p-margin-desktop max-w-[1500px] mx-auto space-y-6">
          <Skeleton className="h-14 w-full" />
        </div>
      }
    >
      <FloorPlanStudioContent />
    </Suspense>
  );
}
