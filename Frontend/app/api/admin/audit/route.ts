import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// Append-only audit trail. Read-only by design — no update/delete endpoints.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get('resource');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const logs: any[] = await dbClient.auditLog.findMany({ where: resource ? { resource } : {} });

  const list = logs
    .filter((l) => (q ? `${l.action ?? ''} ${l.resource ?? ''} ${l.resourceId ?? ''} ${l.actorName ?? ''} ${l.reason ?? ''}`.toLowerCase().includes(q) : true))
    .slice(0, 300);

  return NextResponse.json({ logs: list, resources: [...new Set(logs.map((l) => l.resource))], immutable: true });
}
