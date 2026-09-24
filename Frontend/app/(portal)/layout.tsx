import { auth } from '@/Backend/lib/auth';
import { Sidebar } from '@/Frontend/components/dashboard/Sidebar';
import { DashboardHeader } from '@/Frontend/components/dashboard/DashboardHeader';
import CopilotFab from '@/Frontend/components/architect/CopilotFab';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // PREVIEW MODE: do not redirect when unauthenticated — the Sidebar derives a
  // role from the current path so every dashboard remains viewable. Re-add the
  // `redirect('/login')` guard when authentication is re-enabled.
  const role = (session?.user as any)?.role; // undefined in preview → derived from path

  return (
    <div className="min-h-screen bg-[#FAFAF8] dark:bg-[#17201e]">
      <Sidebar role={role} />
      <main className="md:ml-64 md:pt-0 pt-16">
        <DashboardHeader initialRole={role} />
        {children}
      </main>
      <CopilotFab />
    </div>
  );
}
