'use client';

import { PageHeader, Card, StatusPill, StatCard } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';

const serviceTone = (s: string) => (s === 'HEALTHY' ? 'green' : s === 'WARNING' || s === 'DEGRADED' ? 'amber' : 'red');

export default function AdminSystemPage() {
  const { data, loading, error } = useApi<any>('/api/admin/system');
  const d = data;

  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(0)} MB`;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="System Health" subtitle="Runtime and infrastructure status" crumbs={['Admin', 'System']} />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load system status.</p></Card>
      ) : loading || !d ? (
        <Card><p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="favorite" label="Overall" value={d.overall} meta={`uptime ${Math.round(d.uptimeSeconds / 60)} min`} tone={serviceTone(d.overall)} />
            <StatCard icon="memory" label="Memory" value={mb(d.memory.rss)} meta={`${mb(d.memory.heapUsed)} heap`} />
            <StatCard icon="speed" label="Load" value={d.load?.[0]?.toFixed?.(2) ?? '—'} meta="1 min average" />
            <StatCard icon="database" label="Records" value={String((Object.values(d.counts ?? {}) as number[]).reduce((a, b) => a + (b > 0 ? b : 0), 0))} meta="across core tables" />
          </div>

          <Card pad={false} className="mb-6">
            <div className="px-6 py-4 border-b border-outline-variant dark:border-outline"><h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">Services</h2></div>
            <div className="divide-y divide-outline-variant dark:divide-outline">
              {d.services.map((s: any) => (
                <div key={s.name} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-on-surface dark:text-inverse-on-surface">{s.name}</p>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{s.detail}</p>
                  </div>
                  <StatusPill status={s.status} tone={serviceTone(s.status)} />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Table counts</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(d.counts ?? {}).map(([k, v]: any) => (
                <div key={k} className="p-3 rounded-lg border border-outline-variant dark:border-outline">
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant capitalize">{k}</p>
                  <p className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{v}</p>
                </div>
              ))}
            </div>
            <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-4">Snapshot at {new Date(d.timestamp).toLocaleString()}</p>
          </Card>
        </>
      )}
    </div>
  );
}
