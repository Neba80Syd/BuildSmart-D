'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatCard, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ArchitectEarningsPage() {
  const { data, loading, refetch } = useApi<any>('/api/architect/earnings');
  const [withdraw, setWithdraw] = useState(false);

  const totals = data?.totals;
  const transactions = data?.transactions ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Earnings & Transactions" subtitle="Financial visibility across your projects." crumbs={['Architect', 'Finance', 'Earnings & Transactions']} actions={
        <button className={btnPrimary} onClick={() => setWithdraw(true)}><span className="material-symbols-outlined text-[18px]">account_balance</span>Request Withdrawal</button>
      } />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="savings" label="Total Earnings" value={`${fmt(totals?.totalEarnings ?? 0)} ${data?.currency}`} tone="green" />
            <StatCard icon="pending" label="Pending" value={`${fmt(totals?.pending ?? 0)} ${data?.currency}`} tone="amber" />
            <StatCard icon="account_balance" label="Available" value={`${fmt(totals?.available ?? 0)} ${data?.currency}`} />
            <StatCard icon="percent" label="Commission Rate" value={`${Math.round((data?.commissionRate ?? 0) * 100)}%`} meta="platform fee" />
          </div>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Transaction Ledger</h3>
            {transactions.length === 0 ? (
              <EmptyState icon="receipt_long" title="No transactions" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant dark:border-outline">
                      <th className="px-4 py-2">Description</th><th className="px-4 py-2">Kind</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t: any) => (
                      <tr key={t.id} className="border-b border-outline-variant/50 dark:border-outline/40">
                        <td className="px-4 py-2 text-on-surface dark:text-inverse-on-surface">{t.description}</td>
                        <td className="px-4 py-2"><StatusPill status={t.kind} /></td>
                        <td className={`px-4 py-2 text-right font-mono-technical font-semibold ${t.amount >= 0 ? 'text-[#2F6B50]' : 'text-error'}`}>{t.kind === 'EARNING' ? '+' : '−'}{fmt(t.amount)} {t.currency}</td>
                        <td className="px-4 py-2"><StatusPill status={t.status} /></td>
                        <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {withdraw && <WithdrawModal available={totals?.available ?? 0} currency={data?.currency} onClose={() => setWithdraw(false)} onDone={() => { setWithdraw(false); refetch(); }} />}
    </div>
  );
}

function WithdrawModal({ available, currency, onClose, onDone }: { available: number; currency: string; onClose: () => void; onDone: () => void }) {
  const [method, setMethod] = useState('BANK');
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const account = method === 'BANK' ? { bank: String(fd.get('bank')), accountName: String(fd.get('accountName')), accountNumber: String(fd.get('accountNumber')) } : { provider: 'Stripe', accountName: String(fd.get('accountName')), accountId: String(fd.get('accountId')) };
      await api('POST', '/api/architect/earnings', { amount: Number(fd.get('amount')), method, account });
      toast.success('Withdrawal requested');
      onDone();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };
  return (
    <Modal open title="Request Withdrawal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant text-body-sm text-on-surface dark:text-inverse-on-surface">
          Available balance: <strong>{fmt(available)} {currency}</strong>
        </div>
        <Field label="Amount (XAF)"><input className={inputClass} name="amount" type="number" min={1} max={available} required /></Field>
        <Field label="Method">
          <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="BANK">Bank transfer</option>
            <option value="STRIPE">Stripe</option>
          </select>
        </Field>
        {method === 'BANK' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank"><input className={inputClass} name="bank" required /></Field>
            <Field label="Account name"><input className={inputClass} name="accountName" required /></Field>
            <div className="col-span-2"><Field label="Account number"><input className={inputClass} name="accountNumber" required /></Field></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Account name"><input className={inputClass} name="accountName" required /></Field>
            <Field label="Account ID"><input className={inputClass} name="accountId" required /></Field>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Submitting…' : 'Request'}</button>
        </div>
      </form>
    </Modal>
  );
}
