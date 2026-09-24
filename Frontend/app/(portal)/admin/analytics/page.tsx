'use client';

import { useState } from 'react';
import { PageHeader, Card, StatCard, Tabs, StatusPill } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { money } from '@/Frontend/components/admin/shared';

function Bars({ data, color = 'bg-primary-container', height = 160 }: { data: { label: string; value: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: ${d.value}`}>
          <div className={`w-full ${color} rounded-t`} style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, opacity: d.value > 0 ? 1 : 0.15 }} />
          <span className="text-[10px] text-on-surface-variant dark:text-surface-variant mt-1 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiGrid({ kpis, prefix = '' }: { kpis: Record<string, number>; prefix?: string }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Object.entries(kpis).map(([k, v]) => (
        <Card key={k} className="p-4">
          <p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wide">{k.replace(/([A-Z])/g, ' $1')}</p>
          <p className="text-display leading-tight text-on-surface dark:text-inverse-on-surface">{prefix}{Math.round(v ?? 0).toLocaleString()}</p>
        </Card>
      ))}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState(90);
  const [tab, setTab] = useState('platform');
  const { data, loading, error } = useApi<any>(`/api/admin/analytics?range=${range}`);
  const d = data;

  const tabs = [
    { key: 'platform', label: 'Platform', icon: 'insights' },
    { key: 'users', label: 'Users', icon: 'group' },
    { key: 'projects', label: 'Projects', icon: 'architecture' },
    { key: 'marketplace', label: 'Marketplace', icon: 'storefront' },
    { key: 'revenue', label: 'Revenue', icon: 'payments' },
  ];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Platform Analytics"
        subtitle="Operational analytics across all modules"
        crumbs={['Admin', 'Analytics']}
        actions={
          <div className="flex gap-2">
            {[30, 90, 365].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-2 rounded-lg text-label-md border ${range === r ? 'bg-primary-container text-white border-primary-container' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>
                {r === 365 ? '1Y' : `${r}d`}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load analytics.</p></Card>
      ) : loading || !d ? (
        <Card><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p></Card>
      ) : (
        <>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />
          <div className="mt-6 space-y-6">
            {tab === 'platform' && (
              <>
                <KpiGrid kpis={d.platform.kpis} prefix="" />
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">New users</h2><Bars data={d.platform.series} /></Card>
              </>
            )}
            {tab === 'users' && (
              <>
                <KpiGrid kpis={{ totalUsers: d.platform.kpis.totalUsers, activeUsers: d.platform.kpis.activeUsers, newUsers: d.platform.kpis.newUsers, retention: d.platform.kpis.retention }} prefix="" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">By role</h2><div className="space-y-2">{(d.users.byRole ?? []).map((r: any) => <div key={r.label} className="flex justify-between text-body-sm"><span className="capitalize text-on-surface-variant dark:text-surface-variant">{r.label.toLowerCase()}</span><span className="font-semibold">{r.value}</span></div>)}</div></Card>
                  <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">By status</h2><div className="space-y-2">{(d.users.byStatus ?? []).map((r: any) => <div key={r.label} className="flex justify-between text-body-sm"><span className="capitalize text-on-surface-variant dark:text-surface-variant">{r.label.toLowerCase()}</span><span className="font-semibold">{r.value}</span></div>)}</div></Card>
                </div>
              </>
            )}
            {tab === 'projects' && (
              <>
                <KpiGrid kpis={d.projects.kpis} prefix="" />
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">New projects</h2><Bars data={d.projects.series} /></Card>
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">By status</h2><div className="space-y-2">{(d.projects.byStatus ?? []).map((r: any) => <div key={r.label} className="flex items-center justify-between text-body-sm"><StatusPill status={r.label} /><span className="font-semibold">{r.value}</span></div>)}</div></Card>
              </>
            )}
            {tab === 'marketplace' && (
              <>
                <KpiGrid kpis={d.marketplace.kpis} prefix="" />
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Orders over time</h2><Bars data={d.marketplace.series} color="bg-[#2F6B50]" /></Card>
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Popular categories</h2><Bars data={d.marketplace.popularCategories} color="bg-[#A66A00]" /></Card>
              </>
            )}
            {tab === 'revenue' && (
              <>
                <KpiGrid kpis={d.revenue.kpis} prefix={''} />
                <Card><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Revenue (successful payments)</h2><Bars data={d.revenue.series} color="bg-[#2F6B50]" /></Card>
              </>
            )}
          </div>
          <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-4">{d.note}</p>
        </>
      )}
    </div>
  );
}
