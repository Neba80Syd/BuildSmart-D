'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StarRating } from '@/Frontend/components/StarRating';

type Results = {
  products: { id: string; name: string; category: string; price: number; unit: string }[];
  architects: { id: string; name: string; rating: number; location: string; verificationStatus: string }[];
  projects: { id: string; name: string; status: string; location?: string }[];
  articles: { id: string; title: string; slug: string; category: string }[];
};

const EMPTY: Results = { products: [], architects: [], projects: [], articles: [] };

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? EMPTY);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const total = results.products.length + results.architects.length + results.projects.length + results.articles.length;

  return (
    <div className="max-w-4xl mx-auto p-margin-mobile md:p-margin-desktop">
      <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-6">Search &amp; Discover</h1>

      <div className="relative mb-8">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-surface-variant">search</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products, architects, projects, and articles…"
          className="input-field pl-10 pr-4 py-3 w-full text-body-md"
        />
      </div>

      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Searching…</p>
      ) : (
        <>
          {q && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-6">{total} result{total === 1 ? '' : 's'} for “{q}”</p>}

          {!q && (
            <div className="mb-10">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Recommended for you</h2>
            </div>
          )}

          {results.products.length > 0 && (
            <Section title="Products">
              {results.products.map((p) => (
                <Link key={p.id} href="/marketplace-portal" className="flex justify-between items-center py-3 border-b border-outline-variant dark:border-outline last:border-0 hover:bg-surface-container-low dark:hover:bg-tertiary-container px-2 -mx-2 rounded-lg transition-colors">
                  <div>
                    <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</span>
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant ml-2">{p.category}</span>
                  </div>
                  <span className="text-body-md font-mono-technical text-on-background dark:text-surface-container-lowest">{p.price.toLocaleString()} XAF / {p.unit}</span>
                </Link>
              ))}
            </Section>
          )}

          {results.architects.length > 0 && (
            <Section title="Architects">
              {results.architects.map((a) => (
                <Link key={a.id} href={`/architects/${a.id}`} className="flex justify-between items-center py-3 border-b border-outline-variant dark:border-outline last:border-0 hover:bg-surface-container-low dark:hover:bg-tertiary-container px-2 -mx-2 rounded-lg transition-colors">
                  <div>
                    <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{a.name}</span>
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant ml-2">{a.location}</span>
                    {a.verificationStatus === 'VERIFIED' && (
                      <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[16px] ml-1 align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    )}
                  </div>
                  <StarRating value={a.rating} readOnly size="text-[16px]" />
                </Link>
              ))}
            </Section>
          )}

          {results.projects.length > 0 && (
            <Section title="Projects">
              {results.projects.map((p) => (
                <Link key={p.id} href="/projects" className="flex justify-between items-center py-3 border-b border-outline-variant dark:border-outline last:border-0 hover:bg-surface-container-low dark:hover:bg-tertiary-container px-2 -mx-2 rounded-lg transition-colors">
                  <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</span>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.status}{p.location ? ` · ${p.location}` : ''}</span>
                </Link>
              ))}
            </Section>
          )}

          {results.articles.length > 0 && (
            <Section title="Articles">
              {results.articles.map((a) => (
                <Link key={a.id} href={`/blog/${a.slug}`} className="flex justify-between items-center py-3 border-b border-outline-variant dark:border-outline last:border-0 hover:bg-surface-container-low dark:hover:bg-tertiary-container px-2 -mx-2 rounded-lg transition-colors">
                  <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{a.title}</span>
                  <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{a.category}</span>
                </Link>
              ))}
            </Section>
          )}

          {q && total === 0 && (
            <div className="text-center py-16 text-on-surface-variant dark:text-surface-variant">No results for “{q}”.</div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-label-md uppercase tracking-wider text-on-surface-variant dark:text-surface-variant mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
