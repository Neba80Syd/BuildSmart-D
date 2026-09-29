import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser, SessionUser } from '@/Backend/lib/preview';
import { getClientProjects } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get('role')?.toUpperCase() as SessionUser['role'] | undefined;
    const user = await resolveUser(roleParam || 'CLIENT');

    // 1. Unread notifications for this user
    const userIds = [user.id];
    if (user.role === 'VENDOR') {
      try {
        const vp: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
        if (vp?.id) userIds.push(vp.id);
      } catch {}
    }
    const notifications: any[] = await dbClient.notification.findMany({
      where: { userId: { in: userIds } },
    });
    const unreadNotifications = notifications.filter((n) => !n.read).length;

    // 2. Unread messages
    let unreadMessages = 0;
    try {
      const messages: any[] = await dbClient.message.findMany({
        where: { read: false },
      });
      // In preview/demo or authenticated mode, count relevant unread messages
      unreadMessages = messages.length;
    } catch {
      unreadMessages = 0;
    }

    // 3. Client 3D plan notifications
    let new3dReady = 0;
    let next3dLink: string | null = null;
    if (user.role === 'CLIENT') {
      try {
        const projects = await getClientProjects(user.id);
        for (const p of projects) {
          const plans: any[] = await dbClient.floorPlan.findMany({
            where: { projectId: p.id, kind: '3D', status: 'PUBLISHED' },
          });
          const ready = plans.filter((x) => ['READY_FOR_REVIEW', 'UPDATED_READY'].includes(x.reviewStatus));
          new3dReady += ready.length;
          if (!next3dLink && ready.length) {
            next3dLink = `/client/3d?project=${p.id}&plan=${ready[ready.length - 1].id}`;
          }
        }
      } catch {
        // fallback safely if project fetch fails
      }
    }

    // Initials calculation
    const initials = (user.name || 'User')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BS';

    let verificationStatus = 'VERIFIED';
    let avatarUrl: string | null = null;
    const up: any = await dbClient.userProfile.findUnique({ where: { userId: user.id } });
    if (up) {
      const upSettings = typeof up.settings === 'string' ? JSON.parse(up.settings || '{}') : up.settings;
      avatarUrl = up.avatarUrl ?? upSettings?.avatarUrl ?? null;
    }

    if (user.role === 'ARCHITECT') {
      const ap: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
      verificationStatus = ap?.verificationStatus ?? 'UNVERIFIED';
    } else if (user.role === 'VENDOR') {
      const vp: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
      verificationStatus = vp?.verificationStatus ?? 'DRAFT';
      if (!avatarUrl && vp?.logoUrl) {
        avatarUrl = vp.logoUrl;
      }
    }

    const recentNotifications = notifications
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: Boolean(n.read),
        createdAt: n.createdAt,
        link: n.link || null,
      }));

    // 4. Cart item count (for Client and marketplace users)
    let cartCount = 0;
    try {
      const cart: any = await dbClient.cart.findUnique({ where: { userId: user.id } });
      if (cart) {
        const cartItems: any[] = await dbClient.cartItem.findMany({ where: { cartId: cart.id } });
        cartCount = cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0);
      }
    } catch {
      cartCount = 0;
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        initials,
        avatarUrl,
        verificationStatus,
      },
      unreadNotifications,
      unreadMessages,
      cartCount,
      new3dReady,
      next3dLink,
      recentNotifications,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve header status' },
      { status: 500 }
    );
  }
}
