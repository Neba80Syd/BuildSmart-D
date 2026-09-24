'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SalesChart, BarChart, DonutChart, StatusPill } from '@/Frontend/components/vendor/charts';

const fmt = (n: number) => Math.round(n).toLocaleString();

type Analytics = {
  vendor: {
    businessName: string;
    verificationStatus?: string;
    verificationLevel?: string;
  };
  currency: string;
  commissionRate: number;
  metrics: {
    grossRevenue: number;
    netRevenue: number;
    commissions: number;
    orderVolume: number;
    activeOrders: number;
    customers: number;
    totalVisits: number;
  };
  salesSeries: { day: string; revenue: number }[];
  trafficSources: { source: string; visits: number }[];
  trafficSeries: { day: string; visits: number }[];
  topProducts: { productId: string; name: string; unit: string; units: number; revenue: number }[];
  stockSummary: { inStock: number; lowStock: number; outOfStock: number; backordered: number };
  lowStock: { id: string; name: string; sku: string; stock: number; status: string }[];
  demographics: { location: string; customers: number }[];
  recentOrders: { id: string; status: string; totalAmount: number; createdAt: string; customer: string; itemCount: number }[];
};

const UNVERIFIED_VENDOR_ACTIONS = [
  { icon: 'verified', label: 'Verify Business', href: '/vendor/verification', primary: true },
  { icon: 'storefront', label: 'Store Settings', href: '/vendor/settings' },
  { icon: 'notifications', label: 'Notifications', href: '/vendor/notifications' },
  { icon: 'help', label: 'Vendor Handbook', href: '/support' },
];

const RESTRICTED_VENDOR_MODULES = [
  {
    title: 'Product Catalog Publishing',
    desc: 'Publish building materials, set wholesale & retail pricing, upload certifications, and manage SKUs.',
    icon: 'inventory_2',
  },
  {
    title: 'Warehouse & Inventory Control',
    desc: 'Automate stock re-order thresholds, batch tracking, warehouse zoning, and backorder logistics.',
    icon: 'warehouse',
  },
  {
    title: 'Order Processing & Dispatch',
    desc: 'Receive direct contractor orders, issue waybills, generate shipping labels, and manage deliveries.',
    icon: 'receipt_long',
  },
  {
    title: 'Financial Settlements & Payouts',
    desc: 'Direct bank transfers, Mobile Money payouts, platform commission reconciliation, and tax invoices.',
    icon: 'account_balance',
  },
  {
    title: 'Promotions & Marketing',
    desc: 'Run featured material campaigns, set bulk discount coupons, and get sponsored catalog placement.',
    icon: 'campaign',
  },
  {
    title: 'Contractor Inquiries & Direct Sales',
    desc: 'Negotiate bulk contracts with certified architects and construction project managers.',
    icon: 'forum',
  },
];

export default function VendorDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [range, setRange] = useState<'30d' | '7d'>('30d');

  useEffect(() => {
    fetch('/api/vendor/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  if (!data) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading performance metrics…</p>
      </div>
    );
  }

  const vStatus = data.vendor.verificationStatus ?? 'DRAFT';
  const isVerified = vStatus === 'FULLY_VERIFIED' || vStatus === 'VERIFIED';
  const m = data.metrics;
  const series = range === '7d' ? data.salesSeries.slice(-7) : data.salesSeries;

  const stats = [
    { label: 'Total Sales', value: `${fmt(m.grossRevenue)} ${data.currency}`, note: 'Gross revenue (all orders)', icon: 'payments' },
    { label: 'Net Earnings', value: `${fmt(m.netRevenue)} ${data.currency}`, note: `After ${Math.round(data.commissionRate * 100)}% commission`, icon: 'savings', primary: true },
    { label: 'Commissions', value: `${fmt(m.commissions)} ${data.currency}`, note: 'Platform fees', icon: 'percent' },
    { label: 'Orders', value: fmt(m.orderVolume), note: `${m.activeOrders} awaiting fulfillment`, icon: 'receipt_long' },
    { label: 'Customers', value: fmt(m.customers), note: 'Unique buyers', icon: 'groups' },
    { label: 'Store Visits', value: fmt(m.totalVisits), note: '30-day traffic', icon: 'visibility' },
  ];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Vendor Dashboard</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
            {data.vendor.businessName} — {isVerified ? 'verified merchant console' : 'onboarding & restricted mode'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-md uppercase tracking-wide border ${
              isVerified
                ? 'bg-[#Eaf7f1] dark:bg-primary-container text-[#2F6B50] dark:text-on-primary-container border-[#C0E9D7] dark:border-primary'
                : vStatus === 'PENDING'
                  ? 'bg-[#FFF4E5] text-[#A66A00] border-[#F5D09D] dark:bg-yellow-950/40 dark:text-yellow-400 dark:border-yellow-700'
                  : 'bg-error/10 text-error border-error/30'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{isVerified ? 'verified' : vStatus === 'PENDING' ? 'hourglass_top' : 'lock'}</span>
            {vStatus}
          </span>

          <Link
            href="/vendor/verification"
            className="btn-primary text-label-md px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            {isVerified ? 'Store Badge' : 'Verify Store'}
          </Link>
        </div>
      </div>

      {/* RESTRICTED VENDOR ONBOARDING VIEW */}
      {!isVerified && (
        <div className="space-y-6">
          {/* Status Alert Banner */}
          {vStatus === 'PENDING' ? (
            <div className="p-5 rounded-xl bg-[#FFF4E5] dark:bg-yellow-950/25 border border-[#F5D09D] dark:border-yellow-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#A66A00] dark:text-yellow-500 text-[28px] shrink-0">hourglass_top</span>
                <div>
                  <h3 className="text-body-md font-bold text-[#A66A00] dark:text-yellow-400">Store Verification In Review</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5 leading-relaxed">
                    Your commercial registration (RCCM) and Tax ID have been submitted to BuildSmart Administration. Product catalog publishing, order fulfillment, and earnings withdrawals will be enabled once your documents are approved.
                  </p>
                </div>
              </div>
              <Link href="/vendor/verification" className="btn-primary shrink-0 px-4 py-2 text-label-md rounded-lg">
                View Application
              </Link>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-[#FFF8F8] dark:bg-red-950/20 border border-error/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-error text-[28px] shrink-0">lock</span>
                <div>
                  <h3 className="text-body-md font-bold text-error">Restricted Merchant Account — Business Verification Required</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-0.5 leading-relaxed">
                    In compliance with construction supply regulations, merchants must submit certified commercial registration and tax identification documents. Selling products, restocking inventory, and processing payouts are restricted until approved by an administrator.
                  </p>
                </div>
              </div>
              <Link href="/vendor/verification" className="btn-primary shrink-0 px-4 py-2 text-label-md rounded-lg flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Submit Verification
              </Link>
            </div>
          )}

          {/* Onboarding Checklist */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
            <h3 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest mb-4">Vendor Certification Process</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-col justify-between">
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold mb-2">1</span>
                  <h4 className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Store Registered</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Vendor account initialized with basic company name.</p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Completed
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col justify-between ${vStatus === 'PENDING' ? 'border-[#A66A00]/40 bg-[#A66A00]/5' : 'border-error/40 bg-error/5'}`}>
                <div>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[12px] font-bold mb-2 ${vStatus === 'PENDING' ? 'bg-[#A66A00]' : 'bg-error'}`}>2</span>
                  <h4 className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Business Documents</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Upload commercial registration (RCCM), Tax ID, and store permit.</p>
                </div>
                <div className="mt-3">
                  {vStatus === 'PENDING' ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#A66A00]">
                      <span className="material-symbols-outlined text-[14px]">schedule</span> Submitted
                    </span>
                  ) : (
                    <Link href="/vendor/verification" className="text-[11px] font-semibold text-error hover:underline flex items-center gap-1">
                      Action Required <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>

              <div className={`p-4 rounded-xl border flex flex-col justify-between ${vStatus === 'PENDING' ? 'border-primary/40 bg-primary/5' : 'border-outline-variant dark:border-outline'}`}>
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-outline-variant text-on-surface-variant text-[12px] font-bold mb-2">3</span>
                  <h4 className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Compliance Audit</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Administrators verify tax registration and commercial authenticity.</p>
                </div>
                <div className="mt-3 text-[11px] text-on-surface-variant dark:text-surface-variant">
                  {vStatus === 'PENDING' ? '⏳ Under Review' : 'Awaiting Submission'}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-outline-variant dark:border-outline flex flex-col justify-between opacity-60">
                <div>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-outline-variant text-on-surface-variant text-[12px] font-bold mb-2">4</span>
                  <h4 className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Store Certified</h4>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">Verified badge awarded. Products published to marketplace.</p>
                </div>
                <div className="mt-3 text-[11px] text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lock</span> Locked
                </div>
              </div>
            </div>
          </div>

          {/* Accessible Onboarding Actions */}
          <div>
            <h3 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest mb-3">Available Store Management Modules</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {UNVERIFIED_VENDOR_ACTIONS.map((a) => (
                <Link
                  key={a.label}
                  href={a.href}
                  className={`flex flex-col items-center justify-center p-5 rounded-xl text-center border transition-all ${
                    a.primary
                      ? 'bg-primary text-white border-primary shadow-sm hover:bg-[#264B3E]'
                      : 'bg-white dark:bg-surface-container border-outline-variant dark:border-outline hover:border-primary text-on-background dark:text-surface-container-lowest'
                  }`}
                >
                  <span className="material-symbols-outlined text-[32px] mb-2">{a.icon}</span>
                  <span className="text-label-md font-medium leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Locked Features Showcase */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest flex items-center gap-2">
                  <span>Merchant Commercial Modules</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase bg-outline-variant/60 text-on-surface-variant">Restricted</span>
                </h3>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">These sales and inventory features unlock immediately once your store verification is approved.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {RESTRICTED_VENDOR_MODULES.map((m) => (
                <div
                  key={m.title}
                  className="p-5 rounded-xl border border-dashed border-outline-variant dark:border-outline bg-surface-container-low/40 dark:bg-surface-variant/20 relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-surface-container-high dark:bg-surface-container flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[22px]">{m.icon}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-error/80 bg-error/10 px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-[13px]">lock</span>
                        Locked
                      </span>
                    </div>
                    <h4 className="text-body-md font-bold text-on-background/80 dark:text-surface-container-lowest/80">{m.title}</h4>
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1 leading-relaxed">{m.desc}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                    <span className="text-[11px] text-on-surface-variant italic">Requires Admin Verification</span>
                    <Link href="/vendor/verification" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline flex items-center gap-0.5">
                      Verify Store <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VERIFIED VENDOR PERFORMANCE CONSOLE (When vendor is FULLY VERIFIED) */}
      {isVerified && (
        <>
          <div className="flex justify-end">
            <div className="flex items-center gap-2 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-lg p-1">
              {(['7d', '30d'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-md text-label-md transition-colors ${range === r ? 'bg-primary text-white' : 'text-on-surface-variant dark:text-surface-variant hover:bg-surface-container-low'}`}
                >
                  {r === '7d' ? '7 days' : '30 days'}
                </button>
              ))}
            </div>
          </div>

          {/* KPI stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-[20px]">{s.icon}</span>
                </div>
                <div className={`text-headline-sm ${s.primary ? 'text-primary dark:text-primary-fixed' : 'text-on-background dark:text-surface-container-lowest'}`}>{s.value}</div>
                <div className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1 uppercase tracking-wider">{s.label}</div>
                <div className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">{s.note}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* Sales trend */}
            <div className="lg:col-span-2 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">Sales Trend</h2>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">Daily revenue ({data.currency}) — {range === '7d' ? 'last 7 days' : 'last 30 days'}</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant">show_chart</span>
              </div>
              <SalesChart series={series} />
            </div>

            {/* Stock status donut */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Stock Status</h2>
              <div className="flex items-center gap-6">
                <DonutChart
                  segments={[
                    { label: 'In Stock', value: data.stockSummary.inStock },
                    { label: 'Low Stock', value: data.stockSummary.lowStock },
                    { label: 'Out of Stock', value: data.stockSummary.outOfStock },
                    { label: 'Backordered', value: data.stockSummary.backordered },
                  ]}
                />
                <div className="space-y-2 text-body-sm">
                  {[
                    { label: 'In Stock', value: data.stockSummary.inStock, color: 'bg-[#2F6B50]' },
                    { label: 'Low Stock', value: data.stockSummary.lowStock, color: 'bg-[#A66A00]' },
                    { label: 'Out of Stock', value: data.stockSummary.outOfStock, color: 'bg-[#ba1a1a]' },
                    { label: 'Backordered', value: data.stockSummary.backordered, color: 'bg-[#8bb8a4]' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${r.color}`} />
                      <span className="text-on-surface-variant dark:text-surface-variant flex-1">{r.label}</span>
                      <span className="font-mono-technical text-on-background dark:text-surface-container-lowest">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low stock alerts */}
              <div className="mt-6 space-y-2">
                <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Low Stock Alerts</h3>
                {data.lowStock.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 border border-[#A66A00]/30 dark:border-[#FFB951]/40 bg-[#A66A00]/5 dark:bg-[#FFB951]/10 rounded-lg">
                    <span className="material-symbols-outlined text-[#A66A00] dark:text-[#FFB951]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest truncate">{p.name}</div>
                      <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.status.replace('_', ' ')} — {p.stock} left</div>
                    </div>
                    <Link href="/vendor/inventory" className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline shrink-0">Restock</Link>
                  </div>
                ))}
                {data.lowStock.length === 0 && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">All products are sufficiently stocked. 🎉</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            {/* Top products */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Top-Selling Products</h2>
              <div className="space-y-3">
                {data.topProducts.slice(0, 5).map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary-container text-white text-[12px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest truncate">{p.name}</div>
                      <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.units} units · {fmt(p.revenue)} {data.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Traffic sources */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Traffic Sources</h2>
              <BarChart data={data.trafficSources.map((t) => ({ label: t.source, value: t.visits }))} height={160} />
              <div className="grid grid-cols-2 gap-2 mt-4">
                {data.trafficSources.map((t) => (
                  <div key={t.source} className="text-body-sm">
                    <span className="text-on-surface-variant dark:text-surface-variant">{t.source}</span>
                    <span className="font-mono-technical text-on-background dark:text-surface-container-lowest block">{fmt(t.visits)} visits</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Demographics */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Customer Locations</h2>
              <div className="space-y-2">
                {data.demographics.map((d) => (
                  <div key={d.location} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant text-[18px]">location_on</span>
                    <span className="flex-1 text-body-sm text-on-background dark:text-surface-container-lowest">{d.location}</span>
                    <span className="font-mono-technical text-on-surface-variant dark:text-surface-variant">{d.customers} buyers</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent orders table */}
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden">
            <div className="p-6 border-b border-outline-variant dark:border-outline flex justify-between items-center">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">Recent Orders</h2>
              <Link href="/vendor/orders" className="text-label-md text-primary dark:text-primary-fixed-dim uppercase tracking-wider hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Order</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Customer</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Items</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Amount</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
                  {data.recentOrders.map((o) => (
                    <tr key={o.id} className="border-b border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-dim transition-colors">
                      <td className="py-3 px-6 font-mono-technical text-primary dark:text-primary-fixed-dim">{o.id.slice(0, 10).toUpperCase()}</td>
                      <td className="py-3 px-6">{o.customer}</td>
                      <td className="py-3 px-6">{o.itemCount}</td>
                      <td className="py-3 px-6 font-mono-technical">{fmt(o.totalAmount)} {data.currency}</td>
                      <td className="py-3 px-6"><StatusPill status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
