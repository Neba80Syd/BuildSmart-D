import { NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';

const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];

const TOOLS = [
  { id: 'listAuthorizedProjects', label: 'List authorized projects', scope: 'Projects the user owns or is assigned to' },
  { id: 'getProjectContext', label: 'Get active project context', scope: 'Currently selected authorized project' },
  { id: 'getProjectRequirements', label: 'Get project requirements', scope: 'Requirements of the authorized project' },
  { id: 'getProjectDesign', label: 'Get floor-plan records', scope: 'Publishable plans in the authorized project' },
  { id: 'searchMarketplaceMaterials', label: 'Search marketplace materials', scope: 'Public marketplace catalog' },
  { id: 'getArchitectProfile', label: 'Get architect profile', scope: 'The authenticated architect profile' },
  { id: 'createBOQDraft', label: 'Create preliminary BOQ skeleton', scope: 'Deterministic draft; no write to project' },
  { id: 'createDesignBrief', label: 'Create design brief draft', scope: 'Structured extract; no write to project' },
];

export async function GET() {
  const user = await resolveUser('ARCHITECT');
  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({
    success: true,
    tools: TOOLS,
    note: 'All tools are read-only (or produce non-persisted drafts). Free-form AI database access is disabled.',
  });
}
