import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const role = ((session.user as any)?.role || 'CLIENT').toUpperCase();

  if (role === 'ARCHITECT') {
    redirect('/architect');
  }
  if (role === 'VENDOR') {
    redirect('/vendor');
  }
  if (role === 'ADMIN') {
    redirect('/admin');
  }

  redirect('/client');
}
