import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

const KINDS = ['blog', 'faq', 'announcement'] as const;
type Kind = (typeof KINDS)[number];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get('kind') ?? 'blog') as Kind;

  if (kind === 'blog') return NextResponse.json({ kind, items: await dbClient.blogPost.findMany() });
  if (kind === 'faq') return NextResponse.json({ kind, items: await dbClient.faq.findMany() });
  return NextResponse.json({ kind, items: await dbClient.announcement.findMany() });
}

const BlogSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/),
  category: z.string().max(80).optional(),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(1).max(20000),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  scheduledAt: z.string().optional(),
});

const FaqSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(2).max(500),
  answer: z.string().min(1).max(4000),
  category: z.string().max(80).default('General'),
  position: z.number().int().min(0).default(0),
  status: z.enum(['ACTIVE', 'ARCHIVED']).default('ACTIVE'),
});

const AnnouncementSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(200),
  body: z.string().min(1).max(4000),
  audience: z.enum(['ALL', 'CLIENTS', 'ARCHITECTS', 'VENDORS']).default('ALL'),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  scheduledAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const kind = (body?.kind ?? 'blog') as Kind;
  let item: any;

  if (kind === 'blog') {
    const parsed = BlogSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 });
    const dup = await dbClient.blogPost.findUnique({ where: { slug: parsed.data.slug } });
    if (dup) return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    item = await dbClient.blogPost.create({ data: { ...parsed.data, author: auth.user.name, publishedAt: parsed.data.status === 'PUBLISHED' ? new Date().toISOString() : null } });
  } else if (kind === 'faq') {
    const parsed = FaqSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 });
    item = await dbClient.faq.create({ data: parsed.data });
  } else {
    const parsed = AnnouncementSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid' }, { status: 400 });
    item = await dbClient.announcement.create({ data: parsed.data });
  }

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `CONTENT_CREATED`, resource: kind.toUpperCase(), resourceId: item.id });
  return NextResponse.json({ success: true, item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null);
  const kind = (body?.kind ?? 'blog') as Kind;
  const id: string | undefined = body?.id;

  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  if (kind === 'blog') {
    const parsed = BlogSchema.partial().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const existing: any = await dbClient.blogPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data: any = { ...parsed.data };
    delete data.id;
    if (parsed.data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') data.publishedAt = new Date().toISOString();
    const item = await dbClient.blogPost.update({ where: { id }, data });
    await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `CONTENT_UPDATED`, resource: 'BLOG', resourceId: id });
    return NextResponse.json({ success: true, item });
  }
  if (kind === 'faq') {
    const parsed = FaqSchema.partial().safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    const item = await dbClient.faq.update({ where: { id }, data: { ...parsed.data, id: undefined } });
    await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `CONTENT_UPDATED`, resource: 'FAQ', resourceId: id });
    return NextResponse.json({ success: true, item });
  }
  const parsed = AnnouncementSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const item = await dbClient.announcement.update({ where: { id }, data: { ...parsed.data, id: undefined } });
  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `CONTENT_UPDATED`, resource: 'ANNOUNCEMENT', resourceId: id });
  return NextResponse.json({ success: true, item });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const kind = (searchParams.get('kind') ?? 'blog') as Kind;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let ok = false;
  if (kind === 'blog') ok = await dbClient.blogPost.delete({ where: { id } });
  else if (kind === 'faq') ok = await dbClient.faq.delete({ where: { id } });
  else ok = await dbClient.announcement.delete({ where: { id } });
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `CONTENT_DELETED`, resource: kind.toUpperCase(), resourceId: id });
  return NextResponse.json({ success: true });
}
