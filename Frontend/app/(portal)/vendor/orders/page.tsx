'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { StatusPill } from '@/Frontend/components/vendor/charts';

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const fmt = (n: number) => Math.round(n || 0).toLocaleString();

type OrderItem = { id: string; productId: string; name: string; unit: string; sku: string; quantity: number; unitPrice: number; total: number };
type Order = {
  id: string;
  status: string;
  escrowStatus?: string;
  escrowAmount?: number;
  confirmationDeadline?: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  customerName: string;
  customerLocation: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  fulfilledAt: string | null;
  dispute?: {
    id: string;
    status: string;
    reason: string;
    description: string;
    vendorResponse?: string;
  } | null;
  items: OrderItem[];
};

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ orderId: string; carrier: string; trackingNumber: string } | null>(null);
  const [docTarget, setDocTarget] = useState<{ orderId: string; category: string; name: string } | null>(null);
  const [deliveringOrder, setDeliveringOrder] = useState<Order | null>(null);
  const [disputeModal, setDisputeModal] = useState<{ orderId: string; disputeId: string; reason: string; description: string; existingResponse?: string } | null>(null);
  const [vendorResponseText, setVendorResponseText] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/vendor/orders');
      const data = await res.json();
      setOrders(data.orders ?? []);
    } catch {
      toast.error('Failed to load orders');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATUSES) c[s] = orders.filter((o) => o.status === s).length;
    return c;
  }, [orders]);

  const filtered = useMemo(() => (filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)), [orders, filter]);

  const advance = async (order: Order, status: string) => {
    if (status === 'DELIVERED') {
      setDeliveringOrder(order);
      return;
    }

    const res = await fetch('/api/vendor/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status }),
    });
    if (res.ok) {
      toast.success(`Order marked ${status.toLowerCase()}`);
      load();
    } else toast.error('Could not update order');
  };

  const confirmMarkDelivered = async () => {
    if (!deliveringOrder) return;
    const res = await fetch('/api/vendor/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deliveringOrder.id, status: 'DELIVERED' }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success('Order marked as delivered! 72-hour client inspection window started.');
      setDeliveringOrder(null);
      load();
    } else {
      toast.error(data.error ?? 'Could not mark delivered');
    }
  };

  const submitDisputeResponse = async () => {
    if (!disputeModal || !vendorResponseText.trim()) {
      return toast.error('Please enter your response explanation and proof');
    }

    setSubmittingDispute(true);
    try {
      const res = await fetch('/api/vendor/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId: disputeModal.disputeId,
          response: vendorResponseText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Dispute response submitted for admin review');
        setDisputeModal(null);
        setVendorResponseText('');
        load();
      } else {
        toast.error(data.error ?? 'Failed to submit response');
      }
    } catch {
      toast.error('Network error submitting dispute response');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const saveTracking = async () => {
    if (!tracking) return;
    const res = await fetch('/api/vendor/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tracking.orderId, carrier: tracking.carrier, trackingNumber: tracking.trackingNumber, status: 'SHIPPED' }),
    });
    if (res.ok) {
      toast.success('Shipment recorded and customer notified');
      setTracking(null);
      load();
    } else toast.error('Could not save shipment');
  };

  const generateDoc = async () => {
    if (!docTarget) return;
    const res = await fetch('/api/vendor/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(docTarget),
    });
    if (res.ok) {
      toast.success(`${docTarget.category} generated`);
      setDocTarget(null);
    } else toast.error('Could not generate document');
  };

  const nextStatus: Record<string, string> = {
    PENDING: 'PROCESSING',
    PROCESSING: 'SHIPPED',
    SHIPPED: 'DELIVERED',
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">
            Orders &amp; Escrow Fulfillment
          </h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
            Track order fulfillment, shipment tracking, and delivery confirmations for escrow release.
          </p>
        </div>
      </div>

      {/* Status pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-xl">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? 'ALL' : s)}
            className={`bg-white dark:bg-surface-container border rounded-xl p-5 text-left transition-colors ${
              filter === s
                ? 'border-primary dark:border-primary-fixed ring-1 ring-primary'
                : 'border-outline-variant dark:border-outline hover:bg-surface-container-low'
            }`}
          >
            <div className="text-display text-on-background dark:text-surface-container-lowest">{counts[s]}</div>
            <div className="text-label-md text-on-surface-variant dark:text-surface-variant uppercase tracking-wider mt-1">{s}</div>
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant dark:border-outline bg-surface-container-low dark:bg-surface-dim">
                <th className="py-3 px-6 text-label-md text-on-surface-variant uppercase tracking-wider">Order</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant uppercase tracking-wider">Customer</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant uppercase tracking-wider">Escrow / Amount</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant uppercase tracking-wider">Delivery Status</th>
                <th className="py-3 px-6 text-label-md text-on-surface-variant uppercase tracking-wider">Escrow Status</th>
                <th className="py-3 px-6 text-right text-label-md text-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="text-body-sm text-on-surface dark:text-surface-container-lowest divide-y divide-outline-variant/60 dark:divide-outline/40">
              {filtered.slice(0, 50).map((o) => (
                <Fragment key={o.id}>
                  <tr className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="py-3.5 px-6">
                      <button
                        onClick={() => setOpenId(openId === o.id ? null : o.id)}
                        className="font-mono-technical text-primary dark:text-primary-fixed-dim font-semibold hover:underline"
                      >
                        #{o.id.slice(0, 10).toUpperCase()}
                      </button>
                      <div className="text-label-md text-on-surface-variant">{new Date(o.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-semibold">{o.customerName}</div>
                      <div className="text-label-md text-on-surface-variant">{o.customerLocation || 'Customer'}</div>
                    </td>
                    <td className="py-3.5 px-6 font-mono-technical">
                      <div className="font-semibold">{fmt(o.totalAmount)} {o.currency}</div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Vendor net: {fmt(o.escrowAmount ?? o.totalAmount * 0.9)} {o.currency}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusPill status={o.status} />
                      {o.trackingNumber && (
                        <div className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                          {o.carrier}: {o.trackingNumber}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6">
                      {o.dispute ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          DISPUTE OPEN
                        </span>
                      ) : (
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                          o.escrowStatus === 'RELEASED'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : o.escrowStatus === 'CLIENT_CONFIRMATION_PENDING'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {o.escrowStatus === 'CLIENT_CONFIRMATION_PENDING'
                            ? 'INSPECTION (72H)'
                            : (o.escrowStatus ?? 'ESCROWED')}
                        </span>
                      )}
                      {o.confirmationDeadline && o.escrowStatus === 'CLIENT_CONFIRMATION_PENDING' && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                          Auto-releases {new Date(o.confirmationDeadline).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap">
                      {o.dispute && (
                        <button
                          onClick={() => setDisputeModal({
                            orderId: o.id,
                            disputeId: o.dispute!.id,
                            reason: o.dispute!.reason,
                            description: o.dispute!.description,
                            existingResponse: o.dispute!.vendorResponse,
                          })}
                          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200 mr-2"
                        >
                          Respond to Dispute
                        </button>
                      )}
                      {nextStatus[o.status] && (
                        <button
                          onClick={() => advance(o, nextStatus[o.status])}
                          className="btn-primary text-label-sm px-3.5 py-1.5 rounded-lg font-medium mr-2"
                        >
                          {nextStatus[o.status] === 'DELIVERED' ? 'Mark Delivered' : `Mark ${nextStatus[o.status]}`}
                        </button>
                      )}
                      <button
                        onClick={() => setTracking({ orderId: o.id, carrier: o.carrier ?? 'DHL Express', trackingNumber: o.trackingNumber ?? '' })}
                        className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[20px] px-1.5 align-middle"
                        title="Add/Edit shipment tracking"
                      >
                        local_shipping
                      </button>
                      <button
                        onClick={() => setDocTarget({ orderId: o.id, category: 'Commercial Invoice', name: `invoice-${o.id.slice(0, 8)}.txt` })}
                        className="material-symbols-outlined text-on-surface-variant hover:text-primary text-[20px] px-1.5 align-middle"
                        title="Invoice"
                      >
                        receipt_long
                      </button>
                    </td>
                  </tr>
                  {openId === o.id && (
                    <tr key={`${o.id}-detail`} className="border-b border-outline-variant dark:border-outline bg-surface-container-low/40">
                      <td colSpan={6} className="py-4 px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-2 font-semibold">
                              Purchased Products
                            </h4>
                            <div className="space-y-2">
                              {o.items.map((it) => (
                                <div key={it.id} className="flex justify-between text-body-sm bg-white dark:bg-surface-container p-2.5 rounded-lg border border-outline-variant/60">
                                  <span>{it.name} × {it.quantity} {it.unit}</span>
                                  <span className="font-mono-technical font-semibold">{fmt(it.total)} {o.currency}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="text-body-sm space-y-2">
                            <div className="bg-white dark:bg-surface-container p-3.5 rounded-xl border border-outline-variant/60">
                              <div className="font-semibold mb-1">Escrow Details</div>
                              <div><span className="text-on-surface-variant">Escrow Status:</span> <span className="font-semibold">{o.escrowStatus ?? 'ESCROWED'}</span></div>
                              <div><span className="text-on-surface-variant">Shipped at:</span> {o.shippedAt ? new Date(o.shippedAt).toLocaleString() : 'Not yet'}</div>
                              <div><span className="text-on-surface-variant">Delivered at:</span> {o.fulfilledAt ? new Date(o.fulfilledAt).toLocaleString() : 'Not yet'}</div>
                              {o.confirmationDeadline && (
                                <div><span className="text-on-surface-variant">Inspection Deadline:</span> <span className="font-semibold text-amber-700">{new Date(o.confirmationDeadline).toLocaleString()}</span></div>
                              )}
                            </div>
                            {o.dispute && (
                              <div className="bg-red-50 dark:bg-red-950/40 p-3.5 rounded-xl border border-red-200 dark:border-red-900 text-body-sm">
                                <div className="font-bold text-red-800 dark:text-red-300">Client Dispute: {o.dispute.reason}</div>
                                <div className="text-on-surface-variant mt-1">{o.dispute.description}</div>
                                {o.dispute.vendorResponse && (
                                  <div className="mt-2 text-emerald-800 dark:text-emerald-300 bg-white/60 p-2 rounded">
                                    <span className="font-semibold">Your Response:</span> {o.dispute.vendorResponse}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-on-surface-variant dark:text-surface-variant">
                    No orders in this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Delivered Modal */}
      {deliveringOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[28px]">local_shipping</span>
            </div>
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">
              Mark Order as Delivered
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4 leading-relaxed">
              Recording delivery for order <span className="font-mono font-semibold">#{deliveringOrder.id.slice(0, 8)}</span> will notify the client and activate their <strong>72-hour inspection period</strong>.
            </p>
            <div className="bg-surface-container-low dark:bg-surface-dim p-4 rounded-xl text-body-sm text-on-surface-variant mb-5 space-y-1.5">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-semibold font-mono">{fmt(deliveringOrder.totalAmount)} {deliveringOrder.currency}</span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                <span>Escrow Release on Confirmation:</span>
                <span className="font-mono">{fmt(deliveringOrder.escrowAmount ?? deliveringOrder.totalAmount * 0.9)} {deliveringOrder.currency}</span>
              </div>
              <div className="text-[11px] opacity-80 pt-1">
                If the client does not confirm and no dispute is filed within 72 hours, the funds will be automatically released to your Available Balance.
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeliveringOrder(null)}
                className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={confirmMarkDelivered}
                className="btn-primary py-2.5 px-5 rounded-xl font-medium"
              >
                Confirm Delivered
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Response Modal */}
      {disputeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                Respond to Client Dispute
              </h2>
              <button onClick={() => setDisputeModal(null)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-red-50 dark:bg-red-950/40 p-4 rounded-xl border border-red-200 dark:border-red-900 mb-4 text-body-sm">
              <div className="font-semibold text-red-800 dark:text-red-300">
                Reason: {disputeModal.reason}
              </div>
              <p className="text-on-surface-variant mt-1">{disputeModal.description}</p>
            </div>

            <label className="block mb-4">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">
                Your Response &amp; Delivery Proof
              </span>
              <textarea
                rows={4}
                className="input w-full"
                placeholder="Explain the fulfillment process, tracking delivery receipt, or product condition..."
                value={vendorResponseText}
                onChange={(e) => setVendorResponseText(e.target.value)}
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDisputeModal(null)}
                className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant"
              >
                Cancel
              </button>
              <button
                disabled={submittingDispute || !vendorResponseText.trim()}
                onClick={submitDisputeResponse}
                className="btn-primary py-2.5 px-5 rounded-xl font-medium disabled:opacity-50"
              >
                {submittingDispute ? 'Submitting…' : 'Submit Evidence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tracking modal */}
      {tracking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">
              Shipment Logistics
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">
              Record carrier tracking for order <span className="font-mono">#{tracking.orderId.slice(0, 8)}</span>.
            </p>
            <label className="block mb-3">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">Carrier</span>
              <select className="input w-full" value={tracking.carrier} onChange={(e) => setTracking({ ...tracking, carrier: e.target.value })}>
                {['DHL Express', 'FedEx', 'UPS', 'Aramex', 'Local Logistics Partner', 'Other'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block mb-5">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider block mb-1">Tracking Number</span>
              <input
                className="input w-full font-mono"
                placeholder="e.g. DHL-8392183"
                value={tracking.trackingNumber}
                onChange={(e) => setTracking({ ...tracking, trackingNumber: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setTracking(null)} className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant">
                Cancel
              </button>
              <button onClick={saveTracking} className="btn-primary py-2.5 px-5 rounded-xl font-medium">
                Save Tracking &amp; Mark Shipped
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document generation modal */}
      {docTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-2">
              Generate Document
            </h2>
            <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-4">
              Create a printable <strong>{docTarget.category}</strong> for order #{docTarget.orderId.slice(0, 8)}.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDocTarget(null)} className="py-2.5 px-4 rounded-xl border border-outline-variant font-medium text-on-surface-variant">
                Cancel
              </button>
              <button onClick={generateDoc} className="btn-primary py-2.5 px-5 rounded-xl font-medium">
                Generate Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
