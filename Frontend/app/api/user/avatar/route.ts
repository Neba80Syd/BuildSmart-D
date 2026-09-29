import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const safeJson = (v: any, fallback: any = {}) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

const AvatarSchema = z.object({
  avatarUrl: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get('role');
    const user = await resolveUser((roleParam as any) || undefined);
    const profile: any = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
    const settings = safeJson(profile?.settings, {});
    let avatarUrl = profile?.avatarUrl ?? settings.avatarUrl ?? null;

    if (!avatarUrl && user.role === 'VENDOR') {
      const vp: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
      avatarUrl = vp?.logoUrl ?? null;
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      name: user.name,
      role: user.role,
      avatarUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch avatar' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get('role');
    const user = await resolveUser((roleParam as any) || undefined);

    const body = await req.json().catch(() => null);
    const parsed = AvatarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid payload' }, { status: 400 });
    }

    const newAvatarUrl = parsed.data.avatarUrl?.trim() || null;

    const existing: any = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
    const existingSettings = safeJson(existing?.settings, {});
    const updatedSettings = { ...existingSettings, avatarUrl: newAvatarUrl };

    if (existing) {
      const updateData: any = { settings: updatedSettings };
      try {
        await dbClient.userProfile.update({
          where: { userId: user.id },
          data: updateData,
        });
      } catch (err) {
        // Fallback update
        await dbClient.userProfile.update({
          where: { userId: user.id },
          data: { settings: updatedSettings },
        });
      }
    } else {
      await dbClient.userProfile.create({
        data: {
          id: `up_${user.id}`,
          userId: user.id,
          settings: updatedSettings,
        },
      });
    }

    // Mirror to vendor logo if user is vendor
    if (user.role === 'VENDOR') {
      const vp: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
      if (vp) {
        await dbClient.vendorProfile.update({
          where: { userId: user.id },
          data: { logoUrl: newAvatarUrl },
        });
      }
    }

    return NextResponse.json({
      success: true,
      avatarUrl: newAvatarUrl,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update avatar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const roleParam = req.nextUrl.searchParams.get('role');
    const user = await resolveUser((roleParam as any) || undefined);

    const existing: any = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
    const existingSettings = safeJson(existing?.settings, {});
    const updatedSettings = { ...existingSettings, avatarUrl: null };

    if (existing) {
      await dbClient.userProfile.update({
        where: { userId: user.id },
        data: { settings: updatedSettings },
      });
    }

    if (user.role === 'VENDOR') {
      const vp: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
      if (vp) {
        await dbClient.vendorProfile.update({
          where: { userId: user.id },
          data: { logoUrl: null },
        });
      }
    }

    return NextResponse.json({ success: true, avatarUrl: null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete avatar' }, { status: 500 });
  }
}
