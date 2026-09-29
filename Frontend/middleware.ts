import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Secret used to sign and verify NextAuth JWT session tokens
const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  'buildsmart-ai-local-dev-secret-key-32-chars-long-secure';

type Role = 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN';

const ROLE_HOME_MAP: Record<Role, string> = {
  CLIENT: '/client',
  ARCHITECT: '/architect',
  VENDOR: '/vendor',
  ADMIN: '/admin',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Extract session token using Auth.js / NextAuth secret and cookie names
  let token = await getToken({ req, secret: AUTH_SECRET });
  if (!token) {
    token = await getToken({ req, secret: AUTH_SECRET, cookieName: 'authjs.session-token', salt: 'authjs.session-token' });
  }
  if (!token) {
    token = await getToken({ req, secret: AUTH_SECRET, cookieName: '__Secure-authjs.session-token', secureCookie: true, salt: '__Secure-authjs.session-token' });
  }
  if (!token) {
    token = await getToken({ req, secret: AUTH_SECRET, cookieName: 'next-auth.session-token', salt: 'next-auth.session-token' });
  }
  if (!token) {
    token = await getToken({ req, secret: AUTH_SECRET, cookieName: '__Secure-next-auth.session-token', secureCookie: true, salt: '__Secure-next-auth.session-token' });
  }

  const isAuthenticated = Boolean(token);
  const rawRole = (token?.role as string)?.toUpperCase();
  const userRole: Role =
    rawRole === 'ARCHITECT' || rawRole === 'VENDOR' || rawRole === 'ADMIN'
      ? rawRole
      : 'CLIENT';
  const userHome = ROLE_HOME_MAP[userRole] || '/client';

  // 1. If user is already authenticated and visits login/register, redirect directly to their dashboard workspace
  if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL(userHome, req.url));
  }

  // 2. Generic /dashboard or /auth/redirect route -> redirect to role dashboard if authenticated, or login
  if (pathname === '/dashboard' || pathname === '/dashboard/' || pathname === '/auth/redirect' || pathname === '/auth/redirect/') {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL(userHome, req.url));
  }

  // Check if current route is a role-scoped workspace
  const isArchitectRoute = pathname === '/architect' || pathname.startsWith('/architect/');
  const isClientRoute = pathname === '/client' || pathname.startsWith('/client/');
  const isVendorRoute = pathname === '/vendor' || pathname.startsWith('/vendor/');
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');

  const isProtectedWorkspace = isArchitectRoute || isClientRoute || isVendorRoute || isAdminRoute;

  if (isProtectedWorkspace) {
    // 3. Unauthenticated users cannot access any dashboard workspace
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 4. Strict Role-Based Access Control (RBAC):
    // Users are strictly maintained in their own dashboard workspace and cannot navigate to another workspace.
    if (isArchitectRoute && userRole !== 'ARCHITECT') {
      return NextResponse.redirect(new URL(userHome, req.url));
    }

    if (isClientRoute && userRole !== 'CLIENT') {
      return NextResponse.redirect(new URL(userHome, req.url));
    }

    if (isVendorRoute && userRole !== 'VENDOR') {
      return NextResponse.redirect(new URL(userHome, req.url));
    }

    if (isAdminRoute && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL(userHome, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
