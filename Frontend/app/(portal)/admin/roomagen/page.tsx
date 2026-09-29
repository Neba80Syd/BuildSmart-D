'use client';

import React from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  StatCard,
  StatusPill,
  Skeleton,
} from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';

export default function AdminRoomagenPage() {
  const { data, loading, refetch } = useApi<any>('/api/admin/roomagen');

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-6">
        <PageHeader title="Roomagen AI Monitoring" subtitle="Platform-wide floor plan generation and visual synthesis telemetry" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.data?.metrics || {
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    pending: 0,
    successRate: 100,
  };

  const toolStats = data?.data?.toolStats || {};
  const recentJobs: any[] = data?.data?.recentJobs || [];
  const provider = data?.data?.provider || 'roomagen';
  const hasKey = data?.data?.hasKeyConfigured;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="Roomagen AI Monitoring"
        subtitle="Platform-wide floor plan generation, 3D visualization, and provider health."
        crumbs={['Admin', 'AI & Intelligence', 'Roomagen']}
        actions={
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold border ${
                hasKey
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {hasKey ? 'Live API Key Active' : 'Mock Dev Mode Active'}
            </span>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high dark:hover:bg-surface-variant"
              title="Refresh Telemetry"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="auto_awesome"
          label="Total Generations"
          value={String(metrics.total)}
          meta={`Mode: ${provider.toUpperCase()}`}
          tone="default"
        />
        <StatCard
          icon="check_circle"
          label="Completed"
          value={String(metrics.completed)}
          meta={`${metrics.successRate}% Success Rate`}
          tone="green"
        />
        <StatCard
          icon="pending"
          label="Processing / Active"
          value={String(metrics.processing + metrics.pending)}
          meta="Currently synthesizing"
          tone="amber"
        />
        <StatCard
          icon="error"
          label="Failed Generations"
          value={String(metrics.failed)}
          meta="Network / Provider rejections"
          tone={metrics.failed > 0 ? 'red' : 'default'}
        />
      </div>

      {/* Tool Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card pad={true} className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[28px]">floor</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Sketch → 2D Floor Plan</p>
            <p className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
              {toolStats.SKETCH_TO_FLOOR_PLAN || 0}
            </p>
          </div>
        </Card>

        <Card pad={true} className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <span className="material-symbols-outlined text-[28px]">view_in_ar</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Floor Plan → 3D Scene</p>
            <p className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
              {toolStats.FLOOR_PLAN_TO_3D || 0}
            </p>
          </div>
        </Card>

        <Card pad={true} className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <span className="material-symbols-outlined text-[28px]">palette</span>
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant">Plan Colorization</p>
            <p className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface">
              {toolStats.FLOOR_PLAN_COLORIZE || 0}
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Generations Table */}
      <Card pad={true} className="space-y-4">
        <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">
          Recent Generation Activity
        </h3>

        {recentJobs.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant py-8 text-center">
            No Roomagen generation jobs recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead className="border-b border-outline-variant text-label-sm text-on-surface-variant uppercase">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Tool</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant/40">
                    <td className="py-2.5 px-3 font-mono text-[12px] text-on-surface-variant truncate max-w-[140px]">
                      {job.roomagenJobId || job.id}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-on-surface dark:text-inverse-on-surface">
                      {job.tool.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusPill status={job.status} />
                    </td>
                    <td className="py-2.5 px-3 text-label-sm font-semibold">
                      v{job.version}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant truncate max-w-[150px]">
                      {job.projectId || 'None'}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant">
                      {job.userId}
                    </td>
                    <td className="py-2.5 px-3 text-on-surface-variant text-[12px]">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
