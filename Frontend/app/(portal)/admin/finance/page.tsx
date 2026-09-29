'use client';

import { useState } from 'react';
import { PageHeader, Card, StatCard } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { money } from '@/Frontend/components/admin/shared';

function Bars({ data, color = 'bg-[#2F6B50]' }: { data: { label: string; gross: number; refunds: number; net: number }[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.gross));
  return (
    <div className="flex items-end gap-2" style={{ height: 180 }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: gross ${d.gross}, refunds ${d.refunds}`}>
          <span className="text-[10px] text-on-surface-variant dark:text-surface-variant mb-1 truncate">{d.gross > 0 ? Math.round(d.gross / 1000) + 'k' : ''}</span>
          <div className={`w-full ${color} rounded-t`} style={{ height: `${Math.max(2, (d.gross / max) * 100)}%` }} />
          <span className="text-[10px] text-on-surface-variant dark:text-surface-variant mt-1 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminFinancePage() {
  const [range, setRange] = useState(90);
  const { data, loading, error } = useApi<any>(`/api/admin/finance?range=${range}`);
  const s = data?.summary;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Financial Reports"
        subtitle="Server-computed revenue reporting"
        crumbs={['Admin', 'Finance', 'Reports']}
        actions={
          <div className="flex gap-2">
            {[30, 90, 365].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`px-3 py-2 rounded-lg text-label-md border ${range === r ? 'bg-primary-container text-white border-primary-container' : 'border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>
                {r === 365 ? '1Y' : `${r}d`}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <Card><p className="text-error dark:text-red-300">Failed to load report.</p></Card>
      ) : loading || !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 bg-surface-variant dark:bg-surface-container-high animate-pulse rounded-xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="payments" label="Gross Revenue" value={money(s.grossRevenue)} tone="green" />
            <StatCard icon="account_balance" label="Net Revenue" value={money(s.netRevenue)} />
            <StatCard icon="workspace_premium" label="Subscriptions" value={money(s.subscriptionRevenue)} />
            <StatCard icon="assignment_return" label="Refunds" value={money(s.refundTotal)} tone="amber" />
          </div>

          <Card className="mb-6">
            <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Monthly revenue (gross)</h2>
            {data.monthly?.length ? <Bars data={data.monthly} /> : <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No revenue recorded in this period.</p>}
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Pending invoices</h2>
              <p className="text-display text-on-surface dark:text-inverse-on-surface">{s.pendingInvoices}</p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{money(s.pendingInvoiceTotal)} outstanding</p>
            </Card>
            <Card>
              <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-4">Withdrawals</h2>
              <p className="text-display text-on-surface dark:text-inverse-on-surface">{money(s.withdrawalPending)}</p>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{money(s.withdrawalTotal)} total · {money(s.platformRevenue)} platform fees</p>
            </Card>
          </div>
          <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-4">{data.note}</p>
        </>
      )}
    </div>
  );
}
