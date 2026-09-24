'use client';

import { useMemo, useState } from 'react';
import { PageHeader, Card, EmptyState, StatusPill } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, fmtDateTime } from '@/Frontend/components/admin/shared';

export default function AdminAuditPage() {
  const [q, setQ] = useState('');
  const [resource, setResource] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (resource) p.set('resource', resource);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, resource]);

  const { data, loading, error } = useApi<any>(`/api/admin/audit${query ? `?${query}` : ''}`);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Audit Logs" subtitle="Immutable, append-only record of consequential actions" crumbs={['Admin', 'System', 'Audit']} />

      <div className="mb-6 p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant text-body-sm text-on-surface-variant dark:text-surface-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">lock</span>
        Audit entries are append-only and cannot be edited or deleted by administrators.
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search audit entries…" /></div>
          <FilterChips options={data?.resources ?? []} value={resource} onChange={setResource} label="Resource" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load audit log.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={5} /></tbody></TableShell>
        ) : !data?.logs?.length ? (
          <EmptyState icon="receipt" title="No audit entries" />
        ) : (
          <TableShell>
            <thead><tr><Th>Action</Th><Th>Actor</Th><Th>Resource</Th><Th>Result</Th><Th>Reason</Th><Th>When</Th></tr></thead>
            <tbody>
              {data.logs.map((l: any) => (
                <tr key={l.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td className="font-mono text-label-md">{l.action}</Td>
                  <Td>{l.actorName}</Td>
                  <Td className="font-mono text-label-md">{l.resource}{l.resourceId ? ` · ${l.resourceId}` : ''}</Td>
                  <Td><StatusPill status={l.result} tone={l.result === 'SUCCESS' ? 'green' : 'red'} /></Td>
                  <Td className="max-w-xs truncate text-on-surface-variant dark:text-surface-variant">{l.reason ?? '—'}</Td>
                  <Td>{fmtDateTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
