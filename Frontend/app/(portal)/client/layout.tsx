import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/client');
  }

  const role = ((session.user as any)?.role || '').toUpperCase();

  if (role !== 'CLIENT') {
    if (role === 'ARCHITECT') redirect('/architect');
    if (role === 'VENDOR') redirect('/vendor');
    if (role === 'ADMIN') redirect('/admin');
    redirect('/client');
  }

  return <>{children}</>;
}
