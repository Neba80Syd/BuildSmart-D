// BuildSmart AI — client console server helpers.
// Every lookup is scoped to the acting client (`ownerId` / `clientId` / `userId`),
// so client modules never leak other users' resources (server-side authorization).

import { dbClient } from '@/Backend/lib/db';

export const CURRENCY = 'XAF';

export const parseJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

/** Projects owned by the client, enriched with the assigned architect's name. */
export async function getClientProjects(clientId: string): Promise<any[]> {
  const projects: any[] = await dbClient.project.findMany({ where: { ownerId: clientId } });
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unassigned';
  return projects.map((p) => ({
    ...p,
    architectName: nameFor(p.architectId),
    requirements: parseJson(p.requirements, []),
  }));
}

/** A project owned by the client (or null). */
export async function clientProject(clientId: string, projectId: string): Promise<any | null> {
  const project: any = await dbClient.project.findUnique({ where: { id: projectId } });
  if (!project || project.ownerId !== clientId) return null;
  return project;
}

/** Public-safe architect profile (never leaks verification documents). */
export function publicArchitect(profile: any, name: string) {
  return {
    id: profile?.userId,
    name,
    title: profile?.title ?? 'Architect',
    biography: profile?.biography ?? '',
    specializations: parseJson(profile?.specializations, []),
    experience: profile?.experience ?? 0,
    licenseNumber: profile?.licenseNumber ?? '',
    verificationStatus: profile?.verificationStatus ?? 'PENDING',
    verifiedAt: profile?.verifiedAt ?? null,
    rating: profile?.rating ?? 0,
    reviewCount: profile?.reviewCount ?? 0,
    portfolio: parseJson(profile?.portfolio, []),
    location: profile?.location ?? '',
    hourlyRate: profile?.hourlyRate ?? 0,
    languages: parseJson(profile?.languages, []),
    serviceAreas: parseJson(profile?.serviceAreas, []),
  };
}

export const money = (n: number) => `${Math.round(n || 0).toLocaleString()} XAF`;
