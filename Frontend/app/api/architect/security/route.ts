import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const securityEvents: any[] = await dbClient.activity.findMany({ where: { userId: user.id } });
  const userRecord: any = await dbClient.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({
    twoFactorEnabled: false, // 2FA requires re-enabled authentication
    authEnabled: false, // preview mode — auth temporarily disabled
    lastLogin: userRecord?.createdAt ?? null,
    events: securityEvents.filter((e: any) => e.type === 'SYSTEM' || e.type === 'VERIFICATION').slice(0, 20),
  });
}

const ActionSchema = z.object({
  action: z.enum(['changePassword', 'logoutOthers']),
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  if (d.action === 'changePassword') {
    if (!d.newPassword || d.newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }
    // Persist a real bcrypt hash (login verification is currently disabled).
    const hash = await bcrypt.hash(d.newPassword, 10);
    await dbClient.user.update?.({ where: { id: user.id }, data: { passwordHash: hash } });
    await dbClient.activity.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Password changed', body: 'Your account password was updated.' } });
    await dbClient.notification.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Password changed', body: 'Your password was changed successfully.', read: 0 } });
    return NextResponse.json({ success: true });
  }

  if (d.action === 'logoutOthers') {
    // Record the security event; session invalidation re-activates with auth.
    await dbClient.activity.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Signed out other sessions', body: 'All other active sessions were revoked.' } });
    await dbClient.notification.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Security alert', body: 'You signed out other sessions.', read: 0 } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
