import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/Backend/lib/preview';
import { buildAuthorizedContext } from '@/Backend/lib/copilot/context';

const ALLOWED_ROLES = ['ARCHITECT', 'ADMIN'];

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT');
    if (!ALLOWED_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const projectId = req.nextUrl.searchParams.get('projectId');
    const context = await buildAuthorizedContext(
      { id: user.id, name: user.name, role: user.role },
      projectId,
    );
    return NextResponse.json({ success: true, context });
  } catch (err: any) {
    console.error('[ai/context]', err?.message ?? err);
    return NextResponse.json({ error: 'Unable to load AI context.' }, { status: 500 });
  }
}
