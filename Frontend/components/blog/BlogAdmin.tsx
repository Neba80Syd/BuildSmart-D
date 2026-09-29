'use client';

import { useState } from 'react';
import { toast } from 'sonner';

type Post = { id: string; title: string; category: string; excerpt: string; content: string; status: string };

export function BlogAdmin({ posts, isAdmin }: { posts: Post[]; isAdmin: boolean }) {
  const [form, setForm] = useState({ title: '', category: 'AI & Architecture', excerpt: '', content: '' });
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const create = async () => {
    if (form.title.trim().length < 3 || form.excerpt.trim().length < 10 || form.content.trim().length < 20) {
      toast.error('Title (3+), excerpt (10+), and content (20+) are required.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, status: 'DRAFT' }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success('Draft created');
      setForm({ title: '', category: 'AI & Architecture', excerpt: '', content: '' });
    } else toast.error(data.error ?? 'Could not create post');
  };

  const toggle = async (p: Post) => {
    await fetch('/api/blog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: p.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }),
    });
    toast.success('Post updated');
  };

  const remove = async (id: string) => {
    await fetch(`/api/blog?id=${id}`, { method: 'DELETE' });
    toast.success('Post deleted');
  };

  const field =
    'w-full bg-white dark:bg-tertiary border border-[#DDE2E0] dark:border-outline-variant/30 rounded-lg px-3 py-2 text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-[#315C4C]';

  return (
    <div className="mt-12 space-y-6">
      <h2 className="text-headline-md font-semibold text-on-background dark:text-surface-container-lowest">Admin — Manage Content</h2>

      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation space-y-3">
        <input className={field} placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {['AI & Architecture', 'Construction', 'Building Materials', 'Architectural Design', 'Project Management'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className={field} placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        <textarea className={`${field} min-h-28`} placeholder="Content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <button onClick={create} disabled={saving} className="btn-primary px-5 py-2.5 rounded-lg text-label-md disabled:opacity-60">
          {saving ? 'Creating…' : 'Create Draft'}
        </button>
      </div>

      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl divide-y divide-outline-variant dark:divide-outline">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest truncate">{p.title}</div>
              <div className="text-label-md text-on-surface-variant dark:text-surface-variant">
                {p.category} · <span className={p.status === 'PUBLISHED' ? 'text-[#2F6B50]' : 'text-[#A66A00]'}>{p.status}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggle(p)} className="btn-secondary px-3 py-1.5 rounded-lg text-label-md">
                {p.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={() => remove(p.id)} className="px-3 py-1.5 rounded-lg text-label-md text-error dark:text-error-container border border-outline-variant dark:border-outline hover:bg-error/5">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
