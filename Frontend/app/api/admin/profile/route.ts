import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const profile: any = await dbClient.userProfile.findUnique({ where: { userId: auth.user.id } });
  return NextResponse.json({
    user: auth.user,
    profile: { phone: profile?.phone ?? '', location: profile?.location ?? '', bio: profile?.bio ?? '' },
  });
}

const UpdateSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(40).optional(),
  location: z.string().max(160).optional(),
  bio: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  await dbClient.user.update({ where: { id: auth.user.id }, data: { name: parsed.data.name } });

  const existing: any = await dbClient.userProfile.findUnique({ where: { userId: auth.user.id } });
  if (existing) {
    await dbClient.userProfile.update({ where: { userId: auth.user.id }, data: { phone: parsed.data.phone ?? '', location: parsed.data.location ?? '', bio: parsed.data.bio ?? '' } });
  } else {
    await dbClient.userProfile.create({ data: { userId: auth.user.id, phone: parsed.data.phone ?? '', location: parsed.data.location ?? '', bio: parsed.data.bio ?? '' } });
  }

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'PROFILE_UPDATED', resource: 'ADMIN', resourceId: auth.user.id });

  return NextResponse.json({ success: true });
}
