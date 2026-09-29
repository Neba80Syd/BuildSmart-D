import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// Global admin search across authorized platform resources.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase();
  const match = (hay: string) => !q || hay.toLowerCase().includes(q);

  const users: any[] = await dbClient.user.findMany();
  const projects: any[] = await dbClient.project.findMany();
  const products: any[] = await dbClient.product.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const orders: any[] = await dbClient.order.findMany();
  const payments: any[] = await dbClient.payment.findMany();
  const transactions: any[] = await dbClient.transaction.findMany();
  const tickets: any[] = await dbClient.supportTicket.findMany();
  const reports: any[] = await dbClient.report.findMany();
  const disputes: any[] = await dbClient.dispute.findMany();
  const architects: any[] = await dbClient.architectProfile.findMany();

  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';

  const results: any = {
    users: users.filter((u) => match(`${u.name} ${u.email} ${u.role}`)).slice(0, 20).map((u) => ({ id: u.id, title: u.name, sub: u.email, meta: u.role, href: `/admin/users?id=${u.id}` })),
    projects: projects.filter((p) => match(`${p.name} ${p.location}`)).slice(0, 20).map((p) => ({ id: p.id, title: p.name, sub: p.location, meta: p.status, href: `/admin/projects?id=${p.id}` })),
    architects: architects.filter((a) => match(nameFor(a.userId))).slice(0, 20).map((a) => ({ id: a.userId, title: nameFor(a.userId), sub: a.licenseNumber, meta: a.verificationStatus, href: `/admin/users?id=${a.userId}` })),
    vendors: vendors.filter((v) => match(`${v.businessName} ${v.location}`)).slice(0, 20).map((v) => ({ id: v.userId, title: v.businessName, sub: v.location, meta: v.verificationStatus, href: `/admin/vendors?id=${v.userId}` })),
    products: products.filter((p) => match(`${p.name} ${p.category} ${p.sku}`)).slice(0, 20).map((p) => ({ id: p.id, title: p.name, sub: p.category, meta: p.approvalStatus, href: `/admin/products?id=${p.id}` })),
    orders: orders.filter((o) => match(`${o.id} ${o.trackingNumber}`)).slice(0, 20).map((o) => ({ id: o.id, title: o.id, sub: o.trackingNumber, meta: o.status, href: `/admin/orders?id=${o.id}` })),
    transactions: [...payments, ...transactions].filter((t) => match(`${t.id} ${t.description}`)).slice(0, 20).map((t) => ({ id: t.id, title: t.id, sub: t.description, meta: t.status, href: '/admin/payments' })),
    tickets: tickets.filter((t) => match(`${t.subject} ${t.description}`)).slice(0, 20).map((t) => ({ id: t.id, title: t.subject, sub: t.category, meta: t.status, href: `/admin/support?id=${t.id}` })),
    reports: reports.filter((r) => match(`${r.reason} ${r.category}`)).slice(0, 20).map((r) => ({ id: r.id, title: r.reason.slice(0, 60), sub: r.category, meta: r.status, href: `/admin/reports?id=${r.id}` })),
    disputes: disputes.filter((d) => match(`${d.title} ${d.description}`)).slice(0, 20).map((d) => ({ id: d.id, title: d.title, sub: d.category, meta: d.status, href: `/admin/disputes?id=${d.id}` })),
  };

  return NextResponse.json({ query: q, results });
}
