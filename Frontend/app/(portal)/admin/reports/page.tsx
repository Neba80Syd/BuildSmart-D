'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, FilterChips, priorityTone, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminReportsPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (targetType) p.set('targetType', targetType);
    return p.toString();
  }, [status, targetType]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/reports${query ? `?${query}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/reports', { id, action });
      toast.success('Report updated');
      refetch();
      setDetail(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Reports" subtitle="Moderation reports from the community" crumbs={['Admin', 'Communication', 'Reports']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <FilterChips options={data?.statuses ?? ['OPEN', 'UNDER_REVIEW', 'ACTIONED', 'DISMISSED', 'ESCALATED', 'RESOLVED']} value={status} onChange={setStatus} label="Status" />
          <FilterChips options={data?.targetTypes ?? []} value={targetType} onChange={setTargetType} label="Target" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load reports.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.reports?.length ? (
          <EmptyState icon="flag" title="No reports" body="No moderation reports match this filter." />
        ) : (
          <TableShell>
            <thead><tr><Th>Reason</Th><Th>Target</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Filed</Th><Th /></tr></thead>
            <tbody>
              {data.reports.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => setDetail(r)} className="font-medium text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed-dim text-left">{r.reason}</button>
                  </Td>
                  <Td>
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{r.targetType}</span>
                    <p className="font-mono text-label-md">{r.targetId}</p>
                  </Td>
                  <Td>{r.category}</Td>
                  <Td><StatusPill status={r.priority} tone={priorityTone(r.priority)} /></Td>
                  <Td><StatusPill status={r.status} /></Td>
                  <Td>{timeAgo(r.createdAt)}</Td>
                  <Td><button onClick={() => setDetail(r)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Review</button></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.category ?? 'Report'} wide>
        {detail && (
          <div className="space-y-4 text-body-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusPill status={detail.status} />
              <StatusPill status={`${detail.priority} priority`} tone={priorityTone(detail.priority)} />
            </div>
            <p className="text-on-surface dark:text-inverse-on-surface">{detail.reason}</p>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Target</p><p className="font-mono">{detail.targetType}: {detail.targetId}</p></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Reporter</p><p>{detail.reporterName}</p></div>
            </div>
            {detail.resolution && <p className="text-on-surface-variant dark:text-surface-variant">Resolution: {detail.resolution}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => act(detail.id, 'assign')} disabled={busy === detail.id + 'assign'} className="px-4 py-2 rounded-lg border border-outline-variant dark:border-outline text-label-md disabled:opacity-50">Assign to me</button>
              <button onClick={() => act(detail.id, 'action')} disabled={busy === detail.id + 'action'} className="bg-[#2F6B50] text-white px-4 py-2 rounded-lg text-label-md disabled:opacity-50">Take action</button>
              <button onClick={() => act(detail.id, 'escalate')} disabled={busy === detail.id + 'escalate'} className="bg-error/10 text-error dark:text-red-300 border border-error/30 px-4 py-2 rounded-lg text-label-md disabled:opacity-50">Escalate</button>
              <button onClick={() => act(detail.id, 'dismiss')} disabled={busy === detail.id + 'dismiss'} className="px-4 py-2 rounded-lg border border-outline-variant dark:border-outline text-label-md disabled:opacity-50">Dismiss</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
