import { NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

// Lightweight counts for the client console header + sidebar indicators.
export async function GET() {
  const user = await resolveUser('CLIENT');
  const projects = await getClientProjects(user.id);
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });

  let new3dReady = 0;
  let next3dLink: string | null = null;
  for (const p of projects) {
    const plans: any[] = await dbClient.floorPlan.findMany({ where: { projectId: p.id, kind: '3D', status: 'PUBLISHED' } });
    const ready = plans.filter((x) => ['READY_FOR_REVIEW', 'UPDATED_READY'].includes(x.reviewStatus));
    new3dReady += ready.length;
    if (!next3dLink && ready.length) next3dLink = `/client/3d?project=${p.id}&plan=${ready[ready.length - 1].id}`;
  }

  return NextResponse.json({
    unreadNotifications: notifications.filter((n) => !n.read).length,
    new3dReady,
    next3dLink,
  });
}
