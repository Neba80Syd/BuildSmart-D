'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signoutAction } from '@/Backend/actions/auth';

type NavItem = {
  label: string;
  icon: string;
  href: string;
  badge?: string;
  dot?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const SHARED: NavItem[] = [
  { label: 'Search', icon: 'search', href: '/search' },
  { label: 'Discover Architects', icon: 'groups', href: '/architects' },
  { label: 'Journal', icon: 'article', href: '/journal' },
  { label: 'Help Center', icon: 'help', href: '/support' },
];

const NAV: Record<string, NavItem[]> = {
  CLIENT: [
    { label: 'Dashboard', icon: 'dashboard', href: '/client' },
    { label: 'Design Studio', icon: 'architecture', href: '/ai-design' },
    { label: '3D Visualizer', icon: 'view_in_ar', href: '/viewer' },
    { label: 'Material Estimation', icon: 'request_quote', href: '/estimation' },
    { label: 'Source Materials', icon: 'sync_alt', href: '/sourcing' },
    { label: 'Marketplace', icon: 'storefront', href: '/client/marketplace' },
    { label: 'Projects', icon: 'folder_open', href: '/client/projects' },
    { label: 'Notifications', icon: 'notifications', href: '/client/notifications' },
    { label: 'Profile', icon: 'person', href: '/client/profile' },
    { label: 'Subscription', icon: 'workspace_premium', href: '/subscription' },
    ...SHARED,
  ],
  ARCHITECT: [
    { label: 'Dashboard', icon: 'dashboard', href: '/architect' },
    { label: 'Projects', icon: 'architecture', href: '/architect/projects' },
    { label: 'Design Requests', icon: 'inbox', href: '/architect/requests' },
    { label: 'Clients', icon: 'groups', href: '/architect/clients' },
    { label: 'Design Library', icon: 'collections_bookmark', href: '/architect/designs' },
    { label: 'Roomagen Studio', icon: 'palette', href: '/architect/floor-plan-studio' },
    { label: 'Roomagen Dev Console', icon: 'terminal', href: '/architect/roomagen-developer' },
    { label: 'AI Design Studio', icon: 'auto_awesome', href: '/architect/studio' },
    { label: '2D Floor Plan Editor', icon: 'edit_square', href: '/architect/floorplans' },
    { label: '3D Visualization', icon: 'view_in_ar', href: '/architect/3d' },
    { label: 'Materials & BOQ', icon: 'request_quote', href: '/architect/boq' },
    { label: 'Messages', icon: 'forum', href: '/architect/messages' },
    { label: 'Appointments', icon: 'calendar_month', href: '/architect/appointments' },
    { label: 'Notifications', icon: 'notifications', href: '/architect/notifications' },
    { label: 'Browse Materials', icon: 'inventory_2', href: '/architect/materials' },
    { label: 'Vendors', icon: 'storefront', href: '/architect/vendors' },
    { label: 'Orders', icon: 'receipt_long', href: '/architect/orders' },
    { label: 'Profile', icon: 'person', href: '/architect/profile' },
    { label: 'Verification & Credentials', icon: 'verified', href: '/architect/verification' },
    { label: 'Documents', icon: 'folder', href: '/architect/documents' },
    { label: 'Reviews & Ratings', icon: 'reviews', href: '/architect/reviews' },
    { label: 'Subscription & Billing', icon: 'workspace_premium', href: '/architect/billing' },
    { label: 'Wallet & Escrow', icon: 'account_balance_wallet', href: '/architect/wallet' },
    { label: 'Design Escrows', icon: 'lock_clock', href: '/architect/wallet/escrows' },
    { label: 'Wallet Transactions', icon: 'receipt_long', href: '/architect/wallet/transactions' },
    { label: 'Earnings & Transactions', icon: 'account_balance', href: '/architect/earnings' },
    { label: 'Reports & Analytics', icon: 'monitoring', href: '/architect/analytics' },
    { label: 'Settings', icon: 'settings', href: '/architect/settings' },
    { label: 'Security', icon: 'shield', href: '/architect/security' },
    { label: 'Help & Support', icon: 'help', href: '/architect/support' },
  ],
  VENDOR: [
    { label: 'Dashboard', icon: 'dashboard', href: '/vendor' },
    { label: 'Products', icon: 'inventory_2', href: '/vendor/products' },
    { label: 'Inventory', icon: 'warehouse', href: '/vendor/inventory' },
    { label: 'Orders', icon: 'receipt_long', href: '/vendor/orders' },
    { label: 'Returns & Refunds', icon: 'assignment_return', href: '/vendor/returns' },
    { label: 'Earnings', icon: 'account_balance', href: '/vendor/earnings' },
    { label: 'Marketing', icon: 'campaign', href: '/vendor/marketing' },
    { label: 'Messages', icon: 'forum', href: '/vendor/messages' },
    { label: 'Reviews', icon: 'reviews', href: '/vendor/reviews' },
    { label: 'Store Settings', icon: 'storefront', href: '/vendor/settings' },
    { label: 'Verification', icon: 'verified', href: '/vendor/verification' },
    { label: 'Notifications', icon: 'notifications', href: '/vendor/notifications' },
  ],
  ADMIN: [
    { label: 'Overview', icon: 'dashboard', href: '/admin' },
    { label: 'Users', icon: 'group', href: '/profile?as=admin' },
    { label: 'Verification Queue', icon: 'fact_check', href: '/verification', badge: '8' },
    { label: 'Projects', icon: 'architecture', href: '/projects' },
    { label: 'Marketplace', icon: 'storefront', href: '/marketplace-portal' },
    { label: 'Analytics', icon: 'monitoring', href: '/analytics?as=admin' },
    { label: 'Content (Blog)', icon: 'article', href: '/journal' },
    { label: 'Support Tickets', icon: 'support_agent', href: '/support?as=admin' },
    { label: 'Documents', icon: 'folder', href: '/documents' },
    { label: 'Search', icon: 'search', href: '/search' },
    { label: 'Notifications', icon: 'notifications', href: '/admin/notifications' },
    { label: 'Profile', icon: 'person', href: '/profile?as=admin' },
  ],
};

// Grouped navigation for the ARCHITECT dashboard (role-filtered, collapsed groups).
const ARCHITECT_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'dashboard', href: '/architect' }] },
  {
    label: 'Workspace',
    items: [
      { label: 'Projects', icon: 'architecture', href: '/architect/projects' },
      { label: 'Design Requests', icon: 'inbox', href: '/architect/requests' },
      { label: 'Clients', icon: 'groups', href: '/architect/clients' },
      { label: 'Design Library', icon: 'collections_bookmark', href: '/architect/designs' },
    ],
  },
  {
    label: 'Design Studio',
    items: [
      { label: 'AI Copilot', icon: 'auto_awesome', href: '/architect/gemini' },
      { label: 'Roomagen Studio', icon: 'palette', href: '/architect/floor-plan-studio', badge: 'AI' },
      { label: 'Roomagen Dev Console', icon: 'terminal', href: '/architect/roomagen-developer', badge: 'API' },
      { label: 'AI Design Studio', icon: 'auto_awesome', href: '/architect/studio' },
      { label: '2D Floor Plan Editor', icon: 'edit_square', href: '/architect/floorplans' },
      { label: '3D Visualization', icon: 'view_in_ar', href: '/architect/3d' },
      { label: 'Material Estimation & BOQ', icon: 'request_quote', href: '/architect/boq' },
    ],
  },
  {
    label: 'Collaboration',
    items: [
      { label: 'Messages', icon: 'forum', href: '/architect/messages' },
      { label: 'Appointments', icon: 'calendar_month', href: '/architect/appointments' },
      { label: 'Notifications', icon: 'notifications', href: '/architect/notifications' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { label: 'Browse Materials', icon: 'inventory_2', href: '/architect/materials' },
      { label: 'Vendors', icon: 'storefront', href: '/architect/vendors' },
      { label: 'Orders', icon: 'receipt_long', href: '/architect/orders' },
    ],
  },
  {
    label: 'Professional',
    items: [
      { label: 'Profile', icon: 'person', href: '/architect/profile' },
      { label: 'Verification & Credentials', icon: 'verified', href: '/architect/verification' },
      { label: 'Documents', icon: 'folder', href: '/architect/documents' },
      { label: 'Reviews & Ratings', icon: 'reviews', href: '/architect/reviews' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Wallet & Escrow', icon: 'account_balance_wallet', href: '/architect/wallet' },
      { label: 'Design Escrows', icon: 'lock_clock', href: '/architect/wallet/escrows' },
      { label: 'Transactions', icon: 'receipt_long', href: '/architect/wallet/transactions' },
      { label: 'Subscription & Billing', icon: 'workspace_premium', href: '/architect/billing' },
      { label: 'Earnings & Transactions', icon: 'account_balance', href: '/architect/earnings' },
    ],
  },
  { label: 'Analytics', items: [{ label: 'Reports & Analytics', icon: 'monitoring', href: '/architect/analytics' }] },
  {
    label: 'System',
    items: [
      { label: 'Settings', icon: 'settings', href: '/architect/settings' },
      { label: 'Security', icon: 'shield', href: '/architect/security' },
      { label: 'Help & Support', icon: 'help', href: '/architect/support' },
    ],
  },
];

// Grouped navigation for the CLIENT dashboard (role-filtered, collapsed groups).
const CLIENT_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'dashboard', href: '/client' }] },
  {
    label: 'My Projects',
    items: [
      { label: 'Projects', icon: 'architecture', href: '/client/projects' },
      { label: 'Design Requests', icon: 'inbox', href: '/client/requests' },
      { label: 'My Designs', icon: 'collections_bookmark', href: '/client/designs' },
      { label: 'Favorites', icon: 'favorite', href: '/client/favorites' },
    ],
  },
  {
    label: 'Design Review',
    items: [
      { label: '2D Floor Plans', icon: 'edit_square', href: '/client/floorplans' },
      { label: '3D Visualization', icon: 'view_in_ar', href: '/client/3d' },
      { label: 'Revisions & Approvals', icon: 'fact_check', href: '/client/revisions' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Messages', icon: 'forum', href: '/client/messages' },
      { label: 'Appointments', icon: 'calendar_month', href: '/client/appointments' },
      { label: 'Notifications', icon: 'notifications', href: '/client/notifications' },
    ],
  },
  {
    label: 'Materials',
    items: [
      { label: 'Estimates & BOQs', icon: 'request_quote', href: '/client/boq' },
      { label: 'Marketplace', icon: 'storefront', href: '/client/marketplace' },
      { label: 'Shopping Cart', icon: 'shopping_cart', href: '/client/cart' },
      { label: 'Orders', icon: 'receipt_long', href: '/client/orders' },
    ],
  },
  {
    label: 'Architect',
    items: [
      { label: 'My Architect', icon: 'engineering', href: '/client/architect' },
      { label: 'Architect Profile', icon: 'groups', href: '/client/architects' },
    ],
  },
  {
    label: 'Payments',
    items: [
      { label: 'Payments', icon: 'payments', href: '/client/payments' },
      { label: 'Invoices', icon: 'description', href: '/client/invoices' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Documents', icon: 'folder', href: '/client/documents' },
      { label: 'Profile', icon: 'person', href: '/client/profile' },
      { label: 'Settings', icon: 'settings', href: '/client/settings' },
      { label: 'Security', icon: 'shield', href: '/client/security' },
      { label: 'Help & Support', icon: 'help', href: '/client/support' },
    ],
  },
];

// Grouped navigation for the ADMIN dashboard (governance & platform management).
const ADMIN_GROUPS: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Dashboard', icon: 'dashboard', href: '/admin' }] },
  {
    label: 'User Management',
    items: [
      { label: 'Users', icon: 'group', href: '/admin/users' },
      { label: 'Verification Center', icon: 'fact_check', href: '/admin/verification' },
    ],
  },
  {
    label: 'Projects',
    items: [
      { label: 'Projects', icon: 'architecture', href: '/admin/projects' },
      { label: 'Design Requests', icon: 'inbox', href: '/admin/requests' },
      { label: 'Disputes', icon: 'gavel', href: '/admin/disputes' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { label: 'Products', icon: 'inventory_2', href: '/admin/products' },
      { label: 'Vendors', icon: 'storefront', href: '/admin/vendors' },
      { label: 'Orders', icon: 'receipt_long', href: '/admin/orders' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Escrow Management', icon: 'lock_clock', href: '/admin/escrow' },
      { label: 'Transactions', icon: 'account_balance', href: '/admin/payments' },
      { label: 'Invoices', icon: 'description', href: '/admin/invoices' },
      { label: 'Financial Reports', icon: 'monitoring', href: '/admin/finance' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { label: 'Notifications', icon: 'notifications', href: '/admin/notifications' },
      { label: 'Support', icon: 'support_agent', href: '/admin/support' },
      { label: 'Reports', icon: 'flag', href: '/admin/reports' },
    ],
  },
  { label: 'Analytics', items: [{ label: 'Analytics', icon: 'insights', href: '/admin/analytics' }] },
  {
    label: 'Content',
    items: [
      { label: 'Blog', icon: 'article', href: '/admin/content?tab=blog' },
      { label: 'FAQs', icon: 'quiz', href: '/admin/content?tab=faqs' },
      { label: 'Announcements', icon: 'campaign', href: '/admin/content?tab=announcements' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'System Health', icon: 'monitor_heart', href: '/admin/system' },
      { label: 'Activity Logs', icon: 'history', href: '/admin/activity' },
      { label: 'Audit Logs', icon: 'receipt', href: '/admin/audit' },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Security Center', icon: 'shield', href: '/admin/security' },
      { label: 'Access Control', icon: 'admin_panel_settings', href: '/admin/access' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Platform Settings', icon: 'settings', href: '/admin/settings' },
      { label: 'Subscriptions', icon: 'workspace_premium', href: '/admin/subscriptions' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Profile', icon: 'person', href: '/admin/profile' },
      { label: 'Account Security', icon: 'lock', href: '/admin/account' },
    ],
  },
];

const CTA: Record<string, { label: string; href: string }> = {
  CLIENT: { label: 'Request Design', href: '/client/requests' },
  ARCHITECT: { label: 'Create Project', href: '/architect/projects' },
  VENDOR: { label: 'Add Product', href: '/vendor/products' },
  ADMIN: { label: 'Review Queue', href: '/admin/verification' },
};

function deriveRole(pathname: string): string {
  if (pathname.startsWith('/architect')) return 'ARCHITECT';
  if (pathname.startsWith('/vendor')) return 'VENDOR';
  if (pathname.startsWith('/admin')) return 'ADMIN';
  return 'CLIENT';
}

const ARCHITECT_LOCKED_LABELS = new Set([
  'Projects',
  'Design Requests',
  'Clients',
  'Design Library',
  'AI Copilot',
  'AI Design Studio',
  '2D Floor Plan Editor',
  '3D Visualization',
  'Material Estimation & BOQ',
  'Browse Materials',
  'Vendors',
  'Orders',
  'Subscription & Billing',
  'Earnings & Transactions',
  'Reports & Analytics',
]);

const VENDOR_LOCKED_LABELS = new Set([
  'Products',
  'Inventory',
  'Orders',
  'Returns & Refunds',
  'Earnings',
  'Marketing',
]);

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [unread, setUnread] = useState(0);
  const [new3d, setNew3d] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<string>('VERIFIED');

  const derived = deriveRole(pathname);
  const activeRole = derived !== 'CLIENT' ? derived : (role ?? 'CLIENT');
  const isClientConsole = activeRole === 'CLIENT';

  // Fetch verification status & unread counts
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard/header?role=${activeRole}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        if (cancelled) return;
        if (d.user?.verificationStatus) {
          setVerificationStatus(d.user.verificationStatus);
        }
      })
      .catch(() => {});

    if (isClientConsole) {
      fetch('/api/client/header')
        .then((r) => (r.ok ? r.json() : {}))
        .then((d: any) => {
          if (cancelled) return;
          setUnread(d.unreadNotifications ?? 0);
          setNew3d(d.new3dReady ?? 0);
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [activeRole, isClientConsole, pathname]);

  const isArchitectVerified = activeRole !== 'ARCHITECT' || verificationStatus === 'VERIFIED';
  const isVendorVerified = activeRole !== 'VENDOR' || verificationStatus === 'FULLY_VERIFIED' || verificationStatus === 'VERIFIED';

  // Compute navigation groups with feature locks if unverified
  const rawGroups =
    activeRole === 'ADMIN'
      ? ADMIN_GROUPS
      : activeRole === 'ARCHITECT'
        ? ARCHITECT_GROUPS
        : isClientConsole
          ? CLIENT_GROUPS
          : null;

  const groups: NavGroup[] | null = rawGroups
    ? rawGroups.map((g) => ({
        ...g,
        items: g.items.map((item) => {
          if (activeRole === 'ARCHITECT' && !isArchitectVerified) {
            if (ARCHITECT_LOCKED_LABELS.has(item.label)) {
              return { ...item, isLocked: true, badge: 'Locked' };
            }
            if (item.label === 'Verification & Credentials') {
              return {
                ...item,
                badge: verificationStatus === 'PENDING' ? 'Under Review' : 'Action Required',
              };
            }
          }
          return item;
        }),
      }))
    : null;

  const vendorItems = (NAV[activeRole] ?? NAV.CLIENT).map((item) => {
    if (activeRole === 'VENDOR' && !isVendorVerified) {
      if (VENDOR_LOCKED_LABELS.has(item.label)) {
        return { ...item, isLocked: true, badge: 'Locked' };
      }
      if (item.label === 'Verification') {
        return {
          ...item,
          badge: verificationStatus === 'PENDING' ? 'Under Review' : 'Required',
        };
      }
    }
    return item;
  });

  const cta =
    activeRole === 'ARCHITECT' && !isArchitectVerified
      ? { label: 'Verify Credentials', href: '/architect/verification' }
      : activeRole === 'VENDOR' && !isVendorVerified
        ? { label: 'Verify Store', href: '/vendor/verification' }
        : CTA[activeRole] ?? CTA.CLIENT;

  const homeHref = activeRole === 'ARCHITECT' ? '/architect' : activeRole === 'VENDOR' ? '/vendor' : activeRole === 'ADMIN' ? '/admin' : '/client';

  const isActive = (href: string) => {
    if (href === '#') return false;
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const toggleGroup = (label: string) => setCollapsed((c) => ({ ...c, [label]: !c[label] }));

  const NavItemLink = ({ item }: { item: NavItem & { isLocked?: boolean } }) => {
    const active = isActive(item.href);
    const badge = item.href === '/client/notifications' && unread > 0 ? String(unread) : item.badge;
    const dot = item.href === '/client/3d' && new3d > 0 ? true : item.dot;
    const isLocked = item.isLocked;

    const targetHref = isLocked
      ? activeRole === 'ARCHITECT'
        ? '/architect/verification'
        : '/vendor/verification'
      : item.href;

    return (
      <Link
        href={targetHref}
        onClick={() => setOpen(false)}
        aria-current={active ? 'page' : undefined}
        title={isLocked ? 'Feature restricted: Verification and administrator approval required' : undefined}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
          active
            ? 'text-primary dark:text-primary-fixed-dim font-bold bg-secondary-container dark:bg-primary-container'
            : isLocked
              ? 'text-on-surface-variant/60 dark:text-surface-variant/60 hover:text-primary hover:bg-surface-container-high dark:hover:bg-surface-variant'
              : 'text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim hover:bg-surface-container-high dark:hover:bg-surface-variant'
        }`}
      >
        <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
          {isLocked ? 'lock' : item.icon}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {dot && <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] animate-pulse" title="New 3D floorplan ready for review" />}
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-full text-label-md ${
              isLocked
                ? 'bg-outline-variant/60 dark:bg-outline/50 text-on-surface-variant/80 dark:text-surface-variant text-[10px] uppercase font-semibold'
                : badge === 'Action Required' || badge === 'Required'
                  ? 'bg-error/15 text-error text-[10px] font-semibold uppercase'
                  : badge === 'Under Review'
                    ? 'bg-[#FFF4E5] text-[#A66A00] dark:bg-yellow-950/40 dark:text-yellow-400 text-[10px] font-semibold uppercase'
                    : 'bg-error/10 dark:bg-error/20 text-error dark:text-red-300'
            }`}
          >
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const navContent = (
    <>
      {groups
        ? groups.map((g) => (
            <div key={g.label} className="mb-1">
              <button
                onClick={() => toggleGroup(g.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-label-md uppercase tracking-wider text-on-surface-variant/80 dark:text-surface-variant/80 hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
                aria-expanded={!collapsed[g.label]}
              >
                <span>{g.label}</span>
                <span className="material-symbols-outlined text-[16px] transition-transform">
                  {collapsed[g.label] ? 'expand_more' : 'expand_less'}
                </span>
              </button>
              {!collapsed[g.label] && (
                <div className="space-y-0.5">
                  {g.items.map((item) => (
                    <NavItemLink key={item.label} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))
        : vendorItems.map((item) => <NavItemLink key={item.label} item={item} />)}
    </>
  );

  const body = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 mb-4 mt-2">
        <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
            architecture
          </span>
        </div>
        <div>
          <h2 className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim leading-tight">BuildSmart AI</h2>
          <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Professional Suite</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={cta.href}
        className="mb-4 mx-2 bg-primary-container text-white text-label-md px-4 py-3 rounded-lg uppercase tracking-wider hover:bg-[#264B3E] transition-colors flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        {cta.label}
      </Link>

      <nav className="flex-1 overflow-y-auto space-y-1">{navContent}</nav>

      {/* Bottom */}
      <div className="mt-auto pt-4 border-t border-outline-variant dark:border-outline space-y-1">
        <Link
          href="/support"
          className="flex items-center gap-3 px-3 py-2 text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim hover:bg-surface-container-high dark:hover:bg-surface-variant transition-colors rounded-lg"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
          Support
        </Link>
        <button
          onClick={() => void signoutAction()}
          className="w-full flex items-center gap-3 px-3 py-2 text-on-surface-variant dark:text-surface-variant hover:text-error transition-colors rounded-lg text-left"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar + drawer */}
      <div className="md:hidden">
        <header className="fixed top-0 left-0 right-0 z-40 h-16 bg-[#FAFAF8] dark:bg-[#17201e] border-b border-outline-variant dark:border-outline flex items-center justify-between px-4">
          <Link href={homeHref} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-white">
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                architecture
              </span>
            </div>
            <span className="text-headline-sm font-bold text-primary dark:text-primary-fixed-dim">BuildSmart AI</span>
          </Link>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
            className="p-2 text-on-surface dark:text-inverse-on-surface hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-lg"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="relative w-80 max-w-[85vw] h-full bg-[#FAFAF8] dark:bg-[#17201e] border-r border-outline-variant dark:border-outline flex flex-col py-md px-sm overflow-hidden">
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="self-end p-2 text-on-surface-variant dark:text-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex-1 flex flex-col overflow-hidden">{body}</div>
            </aside>
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 bg-[#FAFAF8] dark:bg-[#17201e] border-r border-outline-variant dark:border-outline flex-col py-md px-sm z-40">
        {body}
      </aside>
    </>
  );
}
