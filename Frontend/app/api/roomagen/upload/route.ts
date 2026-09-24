import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB for architectural sketches & drawings
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ success: false, error: { code: 'INVALID_FORM', message: 'Invalid form data' } }, { status: 400 });
  }

  const file = form.get('file') as File | null;
  const projectId = (form.get('projectId') as string) || null;

  if (!file) {
    return NextResponse.json({ success: false, error: { code: 'NO_FILE', message: 'No file was uploaded' } }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'Image size exceeds 10 MB limit' } }, { status: 413 });
  }

  const mime = file.type?.toLowerCase() || '';
  if (!ALLOWED_MIME.has(mime) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    return NextResponse.json({ success: false, error: { code: 'UNSUPPORTED_FORMAT', message: 'Please upload a PNG, JPG, or WebP image' } }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const assetId = `ast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Store in database Document model
  const doc = await dbClient.document.create({
    data: {
      id: assetId,
      ownerId: user.id,
      projectId,
      name: file.name,
      type: mime || 'image/png',
      size: file.size,
      category: 'FloorPlanSketch',
      version: 1,
      content: buf.toString('base64'),
    },
  });

  // Construct accessible asset URL
  const origin = req.nextUrl.origin;
  const assetUrl = `${origin}/api/roomagen/assets/${doc.id}`;

  return NextResponse.json({
    success: true,
    data: {
      assetId: doc.id,
      name: doc.name,
      url: assetUrl,
      size: doc.size,
      type: doc.type,
    },
  }, { status: 201 });
}
