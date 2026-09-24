'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, Skeleton, btnGhost, iconBtn } from '@/Frontend/components/architect/ui';

type NotificationItem = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
};

const CAT_CONFIG: Record<string, { icon: string; bg: string; text: string }> = {
  Orders: { icon: 'receipt_long', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  Escrow: { icon: 'account_balance_wallet', bg: 'bg-teal-500/10 dark:bg-teal-500/20', text: 'text-teal-600 dark:text-teal-400' },
  Inventory: { icon: 'warehouse', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' },
  Reviews: { icon: 'star', bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  Messages: { icon: 'forum', bg: 'bg-sky-500/10 dark:bg-sky-500/20', text: 'text-sky-600 dark:text-sky-400' },
  Disputes: { icon: 'gavel', bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-600 dark:text-rose-400' },
  Verification: { icon: 'verified', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  System: { icon: 'notifications', bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400' },
};

function formatTime(iso: string): string {
  if (!iso) return '—';
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function VendorNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await fetch('/api/vendor/notifications');
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setCategories(data.categories ?? []);
      setCounts(data.counts ?? {});
      setUnreadTotal(data.unread ?? 0);
    } catch (e: any) {
      toast.error(e.message || 'Error loading notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const triggerHeaderUpdate = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('buildsmart:notifications-updated'));
    }
  };

  const markRead = async (ids: string[] | null, read: boolean) => {
    setBusy(true);
    try {
      const res = await fetch('/api/vendor/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          read,
          ...(ids ? { ids } : { markAll: true }),
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadNotifications();
      triggerHeaderUpdate();
      toast.success(read ? 'Marked as read' : 'Marked as unread');
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm('Are you sure you want to dismiss all notifications?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/vendor/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error('Failed to dismiss');
      await loadNotifications();
      triggerHeaderUpdate();
      toast.success('All notifications dismissed');
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const dismissOne = async (id: string) => {
    try {
      const res = await fetch(`/api/vendor/notifications?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to dismiss');
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      triggerHeaderUpdate();
      toast.success('Notification dismissed');
    } catch (e: any) {
      toast.error(e.message || 'Failed to dismiss');
    }
  };

  // Filter and search
  const visible = notifications.filter((n) => {
    if (filter === 'Unread' && n.read) return false;
    if (filter !== 'All' && filter !== 'Unread' && n.category !== filter) return false;
    if (search.trim()) {
      const term = search.toLowerCase();
      const match = `${n.title} ${n.body ?? ''} ${n.category}`.toLowerCase();
      if (!match.includes(term)) return false;
    }
    return true;
  });

  const tabs = ['All', 'Unread', ...categories];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1000px] mx-auto">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadTotal} unread update${unreadTotal === 1 ? '' : 's'} across your vendor store, orders, and wallet.`}
        crumbs={['Vendor', 'Notifications']}
        actions={
          <div className="flex items-center gap-2">
            <button
              className={btnGhost}
              disabled={busy || unreadTotal === 0}
              onClick={() => markRead(null, true)}
            >
              <span className="material-symbols-outlined text-[18px]">done_all</span>
              Mark all read
            </button>
            <button
              className={btnGhost}
              disabled={busy || notifications.length === 0}
              onClick={clearAll}
            >
              <span className="material-symbols-outlined text-[18px]">clear_all</span>
              Clear all
            </button>
          </div>
        }
      />

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-none">
          {tabs.map((tab) => {
            const isActive = filter === tab;
            const badgeCount =
              tab === 'All'
                ? notifications.length
                : tab === 'Unread'
                ? unreadTotal
                : counts[tab] ?? 0;

            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-1.5 rounded-full text-label-md whitespace-nowrap transition-all flex items-center gap-1.5 border cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-sm font-semibold'
                    : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:border-primary/50'
                }`}
              >
                <span>{tab}</span>
                {badgeCount > 0 && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab === 'Unread'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'bg-surface-container-high dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg text-body-sm text-on-surface dark:text-on-surface focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="notifications_off"
          title="No notifications found"
          body={
            filter === 'Unread'
              ? "You're completely caught up! No unread vendor notifications."
              : search
              ? `No notifications matching "${search}".`
              : 'You do not have any notifications in this category yet.'
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((n) => {
            const conf = CAT_CONFIG[n.category] ?? CAT_CONFIG.System;
            return (
              <Card
                key={n.id}
                pad={false}
                className={`transition-all hover:shadow-md border ${
                  !n.read
                    ? 'border-primary/40 bg-secondary-container/20 dark:bg-primary-container/10'
                    : 'border-outline-variant dark:border-outline bg-white dark:bg-surface-dim'
                }`}
              >
                <div className="p-4 sm:p-5 flex items-start gap-4">
                  {/* Category Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${conf.bg} ${conf.text}`}>
                    <span className="material-symbols-outlined text-[22px]">{conf.icon}</span>
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md ${conf.bg} ${conf.text}`}>
                        {n.category}
                      </span>
                      <span className="text-label-sm text-on-surface-variant/70 dark:text-surface-variant/70">
                        {formatTime(n.createdAt)}
                      </span>
                      {!n.read && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary dark:text-primary-fixed-dim">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          New
                        </span>
                      )}
                    </div>

                    <h3 className={`text-title-sm text-on-surface dark:text-on-surface ${!n.read ? 'font-bold' : 'font-medium'}`}>
                      {n.title}
                    </h3>

                    {n.body && (
                      <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 line-clamp-2">
                        {n.body}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 mt-3">
                      {n.link && (
                        <Link
                          href={n.link}
                          className="inline-flex items-center gap-1 text-label-sm font-semibold text-primary dark:text-primary-fixed-dim hover:underline"
                        >
                          View Details
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                      )}

                      <button
                        onClick={() => markRead([n.id], !n.read)}
                        className="text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                      >
                        {n.read ? 'Mark unread' : 'Mark as read'}
                      </button>

                      <button
                        onClick={() => dismissOne(n.id)}
                        className="text-label-sm text-on-surface-variant dark:text-surface-variant hover:text-error transition-colors cursor-pointer ml-auto"
                        title="Dismiss notification"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
