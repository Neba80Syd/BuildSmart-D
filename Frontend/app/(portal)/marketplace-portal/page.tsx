'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { toast } from 'sonner';

type Product = {
  id: string;
  name: string;
  vendor: string;
  vendorVerified: boolean;
  price: number;
  unit: string;
  category: string;
  stock: number;
  certifications: string[];
  description: string;
  imageUrl: string;
};

const CATEGORIES = ['Cement', 'Concrete', 'Steel', 'Tiles', 'Roofing', 'Electrical', 'Timber'];
const CERTIFICATIONS = ['LEED Certified', 'ISO 9001', 'OSHA Compliant'];

export default function MarketplacePage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [certs, setCerts] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('relevance');
  const [cartCount, setCartCount] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data.products ?? []);
    setLoading(false);
  };
  const loadCart = async () => {
    const res = await fetch('/api/cart');
    const data = await res.json();
    setCartCount((data.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0));
  };

  useEffect(() => {
    load();
    loadCart();
  }, []);

  const toggleCategory = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));

  const toggleCert = (name: string) =>
    setCerts((prev) => (prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]));

  const addToCart = async (id: string) => {
    setAdding(id);
    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: id, quantity: 1 }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.info('Please sign in to add items to your cart');
        router.push('/login');
      } else if (res.ok) {
        toast.success('Added to cart');
        const count = typeof data.cartCount === 'number'
          ? data.cartCount
          : (data.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
        setCartCount(count);
        window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: count } }));
      } else {
        toast.error(data.error ?? 'Could not add to cart');
      }
    } finally {
      setAdding(null);
    }
  };

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      const inCategory = selected.length === 0 || selected.includes(p.category);
      const inCert = certs.length === 0 || certs.some((c) => p.certifications.includes(c));
      const q = search.trim().toLowerCase();
      const inSearch = !q || p.name.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q);
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      const inPrice = (isNaN(min) || p.price >= min) && (isNaN(max) || p.price <= max);
      return inCategory && inCert && inSearch && inPrice;
    });
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => Number(b.vendorVerified) - Number(a.vendorVerified));
    if (sort === 'stock') list = [...list].sort((a, b) => b.stock - a.stock);
    return list;
  }, [products, selected, certs, search, sort, minPrice, maxPrice]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    products.forEach((p) => (m[p.category] = (m[p.category] ?? 0) + 1));
    return m;
  }, [products]);

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop flex flex-col gap-xl">
      {/* Hero banner */}
      <section className="w-full relative h-64 md:h-80 rounded-xl overflow-hidden border border-outline-variant dark:border-outline">
        <div className="absolute inset-0">
          <Image src="/images/marketplace-hero.png" alt="Modern construction site at dawn with stacked steel beams" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="absolute inset-0 bg-surface-tint opacity-70" />
        <div className="absolute inset-0 flex flex-col justify-center p-lg md:p-xl">
          <span className="text-label-md text-primary-fixed uppercase tracking-wider mb-2">Featured Partner</span>
          <h1 className="text-display text-surface-container-lowest mb-4">Premium Structural Steel</h1>
          <p className="text-body-lg text-surface-container-low max-w-2xl mb-6">
            Sourced from top-tier foundries. Pre-certified for commercial high-rise projects. Bulk discounts available.
          </p>
          <button
            onClick={() => document.getElementById('product-grid')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary w-fit px-6 py-3 rounded-lg text-label-md flex items-center gap-2 shadow-sm"
          >
            View Supplier Catalog <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Search + category chips (mobile) */}
      <div className="w-full flex md:hidden flex-col gap-4 bg-white dark:bg-[#1e2022] p-4 rounded-xl border border-outline-variant dark:border-outline">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-outline-variant">search</span>
          <input className="input-field pl-10 pr-4 py-3 w-full text-body-md" placeholder="Search materials…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCategory(c)}
              className={`whitespace-nowrap px-4 py-2 rounded-full border text-body-sm ${
                selected.includes(c) ? 'border-2 border-primary dark:border-[#8fd5b5] bg-primary-container text-white font-medium' : 'border-outline-variant dark:border-outline bg-white dark:bg-transparent text-on-surface'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-lg">
        {/* Sidebar filters */}
        <aside className="hidden md:flex w-64 flex-col gap-lg p-lg border border-outline-variant dark:border-outline rounded-xl bg-white dark:bg-[#1e2022] h-fit">
          <div>
            <h3 className="text-headline-sm text-on-surface dark:text-on-surface mb-4">Categories</h3>
            <ul className="flex flex-col gap-2 text-body-sm text-on-surface-variant dark:text-outline-variant">
              {CATEGORIES.map((c) => (
                <li key={c} className="flex justify-between items-center cursor-pointer">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-primary dark:text-[#8fd5b5]">
                    <input type="checkbox" checked={selected.includes(c)} onChange={() => toggleCategory(c)} className="rounded border-outline-variant text-primary dark:text-[#8fd5b5] focus:ring-primary h-4 w-4" />
                    {c}
                  </label>
                  <span>{counts[c] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
          <hr className="border-outline-variant dark:border-outline" />
          <div>
            <h3 className="text-headline-sm text-on-surface dark:text-on-surface mb-4">Price Range</h3>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-outline-variant text-body-sm">XAF</span>
                <input className="input-field pl-6 pr-2 py-2 w-full text-body-sm" placeholder="Min" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </div>
              <span className="text-outline-variant">-</span>
              <div className="relative w-full">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-outline-variant text-body-sm">XAF</span>
                <input className="input-field pl-6 pr-2 py-2 w-full text-body-sm" placeholder="Max" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
            </div>
          </div>
          <hr className="border-outline-variant dark:border-outline" />
          <div>
            <h3 className="text-headline-sm text-on-surface dark:text-on-surface mb-4">Certifications</h3>
            <ul className="flex flex-col gap-2 text-body-sm text-on-surface-variant dark:text-outline-variant">
              {CERTIFICATIONS.map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={certs.includes(c)} onChange={() => toggleCert(c)} className="rounded border-outline-variant text-primary dark:text-[#8fd5b5] focus:ring-primary h-4 w-4" />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {(selected.length > 0 || certs.length > 0 || minPrice || maxPrice || search) && (
            <button
              onClick={() => { setSelected([]); setCerts([]); setMinPrice(''); setMaxPrice(''); setSearch(''); }}
              className="text-label-md text-primary dark:text-primary-fixed-dim uppercase tracking-wider hover:underline text-left"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* Product grid */}
        <div className="flex-1 min-w-0" id="product-grid">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <p className="text-body-md text-on-surface-variant dark:text-outline-variant">
              {loading ? 'Loading…' : (
                <>
                  Showing <strong>{filtered.length}</strong> result{filtered.length === 1 ? '' : 's'}
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <Link href="/cart" className="btn-secondary px-4 py-2 rounded-lg text-label-md flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                Cart ({cartCount})
              </Link>
              <label className="text-body-sm text-on-surface-variant dark:text-outline-variant hidden sm:block">Sort by:</label>
              <select className="input-field py-1 px-3 text-body-sm font-medium text-on-surface dark:text-on-surface bg-transparent" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="stock">Most In Stock</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white dark:bg-[#1e2022] border border-outline-variant dark:border-outline rounded-xl overflow-hidden flex flex-col hover:shadow-elevation transition-all group">
                <div className="h-40 w-full relative bg-surface-variant dark:bg-tertiary-container">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  {p.certifications.length > 0 && (
                    <span className="absolute top-3 left-3 text-[10px] uppercase text-primary-container dark:text-[#8fd5b5] tracking-wider font-semibold bg-white/90 dark:bg-black/60 px-2 py-1 rounded">
                      {p.certifications[0]}
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-start gap-1 mb-1">
                    <span className="text-[10px] uppercase text-on-surface-variant dark:text-outline-variant tracking-wider font-semibold">{p.vendor}</span>
                    {p.vendorVerified && (
                      <span className="material-symbols-outlined text-[14px] text-primary dark:text-[#8fd5b5]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
                  </div>
                  <h3 className="text-body-lg font-semibold text-on-surface dark:text-on-surface leading-tight mb-2 line-clamp-2">{p.name}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-outline-variant mb-3 line-clamp-2">{p.description}</p>
                  <div className="mt-auto">
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-headline-md font-bold text-on-surface dark:text-on-surface">{p.price.toLocaleString()} XAF</span>
                      <span className="text-body-sm text-outline-variant mb-1">/ {p.unit}</span>
                    </div>
                    <p className={`text-body-sm mb-4 ${p.stock < 100 ? 'text-error dark:text-error-container' : 'text-on-surface-variant dark:text-outline-variant'}`}>
                      {p.stock < 100 ? `Only ${p.stock} left` : `${p.stock.toLocaleString()} in stock`}
                    </p>
                    <button
                      onClick={() => addToCart(p.id)}
                      disabled={adding === p.id}
                      className="w-full btn-secondary py-2 rounded-lg text-label-md flex justify-center items-center gap-2 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                      {adding === p.id ? 'Adding…' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-on-surface-variant dark:text-outline-variant">No products match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
