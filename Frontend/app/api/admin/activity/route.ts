import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// General platform activity (non-security-sensitive operational events).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();

  const activities: any[] = await dbClient.activity.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  const list = activities
    .filter((a) => (type ? a.type === type : true))
    .filter((a) => (q ? `${a.title ?? ''} ${a.body ?? ''}`.toLowerCase().includes(q) : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200)
    .map((a) => ({ ...a, userName: nameFor(a.userId) }));

  return NextResponse.json({ activities: list, types: [...new Set(activities.map((a) => a.type))] });
}
