'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, StatCard, StatusPill, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { money, timeAgo, fmtDate } from '@/Frontend/components/admin/shared';

function Bars({ data, color = 'bg-primary-container', height = 140, valuePrefix = '', valueSuffix = '' }: { data: { label: string; value: number }[]; color?: string; height?: number; valuePrefix?: string; valueSuffix?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: ${d.value}`}>
          <span className="text-[10px] text-on-surface-variant dark:text-surface-variant mb-1 truncate">{d.value > 0 ? `${valuePrefix}${d.value}${valueSuffix}` : ''}</span>
          <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, opacity: d.value > 0 ? 1 : 0.15 }} />
          <span className="text-[10px] text-on-surface-variant dark:text-surface-variant mt-1 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const QUICK = [
  { icon: 'fact_check', label: 'Review Verifications', href: '/admin/verification' },
  { icon: 'group', label: 'Manage Users', href: '/admin/users' },
  { icon: 'flag', label: 'Moderate Reports', href: '/admin/reports' },
  { icon: 'support_agent', label: 'Answer Tickets', href: '/admin/support' },
  { icon: 'shield', label: 'Security Center', href: '/admin/security' },
  { icon: 'article', label: 'Publish Content', href: '/admin/content' },
];

export default function AdminDashboardPage() {
  const dash = useApi<any>('/api/admin/dashboard');
  const header = useApi<any>('/api/admin/header');

  if (dash.loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <PageHeader title="Admin Dashboard" subtitle="Platform overview and governance" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (dash.error || !dash.data) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <PageHeader title="Admin Dashboard" />
        <Card className="text-center py-12">
          <p className="text-body-md text-error dark:text-red-300">Failed to load dashboard data.</p>
        </Card>
      </div>
    );
  }

  const { kpis, charts, recentActivity, notifications, verificationPending } = dash.data;
  const badges = header.data ?? {};

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Governance overview across the entire platform"
        crumbs={['Admin', 'Overview']}
        actions={
          <Link href="/admin/audit" className="bg-primary-container text-white text-label-md px-4 py-2 rounded-lg hover:bg-[#264B3E] transition-colors inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">receipt</span>
            Audit Logs
          </Link>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="group" label="Total Users" value={String(kpis.totalUsers)} meta={`${kpis.activeUsers} active this week`} />
        <StatCard icon="payments" label="Revenue" value={money(kpis.revenue)} meta={`${kpis.pendingPayments} invoices pending`} tone="green" />
        <StatCard icon="architecture" label="Active Projects" value={String(kpis.activeProjects)} meta={`${kpis.orders} marketplace orders`} />
        <StatCard icon="verified" label="Pending Verification" value={String(kpis.pendingVerifications)} meta={`${kpis.openReports} open reports`} tone={kpis.pendingVerifications ? 'amber' : 'green'} />
      </div>

      {/* Alerts strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Verifications', value: badges.pendingVerifications, href: '/admin/verification', icon: 'fact_check', tone: 'amber' },
          { label: 'Open Tickets', value: badges.openTickets, href: '/admin/support', icon: 'support_agent', tone: 'blue' },
          { label: 'Open Reports', value: badges.openReports, href: '/admin/reports', icon: 'flag', tone: 'red' },
          { label: 'Security Alerts', value: badges.securityAlerts, href: '/admin/security', icon: 'shield', tone: 'red' },
          { label: 'Unread Alerts', value: badges.unreadNotifications, href: '/admin/notifications', icon: 'notifications', tone: 'gray' },
        ].map((a) => (
          <Link key={a.label} href={a.href} className="bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-xl p-4 hover:border-primary transition-colors">
            <div className="flex items-center justify-between">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant">{a.icon}</span>
              <span className="text-display font-bold text-on-surface dark:text-inverse-on-surface">{a.value ?? 0}</span>
            </div>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-2">{a.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">User Growth</h2>
            <Bars data={charts.userGrowth ?? []} />
          </Card>
          <Card>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Revenue</h2>
            <Bars data={charts.revenue ?? []} color="bg-[#2F6B50]" />
          </Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Users by Role</h2>
              <div className="space-y-2">
                {(charts.userRoles ?? []).map((r: any) => (
                  <div key={r.label} className="flex items-center justify-between text-body-sm">
                    <span className="text-on-surface-variant dark:text-surface-variant capitalize">{r.label.toLowerCase()}</span>
                    <span className="font-semibold text-on-surface dark:text-inverse-on-surface">{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Orders by Status</h2>
              <div className="space-y-2">
                {(charts.orderStatus ?? []).map((r: any) => (
                  <div key={r.label} className="flex items-center justify-between text-body-sm">
                    <StatusPill status={r.label} />
                    <span className="font-semibold text-on-surface dark:text-inverse-on-surface">{r.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK.map((q) => (
                <Link key={q.label} href={q.href} className="flex flex-col items-center gap-1 p-3 rounded-lg border border-outline-variant dark:border-outline hover:border-primary hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors text-center">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">{q.icon}</span>
                  <span className="text-label-md text-on-surface dark:text-inverse-on-surface leading-tight">{q.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          <Card pad={false}>
            <div className="px-6 py-4 border-b border-outline-variant dark:border-outline flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">Recent Activity</h2>
              <Link href="/admin/activity" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-outline-variant dark:divide-outline max-h-[420px] overflow-y-auto">
              {(recentActivity ?? []).map((a: any) => (
                <div key={a.id} className="px-6 py-3">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-[20px] mt-0.5 text-on-surface-variant dark:text-surface-variant">
                      {a.kind === 'security' ? 'shield' : a.kind === 'audit' ? 'receipt' : 'history'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-body-sm font-medium text-on-surface dark:text-inverse-on-surface truncate">{a.title}</p>
                      {a.body && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">{a.body}</p>}
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-0.5">{timeAgo(a.at)}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(recentActivity ?? []).length === 0 && <p className="px-6 py-6 text-body-sm text-on-surface-variant dark:text-surface-variant">No activity yet.</p>}
            </div>
          </Card>

          <Card pad={false}>
            <div className="px-6 py-4 border-b border-outline-variant dark:border-outline flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">Notifications</h2>
              <Link href="/admin/notifications" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">All</Link>
            </div>
            <div className="divide-y divide-outline-variant dark:divide-outline">
              {(notifications ?? []).map((n: any) => (
                <div key={n.id} className="px-6 py-3">
                  <p className="text-body-sm font-medium text-on-surface dark:text-inverse-on-surface">{n.title}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{timeAgo(n.createdAt)}</p>
                </div>
              ))}
              {(notifications ?? []).length === 0 && <p className="px-6 py-6 text-body-sm text-on-surface-variant dark:text-surface-variant">You&apos;re all caught up.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
