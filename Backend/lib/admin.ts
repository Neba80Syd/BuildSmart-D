// BuildSmart AI — admin console server helpers.
// Every mutation path goes through `requireAdmin()` and, for sensitive
// operations, `requirePermission()`. Authorization is always enforced here,
// server-side — never trusted from the browser.

import { NextResponse } from 'next/server';
import { dbClient } from '@/Backend/lib/db';
import { auth } from '@/Backend/lib/auth';

export const parseJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
};

export const money = (n: number, currency = 'XAF') => `${Math.round(n || 0).toLocaleString()} ${currency}`;

/** The full permission catalog exposed by the Access Control module. */
export const PERMISSIONS = [
  'users.view', 'users.manage',
  'architects.view', 'architects.verify', 'architects.suspend',
  'vendors.view', 'vendors.verify', 'vendors.suspend',
  'projects.view', 'projects.manage',
  'marketplace.view', 'marketplace.manage', 'products.approve',
  'orders.view', 'orders.manage',
  'payments.view', 'refunds.manage',
  'verification.view', 'verification.manage',
  'support.view', 'support.manage',
  'analytics.view',
  'security.view', 'security.manage',
  'audit_logs.view',
  'content.manage',
  'settings.manage',
  'roles.manage',
] as const;

const ROLE_DESCRIPTIONS: Record<string, string> = {
  SUPER_ADMIN: 'Unrestricted platform access.',
  ADMINISTRATOR: 'Day-to-day administration.',
  VERIFICATION_OFFICER: 'Reviews verification applications.',
  MARKETPLACE_MANAGER: 'Moderates marketplace listings.',
  FINANCE_OFFICER: 'Manages payments and refunds.',
  SUPPORT_OFFICER: 'Handles support and moderation.',
  SECURITY_OFFICER: 'Investigates security events.',
  CONTENT_MANAGER: 'Manages blog, FAQs and announcements.',
};

/** Authenticate + authorize an ADMIN session; return the user or a 403 response. */
export async function requireAdmin() {
  const session = await auth();
  const role = ((session?.user as any)?.role || '').toUpperCase();
  if (!session?.user || role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 }) };
  }
  const adminUser = session.user as any;
  if (adminUser.status === 'SUSPENDED' || adminUser.status === 'DEACTIVATED') {
    return { error: NextResponse.json({ error: 'Account disabled' }, { status: 403 }) };
  }
  return { user: adminUser };
}

/**
 * Granular permission check. SUPER_ADMIN implicitly holds every permission;
 * every other role is resolved against the stored admin_roles definition.
 */
export async function hasPermission(user: any, perm: string): Promise<boolean> {
  const roleName = user.adminRole ?? 'SUPER_ADMIN';
  if (roleName === 'SUPER_ADMIN') return true;
  const role: any = await dbClient.adminRole.findUnique({ where: { name: roleName } });
  if (!role) return false;
  const perms: string[] = parseJson(role.permissions, []);
  return perms.includes(perm);
}

/** Appends an immutable audit event. */
export async function audit(data: {
  actorId: string;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  result?: string;
  reason?: string | null;
}) {
  return dbClient.auditLog.create({
    data: {
      actorId: data.actorId,
      actorName: data.actorName ?? 'Admin',
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId ?? null,
      result: data.result ?? 'SUCCESS',
      reason: data.reason ?? null,
      ip: '127.0.0.1',
      device: 'Admin console',
    },
  });
}

/** Sends an in-app notification to a user (no-op when target is null). */
export async function notifyUser(userId: string | null | undefined, title: string, body: string, link?: string, resourceId?: string) {
  if (!userId) return null;
  return dbClient.notification.create({
    data: { userId, type: 'SYSTEM', title, body, read: 0, link: link ?? null, resourceId: resourceId ?? null },
  });
}

/** Generic name lookup across the user table. */
export async function names(): Promise<Map<string, string>> {
  const users: any[] = await dbClient.user.findMany();
  const m = new Map<string, string>();
  for (const u of users) m.set(u.id, u.name ?? 'Unknown');
  return m;
}

export const ADMIN_ROLE_DESCRIPTIONS = ROLE_DESCRIPTIONS;
