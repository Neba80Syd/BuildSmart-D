import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

// Global search scoped strictly to the authenticated client's own resources.
export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase();
  const matches = (hay: string) => !q || hay.toLowerCase().includes(q);

  const projects = await getClientProjects(user.id);
  const projectIds = projects.map((p) => p.id);

  // Designs + floorplans + feedback + boqs + documents for the client's projects.
  const designs: any[] = [];
  const plans: any[] = [];
  const feedback: any[] = [];
  const boqs: any[] = [];
  const documents: any[] = [];
  for (const pid of projectIds) {
    designs.push(...(await dbClient.design.findMany({ where: { projectId: pid } })));
    plans.push(...(await dbClient.floorPlan.findMany({ where: { projectId: pid } })));
    feedback.push(...(await dbClient.floorPlanFeedback.findMany({ where: { projectId: pid } })));
    boqs.push(...(await dbClient.boq.findMany({ where: { projectId: pid } })));
    documents.push(...(await dbClient.document.findMany({ where: { projectId: pid } })));
  }

  const orders: any[] = await dbClient.order.findMany({ where: { userId: user.id } });
  const invoices: any[] = await dbClient.invoice.findMany({ where: { userId: user.id } });
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const requests: any[] = await dbClient.designRequest.findMany({ where: { clientId: user.id } });
  const products: any[] = await dbClient.product.findMany();
  const architectProfiles: any[] = await dbClient.architectProfile.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';

  const results: any = {
    projects: projects.filter((p) => matches(p.name + ' ' + (p.description ?? '') + ' ' + (p.location ?? ''))).map((p) => ({ id: p.id, name: p.name, status: p.status, location: p.location, type: 'project' })),
    designs: designs.filter((d) => matches(d.name + ' ' + (d.category ?? ''))).map((d) => ({ id: d.id, name: d.name, status: d.status, version: d.version, type: 'design' })),
    plans: plans.filter((p) => matches(p.name + ' ' + (p.kind ?? ''))).map((p) => ({ id: p.id, name: p.name, kind: p.kind, version: p.version, projectId: p.projectId, type: 'floorplan' })),
    feedback: feedback.filter((f) => matches((f.description ?? '') + ' ' + (f.category ?? ''))).map((f) => ({ id: f.id, description: f.description, category: f.category, status: f.status, type: 'feedback' })),
    architects: architectProfiles.filter((a) => matches(nameFor(a.userId) + ' ' + (a.title ?? '') + ' ' + parseJson(a.specializations, []).join(' '))).map((a) => ({ id: a.userId, name: nameFor(a.userId), title: a.title, type: 'architect' })),
    materials: products.filter((p) => matches(p.name + ' ' + p.category)).map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, unit: p.unit, type: 'material' })),
    orders: orders.filter((o) => matches('order ' + o.id + ' ' + o.status)).map((o) => ({ id: o.id, status: o.status, total: o.totalAmount, type: 'order' })),
    invoices: invoices.filter((i) => matches(i.number + ' ' + (i.description ?? ''))).map((i) => ({ id: i.id, number: i.number, description: i.description, status: i.status, type: 'invoice' })),
    documents: documents.filter((d) => matches(d.name + ' ' + (d.category ?? ''))).map((d) => ({ id: d.id, name: d.name, category: d.category, type: 'document' })),
    requests: requests.filter((r) => matches(r.projectType + ' ' + (r.description ?? ''))).map((r) => ({ id: r.id, projectType: r.projectType, status: r.status, type: 'request' })),
    notifications: notifications.filter((n) => matches(n.title + ' ' + (n.body ?? ''))).map((n) => ({ id: n.id, title: n.title, link: n.link, type: 'notification' })),
    boqs: boqs.filter((b) => matches(b.name + ' ' + (b.status ?? ''))).map((b) => ({ id: b.id, name: b.name, status: b.status, version: b.version, type: 'boq' })),
  };

  return NextResponse.json({ query: q, results });
}
