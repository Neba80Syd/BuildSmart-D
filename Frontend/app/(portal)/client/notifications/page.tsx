'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Skeleton, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientNotificationsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/notifications');
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const mark = async (ids: string[] | null, read: boolean) => {
    try { await api('PATCH', '/api/client/notifications', ids ? { read, ids } : { read, markAll: true }); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const del = async (ids: string[] | null) => {
    try { await api('DELETE', '/api/client/notifications', ids ? { ids } : { all: true }); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const all = data?.notifications ?? [];
  const unreadIds = all.filter((n: any) => !n.read).map((n: any) => n.id);
  const list = all.filter((n: any) => (q ? (n.title + ' ' + (n.body ?? '')).toLowerCase().includes(q.toLowerCase()) : true));

  const tabs = ['all', 'unread', ...(data?.categories ?? [])];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Notifications" subtitle="Categorized updates across your projects, designs and orders." crumbs={['Client', 'Communication', 'Notifications']}
        actions={
          <>
            <button className={btnGhost} onClick={() => mark(null, true)}>Mark all read</button>
            <button className={btnGhost} onClick={() => del(null)}>Clear all</button>
          </>
        } />

      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-full text-label-md capitalize ${filter === t ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>
            {t}{t !== 'all' && t !== 'unread' && data?.counts?.[t] ? ` (${data.counts[t]})` : ''}
          </button>
        ))}
        <input className="ml-auto px-3 py-1.5 rounded-lg border border-outline-variant dark:border-outline text-body-sm bg-white dark:bg-surface-dim dark:text-on-surface" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <EmptyState icon="notifications" title="You're all caught up" body="No new notifications." />
      ) : (
        <div className="space-y-2">
          {list.map((n: any) => (
            <div key={n.id} className={`p-3 rounded-lg border ${n.read ? 'border-outline-variant/50 dark:border-outline/40 bg-surface-container-low/40 dark:bg-surface-variant/40' : 'border-primary/30 dark:border-primary/40 bg-secondary-container/40 dark:bg-primary-container/20'}`}>
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-[20px] ${n.read ? 'text-on-surface-variant dark:text-surface-variant' : 'text-primary dark:text-primary-fixed-dim'}`}>notifications</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] uppercase tracking-wide bg-surface-container-high dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant px-2 py-0.5 rounded-full">{n.category}</span>
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface mt-1">{n.title}</p>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{n.body}</p>
                  {n.link && <Link href={n.link} onClick={() => mark([n.id], true)} className="inline-block mt-1 text-label-md font-semibold text-primary dark:text-primary-fixed-dim">View resource →</Link>}
                </div>
                <div className="flex flex-col gap-1">
                  {!n.read && <button className="text-label-md text-primary dark:text-primary-fixed-dim" onClick={() => mark([n.id], true)}>Read</button>}
                  <button className="text-label-md text-error" onClick={() => del([n.id])}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {unreadIds.length > 0 && <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{unreadIds.length} unread</p>}
        </div>
      )}
    </div>
  );
}
