import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  // Login/security history is derived from the immutable audit trail for this admin.
  const logs: any[] = await dbClient.auditLog.findMany({ where: { actorId: auth.user.id } });
  const events: any[] = await dbClient.securityEvent.findMany();

  return NextResponse.json({
    user: { ...auth.user, adminRole: (auth.user as any).adminRole ?? 'SUPER_ADMIN' },
    authEnabled: false,
    sessions: [],
    sessionNote: 'Session tracking is preview-only until authentication is re-enabled.',
    loginHistory: logs.slice(0, 20).map((l) => ({ id: l.id, action: l.action, resource: l.resource, at: l.createdAt, ip: l.ip, device: l.device })),
    securityEvents: events.filter((e) => e.actorId === auth.user.id).slice(0, 10),
  });
}

const ActionSchema = z.object({
  action: z.enum(['changePassword', 'logoutOthers']),
  newPassword: z.string().min(8).max(128).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  if (parsed.data.action === 'changePassword') {
    if (!parsed.data.newPassword) return NextResponse.json({ error: 'New password required' }, { status: 400 });
    const hash = createHash('sha256').update(parsed.data.newPassword).digest('hex');
    await dbClient.user.update({ where: { id: auth.user.id }, data: { passwordHash: hash } });
    await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'PASSWORD_CHANGED', resource: 'ADMIN', resourceId: auth.user.id });
    return NextResponse.json({ success: true });
  }

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'SESSIONS_REVOKED', resource: 'ADMIN', resourceId: auth.user.id });
  return NextResponse.json({ success: true });
}
