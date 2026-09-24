import { NextResponse } from 'next/server';
import { getSessionUser } from '@/Backend/lib/auth-session';

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, role: null }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'CLIENT',
  });
}
