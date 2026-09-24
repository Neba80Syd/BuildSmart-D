import Link from 'next/link';
import { dbClient } from '@/Backend/lib/db';
import { AddToCartButton } from '@/Frontend/components/cart/AddToCartButton';

// BOQ line items (mirrors the Material Estimation module) with keyword→category mapping.
const REQUIREMENTS = [
  { item: '1.1', description: 'Structural Steel (W-Shapes, Grade 50)', category: 'Steel', quantity: 45200, unit: 'lbs' },
  { item: '1.2', description: 'Reinforced Concrete (4000 PSI)', category: 'Concrete', quantity: 320, unit: 'cu yd' },
  { item: '2.1', description: 'Portland Cement (Type I/II)', category: 'Cement', quantity: 150, unit: 'bags' },
  { item: '2.2', description: 'Ceramic Tiles (600x600mm)', category: 'Tiles', quantity: 4500, unit: 'sq ft' },
];

export default async function SourcingPage() {
  const products: any[] = await dbClient.product.findMany();

  const matches = REQUIREMENTS.map((req) => ({
    ...req,
    products: products.filter((p) => p.category === req.category),
  }));

  return (
    <div className="max-w-5xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">AI → Marketplace Sourcing</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
          Your material estimate, matched to verified marketplace products. Select vendors and add to cart.
        </p>
      </div>

      <div className="space-y-6">
        {matches.map((m) => (
          <div key={m.item} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden shadow-elevation">
            <div className="p-5 bg-surface-container-low dark:bg-tertiary-container border-b border-outline-variant dark:border-outline flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono-technical text-primary dark:text-primary-fixed mr-2">{m.item}</span>
                <span className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{m.description}</span>
              </div>
              <div className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                Required: <strong className="text-on-background dark:text-surface-container-lowest">{m.quantity.toLocaleString()} {m.unit}</strong>
              </div>
            </div>
            <div className="divide-y divide-outline-variant dark:divide-outline">
              {m.products.length === 0 ? (
                <p className="p-5 text-body-sm text-on-surface-variant dark:text-surface-variant">No matching products in this category yet.</p>
              ) : (
                m.products.map((p) => (
                  <div key={p.id} className="p-4 flex flex-wrap items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-surface-variant dark:bg-tertiary-container flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</div>
                      <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.stock.toLocaleString()} in stock</div>
                    </div>
                    <div className="text-body-md font-mono-technical text-on-background dark:text-surface-container-lowest w-28 text-right">
                      {p.price.toLocaleString()} XAF<span className="text-label-md text-on-surface-variant dark:text-surface-variant"> / {p.unit}</span>
                    </div>
                    <div className="w-36">
                      <AddToCartButton productId={p.id} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-4">
        <Link href="/cart" className="btn-primary px-6 py-2.5 rounded-lg text-label-md inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">shopping_cart</span> View Cart
        </Link>
        <Link href="/estimation" className="btn-secondary px-6 py-2.5 rounded-lg text-label-md inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">request_quote</span> Back to BOQ
        </Link>
      </div>
    </div>
  );
}
