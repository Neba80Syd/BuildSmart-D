import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const safeJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const DEFAULT_SETTINGS = {
  units: 'METRIC',
  currency: 'XAF',
  language: 'en',
  theme: 'system',
  notifications: { email: true, push: true, inApp: true, projects: true, clients: true, marketplace: true, payments: true, security: true },
};

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  const userProfile: any = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    location: userProfile?.location ?? '',
    bio: userProfile?.bio ?? '',
    settings: safeJson(profile?.settings, DEFAULT_SETTINGS),
  });
}

const SettingsSchema = z.object({
  section: z.enum(['account', 'appearance', 'language', 'units', 'currency', 'notifications']),
  name: z.string().min(2).max(80).optional(),
  location: z.string().max(120).optional(),
  bio: z.string().max(1000).optional(),
  settings: z.record(z.string(), z.any()).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = SettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  if (d.section === 'account') {
    const existing = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
    const data: any = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.location !== undefined) data.location = d.location;
    if (d.bio !== undefined) data.bio = d.bio;
    if (Object.keys(data).length) {
      if (existing) await dbClient.userProfile.update({ where: { userId: user.id }, data });
      else await dbClient.userProfile.create({ data: { userId: user.id, ...data } });
    }
    return NextResponse.json({ success: true });
  }

  // appearance / language / units / currency / notifications → merge into settings jsonb
  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  const current = safeJson(profile?.settings, DEFAULT_SETTINGS);
  const next: any = { ...current, ...(d.settings ?? {}) };
  await dbClient.architectProfile.update({ where: { userId: user.id }, data: { settings: next } });
  await dbClient.activity.create({ data: { userId: user.id, type: 'SYSTEM', title: 'Settings updated', body: `Section: ${d.section}` } });
  return NextResponse.json({ success: true, settings: next });
}
