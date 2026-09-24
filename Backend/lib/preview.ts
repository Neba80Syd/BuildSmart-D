import { auth } from './auth';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN';
};

const DEMO_USERS: Record<string, SessionUser> = {
  CLIENT: { id: 'u_client', name: 'Jordan Ellis', email: 'client@demo.com', role: 'CLIENT' },
  ARCHITECT: { id: 'u_architect', name: 'Elena Voss', email: 'architect@demo.com', role: 'ARCHITECT' },
  VENDOR: { id: 'u_vendor', name: 'Marcus Hale', email: 'vendor@demo.com', role: 'VENDOR' },
  ADMIN: { id: 'u_admin', name: 'BuildSmart Admin', email: 'admin@demo.com', role: 'ADMIN' },
};

/**
 * Resolve the acting user for a request.
 *
 * When authenticated, returns the real session user (so server-side
 * authorization stays user-scoped once auth is re-enabled). In PREVIEW MODE
 * (no session — the middleware/auth redirects are currently disabled), it
 * falls back to the demo identity for the requested role so features remain
 * genuinely functional rather than dead UI.
 */
export async function resolveUser(defaultRole: SessionUser['role'] = 'CLIENT'): Promise<SessionUser> {
  const session = await auth();
  if (session?.user) {
    return {
      id: (session.user as any).id ?? 'u_anon',
      name: session.user.name ?? 'User',
      email: session.user.email ?? '',
      role: (session.user as any).role ?? defaultRole,
    };
  }
  return DEMO_USERS[defaultRole] ?? DEMO_USERS.CLIENT;
}
