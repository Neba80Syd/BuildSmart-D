import { NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// Lightweight counts for the admin sidebar + header badges.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const architects: any[] = await dbClient.architectProfile.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const tickets: any[] = await dbClient.supportTicket.findMany();
  const security: any[] = await dbClient.securityEvent.findMany();
  const reports: any[] = await dbClient.report.findMany();
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: auth.user.id } });

  return NextResponse.json({
    pendingVerifications: [...architects, ...vendors].filter((p) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED'].includes(p.verificationStatus)).length,
    openTickets: tickets.filter((t) => ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER'].includes(t.status)).length,
    securityAlerts: security.filter((s) => s.status === 'OPEN').length,
    openReports: reports.filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status)).length,
    unreadNotifications: notifications.filter((n) => !n.read).length,
  });
}
