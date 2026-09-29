import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

const DEFAULTS = {
  language: 'en',
  currency: 'XAF',
  units: 'METRIC',
  timezone: 'Africa/Douala',
  theme: 'system',
  notifications: { email: true, push: true, inApp: true, projects: true, designs: true, floorplans: true, marketplace: true, payments: true, messages: true },
  privacy: { profileVisibility: 'PUBLIC', communication: true, dataSharing: false },
};

export async function GET() {
  const user = await resolveUser('CLIENT');
  const profile: any = (await dbClient.userProfile.findUnique({ where: { userId: user.id } })) ?? {};
  const settings = { ...DEFAULTS, ...parseJson(profile.settings, {}) };
  return NextResponse.json({ settings });
}

const SettingsSchema = z.object({
  language: z.string().max(10).optional(),
  currency: z.string().max(10).optional(),
  units: z.enum(['METRIC', 'IMPERIAL']).optional(),
  timezone: z.string().max(60).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  notifications: z.record(z.string(), z.boolean()).optional(),
  privacy: z.record(z.string(), z.any()).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const parsed = SettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });

  const profile: any = (await dbClient.userProfile.findUnique({ where: { userId: user.id } })) ?? {};
  const current = { ...DEFAULTS, ...parseJson(profile.settings, {}) };
  const next = { ...current, ...parsed.data };

  const existing = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
  const updated = existing
    ? await dbClient.userProfile.update({ where: { userId: user.id }, data: { settings: JSON.stringify(next) } })
    : await dbClient.userProfile.create({ data: { userId: user.id, settings: JSON.stringify(next) } });

  return NextResponse.json({ success: true, settings: next, profile: updated });
}
