'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { toast } from 'sonner';

type CartItem = { id: string; productId: string; quantity: number; name: string; price: number; unit: string };

type PaymentMethodType = 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CAMPAY';

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CAMPAY');
  const [payerPhone, setPayerPhone] = useState('');
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    orderId: string;
    paymentReference?: string;
    providerReference?: string;
    redirectUrl?: string;
    instructions?: string;
    ussdCode?: string;
    operator?: string;
  } | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function loadCart() {
    try {
      const res = await fetch('/api/cart');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setItems(data.items || []);
      const count = typeof data.cartCount === 'number'
        ? data.cartCount
        : (data.items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
      window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: count } }));
    } catch {
      toast.error('Could not load cart');
    } finally {
      setLoading(false);
    }
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
    if (res.ok) {
      setItems(data.items ?? []);
      const count = typeof data.cartCount === 'number'
        ? data.cartCount
        : (data.items ?? []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
      window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: count } }));
    } else {
      toast.error(data.error ?? 'Could not update cart');
    }
  }

  async function removeItem(id: string) {
    const res = await fetch(`/api/cart?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setItems(data.items ?? []);
      const count = typeof data.cartCount === 'number'
        ? data.cartCount
        : (data.items ?? []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
      window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: count } }));
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
        window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: 0 } }));
        window.dispatchEvent(new Event('buildsmart:notifications-updated'));
        setCheckoutSuccess({
          orderId: data.orderId,
          paymentReference: data.paymentReference,
          providerReference: data.providerReference,
          redirectUrl: data.redirectUrl,
          instructions: data.instructions,
          ussdCode: data.ussdCode,
          operator: data.operator,
        });
      } else {
        toast.error(data.error ?? 'Checkout failed');
      }
    } catch {
      setCheckingOut(false);
      toast.error('Network error during checkout');
    }
  }

  async function checkPaymentStatus() {
    const targetRef = checkoutSuccess?.providerReference || checkoutSuccess?.paymentReference;
    if (!targetRef) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/payment/verify?reference=${encodeURIComponent(targetRef)}`);
      const data = await res.json();
      if (data.verified || data.status === 'SUCCESS') {
        setPaymentVerified(true);
        toast.success('Payment verified via Campay! Escrow is secured.');
      } else if (data.status === 'FAILED') {
        toast.error('Payment authorization failed on phone.');
      } else {
        toast.info('Payment is still pending on your phone. Please authorize prompt.');
      }
    } catch {
      toast.error('Could not check payment status');
    } finally {
      setIsVerifying(false);
    }
  }

  // Automatic real-time status polling for Campay USSD prompts
  useEffect(() => {
    if (!checkoutSuccess || paymentVerified) return;
    const ref = checkoutSuccess.providerReference || checkoutSuccess.paymentReference;
    if (!ref) return;

    const interval = setInterval(() => {
      fetch(`/api/payment/verify?reference=${encodeURIComponent(ref)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.verified || data.status === 'SUCCESS') {
            setPaymentVerified(true);
            toast.success('Campay confirmed your payment! Escrow secured.');
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 4000);

    const timeout = setTimeout(() => clearInterval(interval), 120000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [checkoutSuccess, paymentVerified]);

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

          {/* Campay Hosted Link Card */}
          {checkoutSuccess.redirectUrl && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 text-left mb-6">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 mb-1">
                <span className="material-symbols-outlined text-amber-600">credit_card</span>
                <span>Campay Secure Gateway Checkout</span>
              </div>
              <p className="text-body-sm text-amber-700 dark:text-amber-300/80 mb-3">
                {checkoutSuccess.instructions || 'Click below to complete payment via Campay portal using MTN MoMo, Orange Money, or Credit Card.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={checkoutSuccess.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-label-sm font-semibold shadow-sm"
                >
                  <span>Open Campay Payment Page</span>
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
                <button
                  type="button"
                  onClick={() => checkPaymentStatus()}
                  disabled={isVerifying || paymentVerified}
                  className="px-4 py-2 rounded-lg text-label-sm border border-amber-400/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 transition-colors font-semibold"
                >
                  {isVerifying ? 'Checking...' : paymentVerified ? 'Verified ✓' : 'I Paid / Check Status'}
                </button>
              </div>
            </div>
          )}

          {/* Campay Mobile Money USSD Prompt Card */}
          {(checkoutSuccess.ussdCode || checkoutSuccess.instructions) && !checkoutSuccess.redirectUrl && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-500/30 rounded-xl p-4 text-left mb-6">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                  <span className="material-symbols-outlined text-blue-600">phone_android</span>
                  <span>Mobile Money USSD Authorization</span>
                </div>
                {checkoutSuccess.operator && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                    {checkoutSuccess.operator}
                  </span>
                )}
              </div>
              <p className="text-body-sm text-blue-800 dark:text-blue-300/90 mb-3 leading-relaxed">
                {checkoutSuccess.instructions}
              </p>
              {checkoutSuccess.ussdCode && (
                <div className="bg-white/80 dark:bg-slate-900/80 rounded-lg p-2.5 font-mono text-center text-sm font-bold text-slate-800 dark:text-slate-100 border border-blue-200 dark:border-blue-900 mb-3">
                  Dial Code on Phone: <span className="text-primary">{checkoutSuccess.ussdCode}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-blue-200 dark:border-blue-900/60">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                  <span className={`w-2.5 h-2.5 rounded-full ${paymentVerified ? 'bg-emerald-500' : 'bg-blue-500 animate-ping'}`} />
                  <span>{paymentVerified ? 'Payment Verified by Campay!' : 'Listening for phone PIN authorization...'}</span>
                </div>
                <button
                  type="button"
                  disabled={isVerifying || paymentVerified}
                  onClick={() => checkPaymentStatus()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isVerifying ? 'Checking...' : paymentVerified ? 'Verified ✓' : 'Check Status'}
                </button>
              </div>
            </div>
          )}

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
              href="/client"
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
          <Link href="/client" className="btn-primary px-6 py-2.5 rounded-lg text-label-md inline-block">
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

              <div className="space-y-3 text-body-sm text-on-surface-variant dark:text-surface-variant">
                <div className="flex justify-between">
                  <span>Subtotal ({count} item{count === 1 ? '' : 's'})</span>
                  <span className="font-mono-technical font-semibold text-on-background dark:text-surface-container-lowest">{total.toLocaleString()} XAF</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    <span>Escrow Buyer Guarantee</span>
                    <span className="material-symbols-outlined text-emerald-500 text-xs" title="100% money-back escrow until you confirm delivery">verified</span>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20">FREE</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="text-on-surface-variant dark:text-surface-variant text-xs">Calculated at Checkout</span>
                </div>
                <div className="border-t border-outline-variant dark:border-outline pt-3 flex justify-between items-baseline">
                  <span className="text-body-md font-bold text-on-background dark:text-surface-container-lowest">Estimated Total</span>
                  <span className="text-headline-md font-bold text-primary dark:text-inverse-primary font-mono-technical">{total.toLocaleString()} XAF</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  href="/checkout"
                  className="w-full btn-primary py-3.5 rounded-xl text-label-md font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                >
                  <span className="material-symbols-outlined text-lg">shopping_cart_checkout</span>
                  <span>Proceed to Checkout</span>
                </Link>

                <Link
                  href="/client"
                  className="w-full py-2.5 rounded-xl text-label-sm font-semibold border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:text-on-background dark:hover:text-surface-container-lowest hover:bg-surface-container-low dark:hover:bg-tertiary-container flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>Continue Shopping</span>
                </Link>
              </div>

              <div className="pt-2 border-t border-outline-variant/60 dark:border-outline/40">
                <div className="flex items-center justify-center gap-2 text-body-xs text-on-surface-variant dark:text-surface-variant">
                  <span className="material-symbols-outlined text-emerald-500 text-xs">shield</span>
                  <span>Secured by BuildSmart Vendor Escrow Protection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
