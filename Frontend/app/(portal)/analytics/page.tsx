import { dbClient } from '@/Backend/lib/db';
import { BarChart, LineChart } from '@/Frontend/components/analytics/Charts';

const RANGE_DAYS = [7, 30, 90];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; as?: string }> }) {
  const { range, as } = await searchParams;
  const days = RANGE_DAYS.includes(Number(range)) ? Number(range) : 30;
  const role = (as ?? 'admin').toUpperCase();
  const cutoff = Date.now() - days * 864e5;

  const users = await dbClient.user.findMany();
  const architects = await dbClient.architectProfile.findMany();
  const vendors = await dbClient.vendorProfile.findMany();
  const projects = await dbClient.project.findMany();
  const products = await dbClient.product.findMany();
  const payments = (await dbClient.payment.findMany()).filter((p: any) => new Date(p.createdAt).getTime() >= cutoff);
  const reviews = await dbClient.review.findMany();
  const posts = await dbClient.blogPost.findMany();
  const tickets = await dbClient.supportTicket.findMany();

  const revenue = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
  const activeProjects = projects.filter((p: any) => ['DESIGNING', 'PROCUREMENT', 'APPROVED'].includes(p.status)).length;

  // Revenue by month (last 4 months)
  const months: { label: string; value: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toLocaleString('en', { month: 'short' });
    const total = payments
      .filter((p: any) => {
        const pd = new Date(p.createdAt);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      })
      .reduce((s: number, p: any) => s + p.amount, 0);
    months.push({ label: key, value: total });
  }

  const productsPerCategory = [...new Set(products.map((p: any) => p.category))].map((cat) => ({
    label: cat,
    value: products.filter((p: any) => p.category === cat).length,
  }));

  const ticketsByStatus = [...new Set(tickets.map((t: any) => t.status))].map((s) => ({
    label: s,
    value: tickets.filter((t: any) => t.status === s).length,
  }));

  const stat = (label: string, value: string | number, icon: string) => (
    <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5 shadow-elevation">
      <div className="flex items-center justify-between mb-3">
        <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[20px]">{icon}</span>
      </div>
      <div className="text-display text-on-background dark:text-surface-container-lowest">{value}</div>
    </div>
  );

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Analytics &amp; Reporting</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Operational and business insights — {role} view.</p>
        </div>
        <div className="flex items-center gap-1 border border-outline-variant dark:border-outline rounded-lg p-1">
          {RANGE_DAYS.map((d) => (
            <a key={d} href={`/analytics?range=${d}&as=${role.toLowerCase()}`} className={`text-label-md px-3 py-1.5 rounded-md transition-colors ${days === d ? 'bg-primary text-on-primary' : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low dark:hover:bg-tertiary-container'}`}>
              {d}d
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stat('Total Users', users.length, 'group')}
        {stat('Architects', architects.length, 'architecture')}
        {stat('Vendors', vendors.length, 'storefront')}
        {stat('Active Projects', activeProjects, 'folder_open')}
        {stat('Marketplace Products', products.length, 'inventory_2')}
        {stat('Reviews', reviews.length, 'star_rate')}
        {stat('Published Articles', posts.filter((p: any) => p.status === 'PUBLISHED').length, 'article')}
        {stat(`Revenue (${days}d)`, `€${revenue.toLocaleString()}`, 'payments')}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation md:col-span-2">
          <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Revenue Trend</h3>
          <LineChart data={months} height={220} />
          <div className="flex justify-between mt-2 text-label-md text-on-surface-variant dark:text-surface-variant">
            {months.map((m) => <span key={m.label}>{m.label}</span>)}
          </div>
        </div>
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
          <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Products by Category</h3>
          <BarChart data={productsPerCategory} height={220} />
        </div>
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation">
          <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Tickets by Status</h3>
          <BarChart data={ticketsByStatus} height={220} />
        </div>
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation md:col-span-2">
          <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Verification Overview</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Verified Architects', value: architects.filter((a: any) => a.verificationStatus === 'VERIFIED').length, total: architects.length },
              { label: 'Verified Vendors', value: vendors.filter((v: any) => v.verificationStatus === 'FULLY_VERIFIED').length, total: vendors.length },
              { label: 'Pending Verifications', value: architects.filter((a: any) => a.verificationStatus === 'PENDING').length, total: '—' },
            ].map((x) => (
              <div key={x.label} className="bg-surface-container-low dark:bg-tertiary-container rounded-xl p-5">
                <div className="text-display text-primary dark:text-primary-fixed">{x.value}</div>
                <div className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">{x.label}</div>
                {typeof x.total === 'number' && <div className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">of {x.total}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
