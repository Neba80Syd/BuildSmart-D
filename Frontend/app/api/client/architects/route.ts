import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';
import { getClientProjects, parseJson, publicArchitect } from '@/Backend/lib/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await resolveUser('CLIENT');
  const { searchParams } = new URL(req.url);
  const mine = searchParams.get('mine') === '1';
  const id = searchParams.get('id');

  const profiles: any[] = await dbClient.architectProfile.findMany();
  const users: any[] = await dbClient.user.findMany();
  const reviews: any[] = await dbClient.review.findMany({ where: { targetType: 'ARCHITECT', status: 'APPROVED' } });
  const nameFor = (uid: string) => users.find((u) => u.id === uid)?.name ?? 'Architect';

  const projects = await getClientProjects(user.id);
  const myArchitectIds = new Set(projects.map((p) => p.architectId).filter(Boolean));

  const list = profiles
    .filter((p) => (mine ? myArchitectIds.has(p.userId) : true))
    .map((p) => {
      const name = nameFor(p.userId);
      const archReviews = reviews.filter((r) => r.targetId === p.userId);
      const activeProjects = projects.filter((x) => x.architectId === p.userId && !['COMPLETED', 'ARCHIVED'].includes(x.status)).length;
      return {
        ...publicArchitect(p, name),
        reviews: archReviews,
        activeProjects,
        assignedProjects: projects.filter((x) => x.architectId === p.userId).map((x) => ({ id: x.id, name: x.name, status: x.status })),
      };
    });

  if (id) {
    const found = list.find((a) => a.id === id);
    if (!found) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ architect: found });
  }

  return NextResponse.json({ architects: list, myArchitectIds: [...myArchitectIds] });
}
