import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function AuthRedirectPage() {
  const session = await auth();

  // Not logged in → go to login
  if (!session?.user) {
    redirect('/login');
  }

  const role = (session.user as any).role || 'CLIENT';

  // Role-based destinations (single source of truth for post-login landing)
  switch (role) {
    case 'VENDOR':
      redirect('/vendor');
    case 'ARCHITECT':
      redirect('/architect');
    case 'ADMIN':
      redirect('/admin');
    case 'CLIENT':
    default:
      redirect('/client');
  }
}
