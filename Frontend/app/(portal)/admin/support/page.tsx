'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, timeAgo } from '@/Frontend/components/admin/shared';

export default function AdminSupportPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/support${query ? `?${query}` : ''}`);
  const detailApi = useApi<any>(detail ? `/api/admin/support?id=${detail.id}` : '');

  const act = async (payload: any) => {
    setBusy(payload.id + payload.action);
    try {
      await api('PATCH', '/api/admin/support', payload);
      toast.success('Ticket updated');
      refetch();
      if (payload.action === 'reply') setReply('');
      if (payload.action === 'note') setNote('');
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Support" subtitle="Manage support tickets and replies" crumbs={['Admin', 'Communication', 'Support']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search tickets…" /></div>
          <FilterChips options={data?.statuses ?? ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED']} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load tickets.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.tickets?.length ? (
          <EmptyState icon="support_agent" title="No tickets" />
        ) : (
          <TableShell>
            <thead><tr><Th>Subject</Th><Th>User</Th><Th>Category</Th><Th>Assignee</Th><Th>Status</Th><Th>Updated</Th><Th /></tr></thead>
            <tbody>
              {data.tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => setDetail(t)} className="font-semibold text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed-dim text-left">{t.subject}</button>
                  </Td>
                  <Td>{t.userName}</Td>
                  <Td>{t.category}</Td>
                  <Td>{t.assigneeName ?? <span className="text-on-surface-variant dark:text-surface-variant">Unassigned</span>}</Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td>{timeAgo(t.updatedAt)}</Td>
                  <Td><button onClick={() => setDetail(t)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Open</button></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.subject ?? ''} wide>
        {detail && detailApi.data?.ticket && (
          <div className="space-y-4 text-body-sm">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusPill status={detailApi.data.ticket.status} />
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{detailApi.data.ticket.userName} · {detailApi.data.ticket.category}</span>
            </div>
            <p className="text-on-surface dark:text-inverse-on-surface">{detailApi.data.ticket.description}</p>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(detailApi.data.ticket.messages ?? []).map((m: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg ${m.from === 'support' ? 'bg-primary-container/10 ml-6' : 'bg-surface-container-low dark:bg-surface-variant mr-6'}`}>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">{m.from === 'support' ? 'Support' : 'User'} · {timeAgo(m.at)}</p>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>

            {(detailApi.data.ticket.internalNotes ?? []).length > 0 && (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase mb-1">Internal notes</p>
                {(detailApi.data.ticket.internalNotes ?? []).map((n: any, i: number) => (
                  <p key={i} className="text-body-sm text-on-surface-variant dark:text-surface-variant">• {n.text} <span className="text-label-md">({n.author})</span></p>
                ))}
              </div>
            )}

            <Field label="Reply to user">
              <textarea className={inputClass} rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className={btnPrimary} disabled={busy === detail.id + 'reply' || !reply} onClick={() => act({ id: detail.id, action: 'reply', message: reply })}>Send reply</button>
              <button className="px-4 py-2 rounded-lg border border-outline-variant dark:border-outline text-label-md disabled:opacity-50" disabled={busy === detail.id + 'note' || !note} onClick={() => act({ id: detail.id, action: 'note', note })}>Add internal note</button>
              <button className="px-4 py-2 rounded-lg border border-outline-variant dark:border-outline text-label-md disabled:opacity-50" disabled={busy === detail.id + 'status'} onClick={() => act({ id: detail.id, action: 'status', status: 'RESOLVED' })}>Mark resolved</button>
            </div>
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note text…" />
          </div>
        )}
      </Modal>
    </div>
  );
}
