import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson, publicArchitect } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await resolveUser('CLIENT');
  const profile: any = (await dbClient.userProfile.findUnique({ where: { userId: user.id } })) ?? {};

  // Primary architect (first assigned project).
  const projects = await getClientProjects(user.id);
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? '';
  let architect: any = null;
  const first = projects.find((p) => p.architectId);
  if (first?.architectId) {
    const ap: any = await dbClient.architectProfile.findUnique({ where: { userId: first.architectId } });
    if (ap) architect = publicArchitect(ap, nameFor(first.architectId));
  }

  return NextResponse.json({
    user,
    profile,
    settings: parseJson(profile.settings, {}),
    architect,
    projectsCount: projects.length,
  });
}

const ProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  location: z.string().max(120).optional().or(z.literal('')),
  bio: z.string().max(1000).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = ProfileSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' }, { status: 400 });

  const { name, ...profileFields } = parsed.data;
  if (name) await dbClient.user.update({ where: { id: user.id }, data: { name } });

  const existing = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
  const profile = existing
    ? await dbClient.userProfile.update({ where: { userId: user.id }, data: profileFields })
    : await dbClient.userProfile.create({ data: { userId: user.id, ...profileFields } });

  return NextResponse.json({ success: true, profile });
}
