'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, FilterChips, priorityTone, timeAgo, btnPrimary, btnGhost } from '@/Frontend/components/admin/shared';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

export default function AdminDisputesPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [resolutionType, setResolutionType] = useState<'RELEASE_VENDOR' | 'REFUND_CLIENT' | 'PARTIAL'>('RELEASE_VENDOR');
  const [clientRefundAmount, setClientRefundAmount] = useState('');
  const [vendorReleaseAmount, setVendorReleaseAmount] = useState('');
  const [runningAutoRelease, setRunningAutoRelease] = useState(false);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/disputes${status ? `?status=${status}` : ''}`);

  const openDetail = async (d: any) => {
    try {
      const res = await api('GET', `/api/admin/disputes?id=${d.id}`);
      setDetail(res.dispute);
      setNote('');
      if (res.dispute?.escrow?.amount) {
        setVendorReleaseAmount(String(res.dispute.escrow.amount));
        setClientRefundAmount('0');
      }
    } catch {
      setDetail(d);
    }
  };

  const act = async (payload: any) => {
    setBusy(payload.id + payload.action);
    try {
      await api('PATCH', '/api/admin/disputes', payload);
      toast.success(payload.action === 'resolve' ? 'Dispute resolved and funds disbursed' : 'Dispute updated');
      refetch();
      setDetail(null);
      setNote('');
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const runAutoRelease = async () => {
    setRunningAutoRelease(true);
    try {
      const res = await api('POST', '/api/admin/finance/escrow');
      toast.success(`Auto-release check complete: ${res.processed ?? 0} orders processed.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Auto-release check failed');
    } finally {
      setRunningAutoRelease(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">
            Dispute Resolution &amp; Escrow Mediation
          </h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">
            Investigate client-vendor marketplace disputes and authorize financial disbursements.
          </p>
        </div>
        <button
          onClick={runAutoRelease}
          disabled={runningAutoRelease}
          className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-label-md shadow-sm disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">schedule</span>
          {runningAutoRelease ? 'Running…' : 'Run Auto-Release Check'}
        </button>
      </div>

      <Card className="mb-6">
        <FilterChips
          options={data?.statuses ?? ['OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'ESCALATED', 'RESOLVED_FOR_VENDOR', 'RESOLVED_FOR_CLIENT', 'PARTIAL_RESOLUTION', 'CLOSED']}
          value={status}
          onChange={setStatus}
          label="Status"
        />
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load disputes.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={7} /></tbody></TableShell>
        ) : !data?.disputes?.length ? (
          <EmptyState icon="gavel" title="No disputes" body="There are no dispute cases matching this filter." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Case ID</Th>
                <Th>Order</Th>
                <Th>Reason</Th>
                <Th>Amount</Th>
                <Th>Parties</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.disputes.map((d: any) => (
                <tr key={d.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => openDetail(d)} className="font-mono-technical font-semibold text-primary dark:text-primary-fixed-dim hover:underline text-left">
                      #{d.id.slice(0, 10).toUpperCase()}
                    </button>
                  </Td>
                  <Td>
                    <span className="font-mono font-medium">#{d.orderId?.slice(0, 8)}</span>
                  </Td>
                  <Td>
                    <div className="font-medium text-on-surface">{d.reason ?? d.title}</div>
                  </Td>
                  <Td>
                    <span className="font-mono-technical font-semibold">{fmt(d.amount)} XAF</span>
                  </Td>
                  <Td>
                    <div className="text-body-sm">
                      <span className="font-medium">{d.clientName ?? 'Client'}</span>
                      <span className="text-on-surface-variant mx-1">↔</span>
                      <span className="font-medium">{d.vendorName ?? 'Vendor'}</span>
                    </div>
                  </Td>
                  <Td><StatusPill status={d.status} /></Td>
                  <Td>{timeAgo(d.updatedAt)}</Td>
                  <Td>
                    <button onClick={() => openDetail(d)} className="btn-primary text-label-sm px-3 py-1 rounded-lg">
                      Review
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      {/* Comprehensive Resolution Modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Dispute Case #${detail.id.slice(0, 10).toUpperCase()}` : ''} wide>
        {detail && (
          <div className="space-y-6 text-body-sm">
            {/* Status header */}
            <div className="flex flex-wrap gap-3 items-center pb-4 border-b border-outline-variant/60">
              <StatusPill status={detail.status} />
              <StatusPill status={`${detail.priority} priority`} tone={priorityTone(detail.priority)} />
              <span className="font-mono-technical font-semibold text-on-surface">
                Escrow Amount: {fmt(detail.escrow?.amount ?? detail.amount)} XAF
              </span>
              <span className="text-on-surface-variant text-label-sm">
                Order #{detail.orderId}
              </span>
            </div>

            {/* Side-by-side Evidence & Claims */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Claim */}
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4">
                <div className="flex items-center gap-1.5 font-bold text-red-800 dark:text-red-300 mb-2">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Client Claim ({detail.clientName ?? 'Client'})
                </div>
                <div className="text-body-sm font-semibold text-on-surface mb-1">
                  Reason: {detail.reason ?? detail.category}
                </div>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  {detail.description || 'No description provided.'}
                </p>
                {detail.evidence && Array.isArray(detail.evidence) && detail.evidence.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-red-200 dark:border-red-900">
                    <span className="text-label-sm font-semibold text-red-800 dark:text-red-300 block mb-1">Client Evidence:</span>
                    {detail.evidence.map((ev: any, idx: number) => (
                      <div key={idx} className="text-[12px] font-mono truncate text-primary hover:underline">
                        {String(ev)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vendor Response */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                  <span className="material-symbols-outlined text-[18px]">store</span>
                  Vendor Response ({detail.vendorName ?? 'Vendor'})
                </div>
                {detail.vendorResponse ? (
                  <>
                    <p className="text-body-sm text-on-surface-variant leading-relaxed">
                      {detail.vendorResponse}
                    </p>
                    {detail.vendorRespondedAt && (
                      <div className="text-[11px] text-on-surface-variant mt-2 opacity-75">
                        Responded on {new Date(detail.vendorRespondedAt).toLocaleString()}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-body-sm text-amber-700 dark:text-amber-400 italic py-3">
                    Awaiting vendor response and proof of delivery.
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            {detail.timeline && Array.isArray(detail.timeline) && detail.timeline.length > 0 && (
              <div className="space-y-2 bg-surface-container-low dark:bg-surface-dim p-4 rounded-xl">
                <p className="text-label-md text-on-surface-variant uppercase font-semibold">Case Timeline</p>
                <div className="space-y-1.5">
                  {detail.timeline.map((t: any, i: number) => (
                    <div key={i} className="text-[12px] flex justify-between gap-4">
                      <span className="font-semibold text-on-surface">{t.actor ?? 'System'}: <span className="font-normal text-on-surface-variant">{t.text || t.action}</span></span>
                      <span className="text-on-surface-variant opacity-70 whitespace-nowrap">{t.at ? new Date(t.at).toLocaleDateString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Resolution Controls */}
            {!['RESOLVED_FOR_VENDOR', 'RESOLVED_FOR_CLIENT', 'PARTIAL_RESOLUTION', 'CLOSED'].includes(detail.status) ? (
              <div className="bg-surface-container border border-outline-variant rounded-2xl p-5 space-y-4">
                <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">
                  Authorize Dispute Resolution &amp; Escrow Settlement
                </h3>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'RELEASE_VENDOR', label: 'Release to Vendor (100%)', desc: 'Disburse escrow to vendor available balance' },
                    { id: 'REFUND_CLIENT', label: 'Refund Client (100%)', desc: 'Debit escrow and refund client payment' },
                    { id: 'PARTIAL', label: 'Partial Split', desc: 'Custom split between client and vendor' },
                  ].map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => setResolutionType(res.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        resolutionType === res.id
                          ? 'border-primary bg-primary/10 ring-1 ring-primary'
                          : 'border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <div className="font-bold text-label-md text-on-surface">{res.label}</div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">{res.desc}</div>
                    </button>
                  ))}
                </div>

                {resolutionType === 'PARTIAL' && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <Field label="Client Refund Amount (XAF)">
                      <input
                        type="number"
                        className={inputClass}
                        value={clientRefundAmount}
                        onChange={(e) => setClientRefundAmount(e.target.value)}
                        placeholder="e.g. 50000"
                      />
                    </Field>
                    <Field label="Vendor Release Amount (XAF)">
                      <input
                        type="number"
                        className={inputClass}
                        value={vendorReleaseAmount}
                        onChange={(e) => setVendorReleaseAmount(e.target.value)}
                        placeholder="e.g. 45000"
                      />
                    </Field>
                  </div>
                )}

                <Field label="Admin Decision Note / Audit Rationale">
                  <input
                    className={inputClass}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Provide detailed justification for the platform audit log..."
                  />
                </Field>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    className={btnGhost}
                    disabled={busy === detail.id + 'note'}
                    onClick={() => act({ id: detail.id, action: 'note', note })}
                  >
                    Add Note Only
                  </button>
                  <button
                    className="bg-[#2F6B50] hover:bg-[#25543F] text-white px-5 py-2.5 rounded-xl font-medium text-label-md shadow-sm disabled:opacity-50"
                    disabled={busy === detail.id + 'resolve' || !note.trim()}
                    onClick={() =>
                      act({
                        id: detail.id,
                        action: 'resolve',
                        resolutionType,
                        resolution: note,
                        clientRefundAmount: resolutionType === 'PARTIAL' ? parseFloat(clientRefundAmount) || 0 : undefined,
                        vendorReleaseAmount: resolutionType === 'PARTIAL' ? parseFloat(vendorReleaseAmount) || 0 : undefined,
                      })
                    }
                  >
                    {busy === detail.id + 'resolve' ? 'Settling…' : 'Authorize & Disburse Escrow'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 text-body-sm text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Case Resolved:</span> {detail.resolution || detail.resolutionType}
                {detail.refundAmount > 0 && <span className="ml-2 font-mono">(Refunded: {fmt(detail.refundAmount)} XAF)</span>}
                {detail.releaseAmount > 0 && <span className="ml-2 font-mono">(Released to vendor: {fmt(detail.releaseAmount)} XAF)</span>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
