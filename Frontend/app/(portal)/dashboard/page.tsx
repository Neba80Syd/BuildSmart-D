import Image from 'next/image';
import Link from 'next/link';
import { resolveUser } from '@/Backend/lib/preview';
import { dbClient } from '@/Backend/lib/db';

const PROJECT_IMAGES: Record<string, string> = {
  DESIGNING: '/images/project-villa.png',
  PROCUREMENT: '/images/project-floorplan.png',
  APPROVED: '/images/project-eco-office.png',
  COMPLETED: '/images/project-eco-office.png',
};

const PHASE_TEXT: Record<string, string> = {
  DESIGNING: 'Phase: Schematic Design',
  PROCUREMENT: 'Phase: Material Procurement',
  APPROVED: 'Phase: Approved for Build',
  COMPLETED: 'Phase: Completed',
};

export default async function ClientDashboardPage() {
  const user = await resolveUser('CLIENT');
  const name = user.name;

  const projects: any[] = (await dbClient.project.findMany({ where: { ownerId: user.id } })).slice(0, 2);
  const orders: any[] = await dbClient.order.findMany({ where: { userId: user.id } });
  const notifications: any[] = await dbClient.notification.findMany({ where: { userId: user.id } });
  const messages: any[] = await dbClient.message.findMany({ where: { roomId: 'room_1' } });
  const products: any[] = await dbClient.product.findMany();

  const activeProjects = projects.filter((p) => p.status !== 'COMPLETED').length;
  const unreadMessages = messages.filter((m) => !m.read).length;
  const totalOrders = orders.length;
  const pendingEstimates = projects.filter((p) => p.status === 'DESIGNING').length;

  const stats = [
    { icon: 'folder_open', label: 'ACTIVE PROJECTS', value: String(activeProjects), tone: 'primary' },
    { icon: 'request_quote', label: 'PENDING ESTIMATES', value: String(pendingEstimates), tone: 'default' },
    { icon: 'forum', label: 'MESSAGES', value: String(messages.length), tone: 'default', badge: unreadMessages ? `${unreadMessages} NEW` : undefined },
    { icon: 'inventory_2', label: 'TOTAL ORDERS', value: String(totalOrders), tone: 'default' },
  ];

  const quickPicks = products.slice(0, 4).map((p) => ({
    icon: 'inventory_2',
    name: p.name,
    price: `${p.price.toLocaleString()} XAF / ${p.unit}`,
    id: p.id,
  }));

  const activity = notifications.slice(0, 4).map((n) => {
    const kind = n.type === 'ORDER' ? 'order' : n.type === 'PAYMENT' ? 'approved' : n.type === 'MESSAGE' ? 'warning' : 'file';
    return { kind, text: [n.title], time: new Date(n.createdAt).toLocaleDateString(), mono: undefined as string | undefined, action: kind === 'file' ? 'Review Now' : undefined };
  });

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop grid grid-cols-1 lg:grid-cols-12 gap-lg lg:gap-gutter">
      {/* Main content */}
      <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-xl">
        {/* Header */}
        <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest dark:bg-tertiary dark:border-tertiary p-lg rounded-xl border border-outline-variant shadow-elevation relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-headline-lg text-on-background dark:text-white mb-1">Welcome back, {name}.</h2>
            <p className="text-body-md text-on-surface-variant dark:text-outline-variant">
              Here is the structural overview of your ongoing projects.
            </p>
          </div>
          <Link href="/projects" className="relative z-10 bg-primary text-on-primary hover:bg-[#264B3E] transition-colors py-3 px-6 rounded-lg text-label-md flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-sm">add</span>
            New Project
          </Link>
          <div className="absolute right-0 top-0 w-64 h-full opacity-10 dark:opacity-20 pointer-events-none" style={{ background: 'repeating-linear-gradient(45deg, #184436, #184436 2px, transparent 2px, transparent 10px)' }} />
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surface-container-lowest dark:bg-[#1a211f] border border-outline-variant dark:border-tertiary rounded-xl p-4 hover:shadow-elevation transition-shadow">
              <div className="flex items-center gap-2 text-on-surface-variant dark:text-outline-variant mb-2">
                <span className="material-symbols-outlined text-sm">{s.icon}</span>
                <h3 className="text-label-md">{s.label}</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-display ${s.tone === 'primary' ? 'text-primary dark:text-inverse-primary' : 'text-on-background dark:text-white'}`}>{s.value}</p>
                {s.badge && (
                  <span className="inline-flex items-center rounded-full bg-[#eaf7f1] dark:bg-primary-container px-2 py-0.5 text-label-md text-[#2F6B50] dark:text-on-primary-container">{s.badge}</span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Recent Projects */}
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-end border-b border-outline-variant dark:border-tertiary pb-2">
            <h3 className="text-headline-md text-on-background dark:text-white">Recent Projects</h3>
            <Link href="/projects" className="text-label-md text-primary dark:text-inverse-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((p) => (
              <div key={p.id} className="bg-surface-container-lowest dark:bg-[#1a211f] border border-outline-variant dark:border-tertiary rounded-xl overflow-hidden hover:shadow-elevation transition-all group">
                <div className="h-40 w-full relative">
                  <Image src={PROJECT_IMAGES[p.status] ?? '/images/project-villa.png'} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-3 left-3 bg-surface-container-lowest dark:bg-inverse-surface text-on-background dark:text-white px-2 py-1 rounded font-mono-technical">{p.id.toUpperCase()}</span>
                </div>
                <div className="p-4">
                  <h4 className="text-headline-sm text-on-background dark:text-white mb-1">{p.name}</h4>
                  <p className="text-body-sm text-on-surface-variant dark:text-outline-variant mb-4">{PHASE_TEXT[p.status] ?? p.status}</p>
                  <div className="w-full bg-surface-variant dark:bg-tertiary-container rounded-full h-2 mb-1">
                    <div className="bg-primary dark:bg-inverse-primary h-2 rounded-full" style={{ width: `${p.progress ?? 0}%` }} />
                  </div>
                  <div className="flex justify-between text-label-md text-on-surface-variant dark:text-outline-variant">
                    <span>Progress</span>
                    <span>{p.progress ?? 0}%</span>
                  </div>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full bg-surface-container-lowest dark:bg-[#1a211f] border border-outline-variant dark:border-tertiary rounded-xl p-8 text-center text-on-surface-variant dark:text-outline-variant">
                No projects yet. <Link href="/projects" className="text-primary dark:text-inverse-primary underline">Create your first project</Link>.
              </div>
            )}
          </div>
        </section>

        {/* Marketplace Quick Picks */}
        <section className="flex flex-col gap-4 mt-8">
          <div className="flex justify-between items-end border-b border-outline-variant dark:border-tertiary pb-2">
            <h3 className="text-headline-md text-on-background dark:text-white">Marketplace Quick Picks</h3>
            <Link href="/marketplace-portal" className="text-label-md text-primary dark:text-inverse-primary hover:underline">Explore Market</Link>
          </div>
          <div className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar -mx-margin-mobile px-margin-mobile md:mx-0 md:px-0">
            {quickPicks.map((m) => (
              <Link href="/marketplace-portal" key={m.id} className="min-w-[200px] flex-shrink-0 bg-surface-container-lowest dark:bg-[#1a211f] border border-outline-variant dark:border-tertiary rounded-xl p-3 hover:shadow-elevation transition-all">
                <div className="h-24 w-full bg-surface-variant dark:bg-tertiary-container rounded mb-3 flex items-center justify-center">
                  <span className="material-symbols-outlined text-outline dark:text-outline-variant text-3xl">{m.icon}</span>
                </div>
                <h5 className="text-body-md font-semibold text-on-background dark:text-white line-clamp-1">{m.name}</h5>
                <p className="text-label-md text-on-surface-variant dark:text-outline-variant mt-1">{m.price}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Activity feed */}
      <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-lg">
        <div className="bg-white dark:bg-[#1a211f] border border-outline-variant dark:border-tertiary rounded-xl p-6 h-full flex flex-col">
          <h3 className="text-headline-sm text-on-background dark:text-white border-b border-outline-variant dark:border-tertiary pb-3 mb-4">Project Activity</h3>
          <div className="relative flex-1">
            <div className="absolute left-3 top-2 bottom-0 w-px bg-outline-variant dark:bg-tertiary" />
            <ul className="space-y-6 relative">
              {activity.map((a, i) => (
                <li key={i} className="flex gap-4">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 border ${
                    a.kind === 'approved' ? 'bg-[#eaf7f1] dark:bg-[#101413] border-primary dark:border-inverse-primary'
                    : a.kind === 'warning' ? 'bg-[#fff8e6] dark:bg-[#101413] border-[#A66A00] dark:border-[#F2B04E]'
                    : 'bg-surface-container-lowest dark:bg-[#101413] border-outline-variant dark:border-tertiary'
                  }`}>
                    <span className={`material-symbols-outlined text-[14px] ${
                      a.kind === 'approved' ? 'text-primary dark:text-inverse-primary'
                      : a.kind === 'warning' ? 'text-[#A66A00] dark:text-[#F2B04E]'
                      : 'text-on-surface-variant dark:text-outline-variant'
                    }`}>
                      {a.kind === 'approved' ? 'check' : a.kind === 'order' ? 'local_shipping' : a.kind === 'warning' ? 'warning' : 'description'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-body-sm text-on-background dark:text-white">
                      {a.text[0]}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-label-md text-on-surface-variant dark:text-outline-variant">{a.time}</span>
                      {a.action && <Link href="/projects" className="text-label-md text-primary dark:text-inverse-primary hover:underline">{a.action}</Link>}
                    </div>
                  </div>
                </li>
              ))}
              {activity.length === 0 && <li className="text-body-sm text-on-surface-variant dark:text-outline-variant">No recent activity.</li>}
            </ul>
          </div>
          <Link href="/notifications" className="mt-6 w-full py-2 border border-outline-variant dark:border-tertiary rounded-lg text-label-md text-on-surface-variant dark:text-outline-variant hover:bg-surface-container-low dark:hover:bg-surface-dim transition-colors text-center block">
            View All Notifications
          </Link>
        </div>
      </aside>
    </div>
  );
}
