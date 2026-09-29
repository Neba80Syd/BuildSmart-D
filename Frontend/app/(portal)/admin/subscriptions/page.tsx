'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, money, fmtDate } from '@/Frontend/components/admin/shared';

export default function AdminSubscriptionsPage() {
  const { data, loading, error, refetch } = useApi<any>('/api/admin/subscriptions');
  const [editor, setEditor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api('PATCH', '/api/admin/subscriptions', { id: editor.id, plan: editor.plan, status: editor.status });
      toast.success('Subscription updated');
      setEditor(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Subscriptions" subtitle="Manage plan subscriptions across accounts" crumbs={['Admin', 'Settings', 'Subscriptions']} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {(data?.plans ?? []).map((p: any) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.name}</h2>
              <StatusPill status={p.tier ?? 'PLAN'} tone={p.tier === 'PRO' ? 'green' : 'gray'} />
            </div>
            <p className="text-display text-on-surface dark:text-inverse-on-surface">{p.price ? money(p.price, p.currency) : 'Free'}</p>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">{p.description}</p>
          </Card>
        ))}
      </div>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load subscriptions.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={5} /></tbody></TableShell>
        ) : !data?.subscriptions?.length ? (
          <EmptyState icon="workspace_premium" title="No subscriptions" />
        ) : (
          <TableShell>
            <thead><tr><Th>User</Th><Th>Role</Th><Th>Plan</Th><Th>Status</Th><Th>Started</Th><Th /></tr></thead>
            <tbody>
              {data.subscriptions.map((s: any) => (
                <tr key={s.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <p className="font-semibold text-on-surface dark:text-inverse-on-surface">{s.userName}</p>
                  </Td>
                  <Td>{s.userRole}</Td>
                  <Td className="font-semibold">{s.plan}</Td>
                  <Td><StatusPill status={s.status} /></Td>
                  <Td>{fmtDate(s.startedAt)}</Td>
                  <Td><button onClick={() => setEditor(s)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Manage</button></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor ? `Subscription — ${editor.userName}` : ''}>
        {editor && (
          <div className="space-y-4">
            <Field label="Plan">
              <select className={inputClass} value={editor.plan} onChange={(e) => setEditor({ ...editor, plan: e.target.value })}>
                {(data?.plans ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="FREE">FREE</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={inputClass} value={editor.status} onChange={(e) => setEditor({ ...editor, status: e.target.value })}>
                {['ACTIVE', 'CANCELLED', 'PAST_DUE'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy} onClick={save}>Save</button>
              <button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
