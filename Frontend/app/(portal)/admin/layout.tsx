import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin');
  }

  const role = ((session.user as any)?.role || '').toUpperCase();

  if (role !== 'ADMIN') {
    if (role === 'CLIENT') redirect('/client');
    if (role === 'ARCHITECT') redirect('/architect');
    if (role === 'VENDOR') redirect('/vendor');
    redirect('/client');
  }

  return <>{children}</>;
}
