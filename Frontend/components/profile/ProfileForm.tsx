'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function ProfileForm({ initial }: { initial: { name: string; location: string; bio: string } }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) toast.success('Profile saved');
    else toast.error(data.error ?? 'Could not save profile');
  };

  const field =
    'w-full bg-white dark:bg-tertiary border border-[#DDE2E0] dark:border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-[#315C4C] dark:focus:border-inverse-primary';

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Full Name</label>
        <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Location</label>
        <input className={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="City, Country" />
      </div>
      <div>
        <label className="block text-label-md text-on-surface-variant dark:text-surface-variant mb-1.5">Bio</label>
        <textarea className={`${field} min-h-24`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="bg-primary text-on-primary hover:bg-[#264B3E] transition-colors px-5 py-2.5 rounded-lg text-label-md disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}
