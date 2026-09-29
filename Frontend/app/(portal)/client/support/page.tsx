'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, Skeleton, inputClass, btnPrimary } from '@/Frontend/components/architect/ui';
import { api } from '@/Frontend/components/architect/hooks';

const FAQS = [
  { q: 'How do I submit a design request?', a: 'Go to Design Requests and click "New Request". Describe your needs, attach any references, and submit. A verified architect will respond with a design.' },
  { q: 'How do I review a 3D floorplan?', a: 'When your architect publishes a 3D floorplan you will be notified. Open 3D Visualization, explore the model, and submit structured feedback or approve it.' },
  { q: 'Can I edit the 3D model myself?', a: 'No. As a client you review and approve. The architect owns and edits the design and 3D models.' },
  { q: 'How are payments handled?', a: 'Invoice and order totals are computed securely on the server. You choose a payment method and confirm — never edit amounts manually.' },
  { q: 'How do I contact my architect?', a: 'Use Messages for direct communication, or schedule an Appointment for a structured consultation.' },
];

export default function ClientSupportPage() {
  const [open, setOpen] = useState<number | null>(0);
  const [form, setForm] = useState({ subject: '', message: '', category: 'General' });
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!form.subject || !form.message) return toast.error('Please fill in all fields');
    setSending(true);
    try { await api('POST', '/api/client/messages', { content: `[Support: ${form.category}] ${form.subject} — ${form.message}`, support: true }); toast.success('Support request sent'); setForm({ subject: '', message: '', category: 'General' }); }
    catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[800px] mx-auto">
      <PageHeader title="Help & Support" subtitle="Find answers or reach out for assistance." crumbs={['Client', 'Account', 'Help & Support']} />

      <Card className="mb-6">
        <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Frequently Asked Questions</h3>
        <div className="space-y-1">
          {FAQS.map((f, i) => (
            <div key={i} className="border-b border-outline-variant/50 dark:border-outline/40 last:border-0">
              <button className="w-full flex items-center justify-between py-3 text-left" onClick={() => setOpen(open === i ? null : i)}>
                <span className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{f.q}</span>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-surface-variant">{open === i ? 'remove' : 'add'}</span>
              </button>
              {open === i && <p className="pb-3 text-body-sm text-on-surface-variant dark:text-surface-variant">{f.a}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Contact Support</h3>
        <div className="space-y-3">
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['General', 'Billing', 'Technical', 'Account', 'Feedback'].map((c) => <option key={c}>{c}</option>)}</select>
          <input className={inputClass} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className={inputClass} rows={4} placeholder="Describe your issue…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button className={btnPrimary} onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send Message'}</button>
        </div>
      </Card>
    </div>
  );
}
