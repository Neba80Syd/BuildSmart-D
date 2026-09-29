'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  name: string;
  price: number;
  unit: string;
  category?: string;
  imageUrl?: string;
  vendorId?: string;
};

type PaymentMethodType = 'CAMPAY' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'CARD' | 'BANK_TRANSFER';
type ShippingMethodType = 'FREE' | 'EXPRESS';

export default function CheckoutPage() {
  const router = useRouter();

  // Cart state
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  // Shipping Address Form
  const [firstName, setFirstName] = useState('Divyansh');
  const [lastName, setLastName] = useState('Agarwal');
  const [email, setEmail] = useState('divyansh@buildsmart.ai');
  const [countryCode, setCountryCode] = useState('+237');
  const [phone, setPhone] = useState('691234567');
  const [city, setCity] = useState('Douala');
  const [state, setState] = useState('Littoral');
  const [zipCode, setZipCode] = useState('560021');
  const [description, setDescription] = useState('');

  // Shipping Method
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodType>('FREE');

  // Payment Method to Escrow
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CAMPAY');
  const [payerPhone, setPayerPhone] = useState('');

  // Coupon / Discount state
  const [couponInput, setCouponInput] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: string;
    value: number;
    discount: number;
    isFreeShipping: boolean;
    summary: string;
  } | null>(null);
  const [couponError, setCouponError] = useState('');

  // Post-checkout state
  const [checkoutSuccess, setCheckoutSuccess] = useState<{
    orderId: string;
    total: number;
    paymentReference?: string;
    providerReference?: string;
    redirectUrl?: string;
    instructions?: string;
    ussdCode?: string;
    operator?: string;
  } | null>(null);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Load user profile & cart
  async function loadInitialData() {
    try {
      const res = await fetch('/api/cart');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      const cartItems: CartItem[] = data.items || [];
      setItems(cartItems);

      // Pre-fill phone if available
      if (cartItems.length > 0) {
        // Also fetch user session info if available
        fetch('/api/profile')
          .then((r) => r.json())
          .then((profileData) => {
            if (profileData?.user?.name) {
              const parts = profileData.user.name.split(' ');
              if (parts[0]) setFirstName(parts[0]);
              if (parts.length > 1) setLastName(parts.slice(1).join(' '));
            }
            if (profileData?.user?.email) setEmail(profileData.user.email);
            if (profileData?.user?.phone) {
              setPhone(profileData.user.phone);
              setPayerPhone(profileData.user.phone);
            }
          })
          .catch(() => {});
      }
    } catch {
      toast.error('Failed to load cart items for checkout');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  // Sync phone for mobile money
  useEffect(() => {
    if (!payerPhone && phone) {
      setPayerPhone(phone);
    }
  }, [phone, payerPhone]);

  // Apply Coupon Code
  async function handleApplyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setValidatingCoupon(true);
    setCouponError('');

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, items }),
      });
      const data = await res.json();

      if (data.valid) {
        setAppliedCoupon({
          code: data.coupon.code,
          type: data.coupon.type,
          value: data.coupon.value,
          discount: data.discount || 0,
          isFreeShipping: Boolean(data.isFreeShipping),
          summary: data.summary,
        });
        toast.success(data.message || `Coupon ${data.coupon.code} applied!`);
        setCouponInput('');
      } else {
        setCouponError(data.error || 'Invalid coupon code');
        toast.error(data.error || 'Invalid coupon code');
      }
    } catch {
      setCouponError('Network error while validating coupon');
      toast.error('Failed to validate coupon code');
    } finally {
      setValidatingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError('');
    toast.info('Coupon removed');
  }

  // Calculate pricing
  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  const count = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const baseShippingFee = shippingMethod === 'EXPRESS' ? 5000 : 0;
  const isFreeShippingApplied = appliedCoupon?.isFreeShipping === true;
  const actualShippingFee = isFreeShippingApplied ? 0 : baseShippingFee;

  let calculatedDiscount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'PERCENT') {
      calculatedDiscount = Math.round(subtotal * (appliedCoupon.value / 100));
    } else if (appliedCoupon.type === 'FIXED') {
      calculatedDiscount = Math.min(subtotal, appliedCoupon.value);
    } else if (appliedCoupon.type === 'FREE_SHIPPING') {
      calculatedDiscount = baseShippingFee;
    }
  }

  const estimatedTaxes = 0; // Tax included or 0 XAF platform fee
  const finalTotal = Math.max(0, subtotal - calculatedDiscount + actualShippingFee + estimatedTaxes);

  // Submit Order & Escrow Locking
  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please enter first and last name');
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!city.trim() || !state.trim()) {
      toast.error('Please provide city and state');
      return;
    }

    setCheckingOut(true);

    try {
      const fullPhone = phone.startsWith('+') ? phone : `${countryCode} ${phone}`;
      const effectivePaymentPhone = payerPhone || fullPhone;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          clientPhone: effectivePaymentPhone,
          paymentDetails: {
            phoneNumber: effectivePaymentPhone,
          },
          shippingMethod,
          couponCode: appliedCoupon?.code ?? null,
          shippingAddress: {
            firstName,
            lastName,
            email,
            phone: fullPhone,
            city,
            state,
            zipCode,
            description,
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
        toast.success(`Escrow Protected Order #${data.orderId} created!`);
        setItems([]);
        window.dispatchEvent(new CustomEvent('buildsmart:cart-updated', { detail: { cartCount: 0 } }));
        window.dispatchEvent(new Event('buildsmart:notifications-updated'));

        setCheckoutSuccess({
          orderId: data.orderId,
          total: data.total,
          paymentReference: data.paymentReference,
          providerReference: data.providerReference,
          redirectUrl: data.redirectUrl,
          instructions: data.instructions,
          ussdCode: data.ussdCode,
          operator: data.operator,
        });
      } else {
        toast.error(data.error ?? 'Failed to place order');
      }
    } catch {
      setCheckingOut(false);
      toast.error('Network error during checkout');
    }
  }

  // Campay status check
  async function checkPaymentStatus() {
    const targetRef = checkoutSuccess?.providerReference || checkoutSuccess?.paymentReference;
    if (!targetRef) return;
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/payment/verify?reference=${encodeURIComponent(targetRef)}`);
      const data = await res.json();
      if (data.verified || data.status === 'SUCCESS') {
        setPaymentVerified(true);
        toast.success('Payment verified! Funds locked safely into Vendor Escrow.');
      } else if (data.status === 'FAILED') {
        toast.error('Payment authorization failed on phone.');
      } else {
        toast.info('Payment is pending authorization on your phone.');
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
            toast.success('Payment confirmed by Campay! Vendor escrow balance secured.');
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

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 text-body-md text-on-surface-variant dark:text-surface-variant">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          <span>Loading secure checkout...</span>
        </div>
      </div>
    );
  }

  // Success view
  if (checkoutSuccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white dark:bg-surface-container border border-emerald-500/30 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>

          <h1 className="text-headline-md font-bold text-on-background dark:text-surface-container-lowest mb-2">
            Payment Secured in Vendor Escrow!
          </h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-6 max-w-xl mx-auto">
            Order <span className="font-mono font-bold text-primary">{checkoutSuccess.orderId}</span> for{' '}
            <span className="font-bold text-on-background dark:text-surface-container-lowest">
              {checkoutSuccess.total.toLocaleString()} XAF
            </span>{' '}
            is confirmed. Funds are now held in the vendor&apos;s escrow wallet and will only be released after you inspect and accept your delivery.
          </p>

          {/* Campay Hosted Payment Link */}
          {checkoutSuccess.redirectUrl && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 rounded-xl p-5 text-left mb-6">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 mb-1">
                <span className="material-symbols-outlined text-amber-600">credit_card</span>
                <span>Campay Secure Gateway Checkout</span>
              </div>
              <p className="text-body-sm text-amber-700 dark:text-amber-300/80 mb-3">
                {checkoutSuccess.instructions || 'Click below to finalize payment via Campay using MTN MoMo, Orange Money, or Credit Card.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={checkoutSuccess.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-label-sm font-semibold shadow-sm"
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

          {/* USSD Dial Prompt for Mobile Money */}
          {(checkoutSuccess.ussdCode || checkoutSuccess.instructions) && !checkoutSuccess.redirectUrl && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-500/30 rounded-xl p-5 text-left mb-6">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-200">
                  <span className="material-symbols-outlined text-blue-600">phone_android</span>
                  <span>Mobile Money Authorization Prompt</span>
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
                <div className="bg-white/90 dark:bg-slate-900/90 rounded-lg p-2.5 font-mono text-center text-base font-bold text-slate-800 dark:text-slate-100 border border-blue-200 dark:border-blue-900 mb-3">
                  Dial Code on Phone: <span className="text-primary">{checkoutSuccess.ussdCode}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-blue-200 dark:border-blue-900/60">
                <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                  <span className={`w-2.5 h-2.5 rounded-full ${paymentVerified ? 'bg-emerald-500' : 'bg-blue-500 animate-ping'}`} />
                  <span>{paymentVerified ? 'Payment Verified by Campay!' : 'Listening for phone PIN authorization...'}</span>
                </div>
                <button
                  type="button"
                  disabled={isVerifying || paymentVerified}
                  onClick={() => checkPaymentStatus()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                >
                  {isVerifying ? 'Checking...' : paymentVerified ? 'Verified ✓' : 'Check Status'}
                </button>
              </div>
            </div>
          )}

          {/* What happens next escrow banner */}
          <div className="bg-surface-container-low dark:bg-tertiary-container/30 border border-outline-variant dark:border-outline rounded-xl p-5 text-left mb-6 text-body-sm text-on-surface-variant dark:text-surface-variant space-y-2">
            <div className="flex items-center gap-2 font-semibold text-on-background dark:text-surface-container-lowest">
              <span className="material-symbols-outlined text-emerald-500 text-sm">lock</span>
              <span>How BuildSmart Escrow Works:</span>
            </div>
            <p>1. The vendor sees the payment safely secured in their escrow wallet and dispatches materials.</p>
            <p>2. Upon delivery, you receive a notification to inspect materials within a 72-hour window.</p>
            <p>3. If everything is in good order, confirm receipt to release funds, or request mediation/refund if there are discrepancies.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/client/orders"
              className="btn-primary px-6 py-3 rounded-xl text-label-md font-semibold inline-flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              <span>Track Orders &amp; Escrow</span>
            </Link>
            <Link
              href="/client"
              className="px-6 py-3 rounded-xl text-label-md border border-outline-variant dark:border-outline text-on-background dark:text-surface-container-lowest hover:bg-surface-container-low transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty cart view
  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 bg-surface-container-low dark:bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 border border-outline-variant dark:border-outline">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant dark:text-surface-variant">shopping_cart</span>
        </div>
        <h1 className="text-headline-md font-bold text-on-background dark:text-surface-container-lowest mb-2">Your Cart is Empty</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant mb-6">
          Add construction materials or tools from the marketplace before proceeding to checkout.
        </p>
        <Link href="/client" className="btn-primary px-6 py-3 rounded-xl text-label-md font-semibold inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">storefront</span>
          <span>Browse Marketplace</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-label-sm text-on-surface-variant dark:text-surface-variant mb-6">
        <Link href="/cart" className="hover:text-primary transition-colors flex items-center gap-1">
          <span>Cart</span>
        </Link>
        <span className="text-outline-variant dark:text-outline font-medium">›</span>
        <span className="font-semibold text-on-background dark:text-surface-container-lowest">Shipping &amp; Checkout</span>
        <span className="text-outline-variant dark:text-outline font-medium">›</span>
        <span className="text-on-surface-variant/50">Payment Escrow</span>
      </nav>

      {/* Main 2-Column Checkout Layout matching the reference image */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Shipping Address + Shipping Method + Payment Method (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-8">
            {/* 1. Shipping Address Section */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant/80 dark:border-outline/50 rounded-2xl p-6 sm:p-7 shadow-xs">
              <h2 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest mb-5">
                Shipping Address
              </h2>

              <div className="space-y-4">
                {/* First Name & Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      First Name<span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Divyansh"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      Last Name<span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Agarwal"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Email & Phone Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      Email<span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="divyansh@buildsmart.ai"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      Phone number<span className="text-error">*</span>
                    </label>
                    <div className="flex items-center rounded-xl border border-outline-variant dark:border-outline overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                      <select
                        aria-label="Country Code"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="bg-surface-container-low dark:bg-surface-container-high px-2.5 py-2.5 text-body-xs font-medium text-on-background dark:text-surface-container-lowest border-r border-outline-variant dark:border-outline focus:outline-none cursor-pointer"
                      >
                        <option value="+237">CMR +237</option>
                        <option value="+91">IND +91</option>
                        <option value="+1">USA +1</option>
                        <option value="+33">FRA +33</option>
                        <option value="+44">GBR +44</option>
                        <option value="+234">NGA +234</option>
                      </select>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="691234567"
                        className="w-full px-3 py-2.5 text-body-sm bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* City, State, Zip Code */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      City<span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Douala"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      State<span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="Littoral"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                      Zip Code<span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="560021"
                      className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                  </div>
                </div>

                {/* Description / Instructions */}
                <div>
                  <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                    Description / Delivery Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter site access details, delivery contact, or instructions..."
                    className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Shipping Method Section */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant/80 dark:border-outline/50 rounded-2xl p-6 sm:p-7 shadow-xs">
              <h2 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest mb-5">
                Shipping Method
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Free Shipping Card */}
                <label
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    shippingMethod === 'FREE'
                      ? 'border-neutral-900 dark:border-white bg-neutral-50/50 dark:bg-white/5 ring-1 ring-neutral-900/10 dark:ring-white/10'
                      : 'border-outline-variant dark:border-outline hover:border-neutral-400 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="FREE"
                      checked={shippingMethod === 'FREE'}
                      onChange={() => setShippingMethod('FREE')}
                      className="accent-neutral-900 dark:accent-white w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">
                        Free Shipping
                      </div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">
                        7-20 Days
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-technical font-semibold text-body-sm text-on-background dark:text-surface-container-lowest">
                    $0
                  </div>
                </label>

                {/* Express Shipping Card */}
                <label
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    shippingMethod === 'EXPRESS'
                      ? 'border-neutral-900 dark:border-white bg-neutral-50/50 dark:bg-white/5 ring-1 ring-neutral-900/10 dark:ring-white/10'
                      : 'border-outline-variant dark:border-outline hover:border-neutral-400 dark:hover:border-neutral-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="EXPRESS"
                      checked={shippingMethod === 'EXPRESS'}
                      onChange={() => setShippingMethod('EXPRESS')}
                      className="accent-neutral-900 dark:accent-white w-4 h-4 cursor-pointer"
                    />
                    <div>
                      <div className="text-body-sm font-semibold text-on-background dark:text-surface-container-lowest">
                        Express Shipping
                      </div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">
                        1-3 Days
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-technical font-semibold text-body-sm text-on-background dark:text-surface-container-lowest">
                    {isFreeShippingApplied ? (
                      <span className="text-emerald-600">FREE</span>
                    ) : (
                      '5,000 XAF ($9)'
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* 3. Escrow Payment Methods (Payment directly into Vendor's Escrow Wallet) */}
            <div className="bg-white dark:bg-surface-container border border-outline-variant/80 dark:border-outline/50 rounded-2xl p-6 sm:p-7 shadow-xs">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest">
                    Payment Method
                  </h2>
                  <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-1">
                    Select a payment option. Funds are secured directly into the vendor&apos;s escrow wallet.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold shrink-0">
                  <span className="material-symbols-outlined text-sm">shield</span>
                  <span>Escrow Protected</span>
                </span>
              </div>

              {/* Escrow Wallet Trust Card */}
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 mb-5 flex items-center gap-3 text-body-xs text-emerald-900 dark:text-emerald-300">
                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg shrink-0">account_balance_wallet</span>
                <span>
                  <strong>Vendor Escrow Wallet Guarantee:</strong> The vendor receives payment in escrow lock, but funds are only accessible to them after you verify and confirm item delivery.
                </span>
              </div>

              <div className="space-y-3">
                {/* Campay Gateway */}
                <label
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'CAMPAY'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CAMPAY"
                    checked={paymentMethod === 'CAMPAY'}
                    onChange={() => setPaymentMethod('CAMPAY')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">
                        Campay Gateway (MoMo &amp; Cards)
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Recommended
                      </span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                      Instant mobile money (MTN / Orange) or Visa / Mastercard hosted checkout.
                    </p>
                  </div>
                </label>

                {/* MTN MoMo */}
                <label
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'MTN_MOMO'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="MTN_MOMO"
                    checked={paymentMethod === 'MTN_MOMO'}
                    onChange={() => setPaymentMethod('MTN_MOMO')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">
                        MTN Mobile Money
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        USSD Push *126#
                      </span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                      Automatic prompt pushed directly to your phone for PIN entry.
                    </p>
                  </div>
                </label>

                {/* Orange Money */}
                <label
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'ORANGE_MONEY'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="ORANGE_MONEY"
                    checked={paymentMethod === 'ORANGE_MONEY'}
                    onChange={() => setPaymentMethod('ORANGE_MONEY')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">
                        Orange Money
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        USSD Push #150*50#
                      </span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                      Prompt pushed to Orange SIM for instant approval.
                    </p>
                  </div>
                </label>

                {/* Credit / Debit Card */}
                <label
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'CARD'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={paymentMethod === 'CARD'}
                    onChange={() => setPaymentMethod('CARD')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">
                        Credit / Debit Card
                      </span>
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">credit_card</span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                      Visa and Mastercard 3D-Secure encrypted processing.
                    </p>
                  </div>
                </label>

                {/* Bank Transfer */}
                <label
                  className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="BANK_TRANSFER"
                    checked={paymentMethod === 'BANK_TRANSFER'}
                    onChange={() => setPaymentMethod('BANK_TRANSFER')}
                    className="accent-primary mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest">
                        Bank Wire Transfer
                      </span>
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">account_balance</span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant dark:text-surface-variant mt-0.5">
                      Commercial bank transfer to BuildSmart escrow trust account.
                    </p>
                  </div>
                </label>
              </div>

              {/* Dynamic Phone Input if Mobile Money selected */}
              {(paymentMethod === 'CAMPAY' || paymentMethod === 'MTN_MOMO' || paymentMethod === 'ORANGE_MONEY') && (
                <div className="mt-4 pt-4 border-t border-outline-variant/60 dark:border-outline/40">
                  <label className="block text-body-xs font-semibold text-on-surface-variant dark:text-surface-variant mb-1.5">
                    {paymentMethod === 'MTN_MOMO'
                      ? 'MTN Mobile Money Phone Number'
                      : paymentMethod === 'ORANGE_MONEY'
                      ? 'Orange Money Phone Number'
                      : 'Cameroon Mobile Money Number (Optional for Card checkout)'}
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 670 00 00 00 or +237 699 00 00 00"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-body-sm rounded-xl border border-outline-variant dark:border-outline bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: "Your Cart" Order Summary & Coupon Input Card (5 cols) */}
        <div className="lg:col-span-5 sticky top-6 space-y-6">
          <div className="bg-white dark:bg-surface-container border border-outline-variant/80 dark:border-outline/50 rounded-2xl p-6 sm:p-7 shadow-sm">
            <h2 className="text-headline-sm font-bold text-on-background dark:text-surface-container-lowest mb-5">
              Your Cart
            </h2>

            {/* Cart Items List matching Reference Image */}
            <div className="space-y-4 mb-6 max-h-[360px] overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/40 dark:border-outline/20 last:border-b-0">
                  <div className="flex items-center gap-3.5">
                    {/* Thumbnail with Quantity Badge in top-left */}
                    <div className="relative w-14 h-14 rounded-xl bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/60 dark:border-outline/40 flex items-center justify-center overflow-hidden shrink-0">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-on-surface-variant">construction</span>
                      )}
                      {/* Dark circle badge on top-left like the image */}
                      <span className="absolute -top-1 -left-1 w-5 h-5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full text-[11px] font-bold flex items-center justify-center shadow-xs">
                        {item.quantity}
                      </span>
                    </div>

                    {/* Item Details */}
                    <div>
                      <div className="text-body-sm font-bold text-on-background dark:text-surface-container-lowest line-clamp-1">
                        {item.name}
                      </div>
                      <div className="text-body-xs text-on-surface-variant dark:text-surface-variant">
                        {item.category || `${item.quantity} ${item.unit || 'unit'}`}
                      </div>
                    </div>
                  </div>

                  {/* Line Total */}
                  <div className="text-right font-mono-technical font-bold text-body-sm text-on-background dark:text-surface-container-lowest">
                    {((item.price || 0) * (item.quantity || 1)).toLocaleString()} XAF
                  </div>
                </div>
              ))}
            </div>

            {/* Discount / Coupon Code Input Box matching Reference Image */}
            <div className="mb-6">
              <div className="flex items-center rounded-xl border border-outline-variant dark:border-outline p-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all bg-transparent">
                <div className="pl-2.5 text-on-surface-variant dark:text-surface-variant flex items-center">
                  <span className="material-symbols-outlined text-lg">sell</span>
                </div>
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                  placeholder="Discount code"
                  className="w-full px-3 py-1.5 text-body-sm bg-transparent text-on-background dark:text-surface-container-lowest focus:outline-none placeholder:text-on-surface-variant/60 uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={validatingCoupon || !couponInput.trim()}
                  className="px-4 py-1.5 rounded-lg text-label-sm font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                >
                  {validatingCoupon ? 'Checking...' : 'Apply'}
                </button>
              </div>

              {/* Error Message */}
              {couponError && (
                <p className="text-body-xs text-error mt-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">error</span>
                  <span>{couponError}</span>
                </p>
              )}

              {/* Applied Coupon Pill */}
              {appliedCoupon && (
                <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-body-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600 text-sm">verified</span>
                    <span>
                      {appliedCoupon.code} ({appliedCoupon.summary})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-error dark:hover:text-error transition-colors p-0.5 rounded"
                    title="Remove coupon"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              )}
            </div>

            {/* Price Breakdown Summary */}
            <div className="space-y-3 pt-2 text-body-sm text-on-surface-variant dark:text-surface-variant border-t border-outline-variant/60 dark:border-outline/40">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono-technical font-semibold text-on-background dark:text-surface-container-lowest">
                  {subtotal.toLocaleString()} XAF
                </span>
              </div>

              {appliedCoupon && calculatedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="flex items-center gap-1">
                    <span>Coupon Discount</span>
                    <span className="text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-900/60 px-1 py-0.2 rounded">
                      {appliedCoupon.code}
                    </span>
                  </span>
                  <span className="font-mono-technical">
                    -{calculatedDiscount.toLocaleString()} XAF
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="font-mono-technical font-semibold text-on-background dark:text-surface-container-lowest">
                  {actualShippingFee === 0 ? '$0' : `${actualShippingFee.toLocaleString()} XAF ($9)`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <span>Estimated taxes / Escrow</span>
                  <span
                    className="material-symbols-outlined text-xs text-on-surface-variant/60 cursor-help"
                    title="Escrow buyer protection is 100% free of charge"
                  >
                    info
                  </span>
                </span>
                <span className="font-mono-technical font-semibold text-emerald-600 dark:text-emerald-400">
                  FREE ($0)
                </span>
              </div>

              <div className="border-t border-outline-variant/80 dark:border-outline/60 pt-4 flex justify-between items-baseline">
                <span className="text-body-md font-bold text-on-background dark:text-surface-container-lowest">
                  Total
                </span>
                <span className="text-headline-md font-bold text-neutral-900 dark:text-white font-mono-technical">
                  {finalTotal.toLocaleString()} XAF
                </span>
              </div>
            </div>

            {/* Primary Action Button matching the image "Continue to Payment" */}
            <div className="mt-6">
              <button
                type="submit"
                form="checkout-form"
                disabled={checkingOut || items.length === 0}
                className="w-full py-4 rounded-xl text-label-md font-bold bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                {checkingOut ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    <span>Securing Escrow in Vendor Wallet...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Payment</span>
                    <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-body-xs text-on-surface-variant dark:text-surface-variant">
              <span className="material-symbols-outlined text-emerald-500 text-xs">lock</span>
              <span>256-bit encrypted checkout with Vendor Escrow Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
