import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function ArchitectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/architect');
  }

  const role = ((session.user as any)?.role || '').toUpperCase();

  if (role !== 'ARCHITECT') {
    if (role === 'CLIENT') redirect('/client');
    if (role === 'VENDOR') redirect('/vendor');
    if (role === 'ADMIN') redirect('/admin');
    redirect('/client');
  }

  return <>{children}</>;
}
