import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';
import { getArchitectContext, getArchitectProjects, CURRENCY } from '@/Backend/lib/architect';

export const dynamic = 'force-dynamic';

const parseJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  const { profile } = await getArchitectContext(user.id);
  const projects = await getArchitectProjects(user.id);
  const requests: any[] = await dbClient.designRequest.findMany({ where: { architectId: user.id } });
  const designs: any[] = await dbClient.design.findMany({ where: { architectId: user.id } });
  const transactions: any[] = await dbClient.transaction.findMany({ where: { userId: user.id } });
  const activities: any[] = await dbClient.activity.findMany({ where: { userId: user.id } });
  const appointments: any[] = await dbClient.appointment.findMany({ where: { architectId: user.id } });
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const rooms: any[] = await dbClient.chatRoom.findMany({ where: {} });
  const participants: any[] = await dbClient.chatParticipant.findMany({ where: { userId: user.id } });
  const subscription: any = await dbClient.subscription.findUnique({ where: { userId: user.id } });

  const active = projects.filter((p) => !['COMPLETED', 'ARCHIVED'].includes(p.status));
  const myRoomIds = new Set(participants.map((p) => p.roomId));
  let unreadMessages = 0;
  for (const room of rooms) {
    if (!myRoomIds.has(room.id)) continue;
    const msgs: any[] = await dbClient.message.findMany({ where: { roomId: room.id } });
    unreadMessages += msgs.filter((m) => !m.read && m.senderId !== user.id).length;
  }

  const now = Date.now();
  const upcoming = appointments
    .filter((a) => a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && a.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 4);

  const settings = parseJson(profile?.settings, {});
  const credentials = parseJson(profile?.credentials, { identity: [], education: [], professional: [], business: [] });
  const missingDocs: string[] = [];
  if (!credentials.professional?.length) missingDocs.push('Architecture license / professional registration');
  if (!credentials.education?.length) missingDocs.push('Architecture degree or certificate');
  if (!credentials.identity?.length) missingDocs.push('National ID / passport');

  const totalEarnings = transactions.filter((t) => t.kind === 'EARNING' && t.status === 'SUCCEEDED').reduce((s: number, t: any) => s + t.amount, 0);
  const pendingEarnings = transactions.filter((t) => t.kind === 'EARNING' && t.status === 'PENDING').reduce((s: number, t: any) => s + t.amount, 0);

  const expiresInDays = subscription?.renewsAt ? Math.max(0, Math.ceil((new Date(subscription.renewsAt).getTime() - now) / 86400000)) : null;

  return NextResponse.json({
    architect: { id: user.id, name: user.name },
    currency: CURRENCY,
    profile: {
      verificationStatus: profile?.verificationStatus ?? 'UNVERIFIED',
      title: profile?.title ?? 'Architect',
      location: profile?.location ?? '',
      rating: profile?.rating ?? 0,
      reviewCount: profile?.reviewCount ?? 0,
    },
    stats: {
      projects: {
        total: projects.length,
        active: active.length,
        completed: projects.filter((p) => p.status === 'COMPLETED').length,
        drafts: projects.filter((p) => p.status === 'DRAFT').length,
        awaitingClient: projects.filter((p) => p.status === 'CLIENT_REVIEW').length,
        needsRevision: projects.filter((p) => p.status === 'REVISION').length,
      },
      clients: {
        total: new Set(projects.map((p) => p.ownerId)).size,
        pendingRequests: requests.filter((r) => r.status === 'NEW').length,
      },
      designs: {
        total: designs.length,
        aiGenerated: designs.filter((d) => d.aiGenerated).length,
        underReview: designs.filter((d) => ['ARCHITECT_REVIEW', 'CLIENT_REVIEW'].includes(d.status)).length,
        approved: designs.filter((d) => d.status === 'APPROVED').length,
        needsRevision: designs.filter((d) => d.status === 'REVISION').length,
      },
      financial: {
        subscription: subscription?.plan ?? 'FREE',
        subscriptionStatus: subscription?.status ?? 'INACTIVE',
        expiresInDays,
        totalEarnings,
        pendingEarnings,
        recentTransactions: transactions.slice(0, 5),
      },
      verification: {
        status: profile?.verificationStatus ?? 'UNVERIFIED',
        missingDocs,
        pendingActions: requests.filter((r) => r.status === 'NEW' || r.status === 'INFO_REQUIRED').length,
      },
      unreadMessages,
      unreadNotifications: notifications.filter((n) => !n.read).length,
    },
    activity: activities.slice(0, 10),
    upcomingAppointments: upcoming,
    settings,
  });
}
