import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const UpdateSchema = z.object({
  title: z.string().max(120).optional(),
  biography: z.string().max(2000).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  specializations: z.array(z.string().max(60)).optional(),
  languages: z.array(z.string().max(40)).optional(),
  serviceAreas: z.array(z.string().max(80)).optional(),
  education: z.array(z.any()).optional(),
  memberships: z.array(z.string().max(120)).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const existing: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  const data: any = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.biography !== undefined) data.biography = d.biography;
  if (d.hourlyRate !== undefined) data.hourlyRate = d.hourlyRate;
  if (d.specializations !== undefined) data.specializations = JSON.stringify(d.specializations);
  if (d.languages !== undefined) data.languages = JSON.stringify(d.languages);
  if (d.serviceAreas !== undefined) data.serviceAreas = JSON.stringify(d.serviceAreas);
  if (d.education !== undefined) data.education = d.education;
  if (d.memberships !== undefined) data.memberships = JSON.stringify(d.memberships);
  if (d.visibility !== undefined) data.visibility = d.visibility;

  let profile;
  if (existing) {
    profile = await dbClient.architectProfile.update({ where: { userId: user.id }, data });
  } else {
    profile = await dbClient.architectProfile.create({
      data: { userId: user.id, ...data, location: '', biography: data.biography ?? '', rating: 0, reviewCount: 0, specializations: data.specializations ?? '[]', portfolio: '[]', hourlyRate: data.hourlyRate ?? 0 },
    });
  }
  return NextResponse.json({ success: true, profile });
}
