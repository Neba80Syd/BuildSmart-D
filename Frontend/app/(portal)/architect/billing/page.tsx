'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const PLANS = [
  { key: 'FREE', name: 'Free', price: 0, features: ['3 AI generations / month', '3 projects', 'Basic 2D editor'] },
  { key: 'BASIC', name: 'Basic', price: 19, features: ['30 AI generations / month', '15 projects', '3D viewer', 'BOQ generator'] },
  { key: 'PROFESSIONAL', name: 'Professional', price: 49, features: ['Unlimited AI generations', 'Unlimited projects', 'Full design studio', 'Priority support'] },
  { key: 'ENTERPRISE', name: 'Enterprise', price: 199, features: ['Team seats', 'Custom integrations', 'Dedicated manager'] },
];

export default function ArchitectBillingPage() {
  const { data, loading, refetch } = useApi<any>('/api/subscription');
  const [changing, setChanging] = useState<string | null>(null);

  const subscription = data?.subscription;
  const payments = data?.payments ?? [];
  const planPrices = data?.planPrices ?? {};

  const changePlan = async (plan: string) => {
    setChanging(plan);
    try {
      await api('POST', '/api/subscription', { plan });
      toast.success(plan === 'FREE' ? 'Subscription cancelled' : `Switched to ${plan} plan`);
      refetch();
    } catch (err: any) { toast.error(err.message); } finally { setChanging(null); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Subscription & Billing" subtitle="Manage your BuildSmart AI plan and payment history." crumbs={['Architect', 'Finance', 'Subscription & Billing']} />

      {loading ? (
        <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
      ) : (
        <>
          <Card className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-headline-md text-on-surface dark:text-inverse-on-surface">{subscription?.plan ?? 'FREE'} Plan</h3>
                <StatusPill status={subscription?.status ?? 'INACTIVE'} />
              </div>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                {subscription?.renewsAt ? `Renews ${new Date(subscription.renewsAt).toLocaleDateString()}` : 'No active renewal'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-display text-primary dark:text-primary-fixed-dim">{planPrices[subscription?.plan] ?? 0} <span className="text-headline-sm">EUR/mo</span></p>
              <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Subscription restrictions are enforced server-side.</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {PLANS.map((p) => (
              <Card key={p.key} className={`flex flex-col ${subscription?.plan === p.key ? 'border-primary ring-2 ring-primary/20' : ''}`}>
                <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{p.name}</h3>
                <p className="text-headline-md text-primary dark:text-primary-fixed-dim font-semibold my-2">{p.price === 0 ? 'Free' : `${p.price}€`}<span className="text-label-md text-on-surface-variant dark:text-surface-variant"> /mo</span></p>
                <ul className="text-body-sm text-on-surface-variant dark:text-surface-variant space-y-1 flex-1">
                  {p.features.map((f) => <li key={f} className="flex items-start gap-1"><span className="material-symbols-outlined text-[16px] text-[#2F6B50]">check</span>{f}</li>)}
                </ul>
                <button
                  className={subscription?.plan === p.key ? btnGhost + ' mt-3' : btnPrimary + ' mt-3'}
                  disabled={changing === p.key || subscription?.plan === p.key}
                  onClick={() => changePlan(p.key)}
                >
                  {changing === p.key ? 'Processing…' : subscription?.plan === p.key ? 'Current Plan' : p.price === 0 ? 'Cancel Subscription' : 'Switch Plan'}
                </button>
              </Card>
            ))}
          </div>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Payment History</h3>
            {payments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div>
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.description}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.amount} {p.currency}</p>
                      <StatusPill status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
