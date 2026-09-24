'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, StatCard } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, FilterChips, severityTone, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminSecurityPage() {
  const [severity, setSeverity] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (severity) params.set('severity', severity);
  if (status) params.set('status', status);
  const qs = params.toString();

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/security${qs ? `?${qs}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/security', { id, action });
      toast.success('Event updated');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts ?? {};

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Security Center" subtitle="Investigate and respond to security events" crumbs={['Admin', 'Security']} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="shield" label="Open" value={String(counts.OPEN ?? data?.events?.filter((e: any) => e.status === 'OPEN').length ?? 0)} tone="amber" />
        <StatCard icon="gpp_bad" label="Critical" value={String(counts.CRITICAL ?? 0)} tone="red" />
        <StatCard icon="priority_high" label="High" value={String(counts.HIGH ?? 0)} tone="amber" />
        <StatCard icon="task_alt" label="Resolved" value={String(data?.events?.filter((e: any) => e.status === 'RESOLVED').length ?? 0)} tone="green" />
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <FilterChips options={data?.severities ?? ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']} value={severity} onChange={setSeverity} label="Severity" />
          <FilterChips options={data?.statuses ?? ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED']} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load security events.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.events?.length ? (
          <EmptyState icon="shield" title="No security events" body="No events match the current filters." />
        ) : (
          <TableShell>
            <thead><tr><Th>Severity</Th><Th>Type</Th><Th>Description</Th><Th>Actor</Th><Th>Status</Th><Th>Detected</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.events.map((e: any) => (
                <tr key={e.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td><StatusPill status={e.severity} tone={severityTone(e.severity)} /></Td>
                  <Td className="font-medium text-on-surface dark:text-inverse-on-surface">{e.type}</Td>
                  <Td className="max-w-xs truncate text-on-surface-variant dark:text-surface-variant">{e.description}</Td>
                  <Td>{e.actorName ?? '—'}</Td>
                  <Td><StatusPill status={e.status} /></Td>
                  <Td>{timeAgo(e.createdAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {e.status === 'OPEN' && <button disabled={busy === e.id + 'investigate'} onClick={() => act(e.id, 'investigate')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Investigate</button>}
                      {['OPEN', 'INVESTIGATING'].includes(e.status) && <button disabled={busy === e.id + 'resolve'} onClick={() => act(e.id, 'resolve')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Resolve</button>}
                      {e.status === 'OPEN' && <button disabled={busy === e.id + 'dismiss'} onClick={() => act(e.id, 'dismiss')} className="text-label-md text-on-surface-variant dark:text-surface-variant hover:underline disabled:opacity-50">Dismiss</button>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
