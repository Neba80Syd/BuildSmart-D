import { NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await resolveUser('CLIENT');
    const clientId = user.id;

    const projects = await getClientProjects(clientId);
    const requests: any[] = await dbClient.designRequest.findMany({ where: { clientId } });
    const designs: any[] = await dbClient.design.findMany({ where: { clientId } });
    const orders: any[] = await dbClient.order.findMany({ where: { userId: clientId } });
    const invoices: any[] = await dbClient.invoice.findMany({ where: { userId: clientId } });
    const payments: any[] = await dbClient.payment.findMany({ where: { userId: clientId } });
    const activities: any[] = await dbClient.activity.findMany({ where: { userId: clientId } });
    const notifications: any[] = await dbClient.notification.findMany({ where: { userId: clientId } });
    const appointments: any[] = await dbClient.appointment.findMany({ where: { clientId } });
    const favorites: any[] = await dbClient.favorite.findMany({ where: { userId: clientId } });

    const projectIds = projects.map((p) => p.id);
    const plans: any[] = [];
    for (const pid of projectIds) {
      plans.push(...(await dbClient.floorPlan.findMany({ where: { projectId: pid } })));
    }
    const threeD = plans.filter((p) => p.kind === '3D');
    const published3d = threeD.filter((p) => p.status === 'PUBLISHED');
    const ready3d = published3d.filter((p) => ['READY_FOR_REVIEW', 'UPDATED_READY'].includes(p.reviewStatus));
    const feedback: any[] = [];
    for (const pid of projectIds) {
      feedback.push(...(await dbClient.floorPlanFeedback.findMany({ where: { projectId: pid } })));
    }

    // Rooms the client participates in (for unread-message count).
    const participants: any[] = await dbClient.chatParticipant.findMany({ where: { userId: clientId } });
    const roomIds = participants.map((p) => p.roomId);
    let unreadMessages = 0;
    for (const rid of roomIds) {
      const msgs: any[] = await dbClient.message.findMany({ where: { roomId: rid } });
      unreadMessages += msgs.filter((m) => m.senderId !== clientId && !m.read).length;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = appointments.filter((a) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(a.status) && new Date(a.date + 'T23:59:59') >= today);

    const active = projects.filter((p) => !['COMPLETED', 'ARCHIVED'].includes(p.status));
    const completed = projects.filter((p) => p.status === 'COMPLETED');
    const pendingRequests = requests.filter((r) => !['CONVERTED', 'REJECTED', 'CANCELLED'].includes(r.status));
    const awaitingReviewDesigns = designs.filter((d) => ['CLIENT_REVIEW', 'REVISION'].includes(d.status));
    const awaitingApprovalDesigns = designs.filter((d) => d.status === 'CLIENT_REVIEW');
    const activeOrders = orders.filter((o) => !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(o.status));
    const pendingInvoices = invoices.filter((i) => i.status === 'PENDING');

    const stats = {
      totalProjects: projects.length,
      activeProjects: active.length,
      completedProjects: completed.length,
      pendingRequests: pendingRequests.length,
      designsAwaitingReview: awaitingReviewDesigns.length,
      designsAwaitingApproval: awaitingApprovalDesigns.length,
      new3dReady: ready3d.length,
      floorplansAwaitingFeedback: ready3d.length,
      published3d: published3d.length,
      upcomingAppointments: upcoming.length,
      unreadMessages,
      unreadNotifications: notifications.filter((n) => !n.read).length,
      pendingPayments: pendingInvoices.length,
      pendingPaymentsTotal: pendingInvoices.reduce((s, i) => s + (i.total ?? 0), 0),
      activeOrders: activeOrders.length,
      favorites: favorites.length,
    };

    const recentActivity = activities.slice(0, 10);

    return NextResponse.json({
      user,
      projects,
      requests,
      designs,
      published3d,
      ready3d,
      feedback,
      upcomingAppointments: upcoming.slice(0, 4),
      appointments: upcoming,
      notifications: notifications.slice(0, 6),
      recentActivity,
      stats,
      architects: await architectsFor(clientId, projects),
    });
  } catch (error) {
    console.error('[Client Dashboard GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve client dashboard data' },
      { status: 500 }
    );
  }
}

async function architectsFor(clientId: string, projects: any[]) {
  const ids = [...new Set(projects.map((p) => p.architectId).filter(Boolean))];
  const users: any[] = await dbClient.user.findMany();
  const out: any[] = [];
  for (const id of ids) {
    const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: id } });
    if (!profile) continue;
    const name = users.find((u) => u.id === id)?.name ?? 'Architect';
    out.push({
      id,
      name,
      title: profile.title,
      verificationStatus: profile.verificationStatus,
      rating: profile.rating,
      reviewCount: profile.reviewCount,
      specializations: parseJson(profile.specializations, []),
    });
  }
  return out;
}
