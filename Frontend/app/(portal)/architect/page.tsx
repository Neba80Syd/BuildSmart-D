'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, StatCard, StatusPill, EmptyState, Skeleton } from '@/Frontend/components/architect/ui';

const fmt = (n: number) => Math.round(n).toLocaleString();

type Overview = {
  architect: { id: string; name: string };
  currency: string;
  profile: { verificationStatus: string; title: string; location: string; rating: number; reviewCount: number };
  stats: {
    projects: { total: number; active: number; completed: number; drafts: number; awaitingClient: number; needsRevision: number };
    clients: { total: number; pendingRequests: number };
    designs: { total: number; aiGenerated: number; underReview: number; approved: number; needsRevision: number };
    financial: { subscription: string; subscriptionStatus: string; expiresInDays: number | null; totalEarnings: number; pendingEarnings: number; recentTransactions: any[] };
    verification: { status: string; missingDocs: string[]; pendingActions: number };
    unreadMessages: number;
    unreadNotifications: number;
  };
  activity: { id: string; type: string; title: string; body: string; createdAt: string }[];
  upcomingAppointments: any[];
};

const VERIFIED_QUICK_ACTIONS = [
  { icon: 'add_home_work', label: 'Create Project', href: '/architect/projects' },
  { icon: 'auto_awesome', label: 'AI Copilot', href: '/architect/gemini' },
  { icon: 'auto_awesome', label: 'Generate AI Design', href: '/architect/studio' },
  { icon: 'edit_square', label: 'Open 2D Editor', href: '/architect/floorplans' },
  { icon: 'view_in_ar', label: 'Open 3D Viewer', href: '/architect/3d' },
  { icon: 'request_quote', label: 'Create BOQ', href: '/architect/boq' },
  { icon: 'inventory_2', label: 'Browse Materials', href: '/architect/materials' },
  { icon: 'inbox', label: 'View Requests', href: '/architect/requests' },
];

const UNVERIFIED_ACTIONS = [
  { icon: 'verified', label: 'Upload Credentials', href: '/architect/verification', primary: true },
  { icon: 'person', label: 'Complete Profile', href: '/architect/profile' },
  { icon: 'settings', label: 'Account Settings', href: '/architect/settings' },
  { icon: 'shield', label: 'Security & 2FA', href: '/architect/security' },
  { icon: 'help', label: 'Help & Guidelines', href: '/architect/support' },
  { icon: 'notifications', label: 'System Alerts', href: '/architect/notifications' },
];

const RESTRICTED_MAJOR_FEATURES = [
  {
    title: 'AI Design Studio & Copilot',
    desc: 'Generate architectural blueprints, realistic 3D renders, and spatial layouts with generative AI.',
    icon: 'auto_awesome',
  },
  {
    title: '2D Floor Plan & CAD Editor',
    desc: 'Vector drafting, multi-room zoning, architectural dimensioning, and SVG export tools.',
    icon: 'edit_square',
  },
  {
    title: '3D Interactive Visualizer',
    desc: 'Real-time BIM 3D walkthroughs, lighting simulations, and structural perspective rendering.',
    icon: 'view_in_ar',
  },
  {
    title: 'Project Commissioning & Management',
    desc: 'Create, budget, coordinate milestone schedules, and manage construction phases.',
    icon: 'architecture',
  },
  {
    title: 'Client Matchmaking & Contracts',
    desc: 'Receive direct client inquiries, issue architectural quotes, and sign digital contracts.',
    icon: 'handshake',
  },
  {
    title: 'Materials Estimation & BOQ Engine',
    desc: 'Automated bill of quantities, local market cost calculations, and supplier procurement.',
    icon: 'request_quote',
  },
];

const TYPE_ICON: Record<string, string> = {
  PROJECT: 'architecture', CLIENT: 'groups', DESIGN: 'design_services', MESSAGE: 'forum',
  VERIFICATION: 'verified', ORDER: 'receipt_long', PAYMENT: 'account_balance', SYSTEM: 'settings',
};

export default function ArchitectDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    fetch('/api/architect/dashboard')
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error || 'Failed to load dashboard');
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (error) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <Card className="text-center py-12 space-y-4">
          <span className="material-symbols-outlined text-[48px] text-error">error</span>
          <p className="text-body-md text-error font-medium">{error}</p>
          <div>
            <button
              onClick={() => {
                setError(null);
                setData(null);
                fetchDashboard();
              }}
              className="btn-primary px-4 py-2 rounded-lg text-label-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      </div>
    );
  }

  const s = data.stats;
  const activity = data.activity.slice(0, 8);
  const isVerified = data.profile.verificationStatus === 'VERIFIED';
  const status = data.profile.verificationStatus;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title={`Welcome, ${data.architect.name.split(' ')[0]}`}
        subtitle={isVerified ? data.profile.title : 'Architect Portal (Restricted Mode)'}
        crumbs={['Architect', 'Dashboard']}
        actions={
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-md uppercase tracking-wide border ${
                isVerified
                  ? 'bg-[#Eaf7f1] dark:bg-primary-container text-[#2F6B50] dark:text-on-primary-container border-[#C0E9D7] dark:border-primary'
                  : status === 'PENDING'
                    ? 'bg-[#FFF4E5] text-[#A66A00] border-[#F5D09D] dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-700'
                    : 'bg-error/10 text-error border-error/30'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{isVerified ? 'verified' : status === 'PENDING' ? 'hourglass_top' : 'lock'}</span>
              {status}
            </span>

            <Link
              href="/architect/verification"
              className="btn-primary text-label-md px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              <span>{isVerified ? 'Credentials' : 'Get Verified'}</span>
            </Link>
          </div>
        }
      />

      {/* RESTRICTED ONBOARDING VIEW (When architect is UNVERIFIED or PENDING) */}
      {!isVerified && (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          {status === 'PENDING' ? (
            <div className="p-5 rounded-xl bg-[#FFF4E5] dark:bg-yellow-950/25 border border-[#F5D09D] dark:border-yellow-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#A66A00] dark:text-yellow-500 text-[28px] shrink-0">hourglass_top</span>
                <div>
                  <h3 className="text-body-md font-bold text-[#A66A00] dark:text-yellow-400">Application Under Review</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5 leading-relaxed">
                    Your architecture license and credentials have been submitted and are awaiting administrator review. Core architectural tools (AI Studio, CAD 2D/3D Editor, Project Creation, and BOQ) will unlock automatically once approved.
                  </p>
                </div>
              </div>
              <Link href="/architect/verification" className="btn-primary shrink-0 px-4 py-2 text-label-md rounded-lg">
                View Submission
              </Link>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-[#FFF8F8] dark:bg-red-950/20 border border-error/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-[28px] shrink-0">lock</span>
                <div>
                  <h3 className="text-body-md font-bold text-error">Account Restricted — Administrator Verification Required</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5 leading-relaxed">
                    As an unverified user, your dashboard is limited to onboarding modules. To access the <strong>AI Design Studio</strong>, <strong>Floor Plan Editor</strong>, <strong>Project Management</strong>, and <strong>Client Sourcing</strong>, you must upload your professional credentials for admin review and approval.
                  </p>
                </div>
              </div>
              <Link href="/architect/verification" className="btn-primary shrink-0 px-4 py-2 text-label-md rounded-lg flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Submit Credentials
              </Link>
            </div>
          )}

          {/* Onboarding Steps Progress */}
          <Card>
            <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface mb-4">Architect Onboarding & Certification Steps</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-col justify-between">
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold mb-2">1</span>
                  <h4 className="text-body-sm font-bold text-on-surface dark:text-inverse-on-surface">Account Registered</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Basic architect account created and authenticated.</p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Completed
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col justify-between ${status === 'PENDING' ? 'border-[#A66A00]/40 bg-[#A66A00]/5' : 'border-error/40 bg-error/5'}`}>
                <div>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[12px] font-bold mb-2 ${status === 'PENDING' ? 'bg-[#A66A00]' : 'bg-error'}`}>2</span>
                  <h4 className="text-body-sm font-bold text-on-surface dark:text-inverse-on-surface">Upload Credentials</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Upload architecture license, degree, and ID proof.</p>
                </div>
                <div className="mt-3">
                  {status === 'PENDING' ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#A66A00]">
                      <span className="material-symbols-outlined text-[14px]">schedule</span> Submitted
                    </span>
                  ) : (
                    <Link href="/architect/verification" className="text-[11px] font-semibold text-error hover:underline flex items-center gap-1">
                      Action Required <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col justify-between ${status === 'PENDING' ? 'border-primary/40 bg-primary/5' : 'border-outline-variant dark:border-outline'}`}>
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-outline-variant text-on-surface-variant text-[12px] font-bold mb-2">3</span>
                  <h4 className="text-body-sm font-bold text-on-surface dark:text-inverse-on-surface">Admin Review</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Administrators audit your credentials and registration number.</p>
                </div>
                <div className="mt-3 text-[11px] text-on-surface-variant dark:text-surface-variant">
                  {status === 'PENDING' ? '⏳ Review in progress' : 'Awaiting submission'}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-outline-variant dark:border-outline flex flex-col justify-between opacity-60">
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-outline-variant text-on-surface-variant text-[12px] font-bold mb-2">4</span>
                  <h4 className="text-body-sm font-bold text-on-surface dark:text-inverse-on-surface">Full Platform Unlock</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Badge activated. All design tools and contracts unlocked.</p>
                </div>
                <div className="mt-3 text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lock</span> Locked
                </div>
              </div>
            </div>
          </Card>

          {/* Allowed Actions for Unverified Architect */}
          <div>
            <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface mb-3">Available Onboarding Modules</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {UNVERIFIED_ACTIONS.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl text-center border transition-all ${
                    a.primary
                      ? 'bg-primary text-white border-primary shadow-sm hover:bg-[#264B3E]'
                      : 'bg-surface-container-low dark:bg-surface-variant border-outline-variant dark:border-outline hover:border-primary text-on-surface dark:text-inverse-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px] mb-2">{a.icon}</span>
                  <span className="text-label-md font-medium leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Locked / Restricted Modules Showcase */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
                  <span>Major Architectural Capabilities</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-outline-variant/60 text-on-surface-variant">Restricted</span>
                </h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">These professional tools unlock immediately once your verification is approved by an admin.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RESTRICTED_MAJOR_FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="p-5 rounded-xl border border-dashed border-outline-variant dark:border-outline bg-surface-container-low/50 dark:bg-surface-variant/30 relative flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high dark:bg-surface-container flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-error/80 bg-error/10 px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-[13px]">lock</span>
                        Locked
                      </span>
                    </div>
                    <h4 className="text-body-md font-bold text-on-surface/80 dark:text-inverse-on-surface/80">{f.title}</h4>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 leading-relaxed">{f.desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant italic">Requires Admin Approval</span>
                    <Link href="/architect/verification" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-0.5">
                      Verify <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VERIFIED PROFESSIONAL VIEW (When architect is FULLY VERIFIED) */}
      {isVerified && (
        <>
          {/* Quick actions */}
          <Card className="mb-6" pad={false}>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-y sm:divide-y-0 divide-outline-variant dark:divide-outline">
              {VERIFIED_QUICK_ACTIONS.map((a) => (
                <Link key={a.label} href={a.href} className="flex flex-col items-center gap-1.5 p-4 text-center hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors group">
                  <span className="material-symbols-outlined text-[24px] text-primary dark:text-primary-fixed-dim group-hover:scale-110 transition-transform">{a.icon}</span>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          {/* Project stats */}
          <h3 className="text-headline-md text-on-surface dark:text-inverse-on-surface mb-3">Project Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard icon="architecture" label="Total Projects" value={String(s.projects.total)} />
            <StatCard icon="bolt" label="Active" value={String(s.projects.active)} tone="green" />
            <StatCard icon="task_alt" label="Completed" value={String(s.projects.completed)} tone="green" />
            <StatCard icon="draft" label="Drafts" value={String(s.projects.drafts)} />
            <StatCard icon="approval" label="Awaiting Client" value={String(s.projects.awaitingClient)} tone="blue" />
            <StatCard icon="sync" label="Needs Revision" value={String(s.projects.needsRevision)} tone="amber" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: clients + designs + financial */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Clients</h4>
                    <Link href="/architect/clients" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">View All</Link>
                  </div>
                  <div className="flex items-end gap-6">
                    <div>
                      <p className="text-display text-primary dark:text-primary-fixed-dim">{s.clients.total}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Total clients</p>
                    </div>
                    <div>
                      <p className="text-headline-md text-[#A66A00] dark:text-yellow-400">{s.clients.pendingRequests}</p>
                      <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Pending requests</p>
                    </div>
                  </div>
                </Card>
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Designs</h4>
                    <Link href="/architect/designs" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Library</Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-label-md">
                    <span className="text-on-surface-variant dark:text-surface-variant">Total</span><span className="text-right font-semibold text-on-surface dark:text-inverse-on-surface">{s.designs.total}</span>
                    <span className="text-on-surface-variant dark:text-surface-variant">AI generated</span><span className="text-right font-semibold text-on-surface dark:text-inverse-on-surface">{s.designs.aiGenerated}</span>
                    <span className="text-on-surface-variant dark:text-surface-variant">Under review</span><span className="text-right font-semibold text-on-surface dark:text-inverse-on-surface">{s.designs.underReview}</span>
                    <span className="text-on-surface-variant dark:text-surface-variant">Approved</span><span className="text-right font-semibold text-on-surface dark:text-inverse-on-surface">{s.designs.approved}</span>
                  </div>
                </Card>
              </div>

              {/* Financial */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Financial Overview</h4>
                  <Link href="/architect/earnings" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Earnings</Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">Subscription</p>
                    <StatusPill status={s.financial.subscription} tone={s.financial.subscriptionStatus === 'ACTIVE' ? 'green' : 'gray'} />
                    {s.financial.expiresInDays != null && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">Renews in {s.financial.expiresInDays} days</p>}
                  </div>
                  <div>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">Total Earnings</p>
                    <p className="text-headline-sm text-primary dark:text-primary-fixed-dim font-semibold">{fmt(s.financial.totalEarnings)} {data.currency}</p>
                  </div>
                  <div>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">Pending</p>
                    <p className="text-headline-sm text-[#A66A00] dark:text-yellow-400 font-semibold">{fmt(s.financial.pendingEarnings)} {data.currency}</p>
                  </div>
                  <div>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-1">Recent</p>
                    <p className="text-body-sm text-on-surface dark:text-inverse-on-surface">{s.financial.recentTransactions[0]?.description ?? '—'}</p>
                  </div>
                </div>
              </Card>

              {/* Activity feed */}
              <Card>
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-4">Activity Feed</h4>
                {activity.length === 0 ? (
                  <EmptyState icon="history" title="No activity yet" body="Your recent activity will appear here." />
                ) : (
                  <div className="space-y-3">
                    {activity.map((a) => (
                      <div key={a.id} className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-[20px] text-primary dark:text-primary-fixed-dim mt-0.5">{TYPE_ICON[a.type] ?? 'bolt'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{a.title}</p>
                          {a.body && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant truncate">{a.body}</p>}
                        </div>
                        <span className="text-label-md text-on-surface-variant dark:text-surface-variant shrink-0">{timeAgo(a.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Right: verification + appointments */}
            <div className="space-y-6">
              <Card className="bg-[#Eaf7f1] dark:bg-primary-container/20 border-[#C0E9D7] dark:border-primary">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[#2F6B50] dark:text-primary text-[24px]">verified</span>
                  <div>
                    <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-1">Certified Architect</h4>
                    <StatusPill status="VERIFIED" tone="green" />
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-2">
                      Your credentials are authenticated. All architectural modules and client matchmaking are active.
                    </p>
                    <Link href="/architect/verification" className="text-sm font-semibold text-[#2F6B50] dark:text-primary hover:underline flex items-center gap-1 mt-3">
                      View credentials <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">Upcoming Appointments</h4>
                  <Link href="/architect/appointments" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Calendar</Link>
                </div>
                {data.upcomingAppointments.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No upcoming appointments.</p>
                ) : (
                  <div className="space-y-2">
                    {data.upcomingAppointments.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-variant">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-low dark:bg-surface-variant flex flex-col items-center justify-center text-primary dark:text-primary-fixed-dim shrink-0">
                          <span className="text-[10px] uppercase">{monthOf(a.date)}</span>
                          <span className="text-body-md font-bold leading-none">{dayOf(a.date)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">{a.title}</p>
                          <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{a.startTime} · {a.clientName ?? '—'}</p>
                        </div>
                        <StatusPill status={a.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3">Notifications</h4>
                <div className="flex items-center gap-4">
                  <Link href="/architect/messages" className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">forum</span>
                    <span className="text-label-md text-on-surface dark:text-inverse-on-surface">Messages</span>
                    {s.unreadMessages > 0 && <span className="ml-auto bg-primary text-white text-[11px] px-2 py-0.5 rounded-full">{s.unreadMessages}</span>}
                  </Link>
                  <Link href="/architect/notifications" className="flex-1 flex items-center gap-2 p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant hover:bg-surface-container dark:hover:bg-surface-container-high transition-colors">
                    <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">notifications</span>
                    <span className="text-label-md text-on-surface dark:text-inverse-on-surface">Alerts</span>
                    {s.unreadNotifications > 0 && <span className="ml-auto bg-primary text-white text-[11px] px-2 py-0.5 rounded-full">{s.unreadNotifications}</span>}
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function monthOf(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleString('en', { month: 'short' });
}
function dayOf(date: string): number {
  return new Date(date + 'T00:00:00').getDate();
}
