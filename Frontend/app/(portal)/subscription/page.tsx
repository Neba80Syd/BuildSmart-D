'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Subscription = { id: string; plan: string; status: string; renewsAt: string | null };
type Payment = { id: string; amount: number; currency: string; status: string; description: string; createdAt: string };

const PLANS = [
  { id: 'FREE', name: 'Free', price: 0, features: ['1 active project', 'AI layout previews', 'Community support'] },
  { id: 'BASIC', name: 'Basic', price: 19, features: ['5 active projects', 'AI floor plans', 'BOQ export (CSV)', 'Email support'] },
  { id: 'PROFESSIONAL', name: 'Professional', price: 49, features: ['Unlimited projects', '3D visualization', 'Marketplace integration', 'Priority support'] },
  { id: 'ENTERPRISE', name: 'Enterprise', price: 199, features: ['Everything in Professional', 'Team seats', 'API access', 'Dedicated manager'] },
];

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/subscription');
    const data = await res.json();
    setSub(data.subscription ?? null);
    setPayments(data.payments ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const change = async (plan: string) => {
    setChanging(plan);
    const res = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    setChanging(null);
    if (res.ok) {
      toast.success(`Switched to ${plan} plan`);
      load();
    } else toast.error(data.error ?? 'Could not update subscription');
  };

  return (
    <div className="max-w-5xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Subscription &amp; Billing</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
          {sub ? (
            <>
              Current plan: <strong className="text-primary dark:text-primary-fixed">{sub.plan}</strong> — status{' '}
              <strong>{sub.status}</strong>
              {sub.renewsAt && ` · renews ${new Date(sub.renewsAt).toLocaleDateString()}`}
            </>
          ) : (
            'Choose a plan to unlock premium capabilities.'
          )}
        </p>
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {PLANS.map((p) => {
            const current = sub?.plan === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-6 flex flex-col ${current ? 'border-primary dark:border-primary-fixed bg-surface-container-low dark:bg-primary-container/10 shadow-elevation' : 'border-outline-variant dark:border-outline bg-white dark:bg-surface-container'}`}
              >
                <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</h3>
                <div className="text-display text-on-background dark:text-surface-container-lowest my-3">
                  €{p.price}<span className="text-body-sm text-on-surface-variant dark:text-surface-variant">/mo</span>
                </div>
                <ul className="space-y-2 text-body-sm text-on-surface-variant dark:text-surface-variant flex-1 mb-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[16px]">check</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => change(p.id)}
                  disabled={current || changing === p.id}
                  className={`rounded-lg py-2.5 text-label-md transition-colors ${current ? 'bg-surface-variant dark:bg-tertiary-container text-on-surface-variant dark:text-on-tertiary-container cursor-default' : 'btn-primary'} disabled:opacity-60`}
                >
                  {current ? 'Current Plan' : changing === p.id ? 'Processing…' : p.price === 0 ? 'Downgrade' : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden shadow-elevation">
        <div className="p-6 border-b border-outline-variant dark:border-outline">
          <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">Payment History</h3>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-body-sm text-on-surface-variant dark:text-surface-variant">No payments yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant">Description</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant text-right">Amount</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant">Status</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant">Date</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-background dark:text-surface-container-lowest divide-y divide-outline-variant dark:divide-outline">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-6">{p.description}</td>
                  <td className="py-3 px-6 text-right font-mono-technical">{p.currency} {p.amount.toFixed(2)}</td>
                  <td className="py-3 px-6"><span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container">{p.status}</span></td>
                  <td className="py-3 px-6 text-on-surface-variant dark:text-surface-variant">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
