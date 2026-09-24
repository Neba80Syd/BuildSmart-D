'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { FilterChips, timeAgo, btnGhost } from '@/Frontend/components/admin/shared';

export default function AdminNotificationsPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (onlyUnread) params.set('unread', '1');
  const qs = params.toString();

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/notifications${qs ? `?${qs}` : ''}`);

  const mark = async (read: boolean, ids?: string[]) => {
    setBusy('mark');
    try {
      await api('PATCH', '/api/admin/notifications', { read, ids });
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const clearAll = async () => {
    setBusy('clear');
    try {
      await api('DELETE', '/api/admin/notifications', { all: true });
      toast.success('Notifications cleared');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Notifications"
        subtitle="Your administrator notifications"
        crumbs={['Admin', 'Notifications']}
        actions={
          <div className="flex gap-2">
            <button className={btnGhost} disabled={busy === 'mark'} onClick={() => mark(true)}>Mark all read</button>
            <button className={btnGhost} disabled={busy === 'clear'} onClick={clearAll}>Clear all</button>
          </div>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <FilterChips options={data?.categories ?? []} value={category} onChange={setCategory} label="Category" />
          <label className="flex items-center gap-2 text-body-sm cursor-pointer">
            <input type="checkbox" className="accent-[#2F6B50]" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
            Unread only
          </label>
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load notifications.</p>}
        {loading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-surface-variant dark:bg-surface-container-high animate-pulse rounded-lg" />)}</div>
        ) : !data?.notifications?.length ? (
          <EmptyState icon="notifications" title="No notifications" body="You're all caught up." />
        ) : (
          <div className="divide-y divide-outline-variant dark:divide-outline">
            {data.notifications.map((n: any) => (
              <div key={n.id} className="px-6 py-4 flex items-start gap-3">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-outline-variant dark:bg-outline' : 'bg-primary dark:bg-primary-fixed-dim'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-on-surface dark:text-inverse-on-surface">{n.title}</p>
                  {n.body && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{n.body}</p>}
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">{n.category} · {timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button onClick={() => mark(true, [n.id])} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline shrink-0">Mark read</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
