'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DonutChart } from '@/Frontend/components/vendor/charts';

type Warehouse = {
  id: string;
  name: string;
  location: string;
  isDefault: boolean;
  stock: { id: string; productId: string; quantity: number; productName: string }[];
};
type ProductRef = { id: string; name: string; sku: string; stock: number };

export default function VendorInventoryPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<ProductRef[]>([]);
  const [activeWh, setActiveWh] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', isDefault: false });
  const [q, setQ] = useState('');

  const load = async () => {
    const res = await fetch('/api/vendor/inventory');
    const data = await res.json();
    setWarehouses(data.warehouses ?? []);
    setProducts(data.products ?? []);
    setActiveWh((prev) => prev ?? data.warehouses?.[0]?.id ?? null);
  };

  useEffect(() => {
    load();
  }, []);

  const active = useMemo(() => warehouses.find((w) => w.id === activeWh) ?? warehouses[0] ?? null, [warehouses, activeWh]);

  const filteredProducts = useMemo(() => {
    if (!q.trim()) return products;
    const t = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(t) || (p.sku ?? '').toLowerCase().includes(t));
  }, [products, q]);

  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const w of warehouses) for (const s of w.stock) map[s.productId] = (map[s.productId] ?? 0) + s.quantity;
    return map;
  }, [warehouses]);

  const stockSummary = useMemo(() => {
    const inStock = products.filter((p) => p.stock >= 100).length;
    const low = products.filter((p) => p.stock > 0 && p.stock < 100).length;
    const out = products.filter((p) => p.stock === 0).length;
    return { inStock, low, out };
  }, [products]);

  const addWarehouse = async () => {
    if (!form.name.trim()) return toast.error('Warehouse name is required');
    const res = await fetch('/api/vendor/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success('Warehouse added');
      setShowAdd(false);
      setForm({ name: '', location: '', isDefault: false });
      load();
    } else toast.error('Could not add warehouse');
  };

  const saveStock = async (productId: string, quantity: number) => {
    if (!active) return;
    const res = await fetch('/api/vendor/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: active.id, stockUpdates: [{ productId, quantity }] }),
    });
    if (res.ok) toast.success('Stock updated');
    else toast.error('Could not update stock');
  };

  const removeWarehouse = async (id: string) => {
    const res = await fetch(`/api/vendor/inventory?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Warehouse removed');
      setActiveWh(null);
      load();
    } else toast.error('Could not remove warehouse');
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Inventory &amp; Stock Control</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Track stock levels, SKUs, and multi-location warehouses.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-primary text-on-primary hover:bg-[#264B3E] transition-colors py-2.5 px-5 rounded-lg text-label-md flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add_business</span> Add Warehouse
        </button>
      </div>

      {/* Stock status tracker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-xl">
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 flex items-center gap-6">
          <DonutChart segments={[{ label: 'In Stock', value: stockSummary.inStock }, { label: 'Low', value: stockSummary.low }, { label: 'Out', value: stockSummary.out }]} />
          <div className="space-y-2 text-body-sm">
            {[{ l: 'In Stock', v: stockSummary.inStock, c: 'bg-[#2F6B50]' }, { l: 'Low Stock', v: stockSummary.low, c: 'bg-[#A66A00]' }, { l: 'Out of Stock', v: stockSummary.out, c: 'bg-[#ba1a1a]' }].map((r) => (
              <div key={r.l} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${r.c}`} />
                <span className="text-on-surface-variant dark:text-surface-variant flex-1">{r.l}</span>
                <span className="font-mono-technical text-on-background dark:text-surface-container-lowest">{r.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
          <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-3">SKU Management</h2>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">Stock Keeping Units identify each catalog variation. Edit SKUs and barcodes from the Product editor.</p>
          <div className="flex items-center gap-2 text-body-sm">
            <span className="material-symbols-outlined text-primary dark:text-primary-fixed-dim">qr_code_scanner</span>
            <span className="text-on-background dark:text-surface-container-lowest">{products.filter((p) => p.sku).length} of {products.length} products have SKUs</span>
          </div>
        </div>
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6">
          <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-3">Warehouse Syncing</h2>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{warehouses.length} location{warehouses.length === 1 ? '' : 's'} synced. Distribute stock across fulfillment centers.</p>
        </div>
      </div>

      {/* Add warehouse modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Add Warehouse</h2>
            <label className="block mb-3">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Name</span>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block mb-3">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Location</span>
              <input className="input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-body-sm text-on-background dark:text-surface-container-lowest mb-4">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              Set as default warehouse
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Cancel</button>
              <button onClick={addWarehouse} className="btn-primary px-4 py-2 rounded-lg text-label-md">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {warehouses.map((w) => (
          <button key={w.id} onClick={() => setActiveWh(w.id)} className={`px-4 py-2 rounded-lg text-label-md border transition-colors ${activeWh === w.id ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-container text-on-surface-variant dark:text-surface-variant border-outline-variant dark:border-outline hover:bg-surface-container-low'}`}>
            {w.name} {w.isDefault && <span className="ml-1 text-[10px] uppercase">• default</span>}
          </button>
        ))}
      </div>

      {active ? (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden">
          <div className="p-6 border-b border-outline-variant dark:border-outline flex flex-wrap justify-between items-center gap-3">
            <div>
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{active.name}</h2>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{active.location} — stock quantities per location</p>
            </div>
            <div className="flex items-center gap-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="input w-full max-w-xs" />
              <button onClick={() => removeWarehouse(active.id)} className="text-label-md text-error dark:text-red-300 hover:underline">Remove</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                  <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Product</th>
                  <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">SKU</th>
                  <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">This Location</th>
                  <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Total (All Locations)</th>
                  <th className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Adjust</th>
                </tr>
              </thead>
              <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
                {filteredProducts.map((p) => {
                  const here = active.stock.find((s) => s.productId === p.id)?.quantity ?? 0;
                  return (
                    <tr key={p.id} className="border-b border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-dim">
                      <td className="py-3 px-6 font-semibold">{p.name}</td>
                      <td className="py-3 px-6 font-mono-technical">{p.sku ?? '—'}</td>
                      <td className="py-3 px-6">
                        <StockInput value={here} onSave={(v) => saveStock(p.id, v)} />
                      </td>
                      <td className="py-3 px-6 font-mono-technical">{totals[p.id] ?? 0}</td>
                      <td className="py-3 px-6 text-label-md text-on-surface-variant dark:text-surface-variant">per-location</td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-on-surface-variant dark:text-surface-variant">No products found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Add a warehouse to start distributing stock.</p>
      )}
    </div>
  );
}

function StockInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="font-mono-technical text-primary dark:text-primary-fixed-dim hover:underline" title="Click to adjust">
        {value}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input autoFocus type="number" min={0} className="input w-20" value={v} onChange={(e) => setV(e.target.value)} />
      <button onClick={() => { onSave(parseInt(v) || 0); setEditing(false); }} className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-[18px]">check</button>
      <button onClick={() => setEditing(false)} className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant text-[18px]">close</button>
    </span>
  );
}
