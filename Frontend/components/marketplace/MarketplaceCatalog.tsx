'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export type Product = {
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

const PRODUCT_IMAGE_FALLBACK: Record<string, string> = {
  Cement: '/images/product-cement.png',
  Steel: '/images/product-rebar.png',
  Tiles: '/images/product-tiles.png',
  Roofing: '/images/product-roofing.png',
  Concrete: '/images/product-cement.png',
  Electrical: '/images/product-angle-iron.png',
  Timber: '/images/product-steel-beam.png',
  'Building Materials': '/images/product-cement.png',
};

export function MarketplaceCatalog() {
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
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      const rawProducts: any[] = data.products ?? [];

      const normalized: Product[] = rawProducts.map((p) => {
        const cat = p.category || 'Building Materials';
        const fallbackImg = PRODUCT_IMAGE_FALLBACK[cat] || '/images/product-cement.png';
        const parsedCerts = Array.isArray(p.certifications)
          ? p.certifications
          : typeof p.certifications === 'string'
            ? p.certifications.split(',').map((c: string) => c.trim()).filter(Boolean)
            : ['ISO 9001'];

        return {
          id: p.id,
          name: p.name,
          vendor: p.vendor && p.vendor !== 'Unknown Vendor' ? p.vendor : 'Prime Materials EU',
          vendorVerified: p.vendorVerified !== false,
          price: Number(p.price) || 5000,
          unit: p.unit || 'unit',
          category: cat,
          stock: typeof p.stock === 'number' ? p.stock : 250,
          certifications: parsedCerts.length > 0 ? parsedCerts : ['ISO 9001'],
          description: p.description || `${p.name} — certified construction grade material with escrow protection.`,
          imageUrl: p.imageUrl || fallbackImg,
        };
      });

      setProducts(normalized);
    } catch {
      toast.error('Could not load marketplace products');
    } finally {
      setLoading(false);
    }
  };

  const loadCart = async () => {
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      const count = typeof data.cartCount === 'number'
        ? data.cartCount
        : (data.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
      setCartCount(count);
    } catch {}
  };

  useEffect(() => {
    load();
    loadCart();

    const onCartUpdated = (e: any) => {
      if (typeof e?.detail?.cartCount === 'number') {
        setCartCount(e.detail.cartCount);
      } else {
        loadCart();
      }
    };

    window.addEventListener('buildsmart:cart-updated', onCartUpdated);
    return () => {
      window.removeEventListener('buildsmart:cart-updated', onCartUpdated);
    };
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
      const inCategory =
        selected.length === 0 ||
        selected.some((c) => p.category.toLowerCase().includes(c.toLowerCase()) || (c === 'Cement' && p.category === 'Building Materials'));
      const inCert = certs.length === 0 || certs.some((c) => p.certifications.includes(c));
      const q = search.trim().toLowerCase();
      const inSearch = !q || p.name.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      const min = parseFloat(minPrice);
      const max = parseFloat(maxPrice);
      const inPrice = (isNaN(min) || p.price >= min) && (isNaN(max) || p.price <= max);
      return inCategory && inCert && inSearch && inPrice;
    });

    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'rating') list = [...list].sort((a, b) => Number(b.vendorVerified) - Number(a.vendorVerified));
    if (sort === 'stock') list = [...list].sort((a, b) => b.stock - a.stock);
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, selected, certs, search, sort, minPrice, maxPrice]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    CATEGORIES.forEach((cat) => {
      m[cat] = products.filter(
        (p) => p.category.toLowerCase().includes(cat.toLowerCase()) || (cat === 'Cement' && p.category === 'Building Materials')
      ).length;
    });
    return m;
  }, [products]);

  return (
    <div className="w-full flex flex-col gap-6 mt-8" id="client-marketplace">
      {/* Featured Partner Banner */}
      <section className="w-full relative h-64 md:h-80 rounded-2xl overflow-hidden border border-outline-variant dark:border-outline shadow-elevation">
        <div className="absolute inset-0">
          <Image
            src="/images/marketplace-hero.png"
            alt="Modern construction site at dawn with stacked steel beams"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-[#0c1f18]/75 backdrop-blur-[1px]" />
        <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-12 z-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/60 px-3 py-1 rounded-full w-fit mb-3 border border-emerald-500/30">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            Featured Partner
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Premium Structural Steel
          </h2>
          <p className="text-sm md:text-base text-slate-200 max-w-2xl mb-6 leading-relaxed">
            Sourced from top-tier foundries. Pre-certified for commercial high-rise projects. Bulk discounts and 100% Escrow buyer protection included.
          </p>
          <button
            type="button"
            onClick={() => document.getElementById('marketplace-catalog-grid')?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary w-fit px-6 py-3 rounded-xl text-label-md font-semibold flex items-center gap-2 shadow-lg hover:scale-102 transition-all cursor-pointer"
          >
            <span>View Supplier Catalog</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Mobile Search & Category Chips */}
      <div className="w-full flex md:hidden flex-col gap-3 bg-white dark:bg-[#1a211f] p-4 rounded-xl border border-outline-variant dark:border-outline shadow-sm">
        <div className="relative w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant text-[20px]">
            search
          </span>
          <input
            className="pl-10 pr-4 py-2.5 w-full bg-surface-container-lowest dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg text-body-sm outline-none focus:border-primary"
            placeholder="Search materials, vendors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
          <button
            type="button"
            onClick={() => setSelected([])}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              selected.length === 0
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface dark:text-surface-variant'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                selected.includes(c)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface dark:text-surface-variant'
              }`}
            >
              {c} ({counts[c] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Main Catalog Section: Sidebar + Product Grid */}
      <div className="flex flex-col md:flex-row gap-6 items-start" id="marketplace-catalog-grid">
        {/* Left Column: Categories and Filters */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col gap-5 p-5 border border-outline-variant dark:border-outline rounded-2xl bg-white dark:bg-[#1a211f] shadow-sm sticky top-20">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-base font-bold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">category</span>
                Categories
              </h3>
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected([])}
                  className="text-xs text-primary dark:text-primary-fixed-dim hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            <ul className="flex flex-col gap-2.5 text-body-sm text-on-surface-variant dark:text-surface-variant">
              {CATEGORIES.map((c) => {
                const isChecked = selected.includes(c);
                const count = counts[c] ?? 0;
                return (
                  <li key={c} className="flex justify-between items-center group">
                    <label className="flex items-center gap-2.5 cursor-pointer font-medium text-on-surface dark:text-inverse-on-surface select-none">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(c)}
                        className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer accent-primary"
                      />
                      <span className={isChecked ? 'text-primary dark:text-primary-fixed-dim font-bold' : ''}>{c}</span>
                    </label>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-container-low dark:bg-surface-dim text-on-surface-variant dark:text-surface-variant">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <hr className="border-outline-variant dark:border-outline/60" />

          {/* Price Range Filter */}
          <div>
            <h4 className="text-sm font-bold text-on-surface dark:text-inverse-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">payments</span>
              Price Range
            </h4>
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline-variant text-xs font-mono">XAF</span>
                <input
                  className="pl-9 pr-2 py-1.5 w-full text-xs border border-outline-variant dark:border-outline rounded-lg bg-surface-container-lowest dark:bg-surface-dim text-on-surface dark:text-surface-variant outline-none focus:border-primary"
                  placeholder="Min"
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <span className="text-outline-variant text-xs">-</span>
              <div className="relative w-full">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-outline-variant text-xs font-mono">XAF</span>
                <input
                  className="pl-9 pr-2 py-1.5 w-full text-xs border border-outline-variant dark:border-outline rounded-lg bg-surface-container-lowest dark:bg-surface-dim text-on-surface dark:text-surface-variant outline-none focus:border-primary"
                  placeholder="Max"
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          <hr className="border-outline-variant dark:border-outline/60" />

          {/* Certifications Filter */}
          <div>
            <h4 className="text-sm font-bold text-on-surface dark:text-inverse-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
              Certifications
            </h4>
            <ul className="flex flex-col gap-2 text-xs text-on-surface-variant dark:text-surface-variant">
              {CERTIFICATIONS.map((c) => (
                <li key={c}>
                  <label className="flex items-center gap-2 cursor-pointer font-medium select-none">
                    <input
                      type="checkbox"
                      checked={certs.includes(c)}
                      onChange={() => toggleCert(c)}
                      className="rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer accent-primary"
                    />
                    <span>{c}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {(selected.length > 0 || certs.length > 0 || minPrice || maxPrice || search) && (
            <button
              type="button"
              onClick={() => {
                setSelected([]);
                setCerts([]);
                setMinPrice('');
                setMaxPrice('');
                setSearch('');
              }}
              className="text-xs text-primary dark:text-primary-fixed-dim font-bold uppercase tracking-wider hover:underline text-left mt-1 pt-2 border-t border-outline-variant/60"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* Right Column: Catalog Grid */}
        <div className="flex-1 min-w-0 w-full">
          {/* Header Bar: Results count, Cart Button, Sort */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 p-4 bg-white dark:bg-[#1a211f] border border-outline-variant dark:border-outline rounded-2xl shadow-sm">
            <div className="flex items-center gap-3">
              <p className="text-body-sm font-medium text-on-surface-variant dark:text-surface-variant">
                Showing <strong className="text-on-surface dark:text-inverse-on-surface font-bold">{filtered.length}</strong> result{filtered.length === 1 ? '' : 's'}
              </p>
              {selected.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  {selected.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold bg-primary/10 text-primary dark:text-primary-fixed-dim px-2.5 py-0.5 rounded-full"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className="hover:text-error ml-0.5 text-xs"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Functional Cart Button with Live Count */}
              <Link
                href="/client/cart"
                className="btn-secondary px-3.5 py-2 rounded-xl text-label-sm font-semibold flex items-center gap-2 hover:shadow transition-all border border-outline-variant dark:border-outline"
                title="View your shopping cart"
              >
                <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                <span>Cart ({cartCount})</span>
              </Link>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-1.5 text-body-xs text-on-surface-variant dark:text-surface-variant">
                <span className="hidden sm:inline font-medium">Sort by:</span>
                <select
                  className="py-1.5 px-2.5 text-xs font-semibold rounded-lg border border-outline-variant dark:border-outline bg-surface-container-lowest dark:bg-surface-dim text-on-surface dark:text-inverse-on-surface outline-none focus:border-primary cursor-pointer"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="stock">Most In Stock</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-[#1a211f] rounded-2xl border border-outline-variant p-4 space-y-3 animate-pulse">
                  <div className="h-44 bg-surface-variant dark:bg-surface-dim rounded-xl" />
                  <div className="h-4 bg-surface-variant dark:bg-surface-dim rounded w-3/4" />
                  <div className="h-3 bg-surface-variant dark:bg-surface-dim rounded w-1/2" />
                  <div className="h-8 bg-surface-variant dark:bg-surface-dim rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Product Cards Grid */}
          {!loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#1a211f] border border-outline-variant dark:border-outline rounded-2xl overflow-hidden flex flex-col hover:shadow-elevation transition-all group hover:-translate-y-0.5 duration-200"
                >
                  <div className="h-48 w-full relative bg-surface-variant dark:bg-tertiary-container overflow-hidden">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {p.certifications.length > 0 && (
                      <span className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider text-emerald-900 bg-emerald-100/90 dark:bg-emerald-950/80 dark:text-emerald-300 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-[2px] border border-emerald-500/20">
                        {p.certifications[0]}
                      </span>
                    )}
                    <span className="absolute top-3 right-3 text-[11px] font-mono font-bold bg-white/90 dark:bg-black/80 px-2 py-0.5 rounded-lg text-slate-800 dark:text-slate-200 border border-outline-variant/60">
                      {p.category}
                    </span>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant/80 dark:text-surface-variant/80 truncate">
                        {p.vendor}
                      </span>
                      {p.vendorVerified && (
                        <span
                          className="material-symbols-outlined text-[15px] text-primary dark:text-[#8fd5b5]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                          title="Verified Vendor"
                        >
                          verified
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-on-surface dark:text-inverse-on-surface leading-snug mb-1.5 line-clamp-2">
                      {p.name}
                    </h3>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mb-4 line-clamp-2 leading-relaxed">
                      {p.description}
                    </p>

                    <div className="mt-auto pt-3 border-t border-outline-variant/60 dark:border-outline/60">
                      <div className="flex items-baseline justify-between mb-3">
                        <div className="flex items-baseline gap-1 font-mono-technical">
                          <span className="text-xl font-bold text-on-surface dark:text-inverse-on-surface">
                            {p.price.toLocaleString()}
                          </span>
                          <span className="text-xs text-on-surface-variant dark:text-surface-variant">
                            XAF / {p.unit}
                          </span>
                        </div>
                        <span className={`text-[11px] font-semibold ${p.stock < 100 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {p.stock < 100 ? `Only ${p.stock} left` : `${p.stock.toLocaleString()} in stock`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => addToCart(p.id)}
                        disabled={adding === p.id}
                        className="w-full btn-primary py-2.5 rounded-xl text-label-sm font-semibold flex justify-center items-center gap-2 shadow-sm hover:shadow transition-all disabled:opacity-60 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {adding === p.id ? 'progress_activity' : 'shopping_cart'}
                        </span>
                        <span>{adding === p.id ? 'Adding…' : 'Add to Cart'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="text-center py-20 bg-white dark:bg-[#1a211f] rounded-2xl border border-outline-variant dark:border-outline p-8">
              <span className="material-symbols-outlined text-5xl text-outline mb-2">storefront</span>
              <h4 className="text-headline-sm font-bold text-on-surface dark:text-inverse-on-surface mb-1">
                No materials found
              </h4>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4 max-w-md mx-auto">
                No products match your selected filters. Try clearing your filters or searching for a different term.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setCerts([]);
                  setMinPrice('');
                  setMaxPrice('');
                  setSearch('');
                }}
                className="btn-secondary px-5 py-2.5 rounded-xl text-label-sm font-semibold inline-flex items-center gap-2"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
