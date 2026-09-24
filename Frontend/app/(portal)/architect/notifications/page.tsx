'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Skeleton, iconBtn, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const CAT_ICON: Record<string, string> = {
  PROJECTS: 'architecture', REQUESTS: 'inbox', CLIENTS: 'groups', VERIFICATION: 'verified', MARKETPLACE: 'storefront', PAYMENTS: 'account_balance',
  MESSAGES: 'forum', SYSTEM: 'settings', AI: 'auto_awesome', APPOINTMENTS: 'calendar_month', REVIEWS: 'reviews',
};

export default function ArchitectNotificationsPage() {
  const { data, loading, refetch } = useApi<{ notifications: any[]; unread: number; categories: string[] }>('/api/architect/notifications');
  const [filter, setFilter] = useState<'All' | 'Unread' | string>('All');

  const items = data?.notifications ?? [];
  const filtered = items.filter((n) => filter === 'All' ? true : filter === 'Unread' ? !n.read : n.category === filter);

  const mark = async (ids: string[] | null) => {
    try {
      await api('PATCH', '/api/architect/notifications', { read: true, ...(ids ? { ids } : { markAll: true }) });
      refetch();
    } catch (err: any) { toast.error(err.message); }
  };

  const dismiss = async (id: string) => {
    try { await api('DELETE', `/api/architect/notifications?id=${id}`); toast.success('Dismissed'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };

  const tabs = ['All', 'Unread', ...(data?.categories ?? [])];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[900px] mx-auto">
      <PageHeader title="Notifications" subtitle={`${data?.unread ?? 0} unread notifications.`} crumbs={['Architect', 'Collaboration', 'Notifications']} actions={
        <button className={btnGhost} onClick={() => mark(null)}><span className="material-symbols-outlined text-[18px]">done_all</span>Mark all read</button>
      } />

      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
        {tabs.map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-full text-label-md whitespace-nowrap border ${filter === t ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="notifications" title="No notifications" body="You're all caught up." />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <Card key={n.id} pad={false} className={`flex items-start gap-3 ${!n.read ? 'border-primary/40' : ''}`}>
              <div className="p-4">
                <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-[22px]">{CAT_ICON[n.category] ?? 'notifications'}</span>
              </div>
              <div className="flex-1 py-3 pr-3 min-w-0">
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => { if (!n.read) mark([n.id]); }}
                    className="block hover:opacity-90 transition-opacity"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-body-md text-on-surface dark:text-inverse-on-surface ${!n.read ? 'font-semibold' : ''}`}>{n.title}</h3>
                      <span className="material-symbols-outlined text-[18px] text-primary dark:text-primary-fixed-dim shrink-0">arrow_forward</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{n.body}</p>
                  </Link>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`text-body-md text-on-surface dark:text-inverse-on-surface ${!n.read ? 'font-semibold' : ''}`}>{n.title}</h3>
                      <span className="text-label-md text-on-surface-variant dark:text-surface-variant shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{n.body}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 p-3">
                {!n.read && <button className={iconBtn} title="Mark read" onClick={() => mark([n.id])}><span className="material-symbols-outlined">mark_email_read</span></button>}
                <button className={iconBtn} title="Dismiss" onClick={() => dismiss(n.id)}><span className="material-symbols-outlined">close</span></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
