'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  unit: string;
  description?: string;
  certifications?: string[];
  imageUrl?: string;
  sku?: string;
  barcode?: string;
  tags?: string[];
  attributes?: Record<string, string | number>;
  backorderable?: boolean;
};

type Media = { id: string; productId: string; kind: 'image' | 'video' | 'sizechart'; url: string; name?: string };

const CATEGORIES = ['Cement', 'Steel', 'Concrete', 'Tiles', 'Roofing', 'Electrical', 'Plumbing', 'Timber', 'Paint', 'Glazing'];
const UNITS = ['bag', 'length', 'm2', 'sheet', 'pc', 'bucket', 'roll', 'ton', 'cu yd', 'm'];

const EMPTY = {
  name: '',
  price: '',
  stock: '',
  category: 'Cement',
  unit: 'bag',
  description: '',
  certifications: '',
  sku: '',
  barcode: '',
  tags: '',
  attributes: '',
  backorderable: false,
};

export default function VendorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [mediaFor, setMediaFor] = useState<Product | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [newMedia, setNewMedia] = useState({ kind: 'image', url: '', name: '' });

  const load = async () => {
    const res = await fetch('/api/products?mine=1');
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return products;
    const t = q.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(t) || p.category.toLowerCase().includes(t) || (p.sku ?? '').toLowerCase().includes(t));
  }, [products, q]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price),
      stock: String(p.stock),
      category: p.category,
      unit: p.unit,
      description: p.description ?? '',
      certifications: (p.certifications ?? []).join(', '),
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      tags: (p.tags ?? []).join(', '),
      attributes: Object.entries(p.attributes ?? {}).map(([k, v]) => `${k}:${v}`).join(', '),
      backorderable: p.backorderable ?? false,
    });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error('Product name is required');
    setSaving(true);
    const attributes: Record<string, string | number> = {};
    for (const pair of form.attributes.split(',')) {
      const [k, ...rest] = pair.trim().split(':');
      if (k) attributes[k] = rest.join(':') || '';
    }
    const body: Record<string, any> = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
      category: form.category,
      unit: form.unit || 'pc',
      description: form.description || undefined,
      certifications: form.certifications,
      sku: form.sku || undefined,
      barcode: form.barcode || undefined,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      backorderable: form.backorderable,
    };
    const res = await fetch('/api/products', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success(editingId ? 'Product updated' : 'Product added');
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY);
      load();
    } else toast.error(data.error ?? 'Could not save product');
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Product deleted');
      load();
    } else toast.error('Could not delete product');
  };

  const bulkImport = async () => {
    const rows = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/[,\t]/).map((c) => c.trim()))
      .filter((c) => c.length >= 5);
    if (!rows.length) return toast.error('No rows detected. Format: name,category,unit,price,stock[,sku]');
    const products = rows.map((r) => ({
      name: r[0],
      category: r[1],
      unit: r[2],
      price: parseFloat(r[3]) || 0,
      stock: parseInt(r[4]) || 0,
      sku: r[5] || undefined,
    }));
    const res = await fetch('/api/products/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Imported ${data.created.length} products`);
      setBulkOpen(false);
      setBulkText('');
      load();
    } else toast.error(data.error ?? 'Bulk import failed');
  };

  const bulkDelete = async () => {
    if (!selected.size) return;
    const res = await fetch('/api/products/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selected] }),
    });
    if (res.ok) {
      toast.success(`Deleted ${selected.size} products`);
      setSelected(new Set());
      load();
    } else toast.error('Bulk delete failed');
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openMedia = async (p: Product) => {
    setMediaFor(p);
    const res = await fetch(`/api/vendor/media?productId=${p.id}`);
    const data = await res.json();
    setMedia(data.media ?? []);
    setNewMedia({ kind: 'image', url: '', name: '' });
  };

  const addMedia = async () => {
    if (!mediaFor || !newMedia.url.trim()) return toast.error('Media URL is required');
    const res = await fetch('/api/vendor/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: mediaFor.id, kind: newMedia.kind, url: newMedia.url, name: newMedia.name || undefined }),
    });
    if (res.ok) {
      toast.success('Media added');
      openMedia(mediaFor);
    } else toast.error('Could not add media');
  };

  const removeMedia = async (id: string) => {
    const res = await fetch(`/api/vendor/media?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Media removed');
      if (mediaFor) openMedia(mediaFor);
    } else toast.error('Could not remove media');
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Product Management</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">List, edit, and organize your catalog.</p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={bulkDelete} className="text-label-md px-4 py-2.5 rounded-lg border border-error text-error dark:text-red-300 hover:bg-error/5 transition-colors">
              Delete ({selected.size})
            </button>
          )}
          <button onClick={() => setBulkOpen(true)} className="btn-secondary px-4 py-2.5 rounded-lg text-label-md flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">upload</span> Bulk Import
          </button>
          <button onClick={showForm ? () => setShowForm(false) : openCreate} className="bg-primary text-on-primary hover:bg-[#264B3E] transition-colors py-2.5 px-5 rounded-lg text-label-md flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
            {showForm ? 'Cancel' : 'Add Product'}
          </button>
        </div>
      </div>

      {/* Search */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, category or SKU…" className="input w-full max-w-md mb-6" />

      {/* Editor form */}
      {showForm && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation mb-6">
          <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">{editingId ? 'Edit Product' : 'Add Product'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Name *</span>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">SKU</span>
              <input className="input w-full" placeholder="PM-CEM-50" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Barcode</span>
              <input className="input w-full" placeholder="6130000000012" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Price (XAF) *</span>
              <input type="number" className="input w-full" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Stock *</span>
              <input type="number" className="input w-full" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Category</span>
              <select className="input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Unit</span>
              <select className="input w-full" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {UNITS.map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Tags (comma separated)</span>
              <input className="input w-full" placeholder="cement, binder" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Certifications</span>
              <input className="input w-full" placeholder="ISO 9001, CE" value={form.certifications} onChange={(e) => setForm({ ...form, certifications: e.target.value })} />
            </label>
            <label className="block md:col-span-2 lg:col-span-3">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Attributes (key:value, comma separated)</span>
              <input className="input w-full" placeholder="brand:Lafarge, grade:42.5R" value={form.attributes} onChange={(e) => setForm({ ...form, attributes: e.target.value })} />
            </label>
            <label className="block md:col-span-2 lg:col-span-3">
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Description</span>
              <textarea className="input w-full" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-body-sm text-on-background dark:text-surface-container-lowest">
              <input type="checkbox" checked={form.backorderable} onChange={(e) => setForm({ ...form, backorderable: e.target.checked })} />
              Allow backorders when out of stock
            </label>
          </div>
          <button onClick={submit} disabled={saving} className="btn-primary px-5 py-2.5 rounded-lg text-label-md mt-4 disabled:opacity-60">
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      )}

      {/* Bulk import modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setBulkOpen(false)}>
          <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">Bulk Import</h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">One product per line: <code className="font-mono-technical">name, category, unit, price, stock, sku</code></p>
            <textarea className="input w-full font-mono-technical text-body-sm" rows={6} value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder={'Portland Cement 50kg, Cement, bag, 4500, 500, PM-CEM-50\nSteel Rebar 12mm, Steel, length, 6800, 200, PM-RBR-12'} />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setBulkOpen(false)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Cancel</button>
              <button onClick={bulkImport} className="btn-primary px-4 py-2 rounded-lg text-label-md">Import</button>
            </div>
          </div>
        </div>
      )}

      {/* Media gallery modal */}
      {mediaFor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setMediaFor(null)}>
          <div className="bg-white dark:bg-surface-container rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-1">Media Gallery</h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">{mediaFor.name}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {media.map((m) => (
                <div key={m.id} className="border border-outline-variant dark:border-outline rounded-lg overflow-hidden relative group">
                  <img src={m.url} alt={m.name ?? ''} className="w-full h-24 object-cover" />
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">{m.kind}</span>
                    <button onClick={() => removeMedia(m.id)} className="material-symbols-outlined text-error text-[18px]">delete</button>
                  </div>
                </div>
              ))}
              {media.length === 0 && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant col-span-3 py-6 text-center">No media yet. Add images, videos or size charts.</p>}
            </div>
            <div className="flex gap-2 items-end">
              <label className="block flex-1">
                <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Kind</span>
                <select className="input w-full" value={newMedia.kind} onChange={(e) => setNewMedia({ ...newMedia, kind: e.target.value })}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="sizechart">Size Chart</option>
                </select>
              </label>
              <label className="block flex-[2]">
                <span className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">URL</span>
                <input className="input w-full" placeholder="/images/…" value={newMedia.url} onChange={(e) => setNewMedia({ ...newMedia, url: e.target.value })} />
              </label>
              <button onClick={addMedia} className="btn-primary px-4 py-2 rounded-lg text-label-md">Add</button>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setMediaFor(null)} className="btn-secondary px-4 py-2 rounded-lg text-label-md">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Product list */}
      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p>
      ) : (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                <th className="py-3 px-4 w-10"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} checked={selected.size > 0 && filtered.every((p) => selected.has(p.id))} /></th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Product</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">SKU</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Price</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Stock</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-right text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest">
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-outline-variant dark:border-outline hover:bg-surface-container-low dark:hover:bg-surface-dim transition-colors">
                  <td className="py-3 px-4"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img src={p.imageUrl ?? '/images/product-cement.png'} alt="" className="w-9 h-9 rounded-lg object-cover border border-outline-variant dark:border-outline" />
                      <div>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{(p.tags ?? []).slice(0, 3).map((t) => `#${t}`).join(' ')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono-technical">{p.sku ?? '—'}</td>
                  <td className="py-3 px-4">{p.category}</td>
                  <td className="py-3 px-4 font-mono-technical">{p.price.toLocaleString()} / {p.unit}</td>
                  <td className={`py-3 px-4 font-mono-technical ${p.stock < 100 ? 'text-[#A66A00] dark:text-[#FFB951]' : ''}`}>{p.stock}</td>
                  <td className="py-3 px-4">
                    {p.stock === 0 ? <span className="text-label-md text-error dark:text-red-300">{p.backorderable ? 'Backordered' : 'Out of stock'}</span> : p.stock < 100 ? <span className="text-label-md text-[#A66A00] dark:text-[#FFB951]">Low stock</span> : <span className="text-label-md text-[#2F6B50] dark:text-primary-fixed">In stock</span>}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button onClick={() => openMedia(p)} className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim text-[20px] px-1" title="Media">collections</button>
                    <button onClick={() => openEdit(p)} className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant hover:text-primary dark:hover:text-primary-fixed-dim text-[20px] px-1" title="Edit">edit</button>
                    <button onClick={() => remove(p.id)} className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant hover:text-error text-[20px] px-1" title="Delete">delete</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-on-surface-variant dark:text-surface-variant">No products found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
