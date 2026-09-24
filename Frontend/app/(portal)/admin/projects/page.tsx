'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, Confirm, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminProjectsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/projects${query ? `?${query}` : ''}`);
  const detailApi = useApi<any>(detail ? `/api/admin/projects?id=${detail.id}` : '');

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/projects', { id, action });
      toast.success(`Project ${action}ed`);
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
      <PageHeader title="Projects" subtitle="Monitor platform projects — administration never edits architectural work" crumbs={['Admin', 'Projects']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search projects…" /></div>
          <FilterChips options={data?.statuses ?? []} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load projects.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={7} /></tbody></TableShell>
        ) : !data?.projects?.length ? (
          <EmptyState icon="architecture" title="No projects" />
        ) : (
          <TableShell>
            <thead><tr><Th>Project</Th><Th>Client</Th><Th>Architect</Th><Th>Status</Th><Th>Progress</Th><Th>Disputes</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.projects.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => setDetail(p)} className="text-left font-semibold text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed-dim">{p.name}</button>
                    {p.flagged && <StatusPill status="Flagged" tone="red" />}
                  </Td>
                  <Td>{p.clientName}</Td>
                  <Td>{p.architectName}</Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td>
                    <div className="w-24 h-1.5 bg-surface-variant dark:bg-surface-container-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary-container" style={{ width: `${p.progress ?? 0}%` }} />
                    </div>
                  </Td>
                  <Td>{p.disputes}</Td>
                  <Td>
                    <div className="flex gap-2">
                      {p.flagged ? (
                        <button disabled={busy === p.id + 'unflag'} onClick={() => act(p.id, 'unflag')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Unflag</button>
                      ) : (
                        <button disabled={busy === p.id + 'flag'} onClick={() => act(p.id, 'flag')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Flag</button>
                      )}
                      {p.status === 'SUSPENDED' ? (
                        <button disabled={busy === p.id + 'resume'} onClick={() => act(p.id, 'resume')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Resume</button>
                      ) : (
                        <button disabled={busy === p.id + 'suspend'} onClick={() => act(p.id, 'suspend')} className="text-label-md text-on-surface-variant dark:text-surface-variant hover:underline disabled:opacity-50">Suspend</button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ''} wide>
        {detail && (
          <div className="space-y-4 text-body-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Client</p><p className="font-medium">{detail.clientName}</p></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Architect</p><p className="font-medium">{detail.architectName}</p></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Status</p><StatusPill status={detail.status} /></div>
              <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase">Updated</p><p>{timeAgo(detail.updatedAt)}</p></div>
            </div>
            {detailApi.data?.activity?.length ? (
              <div>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase mb-2">Recent activity</p>
                <ul className="space-y-1">
                  {detailApi.data.activity.slice(0, 6).map((a: any) => (
                    <li key={a.id} className="text-body-sm text-on-surface-variant dark:text-surface-variant">• {a.title} <span className="text-label-md">({timeAgo(a.createdAt)})</span></li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              {detail.flagged ? <Confirm label="Unflag" onConfirm={() => act(detail.id, 'unflag')} tone="primary" /> : <Confirm label="Flag project" onConfirm={() => act(detail.id, 'flag')} />}
              {detail.status === 'SUSPENDED' ? <Confirm label="Resume" onConfirm={() => act(detail.id, 'resume')} tone="primary" /> : <Confirm label="Suspend" onConfirm={() => act(detail.id, 'suspend')} />}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
