import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const activities: any[] = await dbClient.activity.findMany({ where: { userId: user.id } });
  const securityEvents = activities
    .filter((a) => ['SYSTEM', 'VERIFICATION', 'PAYMENT'].includes(a.type))
    .slice(0, 10)
    .map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt }));

  return NextResponse.json({ authEnabled: false, lastLogin: null, events: securityEvents });
}

const ActionSchema = z.object({
  action: z.enum(['changePassword', 'logoutOthers']),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  if (parsed.data.action === 'changePassword') {
    const pwd = parsed.data.newPassword;
    if (!pwd) return NextResponse.json({ error: 'New password required' }, { status: 400 });
    const hash = createHash('sha256').update(pwd).digest('hex');
    await dbClient.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    await dbClient.activity.create({ data: { userId: user.id, projectId: null, type: 'SYSTEM', title: 'Password changed', body: 'Account password was updated.' } });
    return NextResponse.json({ success: true });
  }

  if (parsed.data.action === 'logoutOthers') {
    await dbClient.activity.create({ data: { userId: user.id, projectId: null, type: 'SYSTEM', title: 'Other sessions signed out', body: 'All other active sessions were terminated.' } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
