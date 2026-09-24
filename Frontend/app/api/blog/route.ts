import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const CreateSchema = z.object({
  title: z.string().min(3).max(160),
  category: z.string().min(1).max(60),
  excerpt: z.string().min(10).max(400),
  content: z.string().min(20).max(20000),
  coverImage: z.string().optional().or(z.literal('')),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});

async function requireAdmin() {
  const user = await resolveUser('ADMIN');
  if (user.role !== 'ADMIN') return { error: 'Forbidden' };
  return { user };
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: 403 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid post' }, { status: 400 });

  const data = parsed.data;
  const post = await dbClient.blogPost.create({
    data: {
      ...data,
      slug: slugify(data.title) + '-' + Date.now().toString(36),
      author: 'BuildSmart Editorial',
      coverImage: data.coverImage || '/images/project-villa.png',
    },
  });
  return NextResponse.json({ success: true, post }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  title: z.string().min(3).max(160).optional(),
  category: z.string().max(60).optional(),
  excerpt: z.string().max(400).optional(),
  content: z.string().max(20000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
});

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: 403 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const post = await dbClient.blogPost.update({ where: { id: parsed.data.id }, data: parsed.data });
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true, post });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await dbClient.blogPost.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
