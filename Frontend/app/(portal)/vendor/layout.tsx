import { auth } from '@/Backend/lib/auth';
import { redirect } from 'next/navigation';

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login?callbackUrl=/vendor');
  }

  const role = ((session.user as any)?.role || '').toUpperCase();

  if (role !== 'VENDOR') {
    if (role === 'CLIENT') redirect('/client');
    if (role === 'ARCHITECT') redirect('/architect');
    if (role === 'ADMIN') redirect('/admin');
    redirect('/client');
  }

  return <>{children}</>;
}
