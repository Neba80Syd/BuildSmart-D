// Authorized context builder for the Copilot.
//
// Only data the authenticated architect is permitted to access is assembled
// here. Passwords, tokens, credentials, audit/security data and other private
// information are never included.

import { dbClient } from '../db';

export type AuthorizedContext = {
  user: { id: string; name: string; role: string };
  profile: { title: string; location: string; verificationStatus: string } | null;
  project: {
    id: string;
    name: string;
    status: string;
    projectType: string | null;
    floors: number | null;
    rooms: number | null;
    siteArea: number | null;
    budget: number | null;
    location: string | null;
    style: string | null;
    requirements: string;
    progress: number;
  } | null;
  availableProjects: Array<{ id: string; name: string; status: string; progress: number }>;
};

const safeArray = (v: any): string => {
  if (Array.isArray(v)) return v.join(', ');
  if (v === null || v === undefined) return '';
  return String(v);
};

export async function buildAuthorizedContext(user: { id: string; name: string; role: string }, projectId?: string | null): Promise<AuthorizedContext> {
  // Architect profile is public to the platform and owned by the user.
  let profile: AuthorizedContext['profile'] = null;
  if (user.role === 'ARCHITECT') {
    const ap: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
    if (ap) {
      profile = {
        title: ap.title ?? 'Architect',
        location: ap.location ?? '',
        verificationStatus: ap.verificationStatus ?? 'UNKNOWN',
      };
    }
  }

  // Projects assigned to this architect (or owned by this user for clients).
  const mine: any[] = await dbClient.project.findMany({ where: { architectId: user.id } });
  const owned: any[] = await dbClient.project.findMany({ where: { ownerId: user.id } });
  const all = [...mine, ...owned].filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);

  const target = projectId ? all.find((p) => p.id === projectId) : all[0] ?? null;

  const project = target
    ? {
        id: target.id,
        name: target.name,
        status: target.status,
        projectType: target.projectType,
        floors: target.floors,
        rooms: target.rooms,
        siteArea: target.siteArea,
        budget: target.budget,
        location: target.location,
        style: target.style,
        requirements: safeArray(target.requirements),
        progress: target.progress,
      }
    : null;

  const availableProjects = all.map((p) => ({ id: p.id, name: p.name, status: p.status, progress: p.progress }));

  return { user: { id: user.id, name: user.name, role: user.role }, profile, project, availableProjects };
}

export function contextToPrompt(ctx: AuthorizedContext): string {
  if (!ctx.project) {
    if (ctx.availableProjects.length === 0) {
      return 'No project context is currently attached. The architect may ask without project context.';
    }
    return 'The architect has authorized projects, but none is currently selected as the active focus project.';
  }

  const p = ctx.project;
  return [
    'Active authorized project context:',
    `Project: ${p.name}`,
    `Building Type: ${p.projectType ?? 'Not specified'}`,
    `Status: ${p.status} · Progress: ${p.progress}%`,
    p.floors ? `Floors: ${p.floors}` : '',
    p.rooms ? `Rooms: ${p.rooms}` : '',
    p.siteArea ? `Site/Building Area: approx. ${p.siteArea}m²` : '',
    p.budget ? `Budget: approx. ${p.budget.toLocaleString()} XAF` : '',
    p.location ? `Location: ${p.location}` : '',
    p.style ? `Style: ${p.style}` : '',
    p.requirements ? `Requirements: ${p.requirements}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
