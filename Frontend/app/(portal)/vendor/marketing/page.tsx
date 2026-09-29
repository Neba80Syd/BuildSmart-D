'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StatusPill } from '@/Frontend/components/vendor/charts';

const fmt = (n: number) => Math.round(n).toLocaleString();

type Coupon = { id: string; code: string; type: string; value: number; minOrder: number; maxUses: number; usedCount: number; active: boolean; endsAt: string | null };
type Campaign = { id: string; name: string; type: string; discountType: string; discountValue: number; active: boolean; startsAt: string | null; endsAt: string | null };
type Assignment = { productId: string; name: string; related: { id: string; relatedProductId: string; relatedName: string }[] };

export default function VendorMarketingPage() {
  const [tab, setTab] = useState<'coupons' | 'campaigns' | 'crosssell'>('coupons');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [couponForm, setCouponForm] = useState({ code: '', type: 'PERCENT', value: '', minOrder: '', maxUses: '', endsAt: '' });
  const [campaignForm, setCampaignForm] = useState({ name: '', type: 'FLASH_SALE', discountType: 'PERCENT', discountValue: '', startsAt: '', endsAt: '' });
  const [crossTarget, setCrossTarget] = useState<Assignment | null>(null);
  const [crossSelection, setCrossSelection] = useState<Set<string>>(new Set());

  const loadCoupons = async () => {
    const res = await fetch('/api/vendor/coupons');
    setCoupons((await res.json()).coupons ?? []);
  };
  const loadCampaigns = async () => {
    const res = await fetch('/api/vendor/campaigns');
    setCampaigns((await res.json()).campaigns ?? []);
  };
  const loadCross = async () => {
    const res = await fetch('/api/vendor/crosssells');
    setAssignments((await res.json()).assignments ?? []);
  };

  useEffect(() => {
    loadCoupons();
    loadCampaigns();
    loadCross();
  }, []);

  const createCoupon = async () => {
    if (!couponForm.code.trim()) return toast.error('Coupon code is required');
    const res = await fetch('/api/vendor/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: couponForm.code,
        type: couponForm.type,
        value: parseFloat(couponForm.value) || 0,
        minOrder: parseFloat(couponForm.minOrder) || 0,
        maxUses: parseInt(couponForm.maxUses) || 0,
        endsAt: couponForm.endsAt || undefined,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      toast.success('Coupon created');
      setCouponForm({ code: '', type: 'PERCENT', value: '', minOrder: '', maxUses: '', endsAt: '' });
      loadCoupons();
    } else toast.error(d.error ?? 'Could not create coupon');
  };

  const toggleCoupon = async (c: Coupon) => {
    await fetch('/api/vendor/coupons', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) });
    loadCoupons();
  };

  const deleteCoupon = async (id: string) => {
    await fetch(`/api/vendor/coupons?id=${id}`, { method: 'DELETE' });
    toast.success('Coupon deleted');
    loadCoupons();
  };

  const createCampaign = async () => {
    if (!campaignForm.name.trim()) return toast.error('Campaign name is required');
    if (!campaignForm.startsAt || !campaignForm.endsAt) return toast.error('Set start and end dates');
    const res = await fetch('/api/vendor/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...campaignForm, discountValue: parseFloat(campaignForm.discountValue) || 0 }),
    });
    if (res.ok) {
      toast.success('Campaign created');
      setCampaignForm({ name: '', type: 'FLASH_SALE', discountType: 'PERCENT', discountValue: '', startsAt: '', endsAt: '' });
      loadCampaigns();
    } else toast.error('Could not create campaign');
  };

  const toggleCampaign = async (c: Campaign) => {
    await fetch('/api/vendor/campaigns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, active: !c.active }) });
    loadCampaigns();
  };

  const openCross = (a: Assignment) => {
    setCrossTarget(a);
    setCrossSelection(new Set(a.related.map((r) => r.relatedProductId)));
  };

  const saveCross = async () => {
    if (!crossTarget) return;
    const res = await fetch('/api/vendor/crosssells', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: crossTarget.productId, relatedProductIds: [...crossSelection] }),
    });
    if (res.ok) {
      toast.success('Cross-sells saved');
      setCrossTarget(null);
      loadCross();
    } else toast.error('Could not save cross-sells');
  };

  const relatedProductIds = useMemo(() => (crossTarget ? assignments.filter((a) => a.productId !== crossTarget.productId) : []), [assignments, crossTarget]);

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Marketing &amp; Promotions</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Create coupons, run campaigns, and configure cross-selling.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {([['coupons', 'Coupons'], ['campaigns', 'Campaigns'], ['crosssell', 'Cross-Selling']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-label-md border transition-colors ${tab === k ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-container text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'coupons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 h-fit">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Coupon Creator</h2>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Code</span><input className="input w-full" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} placeholder="SUMMER10" /></label>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Type</span>
              <select className="input w-full" value={couponForm.type} onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value })}>
                <option value="PERCENT">Percentage discount</option>
                <option value="FIXED">Fixed amount</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </select>
            </label>
            {couponForm.type !== 'FREE_SHIPPING' && (
              <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{couponForm.type === 'PERCENT' ? 'Discount %' : 'Amount off (XAF)'}</span><input type="number" className="input w-full" value={couponForm.value} onChange={(e) => setCouponForm({ ...couponForm, value: e.target.value })} /></label>
            )}
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Min order (XAF)</span><input type="number" className="input w-full" value={couponForm.minOrder} onChange={(e) => setCouponForm({ ...couponForm, minOrder: e.target.value })} /></label>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Max uses (0 = unlimited)</span><input type="number" className="input w-full" value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} /></label>
            <label className="block mb-4"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Expiry date</span><input type="date" className="input w-full" value={couponForm.endsAt} onChange={(e) => setCouponForm({ ...couponForm, endsAt: e.target.value })} /></label>
            <button onClick={createCoupon} className="btn-primary w-full py-2.5 rounded-lg text-label-md">Create Coupon</button>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden h-fit">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Code</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Type</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Value</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Uses</th>
                    <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Status</th>
                    <th className="py-3 px-6 text-right text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b border-outline-variant dark:border-outline">
                      <td className="py-3 px-6 font-mono-technical font-bold">{c.code}</td>
                      <td className="py-3 px-6">{c.type.replace('_', ' ')}</td>
                      <td className="py-3 px-6 font-mono-technical">{c.type === 'PERCENT' ? `${c.value}%` : c.type === 'FIXED' ? `${fmt(c.value)}` : 'Free'}</td>
                      <td className="py-3 px-6">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                      <td className="py-3 px-6"><StatusPill status={c.active ? 'ACTIVE' : 'CANCELLED'} /></td>
                      <td className="py-3 px-6 text-right whitespace-nowrap">
                        <button onClick={() => toggleCoupon(c)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline mr-3">{c.active ? 'Deactivate' : 'Activate'}</button>
                        <button onClick={() => deleteCoupon(c.id)} className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant hover:text-error text-[20px]">delete</button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-on-surface-variant dark:text-surface-variant">No coupons yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 h-fit">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Campaign Manager</h2>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Name</span><input className="input w-full" value={campaignForm.name} onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })} /></label>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Type</span>
              <select className="input w-full" value={campaignForm.type} onChange={(e) => setCampaignForm({ ...campaignForm, type: e.target.value })}>
                <option value="FLASH_SALE">Flash sale</option>
                <option value="SITE_WIDE">Site-wide sale</option>
              </select>
            </label>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Discount value (%)</span><input type="number" className="input w-full" value={campaignForm.discountValue} onChange={(e) => setCampaignForm({ ...campaignForm, discountValue: e.target.value })} /></label>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Start</span><input type="datetime-local" className="input w-full" value={campaignForm.startsAt} onChange={(e) => setCampaignForm({ ...campaignForm, startsAt: e.target.value })} /></label>
            <label className="block mb-4"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">End</span><input type="datetime-local" className="input w-full" value={campaignForm.endsAt} onChange={(e) => setCampaignForm({ ...campaignForm, endsAt: e.target.value })} /></label>
            <button onClick={createCampaign} className="btn-primary w-full py-2.5 rounded-lg text-label-md">Launch Campaign</button>
          </div>
          <div className="lg:col-span-2 space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{c.name}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{c.type.replace('_', ' ')} · {c.discountValue}% off</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{c.startsAt ? new Date(c.startsAt).toLocaleDateString() : '—'} → {c.endsAt ? new Date(c.endsAt).toLocaleDateString() : '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={c.active ? 'ACTIVE' : 'CANCELLED'} />
                  <button onClick={() => toggleCampaign(c)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">{c.active ? 'Pause' : 'Resume'}</button>
                </div>
              </div>
            ))}
            {campaigns.length === 0 && <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-8 text-center text-on-surface-variant dark:text-surface-variant">No campaigns yet.</div>}
          </div>
        </div>
      )}

      {tab === 'crosssell' && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Product</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Recommended with</th>
                <th className="py-3 px-6 text-right text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
              {assignments.map((a) => (
                <tr key={a.productId} className="border-b border-outline-variant dark:border-outline">
                  <td className="py-3 px-6 font-semibold">{a.name}</td>
                  <td className="py-3 px-6">
                    {a.related.length ? a.related.map((r) => r.relatedName).join(', ') : <span className="text-on-surface-variant dark:text-surface-variant">None</span>}
                  </td>
                  <td className="py-3 px-6 text-right"><button onClick={() => openCross(a)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {crossTarget && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCrossTarget(null)}>
              <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Cross-Sell: {crossTarget.name}</h2>
                <div className="space-y-2 max-h-72 overflow-auto mb-4">
                  {relatedProductIds.map((p) => (
                    <label key={p.productId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low dark:hover:bg-surface-dim">
                      <input type="checkbox" checked={crossSelection.has(p.productId)} onChange={(e) => setCrossSelection((prev) => { const n = new Set(prev); e.target.checked ? n.add(p.productId) : n.delete(p.productId); return n; })} />
                      <span>{p.name}</span>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setCrossTarget(null)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Cancel</button>
                  <button onClick={saveCross} className="btn-primary px-4 py-2 rounded-lg text-label-md">Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
