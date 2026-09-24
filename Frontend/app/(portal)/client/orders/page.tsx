'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSession } from 'next-auth/react';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Skeleton, btnPrimary, btnGhost, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

const DISPUTE_REASONS = [
  { id: 'PRODUCT_NOT_RECEIVED', label: 'Product Not Received' },
  { id: 'DAMAGED_PRODUCT', label: 'Damaged or Defective Goods' },
  { id: 'WRONG_PRODUCT', label: 'Wrong Product Delivered' },
  { id: 'MISSING_ITEMS', label: 'Missing Items from Package' },
  { id: 'QUANTITY_DIFFERENCE', label: 'Incorrect Quantity Received' },
  { id: 'QUALITY_ISSUE', label: 'Material Quality Not as Described' },
  { id: 'DELIVERY_PROBLEM', label: 'Delivery Problem or Extreme Delay' },
  { id: 'OTHER', label: 'Other Issue' },
];

export default function ClientOrdersPage() {
  const router = useRouter();
  const { data, loading, refetch } = useApi<{ orders: any[] }>('/api/client/orders');
  const cart = useApi<any>('/api/cart');
  const [detail, setDetail] = useState<any>(null);

  // Dispute modal state
  const [disputeTarget, setDisputeTarget] = useState<any | null>(null);
  const [disputeReason, setDisputeReason] = useState('DAMAGED_PRODUCT');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeEvidence, setDisputeEvidence] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Confirm delivery modal state
  const [confirmingOrder, setConfirmingOrder] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const act = async (id: string, action: string, extra: any = {}) => {
    try {
      await api('PATCH', '/api/client/orders', { id, action, ...extra });
      toast.success(action.replace(/_/g, ' ') + ' successful');
      setDetail(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirmingOrder) return;
    setConfirming(true);
    try {
      await api('PATCH', '/api/client/orders', { id: confirmingOrder.id, action: 'confirm_delivery' });
      toast.success('Delivery confirmed! Payment has been released to the vendor.');
      setConfirmingOrder(null);
      setDetail(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Confirmation failed');
    } finally {
      setConfirming(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!disputeTarget || !disputeDesc.trim()) {
      return toast.error('Please provide a description of the issue');
    }
    setSubmittingDispute(true);
    try {
      await api('PATCH', '/api/client/orders', {
        id: disputeTarget.id,
        action: 'open_dispute',
        reason: disputeReason,
        description: disputeDesc,
        evidence: disputeEvidence ? [disputeEvidence] : [],
      });
      toast.success('Dispute opened. Escrow release has been held pending investigation.');
      setDisputeTarget(null);
      setDisputeDesc('');
      setDisputeEvidence('');
      setDetail(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to open dispute');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const checkout = async () => {
    const session = await getSession();
    if (!session) {
      toast.info('Please sign in to place an order');
      router.push('/login');
      return;
    }
    setCheckingOut(true);
    try {
      const r = await api('POST', '/api/orders', { paymentMethod: 'MTN_MOMO' });
      toast.success(`Order #${r.orderId.slice(0, 8)} placed and payment secured in escrow!`);
      cart.refetch();
      refetch();
    } catch (e: any) {
      if (/auth/i.test(e.message ?? '')) {
        router.push('/login');
        return;
      }
      toast.error(e.message ?? 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const orders = data?.orders ?? [];
  const cartItems = cart.data?.items ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader
        title="Material Orders &amp; Escrow"
        subtitle="Track your construction material purchases protected by BuildSmart Escrow."
        crumbs={['Client', 'Materials', 'Orders']}
      />

      {cartItems.length > 0 && (
        <Card className="mb-6 border-2 border-primary/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">
                You have {cartItems.length} item(s) in your cart
              </h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
                100% Escrow Protected: Payment is only released to vendors after you confirm delivery.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/client/marketplace" className={btnGhost}>
                Continue Shopping
              </Link>
              <button className={btnPrimary} onClick={checkout} disabled={checkingOut}>
                {checkingOut ? 'Securing Escrow...' : 'Checkout with Escrow'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {orders.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="You haven't placed any material orders yet"
          body="Browse verified construction materials suppliers on the BuildSmart Marketplace."
          actionLabel="Explore Marketplace"
          onAction={() => router.push('/client/marketplace')}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const isDeliveredPending =
              o.status === 'DELIVERED' && o.escrowStatus === 'CLIENT_CONFIRMATION_PENDING';
            const isDisputed = o.escrowStatus === 'DISPUTED' || Boolean(o.dispute);
            const isReleased = o.escrowStatus === 'RELEASED';

            return (
              <Card key={o.id} className="overflow-hidden">
                {/* Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-outline-variant/60 dark:border-outline/40">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-technical font-semibold text-primary dark:text-primary-fixed-dim text-lg">
                      #{o.id.slice(0, 10).toUpperCase()}
                    </span>
                    <StatusPill status={o.status} />
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isReleased
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : isDisputed
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : isDeliveredPending
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {isReleased
                        ? 'ESCROW RELEASED'
                        : isDisputed
                        ? 'DISPUTE ON HOLD'
                        : isDeliveredPending
                        ? 'CONFIRMATION PENDING'
                        : 'PAYMENT IN ESCROW'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">
                      {fmt(o.totalAmount)} {o.currency}
                    </span>
                  </div>
                </div>

                {/* Transparency Progress Tracker */}
                <div className="py-4">
                  <div className="grid grid-cols-4 gap-2 text-center text-[12px] font-medium">
                    <div className="text-emerald-700 dark:text-emerald-400">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 mx-auto flex items-center justify-center mb-1 text-[13px] font-bold">
                        ✓
                      </div>
                      Payment Secured
                    </div>
                    <div className={['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status) ? 'text-emerald-700 dark:text-emerald-400' : 'text-on-surface-variant opacity-60'}>
                      <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center mb-1 text-[13px] font-bold ${
                        ['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900' : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {['PROCESSING', 'SHIPPED', 'DELIVERED'].includes(o.status) ? '✓' : '2'}
                      </div>
                      Vendor Preparing
                    </div>
                    <div className={['SHIPPED', 'DELIVERED'].includes(o.status) ? 'text-emerald-700 dark:text-emerald-400' : 'text-on-surface-variant opacity-60'}>
                      <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center mb-1 text-[13px] font-bold ${
                        ['SHIPPED', 'DELIVERED'].includes(o.status) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900' : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {['SHIPPED', 'DELIVERED'].includes(o.status) ? '✓' : '3'}
                      </div>
                      Shipped / Out
                    </div>
                    <div className={isReleased ? 'text-emerald-700 dark:text-emerald-400' : isDeliveredPending ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-on-surface-variant opacity-60'}>
                      <div className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center mb-1 text-[13px] font-bold ${
                        isReleased ? 'bg-emerald-100 text-emerald-800' : isDeliveredPending ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {isReleased ? '✓' : '4'}
                      </div>
                      {isReleased ? 'Delivered & Released' : 'Inspection & Confirm'}
                    </div>
                  </div>
                </div>

                {/* Delivered Inspection Action Banner */}
                {isDeliveredPending && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 my-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                          <span className="material-symbols-outlined text-[20px]">mark_email_unread</span>
                          Order Marked Delivered — Action Required
                        </div>
                        <p className="text-body-sm text-amber-800 dark:text-amber-300 mt-1">
                          Please inspect your products. Confirming will release payment to the vendor.
                          {o.confirmationDeadline && (
                            <span className="block font-medium mt-0.5">
                              Automatic release deadline: {new Date(o.confirmationDeadline).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => setDisputeTarget(o)}
                          className="px-3.5 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-medium text-label-md hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          Report a Problem
                        </button>
                        <button
                          onClick={() => setConfirmingOrder(o)}
                          className="btn-primary px-4 py-2 rounded-lg font-medium text-label-md"
                        >
                          Confirm Delivery
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Disputed Alert Banner */}
                {isDisputed && (
                  <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 my-3 text-body-sm">
                    <div className="font-bold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">gavel</span>
                      Dispute Active: {o.dispute?.reason ?? 'Investigation in progress'}
                    </div>
                    <p className="text-on-surface-variant mt-1">
                      {o.dispute?.description}
                    </p>
                    {o.dispute?.vendorResponse && (
                      <div className="mt-2 bg-white/70 dark:bg-surface-container p-2.5 rounded-lg border border-red-100">
                        <span className="font-semibold">Vendor Response:</span> {o.dispute.vendorResponse}
                      </div>
                    )}
                  </div>
                )}

                {/* Order Footer Info */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-outline-variant/60 dark:border-outline/40 text-body-sm text-on-surface-variant">
                  <div>
                    {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item(s) · {o.items[0]?.vendorName ?? 'Verified Vendor'}
                    {o.trackingNumber && <span className="ml-3 font-mono">Tracking: {o.trackingNumber} ({o.carrier})</span>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setDetail(o)} className={btnGhost}>
                      View Order Details
                    </button>
                    {isDeliveredPending && (
                      <button onClick={() => setConfirmingOrder(o)} className={btnPrimary}>
                        Confirm Delivery
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Order #${detail.id.slice(0, 10).toUpperCase()}` : ''}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusPill status={detail.status} />
              <span className="text-label-md text-on-surface-variant">
                Placed on {new Date(detail.createdAt).toLocaleString()}
              </span>
            </div>

            <div className="space-y-2 border-y border-outline-variant/60 dark:border-outline/40 py-3">
              {detail.items.map((it: any) => (
                <div key={it.id} className="flex justify-between text-body-sm text-on-surface">
                  <span>{it.name} × {it.quantity} {it.unit}</span>
                  <span className="font-mono-technical font-medium">{fmt(it.total)} {detail.currency}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between font-semibold text-body-md text-on-surface">
              <span>Total Paid (Secured in Escrow)</span>
              <span>{fmt(detail.totalAmount)} {detail.currency}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(detail.status) && (
                <ConfirmButton
                  label="Cancel Order"
                  confirmLabel="Are you sure you want to cancel this order?"
                  onConfirm={() => act(detail.id, 'cancel')}
                  className={btnGhost}
                />
              )}
              {detail.status === 'DELIVERED' && detail.escrowStatus === 'CLIENT_CONFIRMATION_PENDING' && (
                <>
                  <button
                    className={btnPrimary}
                    onClick={() => {
                      setConfirmingOrder(detail);
                      setDetail(null);
                    }}
                  >
                    Confirm Delivery
                  </button>
                  <button
                    className={btnGhost}
                    onClick={() => {
                      setDisputeTarget(detail);
                      setDetail(null);
                    }}
                  >
                    Report Problem / Open Dispute
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delivery Dialog */}
      {confirmingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">check_circle</span>
            </div>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">
              Confirm Delivery of Order #{confirmingOrder.id.slice(0, 8)}
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4 leading-relaxed">
              Have you inspected the delivered products and confirmed they are in acceptable condition? Confirming will release <span className="font-semibold font-mono">{fmt(confirmingOrder.totalAmount)} {confirmingOrder.currency}</span> from escrow to the vendor.
            </p>
            <div className="flex justify-end gap-3">
              <button
                disabled={confirming}
                onClick={() => setConfirmingOrder(null)}
                className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant"
              >
                Go Back &amp; Inspect
              </button>
              <button
                disabled={confirming}
                onClick={handleConfirmDelivery}
                className="btn-primary py-2.5 px-5 rounded-xl font-medium"
              >
                {confirming ? 'Releasing Escrow…' : 'Yes, Release Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Dispute Modal */}
      {disputeTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Report a Problem / Open Dispute
              </h2>
              <button onClick={() => setDisputeTarget(null)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant mb-4">
              Opening a dispute places a financial hold on the vendor's payment for Order #{disputeTarget.id.slice(0, 8)}. A BuildSmart dispute mediator will review evidence submitted by both parties.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                  Reason for Dispute
                </label>
                <select
                  className="input w-full"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                >
                  {DISPUTE_REASONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                  Detailed Explanation
                </label>
                <textarea
                  rows={4}
                  className="input w-full"
                  placeholder="Describe the issue, defect, or missing item in detail..."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                  Photo / Evidence URL (Optional)
                </label>
                <input
                  className="input w-full"
                  placeholder="Link to photos or delivery receipt"
                  value={disputeEvidence}
                  onChange={(e) => setDisputeEvidence(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDisputeTarget(null)}
                  className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingDispute || !disputeDesc.trim()}
                  onClick={handleOpenDispute}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl disabled:opacity-50"
                >
                  {submittingDispute ? 'Opening Dispute…' : 'File Dispute & Hold Escrow'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
