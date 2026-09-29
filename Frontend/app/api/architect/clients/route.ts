import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getArchitectClients, getArchitectProjects } from '@/Backend/lib/architect';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('id');

  if (clientId) {
    const projects = (await getArchitectProjects(user.id)).filter((p) => p.ownerId === clientId);
    const requests: any[] = await dbClient.designRequest.findMany({ where: { architectId: user.id, clientId } });
    const documents: any[] = await dbClient.document.findMany({ where: { ownerId: clientId } });
    const appointments: any[] = await dbClient.appointment.findMany({ where: { architectId: user.id, clientId } });
    const reviews: any[] = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', targetId: user.id, authorId: clientId, status: 'APPROVED' } });
    return NextResponse.json({
      client: { id: clientId, name: projects[0]?.clientName ?? requests[0]?.clientName ?? 'Client' },
      projects, requests, documents, appointments, reviews,
    });
  }

  const clients = await getArchitectClients(user.id);
  return NextResponse.json({ clients });
}
