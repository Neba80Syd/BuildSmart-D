'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StatusPill } from '@/Frontend/components/vendor/charts';

type Profile = {
  businessName: string;
  description: string;
  location: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  socialLinks: Record<string, string> | null;
  shippingPolicy: { zones: { name: string; type: string; rate: number; ratePerKg?: number; freeAbove: number }[] } | null;
  verificationDocs: { name: string; kind: string; status: string }[];
  verificationStatus: string;
};

const ZONE_TYPES = ['FLAT', 'WEIGHT', 'FREE'];
const BANNER_CHOICES = ['/images/hero-interior.png', '/images/marketplace-hero.png', '/images/project-villa.png', '/images/hero-villa.png'];
const LOGO_CHOICES = ['/images/product-cement.png', '/images/product-rebar.png', '/images/product-tiles.png', '/images/product-roofing.png'];

export default function VendorSettingsPage() {
  const [tab, setTab] = useState<'storefront' | 'shipping' | 'verification'>('storefront');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ businessName: '', description: '', location: '', bannerUrl: '', logoUrl: '', website: '', instagram: '', linkedin: '', facebook: '' });
  const [zones, setZones] = useState<{ name: string; type: string; rate: number; ratePerKg?: number; freeAbove: number }[]>([]);
  const [docForm, setDocForm] = useState({ name: '', kind: 'license' });

  const load = async () => {
    const res = await fetch('/api/vendor/settings');
    const d = await res.json();
    const p: Profile = d.profile;
    setProfile(p);
    setForm({
      businessName: p.businessName ?? '',
      description: p.description ?? '',
      location: p.location ?? '',
      bannerUrl: p.bannerUrl ?? '',
      logoUrl: p.logoUrl ?? '',
      website: p.socialLinks?.website ?? '',
      instagram: p.socialLinks?.instagram ?? '',
      linkedin: p.socialLinks?.linkedin ?? '',
      facebook: p.socialLinks?.facebook ?? '',
    });
    setZones(p.shippingPolicy?.zones ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const saveStorefront = async () => {
    const res = await fetch('/api/vendor/settings?section=storefront', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: form.businessName,
        description: form.description,
        location: form.location,
        bannerUrl: form.bannerUrl || null,
        logoUrl: form.logoUrl || null,
        socialLinks: { website: form.website, instagram: form.instagram, linkedin: form.linkedin, facebook: form.facebook },
      }),
    });
    if (res.ok) {
      toast.success('Storefront saved');
      load();
    } else toast.error('Could not save storefront');
  };

  const addZone = () => setZones([...zones, { name: '', type: 'FLAT', rate: 0, freeAbove: 0 }]);

  const saveShipping = async () => {
    const res = await fetch('/api/vendor/settings?section=shipping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shippingPolicy: { zones } }),
    });
    if (res.ok) {
      toast.success('Shipping policy saved');
      load();
    } else toast.error('Could not save shipping policy');
  };

  const uploadDoc = async () => {
    if (!docForm.name.trim()) return toast.error('Document name is required');
    const res = await fetch('/api/vendor/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docForm),
    });
    if (res.ok) {
      toast.success('Document uploaded for review');
      setDocForm({ name: '', kind: 'license' });
      load();
    } else toast.error('Could not upload document');
  };

  if (!profile) return <div className="p-margin-mobile md:p-margin-desktop"><p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p></div>;

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Vendor Store Settings</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Customize your storefront, shipping rules, and verification.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {([['storefront', 'Storefront'], ['shipping', 'Shipping Policy'], ['verification', 'Business Verification']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-label-md border transition-colors ${tab === k ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-container text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'storefront' && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 max-w-3xl">
          <div className="mb-6">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">Storefront Customization</h2>
            <div className="relative rounded-xl overflow-hidden h-36 border border-outline-variant dark:border-outline">
              <img src={form.bannerUrl || '/images/hero-interior.png'} alt="Banner" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-end gap-4 -mt-8 ml-6">
              <img src={form.logoUrl || '/images/product-cement.png'} alt="Logo" className="w-20 h-20 rounded-xl object-cover border-4 border-white dark:border-surface-container bg-white" />
            </div>
          </div>

          <label className="block mb-3"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Business Name</span><input className="input w-full" value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></label>
          <label className="block mb-3"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Description</span><textarea className="input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="block mb-3"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Location</span><input className="input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>

          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Banner</span>
              <select className="input w-full" value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}>
                <option value="">Default</option>
                {BANNER_CHOICES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Logo</span>
              <select className="input w-full" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}>
                <option value="">Default</option>
                {LOGO_CHOICES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
          </div>

          <h3 className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mb-2 mt-4">Social Media Links</h3>
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant">Website</span><input className="input w-full" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></label>
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant">Instagram</span><input className="input w-full" value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></label>
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant">LinkedIn</span><input className="input w-full" value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></label>
            <label className="block"><span className="text-label-md text-on-surface-variant dark:text-surface-variant">Facebook</span><input className="input w-full" value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} /></label>
          </div>

          <button onClick={saveStorefront} className="btn-primary px-5 py-2.5 rounded-lg text-label-md">Save Storefront</button>
        </div>
      )}

      {tab === 'shipping' && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 max-w-3xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">Shipping Policy Setup</h2>
            <button onClick={addZone} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">+ Add Zone</button>
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">Define shipping zones with flat rates, weight-based rates, or free shipping thresholds.</p>
          <div className="space-y-3 mb-6">
            {zones.map((z, i) => (
              <div key={i} className="grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center border border-outline-variant dark:border-outline rounded-lg p-3">
                <input className="input w-full" placeholder="Zone name (e.g. Douala)" value={z.name} onChange={(e) => setZones(zones.map((zz, ii) => (ii === i ? { ...zz, name: e.target.value } : zz)))} />
                <select className="input w-32" value={z.type} onChange={(e) => setZones(zones.map((zz, ii) => (ii === i ? { ...zz, type: e.target.value } : zz)))}>
                  {ZONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {z.type !== 'FREE' && (
                  <input type="number" className="input w-32" placeholder={z.type === 'WEIGHT' ? 'XAF/kg' : 'Rate (XAF)'} value={z.type === 'WEIGHT' ? z.ratePerKg ?? '' : z.rate}
                    onChange={(e) => setZones(zones.map((zz, ii) => (ii === i ? (z.type === 'WEIGHT' ? { ...zz, ratePerKg: parseFloat(e.target.value) || 0 } : { ...zz, rate: parseFloat(e.target.value) || 0 }) : zz)))} />
                )}
                <input type="number" className="input w-32" placeholder="Free above (XAF)" value={z.freeAbove} onChange={(e) => setZones(zones.map((zz, ii) => (ii === i ? { ...zz, freeAbove: parseFloat(e.target.value) || 0 } : zz)))} />
                <button onClick={() => setZones(zones.filter((_, ii) => ii !== i))} className="material-symbols-outlined text-error text-[20px]">delete</button>
              </div>
            ))}
            {zones.length === 0 && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant py-4">No shipping zones defined.</p>}
          </div>
          <button onClick={saveShipping} className="btn-primary px-5 py-2.5 rounded-lg text-label-md">Save Shipping Policy</button>
        </div>
      )}

      {tab === 'verification' && (
        <div className="grid md:grid-cols-2 gap-gutter max-w-4xl">
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">Business Verification</h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-body-sm text-on-surface-variant dark:text-surface-variant">Current status:</span>
              <StatusPill status={profile.verificationStatus === 'FULLY_VERIFIED' ? 'DELIVERED' : profile.verificationStatus === 'VERIFIED_VENDOR' ? 'APPROVED' : 'REQUESTED'} />
            </div>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">Upload business licenses, IDs, and tax registration certificates. Our team reviews them before your store is fully verified.</p>
            <label className="block mb-2"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Document name</span><input className="input w-full" value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="business-registration.pdf" /></label>
            <label className="block mb-4"><span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Type</span>
              <select className="input w-full" value={docForm.kind} onChange={(e) => setDocForm({ ...docForm, kind: e.target.value })}>
                <option value="license">Business License</option>
                <option value="tax">Tax Registration</option>
                <option value="id">Government ID</option>
                <option value="other">Other</option>
              </select>
            </label>
            <button onClick={uploadDoc} className="btn-primary px-5 py-2.5 rounded-lg text-label-md">Upload for Review</button>
          </div>
          <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Uploaded Documents</h2>
            <div className="space-y-2">
              {(profile.verificationDocs ?? []).map((d, i) => (
                <div key={i} className="flex items-center gap-3 p-3 border border-outline-variant dark:border-outline rounded-lg">
                  <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant">description</span>
                  <span className="flex-1 text-body-sm text-on-background dark:text-surface-container-lowest truncate">{d.name}</span>
                  <StatusPill status={d.status} />
                </div>
              ))}
              {(profile.verificationDocs ?? []).length === 0 && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">No documents uploaded.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
