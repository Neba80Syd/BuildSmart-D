import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * Global /notifications redirector.
 * Automatically forwards users to their respective role-based notification center
 * so they always remain within their dedicated portal (Admin, Vendor, Architect, or Client).
 */
export default async function NotificationsPage() {
  const session = await auth();
  let role = (session?.user as any)?.role;

  if (!role) {
    try {
      const headersList = await headers();
      const referer = headersList.get('referer') || '';
      if (referer.includes('/admin')) role = 'ADMIN';
      else if (referer.includes('/vendor')) role = 'VENDOR';
      else if (referer.includes('/architect')) role = 'ARCHITECT';
    } catch {
      // ignore header resolution failure
    }
  }

  if (role === 'ADMIN') {
    redirect('/admin/notifications');
  }
  if (role === 'VENDOR') {
    redirect('/vendor/notifications');
  }
  if (role === 'ARCHITECT') {
    redirect('/architect/notifications');
  }

  redirect('/client/notifications');
}
