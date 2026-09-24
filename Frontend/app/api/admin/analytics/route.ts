import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const range = Number(new URL(req.url).searchParams.get('range') ?? 90) || 90;
  const cutoff = Date.now() - range * 86400000;
  const inRange = (d: any) => d && new Date(d).getTime() >= cutoff;

  const users: any[] = await dbClient.user.findMany();
  const projects: any[] = await dbClient.project.findMany();
  const products: any[] = await dbClient.product.findMany();
  const orders: any[] = await dbClient.order.findMany();
  const payments: any[] = await dbClient.payment.findMany();
  const transactions: any[] = await dbClient.transaction.findMany();
  const designs: any[] = await dbClient.design.findMany();
  const architects: any[] = await dbClient.architectProfile.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();

  const monthly = (rows: any[], get: (r: any) => any) => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      const d = get(r);
      if (!inRange(d)) continue;
      const k = new Date(d).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  };

  const revenueMonthly = (rows: any[]) => {
    const m: Record<string, number> = {};
    for (const r of rows) {
      if (!inRange(r.createdAt) || r.status !== 'SUCCEEDED') continue;
      const k = new Date(r.createdAt).toLocaleDateString('en', { month: 'short', year: '2-digit' });
      m[k] = (m[k] ?? 0) + (r.amount ?? 0);
    }
    return Object.entries(m).map(([label, value]) => ({ label, value }));
  };

  const activeCutoff = Date.now() - 7 * 86400000;

  return NextResponse.json({
    platform: {
      kpis: {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= activeCutoff).length,
        newUsers: users.filter((u) => inRange(u.createdAt)).length,
        retention: users.length ? Math.round((users.filter((u) => u.lastActiveAt && new Date(u.lastActiveAt).getTime() >= activeCutoff).length / users.length) * 100) : 0,
        growth: users.length ? Math.round((users.filter((u) => inRange(u.createdAt)).length / users.length) * 100) : 0,
      },
      series: monthly(users, (u) => u.createdAt),
    },
    users: {
      byRole: (['CLIENT', 'ARCHITECT', 'VENDOR', 'ADMIN'] as const).map((role) => ({ label: role, value: users.filter((u) => u.role === role).length })),
      byStatus: (['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const).map((s) => ({ label: s, value: users.filter((u) => (u.status ?? 'ACTIVE') === s).length })),
      registrations: monthly(users, (u) => u.createdAt),
    },
    projects: {
      kpis: {
        total: projects.length,
        active: projects.filter((p) => !['COMPLETED', 'ARCHIVED'].includes(p.status)).length,
        completed: projects.filter((p) => p.status === 'COMPLETED').length,
        approvalRate: designs.length ? Math.round((designs.filter((d) => d.status === 'APPROVED').length / designs.length) * 100) : 0,
        revisionRate: designs.length ? Math.round((designs.filter((d) => d.status === 'REVISION').length / designs.length) * 100) : 0,
      },
      byStatus: (() => {
        const m: Record<string, number> = {};
        for (const p of projects) m[p.status] = (m[p.status] ?? 0) + 1;
        return Object.entries(m).map(([label, value]) => ({ label, value }));
      })(),
      series: monthly(projects, (p) => p.createdAt),
    },
    marketplace: {
      kpis: {
        products: products.length,
        activeListings: products.filter((p) => p.isActive).length,
        orders: orders.length,
        sales: orders.filter((o) => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0),
        pendingProducts: products.filter((p) => p.approvalStatus === 'PENDING').length,
      },
      popularCategories: (() => {
        const m: Record<string, number> = {};
        for (const p of products) m[p.category] = (m[p.category] ?? 0) + 1;
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
      })(),
      vendorPerformance: vendors.map((v) => ({
        label: v.businessName ?? v.userId,
        products: products.filter((p) => p.vendorId === v.userId).length,
        rating: v.rating ?? 0,
      })),
      series: monthly(orders, (o) => o.createdAt),
    },
    revenue: {
      kpis: {
        gross: payments.filter((p) => p.status === 'SUCCEEDED' && inRange(p.createdAt)).reduce((s, p) => s + p.amount, 0),
        refunds: transactions.filter((t) => t.kind === 'REFUND' && inRange(t.createdAt)).reduce((s, t) => s + t.amount, 0),
        subscriptions: transactions.filter((t) => t.kind === 'SUBSCRIPTION' && inRange(t.createdAt)).reduce((s, t) => s + t.amount, 0),
        net: payments.filter((p) => p.status === 'SUCCEEDED' && inRange(p.createdAt)).reduce((s, p) => s + p.amount, 0) - transactions.filter((t) => t.kind === 'REFUND' && inRange(t.createdAt)).reduce((s, t) => s + t.amount, 0),
      },
      series: revenueMonthly(payments),
    },
    architects,
    range,
    note: 'Figures are computed from recorded data; incomplete periods are labelled where applicable.',
  });
}
