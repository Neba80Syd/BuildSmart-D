'use client';

import { useState } from 'react';
import { PageHeader, Card, StatCard, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { SalesChart, BarChart, DonutChart } from '@/Frontend/components/vendor/charts';

const fmt = (n: number) => Math.round(n).toLocaleString();
const RANGES = ['7d', '30d', '90d', '180d', '365d'];

export default function ArchitectAnalyticsPage() {
  const [range, setRange] = useState('30d');
  const { data, loading } = useApi<any>(`/api/architect/analytics?range=${range}`);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="Reports & Analytics" subtitle="Understand your professional performance." crumbs={['Architect', 'Analytics', 'Reports & Analytics']} actions={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-label-md ${range === r ? 'bg-primary text-white' : 'bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{r}</button>
          ))}
        </div>
      } />

      {loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="architecture" label="Total Projects" value={String(data.projects.total)} meta={`${data.projects.active} active`} />
            <StatCard icon="groups" label="Clients" value={String(data.clients.total)} meta={`${data.clients.newInRange} new in range`} />
            <StatCard icon="auto_awesome" label="AI Designs" value={String(data.designs.aiGenerated)} meta={`${data.designs.total} total`} />
            <StatCard icon="savings" label="Total Earnings" value={fmt(data.financial.totalEarnings)} meta={`${fmt(data.financial.pendingEarnings)} pending`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Earnings Trend ({range})</h3>
              <SalesChart series={data.financial.earningsSeries} height={200} />
            </Card>
            <Card>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Projects by Category</h3>
              <BarChart data={data.projects.byType} height={200} labelKey="label" valueKey="value" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Reputation</h3>
              <div className="flex items-center gap-4">
                <DonutChart segments={data.reputation.distribution} size={140} />
                <div>
                  <p className="text-display text-[#A66A00] dark:text-yellow-400">{data.reputation.average}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{data.reputation.count} reviews</p>
                </div>
              </div>
            </Card>
            <Card>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Designs</h3>
              <div className="space-y-2 text-body-sm">
                <Row k="Total designs" v={data.designs.total} />
                <Row k="AI generated" v={data.designs.aiGenerated} />
                <Row k="Approved" v={data.designs.approved} />
                <Row k="Revision rate" v={`${data.designs.revisionRate}%`} />
              </div>
            </Card>
            <Card>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Marketplace</h3>
              <div className="space-y-2 text-body-sm">
                <Row k="Orders" v={data.marketplace.orders} />
                <Row k="Total spending" v={`${fmt(data.marketplace.spending)} XAF`} />
                <Row k="Completed projects" v={data.projects.completed} />
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between border-b border-outline-variant/50 dark:border-outline/40 py-1.5 last:border-0">
      <span className="text-on-surface-variant dark:text-surface-variant">{k}</span>
      <span className="font-semibold text-on-surface dark:text-inverse-on-surface">{v}</span>
    </div>
  );
}
