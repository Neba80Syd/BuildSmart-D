import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await resolveUser();
  const { id } = await params;
  const doc = await dbClient.document.findUnique({ where: { id } });

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // Authorization: only the owner (or an admin) may download the file.
  if (doc.ownerId !== user.id && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let bytes: Buffer;
  let contentType = doc.type || 'application/octet-stream';
  let filename = doc.name.replace(/["\\]/g, '');

  if (doc.content) {
    bytes = Buffer.from(doc.content, 'base64');
  } else {
    // Seed/demo documents carry metadata only — serve a readable summary.
    const summary = [
      `BuildSmart AI — Document Export`,
      `--------------------------------`,
      `File: ${doc.name}`,
      `Category: ${doc.category}`,
      `Version: ${doc.version}`,
      `Size: ${doc.size} bytes`,
      `Uploaded: ${doc.createdAt}`,
      `Owner: ${doc.ownerId}`,
    ].join('\n');
    bytes = Buffer.from(summary, 'utf8');
    contentType = 'text/plain';
    filename = doc.name.replace(/\.[^.]+$/, '') + '-summary.txt';
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
