'use client';

import Link from 'next/link';
import { PageHeader, Card, StatCard, StatusPill, Skeleton, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';
import { MarketplaceCatalog } from '@/Frontend/components/marketplace/MarketplaceCatalog';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

export default function ClientDashboardPage() {
  const { data, loading, error } = useApi<any>('/api/client/dashboard');

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div></div>;
  if (error) return <div className="p-margin-mobile md:p-margin-desktop"><EmptyState icon="error" title="Could not load your dashboard" body={error} /></div>;

  const s = data.stats;
  const ready3d = data.ready3d ?? [];
  const generating3d = (data.published3d ?? []).filter((p: any) => p.status !== 'PUBLISHED');

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader
        title={`Welcome back, ${data.user.name.split(' ')[0]}`}
        subtitle="A real-time overview of your projects, designs and pending actions."
        crumbs={['Client', 'Overview', 'Dashboard']}
      />

      {/* 3D floorplan status banner */}
      {ready3d.length > 0 && (
        <Card className="mb-6 border-primary/30 dark:border-primary/40 bg-secondary-container/60 dark:bg-primary-container/20">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="material-symbols-outlined text-[36px] text-primary dark:text-primary-fixed-dim">view_in_ar</span>
            <div className="flex-1">
              <h3 className="text-headline-sm text-primary dark:text-primary-fixed-dim">Your 3D floorplan is ready</h3>
              <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">Explore the generated model and provide feedback to your architect.</p>
            </div>
            <Link href={`/client/3d?project=${ready3d[0].projectId}&plan=${ready3d[0].id}`} className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-label-md font-semibold hover:bg-[#264B3E]">
              View 3D Floorplan
            </Link>
          </div>
        </Card>
      )}
      {ready3d.length === 0 && generating3d.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant dark:text-surface-variant animate-spin">progress_activity</span>
            <div>
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Your architect is still preparing the 3D floorplan</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">You will receive a notification when it is ready for review.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="architecture" label="Total Projects" value={String(s.totalProjects)} />
        <StatCard icon="autorenew" label="Active Projects" value={String(s.activeProjects)} tone="blue" />
        <StatCard icon="task_alt" label="Completed" value={String(s.completedProjects)} tone="green" />
        <StatCard icon="inbox" label="Pending Requests" value={String(s.pendingRequests)} tone="amber" />
        <StatCard icon="collections_bookmark" label="Designs Awaiting Review" value={String(s.designsAwaitingReview)} tone="blue" />
        <StatCard icon="fact_check" label="Designs Awaiting Approval" value={String(s.designsAwaitingApproval)} />
        <StatCard icon="view_in_ar" label="New 3D Floorplans" value={String(s.new3dReady)} tone="green" />
        <StatCard icon="rate_review" label="3D Awaiting Feedback" value={String(s.floorplansAwaitingFeedback)} tone="amber" />
        <StatCard icon="calendar_month" label="Upcoming Appointments" value={String(s.upcomingAppointments)} />
        <StatCard icon="forum" label="Unread Messages" value={String(s.unreadMessages)} tone="blue" />
        <StatCard icon="payments" label="Pending Payments" value={String(s.pendingPayments)} meta={fmt(s.pendingPaymentsTotal) + ' XAF'} tone="amber" />
        <StatCard icon="receipt_long" label="Active Orders" value={String(s.activeOrders)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Recent Activity</h3>
            <Link href="/client/projects" className="text-label-md text-primary dark:text-primary-fixed-dim">View projects</Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <EmptyState icon="timeline" title="No recent activity" body="Actions on your projects will appear here." />
          ) : (
            <div className="space-y-3">
              {data.recentActivity.map((a: any) => (
                <div key={a.id} className="flex gap-3">
                  <span className="material-symbols-outlined text-[20px] text-primary dark:text-primary-fixed-dim mt-0.5">check_circle</span>
                  <div className="min-w-0">
                    <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{a.title}</p>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">{a.body}</p>
                    <p className="text-label-md text-on-surface-variant/70 dark:text-surface-variant/70">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right column: quick actions + appointments + notifications */}
        <div className="space-y-6">
          <Card>
            <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Request New Design', icon: 'post_add', href: '/client/requests' },
                { label: 'View Projects', icon: 'architecture', href: '/client/projects' },
                { label: 'Review Design', icon: 'fact_check', href: '/client/revisions' },
                { label: 'View 3D Floorplan', icon: 'view_in_ar', href: '/client/3d' },
                { label: 'Message Architect', icon: 'forum', href: '/client/messages' },
                { label: 'View BOQ', icon: 'request_quote', href: '/client/boq' },
                { label: 'Browse Marketplace', icon: 'storefront', href: '/client/marketplace' },
                { label: 'Make Payment', icon: 'payments', href: '/client/payments' },
              ].map((a) => (
                <Link key={a.label} href={a.href} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-outline-variant dark:border-outline text-body-sm text-on-surface dark:text-inverse-on-surface hover:bg-secondary-container dark:hover:bg-primary-container hover:text-primary dark:hover:text-primary-fixed-dim transition-colors">
                  <span className="material-symbols-outlined text-[18px]">{a.icon}</span>{a.label}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Upcoming Appointments</h3>
              <Link href="/client/appointments" className="text-label-md text-primary dark:text-primary-fixed-dim">All</Link>
            </div>
            {data.upcomingAppointments.length === 0 ? (
              <EmptyState icon="calendar_month" title="No upcoming appointments" />
            ) : (
              <div className="space-y-2">
                {data.upcomingAppointments.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div>
                      <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{a.title}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{a.date} · {a.startTime}</p>
                    </div>
                    <StatusPill status={a.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Notifications</h3>
              <Link href="/client/notifications" className="text-label-md text-primary dark:text-primary-fixed-dim">All</Link>
            </div>
            {data.notifications.length === 0 ? (
              <EmptyState icon="notifications" title="You're all caught up" body="No new notifications." />
            ) : (
              <div className="space-y-2">
                {data.notifications.map((n: any) => (
                  <Link key={n.id} href={n.link ?? '/client/notifications'} className={`block p-3 rounded-lg ${n.read ? 'bg-surface-container-low/50 dark:bg-surface-variant/50' : 'bg-secondary-container/50 dark:bg-primary-container/30'}`}>
                    <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{n.title}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{new Date(n.createdAt).toLocaleString()}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Integrated Marketplace with Categories */}
      <div className="mt-10 pt-8 border-t border-outline-variant/60 dark:border-outline/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-on-surface dark:text-inverse-on-surface">
              Marketplace & Construction Materials
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5">
              Source verified building materials directly from certified suppliers with 100% Escrow Protection.
            </p>
          </div>
          <Link
            href="/client/cart"
            className="btn-secondary px-4 py-2 rounded-xl text-label-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto border border-outline-variant dark:border-outline shadow-sm hover:shadow"
          >
            <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            View Cart
          </Link>
        </div>

        <MarketplaceCatalog />
      </div>
    </div>
  );
}
