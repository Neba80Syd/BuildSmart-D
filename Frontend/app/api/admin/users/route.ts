import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

const PAGE = 10;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const role = searchParams.get('role');
  const status = searchParams.get('status');
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const sort = searchParams.get('sort') ?? 'newest';
  const page = Number(searchParams.get('page') ?? 1) || 1;

  const users: any[] = await dbClient.user.findMany();
  const architectProfiles: any[] = await dbClient.architectProfile.findMany();
  const vendorProfiles: any[] = await dbClient.vendorProfile.findMany();
  const projects: any[] = await dbClient.project.findMany();
  const reports: any[] = await dbClient.report.findMany();

  if (id) {
    const user = users.find((u) => u.id === id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const profile: any = await dbClient.userProfile.findUnique({ where: { userId: id } });
    const ap = architectProfiles.find((a) => a.userId === id);
    const vp = vendorProfiles.find((v) => v.userId === id);
    const userProjects = projects.filter((p) => p.ownerId === id || p.architectId === id);
    const userReports = reports.filter((r) => r.targetId === id || r.reporterId === id);
    return NextResponse.json({
      user: { ...user, phone: profile?.phone ?? null, location: profile?.location ?? null, bio: profile?.bio ?? null },
      verification: ap ? { type: 'ARCHITECT', status: ap.verificationStatus, licenseNumber: ap.licenseNumber, verifiedAt: ap.verifiedAt } : vp ? { type: 'VENDOR', status: vp.verificationStatus, registrationNumber: vp.registrationNumber, verifiedAt: vp.verifiedAt } : null,
      projects: userProjects,
      reports: userReports,
    });
  }

  const verificationFor = (u: any) => {
    if (u.role === 'ARCHITECT') return architectProfiles.find((a) => a.userId === u.id)?.verificationStatus ?? 'PENDING';
    if (u.role === 'VENDOR') return vendorProfiles.find((v) => v.userId === u.id)?.verificationStatus ?? 'DRAFT';
    return null;
  };

  let list = users.filter((u) => (role ? u.role === role : true)).filter((u) => (status ? u.status === status : true)).filter((u) => (q ? `${u.name ?? ''} ${u.email ?? ''} ${u.role}`.toLowerCase().includes(q) : true));

  list = [...list].sort((a, b) => {
    if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === 'name') return (a.name ?? '').localeCompare(b.name ?? '');
    if (sort === 'lastActive') return new Date(b.lastActiveAt ?? 0).getTime() - new Date(a.lastActiveAt ?? 0).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status ?? 'ACTIVE',
    adminRole: u.adminRole ?? null,
    emailVerified: u.emailVerified,
    verification: verificationFor(u),
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt ?? null,
    projectCount: projects.filter((p) => p.ownerId === u.id || p.architectId === u.id).length,
    reportCount: reports.filter((r) => r.targetId === u.id).length,
  }));

  return NextResponse.json({ users: rows, total, pages, page, roles: ['ADMIN', 'ARCHITECT', 'VENDOR', 'CLIENT'], statuses: ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] });
}

const ActionSchema = z.object({
  id: z.string(),
  action: z.enum(['suspend', 'restore', 'deactivate', 'activate', 'reset_password', 'revoke_sessions']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const target: any = await dbClient.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // An administrator may never suspend themselves or another administrator.
  if (target.role === 'ADMIN') return NextResponse.json({ error: 'Administrator accounts cannot be modified here' }, { status: 403 });

  const { action, reason } = parsed.data;
  let next: any = {};

  if (action === 'suspend') next = { status: 'SUSPENDED' };
  else if (action === 'restore' || action === 'activate') next = { status: 'ACTIVE' };
  else if (action === 'deactivate') next = { status: 'DEACTIVATED' };
  else if (action === 'reset_password') next = {}; // forces credential reset on next login
  else if (action === 'revoke_sessions') next = {};

  if (Object.keys(next).length) await dbClient.user.update({ where: { id: target.id }, data: next });

  const ACTION_LABEL: Record<string, string> = {
    suspend: 'ACCOUNT_SUSPENDED', restore: 'ACCOUNT_RESTORED', deactivate: 'ACCOUNT_DEACTIVATED', activate: 'ACCOUNT_ACTIVATED', reset_password: 'PASSWORD_RESET_INITIATED', revoke_sessions: 'SESSIONS_REVOKED',
  };
  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: ACTION_LABEL[action], resource: 'USER', resourceId: target.id, reason: reason ?? null });
  await notifyUser(target.id, action === 'suspend' ? 'Account suspended' : action === 'restore' ? 'Account restored' : action === 'deactivate' ? 'Account deactivated' : action === 'activate' ? 'Account activated' : action === 'reset_password' ? 'Password reset required' : 'Sessions revoked', `An administrator ${action.replace('_', ' ')}${reason ? `: ${reason}` : ''} your account.`);

  return NextResponse.json({ success: true, status: next.status ?? target.status });
}
