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

  const file = form.get('file');
  const projectId = (form.get('projectId') as string) || null;

  if (!file || typeof file === 'string' || file.size === 0) {
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

  const apiKey = process.env.IMGBB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: { code: 'IMGBB_NOT_CONFIGURED', message: 'Image hosting is not configured. Set IMGBB_API_KEY on the server.' } }, { status: 503 });
  }

  // Roomagen must be able to download the original image from outside our server.
  const uploadForm = new FormData();
  uploadForm.set('key', apiKey);
  uploadForm.set('image', buf.toString('base64'));
  uploadForm.set('name', assetId);

  let assetUrl: string;
  try {
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: uploadForm,
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (!response.ok || result.success !== true || typeof result.data?.url !== 'string') {
      throw new Error('Image hosting upload failed');
    }
    const hostedUrl = new URL(result.data.url);
    if (hostedUrl.protocol !== 'https:') {
      throw new Error('Image hosting returned an invalid URL');
    }
    assetUrl = hostedUrl.href;
  } catch {
    // Do not expose upstream responses, credentials, or deletion URLs to clients.
    return NextResponse.json({ success: false, error: { code: 'IMGBB_UPLOAD_FAILED', message: 'Unable to host the image. Check the server ImgBB configuration and try again.' } }, { status: 502 });
  }

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
