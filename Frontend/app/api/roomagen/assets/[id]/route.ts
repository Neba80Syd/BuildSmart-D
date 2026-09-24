import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const doc: any = await dbClient.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  let bytes: Buffer;
  const contentType = doc.type || 'image/png';

  if (doc.content) {
    bytes = Buffer.from(doc.content, 'base64');
  } else {
    return NextResponse.json({ error: 'Asset content is empty' }, { status: 404 });
  }

  const filename = (doc.name || 'asset.png').replace(/["\\]/g, '');

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
