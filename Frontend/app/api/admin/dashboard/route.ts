import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

function bucketBy(range: number): { size: number; unit: 'day' | 'month' } {
  return range > 90 ? { size: 30, unit: 'month' } : { size: 1, unit: 'day' };
}

// Build a labelled time series of `count` over the last `range` days.
function series(rows: any[], getDate: (r: any) => Date | null, range: number, aggregate: 'count' | 'sum' = 'count', getValue?: (r: any) => number) {
  const { size, unit } = bucketBy(range);
  const now = Date.now();
  const buckets: { label: string; value: number; from: number; to: number }[] = [];
  const steps = unit === 'month' ? Math.ceil(range / 30) : range;
  for (let i = steps - 1; i >= 0; i--) {
    const to = now - i * size * 86400000;
    const from = to - size * 86400000;
    const d = new Date(to);
    const label = unit === 'month' ? d.toLocaleString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    buckets.push({ label, value: 0, from, to });
  }
  for (const r of rows) {
    const t = getDate(r)?.getTime();
    if (!t) continue;
    const b = buckets.find((x) => t >= x.from && t <= x.to);
    if (b) b.value += aggregate === 'sum' ? (getValue?.(r) ?? 0) : 1;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const range = Number(new URL(req.url).searchParams.get('range') ?? 30) || 30;

  const users: any[] = await dbClient.user.findMany();
  const architects: any[] = await dbClient.architectProfile.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const projects: any[] = await dbClient.project.findMany();
  const products: any[] = await dbClient.product.findMany();
  const orders: any[] = await dbClient.order.findMany();
  const payments: any[] = await dbClient.payment.findMany();
  const invoices: any[] = await dbClient.invoice.findMany();
  const tickets: any[] = await dbClient.supportTicket.findMany();
  const security: any[] = await dbClient.securityEvent.findMany();
  const reports: any[] = await dbClient.report.findMany();
  const disputes: any[] = await dbClient.dispute.findMany();
  const activities: any[] = await dbClient.activity.findMany();
  const auditRows: any[] = await dbClient.auditLog.findMany();
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: auth.user.id } });

  const week = Date.now() - 7 * 86400000;
  const activeUsers = users.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= week).length;
  const pendingVerifications = [...architects, ...vendors].filter((p) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED'].includes(p.verificationStatus)).length;
  const succeeded = payments.filter((p) => p.status === 'SUCCEEDED');
  const revenue = succeeded.reduce((s, p) => s + (p.amount ?? 0), 0);
  const pendingPayments = invoices.filter((i) => i.status === 'PENDING');
  const openTickets = tickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER'].includes(t.status)).length;

  const kpis = {
    totalUsers: users.length,
    activeUsers,
    architects: users.filter((u) => u.role === 'ARCHITECT').length,
    clients: users.filter((u) => u.role === 'CLIENT').length,
    vendors: users.filter((u) => u.role === 'VENDOR').length,
    pendingVerifications,
    activeProjects: projects.filter((p) => !['COMPLETED', 'ARCHIVED', 'DRAFT'].includes(p.status)).length,
    products: products.length,
    orders: orders.length,
    revenue,
    pendingPayments: pendingPayments.length,
    pendingPaymentsTotal: pendingPayments.reduce((s, i) => s + (i.total ?? 0), 0),
    openTickets,
    openReports: reports.filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status)).length,
    openDisputes: disputes.filter((d) => ['OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'ESCALATED'].includes(d.status)).length,
    securityAlerts: security.filter((s) => s.status === 'OPEN').length,
  };

  const charts = {
    userGrowth: series(users, (u) => u.createdAt, range),
    revenue: series(succeeded, (p) => p.createdAt, range, 'sum', (p) => p.amount ?? 0),
    orders: series(orders, (o) => o.createdAt, range),
    verification: series(
      [...architects, ...vendors].filter((p) => p.verifiedAt),
      (p) => p.verifiedAt,
      range
    ),
    orderStatus: (() => {
      const counts: Record<string, number> = {};
      for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
      return Object.entries(counts).map(([label, value]) => ({ label, value }));
    })(),
    userRoles: (() => {
      const counts: Record<string, number> = {};
      for (const u of users) counts[u.role] = (counts[u.role] ?? 0) + 1;
      return Object.entries(counts).map(([label, value]) => ({ label, value }));
    })(),
  };

  // Merged activity feed (activities + audit + security) with deep links.
  const feed = [
    ...activities.map((a) => ({ id: a.id, kind: 'activity', type: a.type, title: a.title, body: a.body, at: a.createdAt, link: null })),
    ...auditRows.map((a) => ({ id: a.id, kind: 'audit', type: 'AUDIT', title: a.action, body: `${a.resource}${a.resourceId ? ' ' + a.resourceId : ''} — ${a.result}`, at: a.createdAt, link: null })),
    ...security.map((s) => ({ id: s.id, kind: 'security', type: 'SECURITY', title: `${s.severity} — ${s.type}`, body: s.description, at: s.createdAt, link: '/admin/security' })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  return NextResponse.json({
    kpis,
    charts,
    recentActivity: feed,
    notifications: notifications.slice(0, 6),
    verificationPending: pendingVerifications,
  });
}
