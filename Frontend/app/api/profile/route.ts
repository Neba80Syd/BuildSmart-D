import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

const ProfileSchema = z.object({
  name: z.string().min(2).max(80),
  location: z.string().max(120).optional().or(z.literal('')),
  bio: z.string().max(1000).optional().or(z.literal('')),
});

export async function GET() {
  const user = await resolveUser();
  const profile = (await dbClient.userProfile.findUnique({ where: { userId: user.id } })) ?? {};
  let roleProfile: any = null;
  if (user.role === 'ARCHITECT') roleProfile = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  if (user.role === 'VENDOR') roleProfile = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ user, profile, roleProfile });
}

export async function PATCH(req: NextRequest) {
  const user = await resolveUser();
  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' }, { status: 400 });

  const existing = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
  const profile = existing
    ? await dbClient.userProfile.update({ where: { userId: user.id }, data: parsed.data })
    : await dbClient.userProfile.create({ data: { userId: user.id, ...parsed.data } });

  return NextResponse.json({ success: true, profile });
}
