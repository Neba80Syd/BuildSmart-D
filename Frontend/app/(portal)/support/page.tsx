'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  description: string;
  messages: { author: string; body: string; createdAt: string }[];
  createdAt: string;
};

const FAQS = [
  { q: 'How do I generate a floor plan?', a: 'Open the AI Design Studio, set your requirements, and press "Generate AI Layout". A schematic plan plus area and cost estimates appear instantly.' },
  { q: 'How does the BOQ work?', a: 'The Material Estimation page turns your project into an itemized Bill of Quantities with computed subtotal, contingency and total. Export it as CSV or PDF.' },
  { q: 'How do vendors get verified?', a: 'Vendors submit business registration and credentials through the Verification page. Our team reviews documents within 48 hours.' },
  { q: 'Can I cancel my subscription?', a: 'Yes. On the Subscription page, switch to the Free plan or cancel. Access to premium features ends at the renewal date.' },
];

const STATUS_TONE: Record<string, string> = {
  OPEN: 'bg-[#315C4C]/10 text-[#315C4C] dark:bg-primary-container dark:text-on-primary-container',
  IN_PROGRESS: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
  WAITING_FOR_USER: 'bg-[#315C4C]/10 text-[#315C4C] dark:bg-secondary-container dark:text-on-secondary-container',
  RESOLVED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
  CLOSED: 'bg-surface-variant text-on-surface-variant dark:bg-surface-variant dark:text-on-surface-variant',
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ subject: '', category: 'Technical', priority: 'MEDIUM', description: '' });
  const [reply, setReply] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch(`/api/tickets${isAdmin ? '?role=ADMIN' : ''}`);
    const data = await res.json();
    setTickets(data.tickets ?? []);
    setIsAdmin(data.isAdmin ?? false);
    setLoading(false);
  };

  useEffect(() => {
    // Allow previewing the admin (all-tickets) view via ?as=admin.
    const param = new URLSearchParams(window.location.search).get('as')?.toUpperCase();
    setIsAdmin(param === 'ADMIN');
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const create = async () => {
    if (form.subject.trim().length < 4 || form.description.trim().length < 10) {
      toast.error('Please add a subject (4+) and description (10+).');
      return;
    }
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success('Ticket created');
      setForm({ subject: '', category: 'Technical', priority: 'MEDIUM', description: '' });
      load();
    } else toast.error(data.error ?? 'Could not create ticket');
  };

  const update = async (id: string, patch: { status?: string; reply?: string }) => {
    const res = await fetch(`/api/tickets${isAdmin ? '?role=ADMIN' : ''}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) {
      toast.success('Updated');
      setReply((r) => ({ ...r, [id]: '' }));
      load();
    }
  };

  const field =
    'w-full bg-white dark:bg-tertiary border border-[#DDE2E0] dark:border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-[#315C4C]';

  return (
    <div className="max-w-5xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Help Center</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Answers, guides, and direct support.</p>
        </div>
        <div className="flex items-center gap-1 border border-outline-variant dark:border-outline rounded-lg p-1">
          <a href="/support" className={`text-label-md px-3 py-1.5 rounded-md transition-colors ${!isAdmin ? 'bg-primary text-on-primary' : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}>My Tickets</a>
          <a href="/support?as=admin" className={`text-label-md px-3 py-1.5 rounded-md transition-colors ${isAdmin ? 'bg-primary text-on-primary' : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}>Admin View</a>
        </div>
      </div>

      {/* FAQs */}
      <section className="mb-12">
        <h2 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest mb-6">Frequently Asked Questions</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {FAQS.map((f) => (
            <details key={f.q} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5 shadow-elevation group">
              <summary className="cursor-pointer text-body-md font-semibold text-on-background dark:text-surface-container-lowest flex justify-between items-center">
                {f.q}
                <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
              </summary>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-3">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create ticket */}
        <section>
          <h2 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest mb-6">Contact Support</h2>
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation space-y-3">
            <input className={field} placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['Technical', 'Account', 'Billing', 'Verification', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
              <select className={field} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <textarea className={`${field} min-h-28`} placeholder="Describe your issue…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button onClick={create} className="btn-primary w-full py-2.5 rounded-lg text-label-md">Submit Ticket</button>
          </div>
        </section>

        {/* Tickets list */}
        <section>
          <h2 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest mb-6">{isAdmin ? 'All Tickets' : 'My Tickets'}</h2>
          {loading ? (
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No tickets yet.</p>
          ) : (
            <div className="space-y-4">
              {tickets.map((t) => (
                <div key={t.id} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5 shadow-elevation">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{t.subject}</div>
                      <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{t.category} · {t.priority} · {new Date(t.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${STATUS_TONE[t.status]}`}>{t.status}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">{t.description}</p>
                  {t.messages?.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {t.messages.map((m, i) => (
                        <div key={i} className={`text-body-sm p-2 rounded-lg ${m.author === 'support' ? 'bg-surface-container-low dark:bg-primary-container/10' : 'bg-surface-variant dark:bg-tertiary-container'}`}>
                          <span className="text-label-md font-semibold">{m.author}:</span> {m.body}
                        </div>
                      ))}
                    </div>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex gap-2">
                      <input className={`${field} flex-1`} placeholder="Reply…" value={reply[t.id] ?? ''} onChange={(e) => setReply({ ...reply, [t.id]: e.target.value })} />
                      <button onClick={() => update(t.id, { reply: reply[t.id] })} className="btn-primary px-3 py-2 rounded-lg text-label-md">Reply</button>
                      <select
                        className={`${field} w-36`}
                        value={t.status}
                        onChange={(e) => update(t.id, { status: e.target.value })}
                      >
                        {['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED'].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
