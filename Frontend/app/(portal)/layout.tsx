import { auth } from '@/Backend/lib/auth';
import { Sidebar } from '@/Frontend/components/dashboard/Sidebar';
import { DashboardHeader } from '@/Frontend/components/dashboard/DashboardHeader';
import CopilotFab from '@/Frontend/components/architect/CopilotFab';
import { redirect } from 'next/navigation';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const role = ((session.user as any)?.role || 'CLIENT').toUpperCase() as
    | 'CLIENT'
    | 'ARCHITECT'
    | 'VENDOR'
    | 'ADMIN';

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#17201e]">
      <Sidebar role={role} />
      <main className="md:ml-64 md:pt-0 pt-16">
        <DashboardHeader initialRole={role} />
        {children}
      </main>
      {role === 'ARCHITECT' && <CopilotFab />}
    </div>
  );
}
