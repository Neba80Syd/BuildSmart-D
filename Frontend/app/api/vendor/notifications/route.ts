import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getVendorContext } from '@/Backend/lib/vendor';

export const dynamic = 'force-dynamic';

export const VENDOR_CATEGORIES = [
  'Orders',
  'Escrow',
  'Inventory',
  'Reviews',
  'Messages',
  'Disputes',
  'Verification',
  'System',
] as const;

export function categorizeVendorNotification(n: any): string {
  const type = String(n.type || '').toUpperCase();
  const title = String(n.title || '').toUpperCase();

  if (type === 'ORDER' || title.includes('ORDER') || title.includes('SHIPMENT')) return 'Orders';
  if (
    type === 'PAYMENT' ||
    type === 'ESCROW' ||
    type === 'FINANCE' ||
    type === 'WITHDRAWAL' ||
    title.includes('ESCROW') ||
    title.includes('PAYOUT') ||
    title.includes('WALLET')
  ) {
    return 'Escrow';
  }
  if (type === 'INVENTORY' || type === 'PRODUCT' || type === 'STOCK' || title.includes('STOCK')) return 'Inventory';
  if (type === 'REVIEW' || title.includes('REVIEW') || title.includes('RATING')) return 'Reviews';
  if (type === 'MESSAGE' || type === 'INQUIRY' || title.includes('MESSAGE') || title.includes('INQUIRY')) return 'Messages';
  if (type === 'DISPUTE' || title.includes('DISPUTE')) return 'Disputes';
  if (type === 'VERIFICATION' || title.includes('VERIFICATION') || title.includes('KYC')) return 'Verification';

  return 'System';
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser('VENDOR');
    let vendorId: string | null = null;
    try {
      const ctx = await getVendorContext(user.id);
      vendorId = ctx.vendorId;
    } catch {
      // preview or fallback without vendor record
    }

    const userIds = [user.id, vendorId].filter(Boolean) as string[];

    const notifications: any[] = await dbClient.notification.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
    });

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') ?? 'All'; // All | Unread | <Category>
    const q = (searchParams.get('q') ?? '').toLowerCase().trim();

    const counts: Record<string, number> = {};
    for (const c of VENDOR_CATEGORIES) {
      counts[c] = 0;
    }

    const enriched = notifications.map((n) => {
      const category = categorizeVendorNotification(n);
      counts[category] = (counts[category] ?? 0) + (n.read ? 0 : 1);
      return {
        ...n,
        category,
        read: Boolean(n.read),
      };
    });

    const filtered = enriched.filter((n) => {
      if (filter === 'Unread') {
        if (n.read) return false;
      } else if (filter !== 'All' && n.category !== filter) {
        return false;
      }

      if (q) {
        const hay = `${n.title} ${n.body ?? ''} ${n.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return NextResponse.json({
      notifications: filtered,
      unread: notifications.filter((n) => !n.read).length,
      categories: [...VENDOR_CATEGORIES],
      counts,
    });
  } catch (error: any) {
    console.error('Error fetching vendor notifications:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}

const PatchSchema = z.object({
  read: z.boolean(),
  ids: z.array(z.string()).optional(),
  markAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveUser('VENDOR');
    let vendorId: string | null = null;
    try {
      const ctx = await getVendorContext(user.id);
      vendorId = ctx.vendorId;
    } catch {}

    const userIds = [user.id, vendorId].filter(Boolean) as string[];

    const body = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const { read, ids, markAll } = body.data;
    const all: any[] = await dbClient.notification.findMany({
      where: { userId: { in: userIds } },
    });

    const targets = markAll ? all : all.filter((n) => (ids ?? []).includes(n.id));
    for (const n of targets) {
      await dbClient.notification.update({
        where: { id: n.id },
        data: { read },
      });
    }

    return NextResponse.json({ success: true, count: targets.length });
  } catch (error: any) {
    console.error('Error updating vendor notifications:', error);
    return NextResponse.json({ error: error.message || 'Failed to update notifications' }, { status: 500 });
  }
}

const DeleteSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string()).optional(),
});

export async function DELETE(req: NextRequest) {
  try {
    const user = await resolveUser('VENDOR');
    let vendorId: string | null = null;
    try {
      const ctx = await getVendorContext(user.id);
      vendorId = ctx.vendorId;
    } catch {}

    const userIds = [user.id, vendorId].filter(Boolean) as string[];

    const { searchParams } = new URL(req.url);
    const queryId = searchParams.get('id');

    let bodyData: { all?: boolean; ids?: string[] } = {};
    if (req.headers.get('content-type')?.includes('application/json')) {
      const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
      if (parsed.success) bodyData = parsed.data;
    }

    const all: any[] = await dbClient.notification.findMany({
      where: { userId: { in: userIds } },
    });

    let targets: any[] = [];
    if (queryId) {
      targets = all.filter((n) => n.id === queryId);
    } else if (bodyData.all) {
      targets = all;
    } else if (bodyData.ids?.length) {
      targets = all.filter((n) => bodyData.ids!.includes(n.id));
    }

    // Dismiss notifications by setting read: true
    for (const n of targets) {
      await dbClient.notification.update({
        where: { id: n.id },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true, dismissed: targets.length });
  } catch (error: any) {
    console.error('Error dismissing vendor notifications:', error);
    return NextResponse.json({ error: error.message || 'Failed to dismiss notifications' }, { status: 500 });
  }
}
