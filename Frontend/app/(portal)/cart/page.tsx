'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { toast } from 'sonner';

type CartItem = { id: string; productId: string; quantity: number; name: string; price: number; unit: string };

type PaymentMethodType = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD' | 'BANK_TRANSFER';

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('MTN_MOMO');
  const [payerPhone, setPayerPhone] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState<{ orderId: string } | null>(null);

  async function loadCart() {
    const session = await getSession();
    if (!session) {
      router.push('/login');
      return;
    }
    const res = await fetch('/api/cart');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCart();
  }, []);

  async function updateQty(id: string, quantity: number) {
    const res = await fetch('/api/cart', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity }),
    });
    const data = await res.json();
    if (res.ok) setItems(data.items ?? []);
    else toast.error(data.error ?? 'Could not update cart');
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/cart?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setItems(data.items ?? []);
      toast.success('Item removed');
    }
  }

  async function checkout() {
    setCheckingOut(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          paymentDetails: {
            phoneNumber: payerPhone,
          },
        }),
      });
      const data = await res.json();
      setCheckingOut(false);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (data.success) {
        toast.success(`Escrow Protected Order ${data.orderId} created!`);
        setItems([]);
        setCheckoutSuccess({ orderId: data.orderId });
      } else {
        toast.error(data.error ?? 'Checkout failed');
      }
    } catch {
      setCheckingOut(false);
      toast.error('Network error during checkout');
    }
  }

  const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  if (checkoutSuccess) {
    return (
      <div className="max-w-2xl mx-auto p-margin-mobile md:p-margin-desktop py-12">
        <div className="bg-white dark:bg-surface-container border border-emerald-500/30 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>
          <h2 className="text-headline-md font-bold text-on-background dark:text-surface-container-lowest mb-2">
            Payment Escrow Secured!
          </h2>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-6">
            Order <span className="font-mono font-bold text-primary">{checkoutSuccess.orderId}</span> has been created.
            Your payment is held safely in BuildSmart Escrow. Funds will only be released to the vendor after you receive and inspect your items.
          </p>

          <div className="bg-surface-container-low dark:bg-tertiary-container/30 border border-outline-variant dark:border-outline rounded-xl p-4 text-left mb-6 text-body-sm text-on-surface-variant dark:text-surface-variant space-y-2">
            <div className="flex items-center gap-2 font-semibold text-on-background dark:text-surface-container-lowest">
              <span className="material-symbols-outlined text-emerald-500 text-sm">lock</span>
              What happens next?
            </div>
            <p>1. The vendor prepares and delivers your construction materials.</p>
            <p>2. Once delivered, you will receive a notification and a 72-hour inspection window begins.</p>
            <p>3. Inspect the materials and click &ldquo;Confirm Delivery&rdquo; to release payment, or file a dispute if anything is wrong.</p>
          </div>

          <div className="flex justify-center gap-3">
            <Link
              href="/client/orders"
              className="btn-primary px-6 py-3 rounded-lg text-label-md font-semibold inline-flex items-center gap-2 shadow-md"
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Track Escrow & Orders
            </Link>
            <Link
              href="/marketplace-portal"
              className="px-6 py-3 rounded-lg text-label-md border border-outline-variant dark:border-outline text-on-background dark:text-surface-container-lowest hover:bg-surface-container-low transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-margin-mobile md:p-margin-desktop py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-headline-lg font-bold text-on-background dark:text-surface-container-lowest">Your Cart</h1>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">
            BuildSmart Marketplace Secure Checkout
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
          <span className="material-symbols-outlined text-sm">security</span>
          100% Escrow Protection
        </div>
      </div>

      {loading && <div className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</div>}

      {!loading && items.length === 0 && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-8 shadow-elevation text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant dark:text-surface-variant mb-2">shopping_cart</span>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-4">
            Your cart is empty.
          </p>
          <Link href="/marketplace-portal" className="btn-primary px-6 py-2.5 rounded-lg text-label-md inline-block">
            Browse Marketplace
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-5 shadow-elevation">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest">{item.name}</div>
                      <div className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-1">
                        {item.price.toLocaleString()} XAF / {item.unit}
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-on-surface-variant dark:text-surface-variant hover:text-error dark:hover:text-error-container transition-colors" aria-label="Remove item">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-8 h-8 rounded-lg border border-outline-variant dark:border-outline flex items-center justify-center hover:bg-surface-container-low dark:hover:bg-tertiary-container text-on-background dark:text-surface-container-lowest" aria-label="Decrease quantity">−</button>
                      <span className="w-10 text-center font-mono-technical text-on-background dark:text-surface-container-lowest">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-8 h-8 rounded-lg border border-outline-variant dark:border-outline flex items-center justify-center hover:bg-surface-container-low dark:hover:bg-tertiary-container text-on-background dark:text-surface-container-lowest" aria-label="Increase quantity">+</button>
                    </div>
                    <div className="font-mono-technical text-lg font-semibold text-on-background dark:text-surface-container-lowest">
                      {((item.price || 0) * (item.quantity || 1)).toLocaleString()} XAF
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Escrow Guarantee Trust Banner */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-primary/5 to-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">verified_user</span>
                </div>
                <div>
                  <h3 className="text-label-md font-bold text-on-background dark:text-surface-container-lowest">
                    BuildSmart Escrow Buyer Guarantee
                  </h3>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">
                    Your money is held safely in escrow. The vendor is never paid until you confirm that you have received your order in satisfactory condition. If there is a delivery or quality issue, our mediation team will issue a refund.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout & Payment Summary */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation space-y-6">
              <h2 className="text-label-lg font-bold text-on-background dark:text-surface-container-lowest">Order Summary</h2>

              <div className="space-y-2 text-body-sm text-on-surface-variant dark:text-surface-variant">
                <div className="flex justify-between">
                  <span>Subtotal ({count} item{count === 1 ? '' : 's'})</span>
                  <span className="font-mono-technical font-semibold text-on-background dark:text-surface-container-lowest">{total.toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span>Escrow Protection Fee</span>
                  <span className="text-emerald-600 font-semibold">FREE</span>
                </div>
                <div className="border-t border-outline-variant dark:border-outline pt-3 flex justify-between items-baseline">
                  <span className="text-body-md font-bold text-on-background dark:text-surface-container-lowest">Total</span>
                  <span className="text-headline-md font-bold text-primary dark:text-inverse-primary font-mono-technical">{total.toLocaleString()} XAF</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="border-t border-outline-variant dark:border-outline pt-4">
                <label className="block text-label-sm font-semibold text-on-background dark:text-surface-container-lowest mb-3">
                  Select Escrow Payment Method
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === 'MTN_MOMO'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="MTN_MOMO"
                      checked={paymentMethod === 'MTN_MOMO'}
                      onChange={() => setPaymentMethod('MTN_MOMO')}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <div className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">MTN Mobile Money</div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">Direct push prompt to your phone</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === 'ORANGE_MONEY'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="ORANGE_MONEY"
                      checked={paymentMethod === 'ORANGE_MONEY'}
                      onChange={() => setPaymentMethod('ORANGE_MONEY')}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <div className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Orange Money</div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">OM instant escrow authorization</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === 'CARD'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="CARD"
                      checked={paymentMethod === 'CARD'}
                      onChange={() => setPaymentMethod('CARD')}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <div className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Credit / Debit Card</div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">Visa & Mastercard secured</div>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="BANK_TRANSFER"
                      checked={paymentMethod === 'BANK_TRANSFER'}
                      onChange={() => setPaymentMethod('BANK_TRANSFER')}
                      className="accent-primary"
                    />
                    <div className="flex-1">
                      <div className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">Bank Wire Transfer</div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">Commercial bank escrow invoice</div>
                    </div>
                  </label>
                </div>

                {(paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY') && (
                  <div className="mt-3">
                    <label className="block text-body-xs text-on-surface-variant dark:text-surface-variant mb-1">
                      {paymentMethod === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'} Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +237 670 00 00 00"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-body-sm border border-outline-variant dark:border-outline rounded-lg bg-surface-container-lowest dark:bg-surface-container text-on-background dark:text-surface-container-lowest focus:outline-none focus:border-primary"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={checkout}
                disabled={checkingOut}
                className="w-full btn-primary py-3 rounded-xl text-label-md font-bold disabled:opacity-60 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <span className="material-symbols-outlined text-lg">lock</span>
                {checkingOut ? 'Securing Escrow Payment…' : `Pay & Escrow ${total.toLocaleString()} XAF`}
              </button>

              <div className="flex items-center justify-center gap-2 text-body-xs text-on-surface-variant dark:text-surface-variant">
                <span className="material-symbols-outlined text-emerald-500 text-xs">shield</span>
                <span>Protected by 256-bit SSL & BuildSmart Escrow</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
