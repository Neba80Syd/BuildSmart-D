'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, Field, inputClass, btnPrimary, StatusPill, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const FAQS = [
  { q: 'How do I convert a design request into a project?', a: 'Open Design Requests, accept the request, then choose "Convert to Project" — the client brief is transferred automatically.' },
  { q: 'Are AI-generated designs structurally approved?', a: 'No. AI designs are preliminary and clearly marked as AI-generated. They must be validated by a licensed engineer before construction.' },
  { q: 'Can I override AI material estimates?', a: 'Yes. Open any BOQ and click "Edit Quantities" to manually adjust quantities and prices, then save.' },
  { q: 'How does platform commission work?', a: 'BuildSmart AI deducts a 5% commission on architect fees, shown in your Earnings & Transactions ledger.' },
];

export default function ArchitectSupportPage() {
  const { data, loading, refetch } = useApi<{ tickets: any[]; isAdmin: boolean }>('/api/tickets');
  const [form, setForm] = useState({ subject: '', category: 'General', priority: 'LOW', description: '' });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('POST', '/api/tickets', form);
      toast.success('Support ticket submitted');
      setForm({ subject: '', category: 'General', priority: 'LOW', description: '' });
      refetch();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1000px] mx-auto">
      <PageHeader title="Help & Support" subtitle="FAQs, documentation and contact support." crumbs={['Architect', 'System', 'Help & Support']} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Frequently Asked Questions</h3>
            <div className="space-y-3">
              {FAQS.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface py-2 border-b border-outline-variant/50 dark:border-outline/40">
                    {f.q}
                    <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant pt-2 pb-3">{f.a}</p>
                </details>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Contact Options</h3>
            <div className="space-y-2">
              <a href="mailto:support@buildsmart.ai" className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant"><span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">mail</span><span className="text-body-sm text-on-surface dark:text-inverse-on-surface">support@buildsmart.ai</span></a>
              <button onClick={() => toast.info('Report problem — open a ticket below')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant"><span className="material-symbols-outlined text-error">report</span><span className="text-body-sm text-on-surface dark:text-inverse-on-surface">Report a problem</span></button>
              <button onClick={() => toast.info('Security issue — email security@buildsmart.ai')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant"><span className="material-symbols-outlined text-[#A66A00]">security</span><span className="text-body-sm text-on-surface dark:text-inverse-on-surface">Report a security issue</span></button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Open a Support Ticket</h3>
            <form onSubmit={submit} className="space-y-4">
              <Field label="Subject"><input className={inputClass} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required minLength={4} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {['General', 'Billing', 'Verification', 'Design Studio', 'Marketplace', 'Account'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {['LOW', 'MEDIUM', 'HIGH'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Description"><textarea className={inputClass} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required minLength={10} /></Field>
              <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Submitting…' : 'Submit Ticket'}</button>
            </form>
          </Card>

          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Your Tickets</h3>
            {loading ? <Skeleton className="h-24" /> : (data?.tickets ?? []).length === 0 ? (
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No tickets yet.</p>
            ) : (
              <div className="space-y-2">
                {(data?.tickets ?? []).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{t.subject}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{t.category} · {t.priority}</p></div>
                    <StatusPill status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
