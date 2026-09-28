'use client';

import Link from 'next/link';
import { PageHeader, btnGhost } from '@/Frontend/components/architect/ui';
import { MarketplaceCatalog } from '@/Frontend/components/marketplace/MarketplaceCatalog';

export default function ClientMarketplacePage() {
  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader
        title="Marketplace"
        subtitle="Purchase certified construction materials with categories and 100% escrow protection."
        crumbs={['Client', 'Materials', 'Marketplace']}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/client/orders" className={btnGhost}>
              View Orders
            </Link>
            <Link
              href="/client/cart"
              className="btn-primary px-4 py-2 rounded-xl text-label-sm font-semibold inline-flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
              My Cart
            </Link>
          </div>
        }
      />

      <MarketplaceCatalog />
    </div>
  );
}
