'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, StatCard } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, Confirm, money, fmtDateTime } from '@/Frontend/components/admin/shared';

export default function AdminPaymentsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (kind) p.set('kind', kind);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status, kind]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/payments${query ? `?${query}` : ''}`);
  const { data: campayStatus } = useApi<any>('/api/payment/campay');

  const refund = async (paymentId: string) => {
    setBusy(paymentId + 'refund');
    try {
      await api('POST', '/api/admin/payments', { paymentId });
      toast.success('Refund issued');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Refund failed');
    } finally {
      setBusy(null);
    }
  };

  const s = data?.summary ?? { gross: 0, refunds: 0, net: 0, pending: 0, failed: 0 };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Transactions" subtitle="Unified ledger of payments and architect transactions" crumbs={['Admin', 'Finance', 'Transactions']} />

      {campayStatus?.success && (
        <Card className="mb-6 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-emerald-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined">payments</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-label-md font-bold text-on-background dark:text-surface-container-lowest">
                    Campay Mobile Money Gateway
                  </h3>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    campayStatus.environment === 'demo'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {campayStatus.environment === 'demo' ? 'Sandbox / Demo' : 'Live Production'}
                  </span>
                </div>
                <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                  Connected to {campayStatus.baseUrl} • Direct MTN MoMo, Orange Money & Card Collections
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-right">
              <div>
                <span className="text-body-xs text-on-surface-variant dark:text-surface-variant block">Campay Balance</span>
                <span className="font-mono-technical font-bold text-on-background dark:text-surface-container-lowest text-label-lg">
                  {campayStatus.balance?.total_balance ?? 0} {campayStatus.balance?.currency || 'XAF'}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="payments" label="Gross" value={money(s.gross)} tone="green" />
        <StatCard icon="assignment_return" label="Refunds" value={money(s.refunds)} tone="amber" />
        <StatCard icon="account_balance" label="Net" value={money(s.net)} />
        <StatCard icon="pending" label="Pending" value={String(s.pending)} meta={`${s.failed} failed`} />
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search transactions…" /></div>
          <FilterChips options={data?.statuses ?? []} value={status} onChange={setStatus} label="Status" />
          <FilterChips options={data?.kinds ?? []} value={kind} onChange={setKind} label="Type" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load transactions.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.transactions?.length ? (
          <EmptyState icon="account_balance" title="No transactions" />
        ) : (
          <TableShell>
            <thead><tr><Th>Reference</Th><Th>User</Th><Th>Type</Th><Th>Amount</Th><Th>Status</Th><Th>Date</Th><Th /></tr></thead>
            <tbody>
              {data.transactions.map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td className="font-mono">{t.id}</Td>
                  <Td>{t.userName}</Td>
                  <Td><StatusPill status={t.type} tone={t.type === 'REFUND' ? 'amber' : t.type === 'WITHDRAWAL' ? 'purple' : 'gray'} /></Td>
                  <Td className={t.type === 'REFUND' ? 'text-error dark:text-red-300' : 'font-semibold'}>{t.type === 'REFUND' || t.type === 'WITHDRAWAL' || t.type === 'FEE' ? '−' : '+'}{money(t.amount, t.currency)}</Td>
                  <Td><StatusPill status={t.status} /></Td>
                  <Td>{fmtDateTime(t.createdAt)}</Td>
                  <Td>
                    {t.type === 'PAYMENT' && t.status === 'SUCCEEDED' && (
                      <Confirm label="Refund" confirmLabel="Confirm refund?" onConfirm={() => refund(t.id)} />
                    )}
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
