import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, PERMISSIONS, parseJson } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const roles: any[] = await dbClient.adminRole.findMany();
  const users: any[] = await dbClient.user.findMany();
  const admins = users
    .filter((u) => u.role === 'ADMIN')
    .map((u) => ({ id: u.id, name: u.name, email: u.email, adminRole: u.adminRole ?? 'SUPER_ADMIN' }));

  return NextResponse.json({
    roles: roles.map((r) => ({ ...r, permissions: parseJson(r.permissions, []) })),
    admins,
    permissionCatalog: [...PERMISSIONS],
  });
}

const RoleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60).regex(/^[A-Z0-9_]+$/),
  description: z.string().max(300).optional(),
  permissions: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = RoleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid role' }, { status: 400 });

  const existing = await dbClient.adminRole.findUnique({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json({ error: 'Role already exists' }, { status: 409 });

  const role = await dbClient.adminRole.create({ data: { name: parsed.data.name, description: parsed.data.description ?? '', permissions: JSON.stringify(parsed.data.permissions), isSystem: false } });
  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'ROLE_CREATED', resource: 'ADMIN_ROLE', resourceId: role.id, reason: parsed.data.name });
  return NextResponse.json({ success: true, role: { ...role, permissions: parseJson(role.permissions, []) } }, { status: 201 });
}

const UpdateSchema = z.object({
  id: z.string(),
  permissions: z.array(z.string()).min(1).optional(),
  description: z.string().max(300).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const role: any = await dbClient.adminRole.findUnique({ where: { id: parsed.data.id } });
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (parsed.data.permissions) data.permissions = JSON.stringify(parsed.data.permissions);
  if (parsed.data.description !== undefined) data.description = parsed.data.description;

  const updated = await dbClient.adminRole.update({ where: { id: role.id }, data });
  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'ROLE_UPDATED', resource: 'ADMIN_ROLE', resourceId: role.id, reason: role.name });
  return NextResponse.json({ success: true, role: { ...updated, permissions: parseJson(updated.permissions, []) } });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const role: any = await dbClient.adminRole.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 });

  await dbClient.adminRole.delete({ where: { id } });
  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'ROLE_DELETED', resource: 'ADMIN_ROLE', resourceId: id, reason: role.name });
  return NextResponse.json({ success: true });
}
