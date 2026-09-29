import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

const EDITABLE_KEYS = ['general', 'marketplace', 'security', 'notifications'] as const;

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const settings: any[] = await dbClient.platformSetting.findMany();
  const map: Record<string, any> = {};
  for (const s of settings) map[s.key] = s.value ?? {};
  return NextResponse.json({ settings: map });
}

const UpdateSchema = z.object({
  key: z.enum(EDITABLE_KEYS),
  value: z.record(z.string(), z.any()),
});

// Sensitive configuration uses secure server-side storage — the value shape is
// validated here and only whitelisted keys may be written.
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const setting = await dbClient.platformSetting.upsert({ data: { key: parsed.data.key, value: parsed.data.value } });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: 'CONFIG_CHANGED', resource: 'SETTINGS', resourceId: parsed.data.key, reason: `${parsed.data.key} updated` });

  return NextResponse.json({ success: true, setting });
}
