'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { signoutAction } from '@/Backend/actions/auth';

type Role = 'CLIENT' | 'ARCHITECT' | 'VENDOR' | 'ADMIN';

type ActionItem = {
  label: string;
  icon: string;
  href: string;
};

const ROLE_ACTIONS: Record<Role, ActionItem[]> = {
  CLIENT: [
    { label: 'Request Design', icon: 'post_add', href: '/client/requests' },
    { label: 'Create Project', icon: 'add_home', href: '/client/projects' },
    { label: 'Message Architect', icon: 'forum', href: '/client/messages' },
    { label: 'Schedule Appointment', icon: 'calendar_add_on', href: '/client/appointments' },
    { label: 'Review Design', icon: 'fact_check', href: '/client/revisions' },
    { label: 'View 3D Floorplan', icon: 'view_in_ar', href: '/client/3d' },
    { label: 'Provide 3D Feedback', icon: 'rate_review', href: '/client/3d' },
    { label: 'View BOQ', icon: 'request_quote', href: '/client/boq' },
    { label: 'Browse Marketplace', icon: 'storefront', href: '/client/marketplace' },
    { label: 'Shopping Cart', icon: 'shopping_cart', href: '/client/cart' },
    { label: 'View Orders', icon: 'receipt_long', href: '/client/orders' },
    { label: 'Make Payment', icon: 'payments', href: '/client/payments' },
    { label: 'Upload Document', icon: 'upload_file', href: '/client/documents' },
  ],
  ARCHITECT: [
    { label: 'Create Project', icon: 'add_home_work', href: '/architect/projects' },
    { label: 'AI Copilot', icon: 'auto_awesome', href: '/architect/gemini' },
    { label: 'Generate AI Design', icon: 'auto_awesome', href: '/architect/studio' },
    { label: 'Open 2D Editor', icon: 'edit_square', href: '/architect/floorplans' },
    { label: 'Open 3D Viewer', icon: 'view_in_ar', href: '/architect/3d' },
    { label: 'Create BOQ', icon: 'request_quote', href: '/architect/boq' },
    { label: 'Message Client', icon: 'forum', href: '/architect/messages' },
    { label: 'Schedule Appointment', icon: 'calendar_month', href: '/architect/appointments' },
    { label: 'Browse Materials', icon: 'inventory_2', href: '/architect/materials' },
    { label: 'View Requests', icon: 'inbox', href: '/architect/requests' },
  ],
  VENDOR: [
    { label: 'Add Product', icon: 'add_circle', href: '/vendor/products' },
    { label: 'Manage Inventory', icon: 'warehouse', href: '/vendor/inventory' },
    { label: 'View Orders', icon: 'receipt_long', href: '/vendor/orders' },
    { label: 'Returns & Refunds', icon: 'assignment_return', href: '/vendor/returns' },
    { label: 'Earnings Report', icon: 'account_balance', href: '/vendor/earnings' },
    { label: 'Customer Inquiries', icon: 'forum', href: '/vendor/messages' },
    { label: 'Store Settings', icon: 'storefront', href: '/vendor/settings' },
  ],
  ADMIN: [
    { label: 'Review Verifications', icon: 'fact_check', href: '/admin/verification' },
    { label: 'Manage Users', icon: 'group', href: '/admin/users' },
    { label: 'Review Disputes', icon: 'gavel', href: '/admin/disputes' },
    { label: 'Support Tickets', icon: 'support_agent', href: '/admin/support' },
    { label: 'Platform Analytics', icon: 'insights', href: '/admin/analytics' },
    { label: 'Moderate Reports', icon: 'flag', href: '/admin/reports' },
    { label: 'Security Center', icon: 'shield', href: '/admin/security' },
    { label: 'Publish Content', icon: 'article', href: '/admin/content' },
  ],
};

const PROFILE_MENUS: Record<Role, ActionItem[]> = {
  CLIENT: [
    { label: 'Profile', icon: 'person', href: '/client/profile' },
    { label: 'My Architect', icon: 'engineering', href: '/client/architect' },
    { label: 'Settings', icon: 'settings', href: '/client/settings' },
    { label: 'Security', icon: 'shield', href: '/client/security' },
    { label: 'Help & Support', icon: 'help', href: '/client/support' },
  ],
  ARCHITECT: [
    { label: 'Profile', icon: 'person', href: '/architect/profile' },
    { label: 'Verification & Credentials', icon: 'verified', href: '/architect/verification' },
    { label: 'Settings', icon: 'settings', href: '/architect/settings' },
    { label: 'Security', icon: 'shield', href: '/architect/security' },
    { label: 'Help & Support', icon: 'help', href: '/architect/support' },
  ],
  VENDOR: [
    { label: 'Profile', icon: 'person', href: '/profile?as=vendor' },
    { label: 'Store Settings', icon: 'storefront', href: '/vendor/settings' },
    { label: 'Verification', icon: 'verified', href: '/verification?as=vendor' },
    { label: 'Marketing', icon: 'campaign', href: '/vendor/marketing' },
    { label: 'Help & Support', icon: 'help', href: '/support' },
  ],
  ADMIN: [
    { label: 'Admin Profile', icon: 'person', href: '/admin/profile' },
    { label: 'Platform Settings', icon: 'settings', href: '/admin/settings' },
    { label: 'Access Control', icon: 'admin_panel_settings', href: '/admin/access' },
    { label: 'System Health', icon: 'monitor_heart', href: '/admin/system' },
    { label: 'Help & Support', icon: 'help', href: '/admin/support' },
  ],
};

function deriveRoleFromPath(pathname: string): Role {
  if (pathname.startsWith('/architect')) return 'ARCHITECT';
  if (pathname.startsWith('/vendor')) return 'VENDOR';
  if (pathname.startsWith('/admin')) return 'ADMIN';
  return 'CLIENT';
}

function getHomeHref(role: Role): string {
  switch (role) {
    case 'ARCHITECT':
      return '/architect';
    case 'VENDOR':
      return '/vendor';
    case 'ADMIN':
      return '/admin';
    default:
      return '/client';
  }
}

function getNotificationsHref(role: Role): string {
  switch (role) {
    case 'ARCHITECT':
      return '/architect/notifications';
    case 'CLIENT':
      return '/client/notifications';
    case 'ADMIN':
      return '/admin/notifications';
    case 'VENDOR':
      return '/vendor/notifications';
    default:
      return '/notifications';
  }
}

function getMessagesHref(role: Role): string {
  switch (role) {
    case 'ARCHITECT':
      return '/architect/messages';
    case 'CLIENT':
      return '/client/messages';
    case 'VENDOR':
      return '/vendor/messages';
    default:
      return '/chat';
  }
}

export function DashboardHeader({ initialRole }: { initialRole?: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const derived = deriveRoleFromPath(pathname);
  const role = derived !== 'CLIENT' ? derived : (pathname.startsWith('/client') ? 'CLIENT' : (initialRole ?? 'CLIENT'));
  const homeHref = getHomeHref(role);
  const notificationsHref = getNotificationsHref(role);
  const messagesHref = getMessagesHref(role);

  const [query, setQuery] = useState('');
  const [openMenu, setOpenMenu] = useState<'actions' | 'profile' | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [next3dLink, setNext3dLink] = useState<string | null>(null);
  const [initials, setInitials] = useState(() => (role === 'ARCHITECT' ? 'EV' : role === 'VENDOR' ? 'MH' : role === 'ADMIN' ? 'BA' : 'JE'));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [dark, setDark] = useState(false);
  const [, startTransition] = useTransition();

  const menuRef = useRef<HTMLDivElement>(null);

  // Sync initials and title whenever route / role changes
  useEffect(() => {
    setInitials(role === 'ARCHITECT' ? 'EV' : role === 'VENDOR' ? 'MH' : role === 'ADMIN' ? 'BA' : 'JE');
  }, [role]);

  // Sync theme state with <html> and localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    window.dispatchEvent(new Event('buildsmart:theme-changed'));
  };

  // Fetch header status, notifications, messages, and cart count
  const fetchStatus = () => {
    fetch(`/api/dashboard/header?role=${role}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: any) => {
        if (typeof d.unreadNotifications === 'number') {
          setUnread(d.unreadNotifications);
        }
        if (typeof d.unreadMessages === 'number') {
          setUnreadMessages(d.unreadMessages);
        }
        if (typeof d.cartCount === 'number') {
          setCartCount(d.cartCount);
        }
        if (d.next3dLink !== undefined) {
          setNext3dLink(d.next3dLink ?? null);
        }
        if (d.user?.initials) {
          setInitials(d.user.initials);
        }
        if (d.user?.name) {
          setUserName(d.user.name);
        }
        if (d.user?.avatarUrl !== undefined) {
          setAvatarUrl(d.user.avatarUrl);
        }
      })
      .catch(() => {});
  };

  // Fetch on mount, path change, and poll every 4 seconds for real-time notification arrivals
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);

    const onNotificationUpdate = () => fetchStatus();
    const onAvatarUpdated = (e: any) => {
      setAvatarUrl(e.detail?.avatarUrl ?? null);
    };
    const onCartUpdated = (e: any) => {
      if (typeof e?.detail?.cartCount === 'number') {
        setCartCount(e.detail.cartCount);
      } else {
        fetchStatus();
      }
    };

    window.addEventListener('buildsmart:notifications-updated', onNotificationUpdate);
    window.addEventListener('buildsmart:avatar-updated', onAvatarUpdated);
    window.addEventListener('buildsmart:cart-updated', onCartUpdated);
    window.addEventListener('focus', onNotificationUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('buildsmart:notifications-updated', onNotificationUpdate);
      window.removeEventListener('buildsmart:avatar-updated', onAvatarUpdated);
      window.removeEventListener('buildsmart:cart-updated', onCartUpdated);
      window.removeEventListener('focus', onNotificationUpdate);
    };
  }, [pathname, role]);

  // Click outside to close dropdowns
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setOpenMenu(null);
    if (!query.trim()) return;
    if (role === 'CLIENT') {
      router.push(`/client/search?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  // Format breadcrumb text
  const segments = pathname.split('/').filter(Boolean);
  const rawCrumb = segments.length <= 1 ? 'Dashboard' : segments[segments.length - 1];
  const crumb = rawCrumb.replace(/[-_]/g, ' ');

  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase();
  const quickActions = ROLE_ACTIONS[role] ?? ROLE_ACTIONS.CLIENT;
  const profileMenu = PROFILE_MENUS[role] ?? PROFILE_MENUS.CLIENT;

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#FAFAF8] dark:bg-[#17201e] border-b border-outline-variant dark:border-outline flex items-center gap-2 md:gap-4 px-margin-mobile md:px-margin-desktop">
      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-2 text-label-md text-on-surface-variant dark:text-surface-variant min-w-0">
        <Link
          href={homeHref}
          className="font-medium hover:text-primary dark:hover:text-primary-fixed-dim transition-colors"
        >
          {roleLabel}
        </Link>
        <span className="material-symbols-outlined text-[16px] select-none text-on-surface-variant/70 dark:text-surface-variant/70">
          chevron_right
        </span>
        <span className="text-on-surface dark:text-inverse-on-surface capitalize truncate font-semibold">
          {crumb}
        </span>
      </div>

      {/* Global search */}
      <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant text-[20px] pointer-events-none">
          search
        </span>
        <input
          className="pl-10 pr-4 py-2 w-full bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none text-on-surface dark:text-on-surface placeholder:text-on-surface-variant/60 dark:placeholder:text-surface-variant/60 transition-all"
          placeholder="Search projects, designs, 3D plans, orders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {/* Action group */}
      <div className="ml-auto flex items-center gap-1 md:gap-2" ref={menuRef}>
        {/* Quick actions (bolt) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'actions' ? null : 'actions')}
            aria-label="Quick actions"
            title="Quick actions"
            aria-expanded={openMenu === 'actions'}
            className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors text-on-surface dark:text-inverse-on-surface flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]">bolt</span>
          </button>
          {openMenu === 'actions' && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-xl shadow-lg z-50 py-2 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/80 dark:text-surface-variant/80 border-b border-outline-variant/60 dark:border-outline/60 mb-1">
                {roleLabel} Shortcuts
              </div>
              {next3dLink && (
                <Link
                  href={next3dLink}
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-sm font-semibold text-primary dark:text-primary-fixed-dim hover:bg-secondary-container dark:hover:bg-primary-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">new_releases</span>
                  View New 3D Floorplan
                </Link>
              )}
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center gap-3 px-4 py-2 text-body-sm text-on-surface dark:text-inverse-on-surface hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-surface-variant">
                    {a.icon}
                  </span>
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Light / Dark theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors text-on-surface dark:text-inverse-on-surface flex items-center justify-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-[22px] transition-transform duration-200">
            {dark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Shopping Cart with real-time badge count */}
        <Link
          href="/client/cart"
          className="relative p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors text-on-surface dark:text-inverse-on-surface flex items-center justify-center cursor-pointer group"
          aria-label={cartCount > 0 ? `Shopping Cart (${cartCount} items)` : 'Shopping Cart'}
          title={cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in cart` : 'Shopping Cart'}
        >
          <span className="material-symbols-outlined text-[22px] group-hover:scale-105 transition-transform">
            shopping_cart
          </span>
          {cartCount > 0 && (
            <span
              className="absolute top-0.5 right-0.5 bg-amber-600 dark:bg-amber-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold shadow-sm transition-all duration-200"
              aria-hidden="true"
            >
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </Link>

        {/* Notifications with real-time badge count */}
        <Link
          href={notificationsHref}
          className="relative p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors text-on-surface dark:text-inverse-on-surface flex items-center justify-center"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
          title={unread > 0 ? `${unread} unread notification${unread > 1 ? 's' : ''}` : 'Notifications'}
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          {unread > 0 && (
            <span
              className="absolute top-0.5 right-0.5 bg-error text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold animate-pulse shadow-sm"
              aria-hidden="true"
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        {/* Messages */}
        <Link
          href={messagesHref}
          className="relative p-2 hover:bg-surface-container-high dark:hover:bg-surface-variant rounded-full transition-colors text-on-surface dark:text-inverse-on-surface flex items-center justify-center"
          aria-label="Messages"
          title="Messages"
        >
          <span className="material-symbols-outlined text-[22px]">forum</span>
          {unreadMessages > 0 && (
            <span
              className="absolute top-0.5 right-0.5 bg-primary text-white text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-bold"
              aria-hidden="true"
            >
              {unreadMessages > 99 ? '99+' : unreadMessages}
            </span>
          )}
        </Link>

        {/* Profile menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}
            aria-label="User profile menu"
            title={userName ? `${userName} (${roleLabel})` : `${roleLabel} profile`}
            aria-expanded={openMenu === 'profile'}
            className="w-8 h-8 ml-1 rounded-full bg-primary-container hover:bg-[#264B3E] text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            {initials}
          </button>
          {openMenu === 'profile' && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-xl shadow-lg z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-outline-variant/60 dark:border-outline/60 mb-1">
                <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                  {userName || `${roleLabel} User`}
                </p>
                <p className="text-label-sm text-on-surface-variant dark:text-surface-variant">
                  {roleLabel} Workspace
                </p>
              </div>
              {profileMenu.map((m) => (
                <Link
                  key={m.label}
                  href={m.href}
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center gap-3 px-4 py-2 text-body-sm text-on-surface dark:text-inverse-on-surface hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant dark:text-surface-variant">
                    {m.icon}
                  </span>
                  {m.label}
                </Link>
              ))}
              <div className="border-t border-outline-variant/60 dark:border-outline/60 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    startTransition(() => {
                      void signoutAction();
                    });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-body-sm text-error hover:bg-error/10 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
