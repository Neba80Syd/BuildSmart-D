'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { toast } from 'sonner';

export function AddToCartButton({ productId, quantity = 1 }: { productId: string; quantity?: number }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true);
    try {
      const session = await getSession();
      if (!session) {
        toast.info('Please sign in to add items to your cart');
        router.push('/login');
        return;
      }
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await res.json();
      if (res.status === 401) {
        toast.info('Please sign in to add items to your cart');
        router.push('/login');
      } else if (res.ok) {
        toast.success('Added to cart');
      } else {
        toast.error(data.error ?? 'Could not add to cart');
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <button onClick={add} disabled={adding} className="btn-secondary w-full py-2 rounded-lg text-label-md flex justify-center items-center gap-2 disabled:opacity-60">
      <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
      {adding ? 'Adding…' : 'Add to Cart'}
    </button>
  );
}
