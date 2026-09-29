'use client';

import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

type Status = { role: string; name: string; verificationStatus: string; licenseNumber: string; experience: number | null };

function VerificationInner() {
  const [role, setRole] = useState<'ARCHITECT' | 'VENDOR'>('ARCHITECT');
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ fullName: '', licenseNumber: '', experience: '' });

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('as')?.toUpperCase();
    setRole(param === 'VENDOR' ? 'VENDOR' : 'ARCHITECT');
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/verification?role=${role}`);
      const data = await res.json();
      setStatus(data);
      setForm((f) => ({
        ...f,
        fullName: f.fullName || data.name || '',
        licenseNumber: f.licenseNumber || data.licenseNumber || '',
        experience: f.experience || (data.experience != null ? String(data.experience) : ''),
      }));
      setLoading(false);
    })();
  }, [role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch(`/api/verification?role=${role}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      toast.success('Application submitted for review');
      setStatus({ ...(status as Status), verificationStatus: 'PENDING' });
    } else toast.error(data.error ?? 'Submission failed');
  };

  const submitted = status && ['PENDING', 'VERIFIED', 'FULLY_VERIFIED'].includes(status.verificationStatus);

  return (
    <div className="max-w-2xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest">Professional Verification</h1>
        <div className="flex items-center gap-1 border border-outline-variant dark:border-outline rounded-lg p-1">
          {(['ARCHITECT', 'VENDOR'] as const).map((r) => (
            <button key={r} onClick={() => setRole(r)} className={`text-label-md px-3 py-1.5 rounded-md transition-colors ${role === r ? 'bg-primary text-on-primary' : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}>
              {r === 'ARCHITECT' ? 'Architect' : 'Vendor'}
            </button>
          ))}
        </div>
      </div>
      <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-6">
        Submit your credentials for review. Only verified professionals appear with badges and gain full workspace access.
      </p>

      <div className="mb-6 p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant border border-outline-variant flex items-center justify-between gap-4">
        <div>
          <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">Looking for document & file uploads?</p>
          <p className="text-body-xs text-on-surface-variant dark:text-surface-variant">Access the specialized credential upload portal for {role === 'ARCHITECT' ? 'Architects' : 'Vendors'}.</p>
        </div>
        <a
          href={role === 'ARCHITECT' ? '/architect/verification' : '/vendor/verification'}
          className="btn-primary text-label-md px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1"
        >
          <span>Open {role === 'ARCHITECT' ? 'Architect' : 'Vendor'} Portal</span>
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </a>
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p>
      ) : !submitted ? (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Full Name / Business Name</label>
              <input className="input w-full" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">License / Registration #</label>
                <input className="input w-full" required value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
              </div>
              <div>
                <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Years of Experience</label>
                <input type="number" className="input w-full" required value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Upload Credentials (PDF/JPG)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="input w-full" />
              <div className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">Files are stored privately and reviewed by our team.</div>
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5 rounded-lg text-label-md disabled:opacity-60">
              {submitting ? 'Submitting…' : 'Submit for Review'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
          <div className="text-center py-6">
            <div className="text-4xl mb-4">{status!.verificationStatus === 'PENDING' ? '⏳' : '✅'}</div>
            <div className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest">
              {status!.verificationStatus === 'PENDING' ? 'Application Submitted' : 'Verification Approved'}
            </div>
            <p className="text-body-md text-on-surface-variant dark:text-surface-variant mt-2">
              {status!.verificationStatus === 'PENDING'
                ? 'Your documents are under review. You will be notified within 48 hours.'
                : 'Your credentials have been verified. Your professional badge is live.'}
            </p>
            <div className="mt-6 inline-block badge badge-warning">{status!.verificationStatus} — {status!.verificationStatus === 'PENDING' ? 'UNDER REVIEW' : 'ACTIVE'}</div>
            {status!.verificationStatus !== 'PENDING' && (
              <div className="mt-6">
                <button onClick={() => { setStatus({ ...status!, verificationStatus: 'UNVERIFIED' }); }} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">
                  Resubmit credentials
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="p-margin-desktop text-on-surface-variant">Loading…</div>}>
      <VerificationInner />
    </Suspense>
  );
}
