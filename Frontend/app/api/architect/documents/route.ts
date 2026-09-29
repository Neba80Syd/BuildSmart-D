import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/csv', 'text/plain', 'application/zip', 'application/x-dwg', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.csv': 'text/csv', '.txt': 'text/plain', '.zip': 'application/zip', '.dwg': 'application/x-dwg',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function detectType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  return EXT_TO_MIME[ext] ?? 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const docs: any[] = await dbClient.document.findMany({ where: { ownerId: user.id, ...(projectId ? { projectId } : {}) } });
  const filtered = category ? docs.filter((d) => d.category === category) : docs;
  return NextResponse.json({ documents: filtered.map((d) => ({ ...d, content: undefined })) });
}

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const form = await req.formData();
  const file = form.get('file') as File | null;
  const category = (form.get('category') as string) || 'Project';
  const projectId = (form.get('projectId') as string) || null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'File exceeds 5 MB limit' }, { status: 413 });
  const type = detectType(file);
  if (!ALLOWED.has(type)) return NextResponse.json({ error: `File type "${file.type}" not allowed` }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const doc = await dbClient.document.create({
    data: { ownerId: user.id, projectId, name: file.name, type, size: file.size, category, version: 1, content: buf.toString('base64') },
  });
  await dbClient.activity.create({ data: { userId: user.id, projectId, type: 'PROJECT', title: 'Document uploaded', body: file.name } });
  return NextResponse.json({ success: true, document: { ...doc, content: undefined } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const doc: any = await dbClient.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (doc.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await dbClient.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
