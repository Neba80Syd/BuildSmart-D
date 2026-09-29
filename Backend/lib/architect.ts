// BuildSmart AI — architect console server helpers.
// All data is scoped to the acting architect via `architectId` so the dashboard
// modules never leak other professionals' resources (server-side authorization).

import { dbClient } from '@/Backend/lib/db';

export const CURRENCY = 'XAF';
export const COMMISSION_RATE = 0.05; // platform commission on architect fees

export type Context = {
  architectId: string;
  profile: any;
};

/** Resolve the architect profile + canonical architectId from the acting user. */
export async function getArchitectContext(userId: string): Promise<Context> {
  const profile = await dbClient.architectProfile.findUnique({ where: { userId } });
  const architectId = userId;
  return { profile, architectId };
}

const parseJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/** Projects owned/assigned to the architect, enriched with client names. */
export async function getArchitectProjects(architectId: string): Promise<any[]> {
  const projects: any[] = await dbClient.project.findMany({ where: { architectId } });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Client';
  return projects.map((p) => ({
    ...p,
    clientName: nameFor(p.ownerId),
    requirements: parseJson(p.requirements, []),
  }));
}

/** Clients derived from the architect's projects + design requests. */
export async function getArchitectClients(architectId: string): Promise<any[]> {
  const projects = await getArchitectProjects(architectId);
  const requests: any[] = await dbClient.designRequest.findMany({ where: { architectId } });
  const users: any[] = await dbClient.user.findMany();
  const profileFor = (id: string) => users.find((u) => u.id === id);
  const emailFor = (id: string) => profileFor(id)?.email ?? '';

  const map = new Map<string, any>();
  const touch = (id: string, name: string) => {
    if (!map.has(id)) {
      map.set(id, { id, name, email: emailFor(id), projects: 0, activeProjects: 0, requests: 0, lastInteraction: null });
    }
    return map.get(id);
  };
  for (const p of projects) {
    const c = touch(p.ownerId, p.clientName);
    c.projects += 1;
    if (!['COMPLETED', 'ARCHIVED'].includes(p.status)) c.activeProjects += 1;
    if (!c.lastInteraction || new Date(p.updatedAt) > new Date(c.lastInteraction)) c.lastInteraction = p.updatedAt;
  }
  for (const r of requests) {
    const c = touch(r.clientId, r.clientName);
    c.requests += 1;
    if (!c.lastInteraction || new Date(r.updatedAt) > new Date(c.lastInteraction)) c.lastInteraction = r.updatedAt;
  }
  return Array.from(map.values()).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

export type AnalyticsRange = '7d' | '30d' | '90d' | '180d' | '365d';

/** Build the analytics payload used by Reports & Analytics. */
export async function buildArchitectAnalytics(architectId: string, range: AnalyticsRange = '30d'): Promise<any> {
  const rangeDays = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 }[range];
  const since = new Date(Date.now() - rangeDays * 86400000);

  const projects = await getArchitectProjects(architectId);
  const clients = await getArchitectClients(architectId);
  const designs: any[] = await dbClient.design.findMany({ where: { architectId } });
  const orders: any[] = await dbClient.order.findMany({ where: { userId: architectId } });
  const transactions: any[] = await dbClient.transaction.findMany({ where: { userId: architectId } });
  const reviews: any[] = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: architectId, status: 'APPROVED' } });

  const active = projects.filter((p) => !['COMPLETED', 'ARCHIVED'].includes(p.status));
  const completed = projects.filter((p) => p.status === 'COMPLETED');

  // Projects by category (type)
  const byType = new Map<string, number>();
  for (const p of projects) byType.set(p.projectType ?? 'Custom', (byType.get(p.projectType ?? 'Custom') ?? 0) + 1);

  // Earnings series (last N days, bucketed by day)
  const earningsSeries: { day: string; revenue: number }[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ymd = d.toISOString().slice(0, 10);
    const dayTx = transactions.filter((t) => t.kind === 'EARNING' && t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) === ymd);
    earningsSeries.push({ day: ymd, revenue: dayTx.reduce((s: number, t: any) => s + t.amount, 0) });
  }

  const totalEarnings = transactions.filter((t) => t.kind === 'EARNING' && t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const pendingEarnings = transactions.filter((t) => t.kind === 'EARNING' && t.status === 'PENDING').reduce((s: number, t: any) => s + t.amount, 0);

  const avgRating = reviews.length ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;
  const ratingDist = [5, 4, 3, 2, 1].map((star) => ({ label: `${star}★`, value: reviews.filter((r) => r.rating === star).length }));

  const spending = orders.filter((o) => ['DELIVERED', 'SHIPPED', 'PROCESSING', 'CONFIRMED'].includes(o.status)).reduce((s: number, o: any) => s + o.totalAmount, 0);

  const aiDesigns = designs.filter((d) => d.aiGenerated).length;
  const approvedDesigns = designs.filter((d) => d.status === 'APPROVED').length;

  const newClientsInRange = clients.filter((c) => c.lastInteraction && new Date(c.lastInteraction) >= since).length;

  return {
    range,
    rangeDays,
    projects: {
      total: projects.length,
      active: active.length,
      completed: completed.length,
      byType: Array.from(byType.entries()).map(([label, value]) => ({ label, value })),
    },
    clients: { total: clients.length, newInRange: newClientsInRange },
    designs: {
      total: designs.length,
      aiGenerated: aiDesigns,
      approved: approvedDesigns,
      revisionRate: designs.length ? Number(((designs.filter((d) => d.status === 'REVISION').length / designs.length) * 100).toFixed(0)) : 0,
    },
    marketplace: { orders: orders.length, spending },
    financial: {
      totalEarnings,
      pendingEarnings,
      earningsSeries,
    },
    reputation: { average: Number(avgRating.toFixed(1)), count: reviews.length, distribution: ratingDist },
  };
}
