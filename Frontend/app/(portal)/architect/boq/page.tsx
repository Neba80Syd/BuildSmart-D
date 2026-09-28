'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ArchitectBoqPage() {
  const { data, loading, refetch } = useApi<{ boqs: any[]; itemsByBoq: Record<string, any[]> }>('/api/architect/boq');
  const [active, setActive] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const boqs = data?.boqs ?? [];
  const items = active ? (data?.itemsByBoq?.[active] ?? []) : [];

  const activeBoq = boqs.find((b) => b.id === active);
  const total = items.reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="Material Estimation & BOQ" subtitle="Estimate materials and generate Bills of Quantities for your projects." crumbs={['Architect', 'Design Studio', 'Materials & BOQ']} actions={
        <button className={btnPrimary} onClick={() => setModal(true)}><span className="material-symbols-outlined text-[18px]">add</span>New BOQ</button>
      } />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      ) : boqs.length === 0 ? (
        <EmptyState icon="request_quote" title="No BOQs yet" body="Generate a material estimate from a project." actionLabel="Create BOQ" onAction={() => setModal(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-3">
            {boqs.map((b) => (
              <button key={b.id} onClick={() => setActive(b.id)} className={`w-full text-left p-4 rounded-xl border transition-colors ${active === b.id ? 'bg-secondary-container dark:bg-primary-container border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline hover:border-primary'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-headline-sm text-on-surface dark:text-on-surface">{b.name}</h3>
                  <StatusPill status={b.status} />
                </div>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">V{b.version} · {(data?.itemsByBoq?.[b.id] ?? []).length} items</p>
                <p className="text-body-sm font-semibold text-primary dark:text-primary-fixed-dim mt-1">{fmt((data?.itemsByBoq?.[b.id] ?? []).reduce((s, i) => s + (i.total ?? 0), 0))} {b.currency}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!activeBoq ? (
              <Card className="text-center py-16 text-on-surface-variant dark:text-surface-variant">Select a BOQ to view and edit its items.</Card>
            ) : (
              <BoqDetail boq={activeBoq} items={items} total={total} onChanged={refetch} onDeleted={() => { setActive(null); refetch(); }} />
            )}
          </div>
        </div>
      )}

      {modal && <NewBoqModal onClose={() => setModal(false)} onDone={(id) => { setModal(false); setActive(id); refetch(); }} />}
    </div>
  );
}

function BoqDetail({ boq, items, total, onChanged, onDeleted }: { boq: any; items: any[]; total: number; onChanged: () => void; onDeleted: () => void }) {
  const [edit, setEdit] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'materials' | 'engineering'>('items');
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState('');
  const [forwarding, setForwarding] = useState(false);

  const rows = edit ?? items;

  const meta = useMemo(() => {
    try {
      if (boq.notes && (boq.notes.startsWith('{') || boq.notes.startsWith('['))) {
        return JSON.parse(boq.notes);
      }
    } catch {
      // plain text note
    }
    return null;
  }, [boq.notes]);

  const setItem = (id: string, patch: any) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch, total: (patch.quantity ?? r.quantity) * (patch.unitPrice ?? r.unitPrice) } : r));
    setEdit(next);
  };

  const save = async () => {
    try {
      await api('PATCH', '/api/architect/boq', { id: boq.id, items: edit!.map(({ category, material, description, unit, quantity, unitPrice, source, notes, linkedProductId }) => ({ category, material, description, unit, quantity, unitPrice, source, notes, linkedProductId })) });
      toast.success('BOQ saved');
      setEdit(null);
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const setStatus = async (status: string) => {
    try {
      await api('PATCH', '/api/architect/boq', { id: boq.id, status });
      toast.success('Status updated');
      onChanged();
    } catch (err: any) { toast.error(err.message); }
  };

  const del = async () => {
    try {
      await api('DELETE', `/api/architect/boq?id=${boq.id}`);
      toast.success('BOQ deleted');
      onDeleted();
    } catch (err: any) { toast.error(err.message); }
  };

  const forwardToClient = async () => {
    setForwarding(true);
    try {
      await api('POST', '/api/architect/boq/send-to-client', {
        boqId: boq.id,
        message: forwardMessage,
        notifyClient: true,
        postToChat: true,
      });
      toast.success('Preliminary BOQ & Material Estimation forwarded to client dashboard!');
      setForwardModalOpen(false);
      setForwardMessage('');
      onChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to forward to client');
    } finally {
      setForwarding(false);
    }
  };

  const exportCsv = () => {
    const head = 'Category,Material,Description,Unit,Quantity,Unit Price,Total,Source';
    const lines = rows.map((r) => [r.category, r.material, r.description ?? '', r.unit, r.quantity, r.unitPrice, r.total, r.source].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [head, ...lines, `"","","","","","","TOTAL",${total}`].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${boq.name.replace(/\s+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('BOQ exported as CSV');
  };

  return (
    <Card pad={false}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant dark:border-outline">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-headline-md text-on-surface dark:text-on-surface">{boq.name}</h3>
            {meta?.floorPlanName && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                <span className="material-symbols-outlined text-[13px]">architecture</span>
                {meta.floorPlanName}
              </span>
            )}
          </div>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
            {typeof meta?.summary === 'string'
              ? meta.summary
              : meta?.summary
              ? `${meta.summary.tradeCount || 8} construction trades · ${meta.summary.itemCount || rows.length} line items · ${meta.summary.grossFloorAreaM2 || meta.grossAreaM2 || ''} m² GFA`
              : !meta && boq.notes
              ? boq.notes
              : 'AI Civil Engineering Takeoff'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass + ' w-auto'} value={boq.status} onChange={(e) => setStatus(e.target.value)}>
            {['DRAFT', 'FINAL', 'SENT'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className={btnGhost} onClick={exportCsv}><span className="material-symbols-outlined text-[18px]">download</span>Export</button>
          {edit ? <button className={btnPrimary} onClick={save}>Save Changes</button> : <button className={btnGhost} onClick={() => setEdit(items)}>Edit Quantities</button>}
          
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs shadow-sm transition-all"
            onClick={() => setForwardModalOpen(true)}
            title="Forward this preliminary BOQ & material estimate to client dashboard"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>Forward to Client
          </button>

          <ConfirmButton icon="delete" label="" onConfirm={del} />
        </div>
      </div>

      {/* Floor Plan metadata banner if present */}
      {meta && (
        <div className="px-5 py-3 bg-secondary-container/40 dark:bg-surface-variant/40 border-b border-outline-variant/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            {meta.grossAreaM2 && (
              <span className="flex items-center gap-1 text-on-surface-variant dark:text-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-primary">square_foot</span>
                Gross Floor Area: <strong className="text-on-surface dark:text-inverse-on-surface">{meta.grossAreaM2} m²</strong>
              </span>
            )}
            {meta.durationMonths && (
              <span className="flex items-center gap-1 text-on-surface-variant dark:text-surface-variant">
                <span className="material-symbols-outlined text-[15px] text-primary">calendar_month</span>
                Estimated Duration: <strong className="text-on-surface dark:text-inverse-on-surface">{meta.durationMonths} months</strong>
              </span>
            )}
            {meta.sentToClientAt && (
              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300 font-medium">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                Forwarded to client: {new Date(meta.sentToClientAt).toLocaleDateString()}
              </span>
            )}
          </div>
          {meta.architectMessage && (
            <p className="w-full text-on-surface-variant dark:text-surface-variant italic">
              Architect Note: &quot;{meta.architectMessage}&quot;
            </p>
          )}
        </div>
      )}

      {/* Tab navigation if rich metadata exists */}
      {meta && (
        <div className="flex border-b border-outline-variant dark:border-outline px-5 gap-4 bg-surface dark:bg-surface-dim">
          <button
            onClick={() => setActiveTab('items')}
            className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'items'
                ? 'border-primary text-primary dark:text-primary-fixed-dim'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">receipt_long</span>
            Detailed BOQ ({rows.length})
          </button>
          {meta.materials && meta.materials.length > 0 && (
            <button
              onClick={() => setActiveTab('materials')}
              className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'materials'
                  ? 'border-primary text-primary dark:text-primary-fixed-dim'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">inventory_2</span>
              Consolidated Materials ({meta.materials.length})
            </button>
          )}
          {meta.engineeringInsights && (
            <button
              onClick={() => setActiveTab('engineering')}
              className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                activeTab === 'engineering'
                  ? 'border-primary text-primary dark:text-primary-fixed-dim'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">engineering</span>
              Engineering & Site Insights
            </button>
          )}
        </div>
      )}

      {/* Tab Content 1: Detailed BOQ Items */}
      {activeTab === 'items' && (
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant dark:border-outline">
                <th className="px-4 py-2">Category</th><th className="px-4 py-2">Material</th><th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit Price</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/50 dark:border-outline/40 hover:bg-surface-container-low dark:hover:bg-surface-variant">
                  <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{r.category}</td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-on-surface dark:text-on-surface">{r.material}</div>
                    {r.description && <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{r.description}</div>}
                    {r.notes && <div className="text-[11px] text-on-surface-variant dark:text-surface-variant italic">{r.notes}</div>}
                  </td>
                  <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{r.unit}</td>
                  <td className="px-4 py-2 text-right">
                    {edit ? <input className={inputClass + ' w-20 text-right'} type="number" value={r.quantity} onChange={(e) => setItem(r.id, { quantity: Number(e.target.value) })} /> : <span className="font-mono-technical">{r.quantity}</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {edit ? <input className={inputClass + ' w-28 text-right'} type="number" value={r.unitPrice} onChange={(e) => setItem(r.id, { unitPrice: Number(e.target.value) })} /> : <span className="font-mono-technical">{fmt(r.unitPrice)}</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-primary dark:text-primary-fixed-dim font-mono-technical">{fmt(r.total)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-label-md px-2 py-0.5 rounded ${r.source === 'AI_ESTIMATE' ? 'bg-[#EAF3FB] text-[#2F5F8A]' : r.source === 'MARKETPLACE' ? 'bg-[#F3EEFB] text-[#6B4FA0]' : 'bg-surface-container-low text-on-surface-variant'}`}>{r.source}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-low dark:bg-surface-variant">
                <td colSpan={5} className="px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant dark:text-surface-variant">Estimated Total</td>
                <td className="px-4 py-3 text-right font-bold text-on-surface dark:text-on-surface font-mono-technical">{fmt(total)} {boq.currency}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Tab Content 2: Bulk Materials Takeoff */}
      {activeTab === 'materials' && meta?.materials && (
        <div className="overflow-x-auto p-4">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant dark:border-outline">
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-right">Estimated Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Regional Unit Rate</th>
                <th className="px-3 py-2 text-right">Estimated Total</th>
                <th className="px-3 py-2">Usage / Specs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {meta.materials.map((m: any, idx: number) => (
                <tr key={idx} className="hover:bg-surface-container-low dark:hover:bg-surface-variant">
                  <td className="px-3 py-2.5 font-medium text-on-surface dark:text-inverse-on-surface">{m.item}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant text-xs">{m.category}</td>
                  <td className="px-3 py-2.5 text-right font-semibold font-mono-technical">{m.estimatedQuantity?.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-on-surface-variant">{m.unit}</td>
                  <td className="px-3 py-2.5 text-right font-mono-technical">{fmt(m.unitPrice)} XAF</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-primary dark:text-primary-fixed-dim font-mono-technical">{fmt(m.totalCost)} XAF</td>
                  <td className="px-3 py-2.5 text-xs text-on-surface-variant italic">{m.usage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content 3: Engineering Insights */}
      {activeTab === 'engineering' && meta?.engineeringInsights && (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low dark:bg-surface-variant">
              <h5 className="font-semibold text-sm text-on-surface dark:text-inverse-on-surface flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-[18px] text-teal-600">foundation</span>
                Foundation & Structural Guidance
              </h5>
              <p className="text-xs text-on-surface-variant dark:text-surface-variant mb-2">
                {meta.engineeringInsights.foundationRecommendations ||
                  meta.engineeringInsights.siteAnalysis ||
                  'Strip / pad footings calibrated to regional soil bearing capacity.'}
              </p>
              <p className="text-xs text-on-surface-variant dark:text-surface-variant">
                {meta.engineeringInsights.structuralSystem ||
                  (Array.isArray(meta.engineeringInsights.structuralRecommendations)
                    ? meta.engineeringInsights.structuralRecommendations.join(' ')
                    : 'Reinforced concrete columns and ring beams with standard infill.')}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low dark:bg-surface-variant">
              <h5 className="font-semibold text-sm text-on-surface dark:text-inverse-on-surface flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">science</span>
                Concrete Batching & Soil
              </h5>
              <p className="text-xs text-on-surface-variant dark:text-surface-variant mb-2">
                <strong>Batching Mix:</strong>{' '}
                {meta.engineeringInsights.concreteBatchingMix ||
                  meta.summary?.concreteGradeSpecification ||
                  '350 kg/m³ for slabs, beams, columns; 300 kg/m³ for sub-structure.'}
              </p>
              <p className="text-xs text-on-surface-variant dark:text-surface-variant">
                <strong>Soil Capacity:</strong>{' '}
                {meta.engineeringInsights.soilBearingCapacity ||
                  meta.summary?.soilAssumption ||
                  '150-200 kN/m² typical lateritic soil.'}
              </p>
            </div>
          </div>

          {meta.engineeringInsights.valueEngineeringTips && (
            <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
              <h5 className="font-semibold text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[16px]">savings</span>
                Value Engineering & Optimization
              </h5>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                {Array.isArray(meta.engineeringInsights.valueEngineeringTips)
                  ? meta.engineeringInsights.valueEngineeringTips.join(' • ')
                  : String(meta.engineeringInsights.valueEngineeringTips)}
              </p>
            </div>
          )}

          {(meta.engineeringInsights.phasesTimeline || meta.engineeringInsights.estimatedMilestones) && (
            <div>
              <h5 className="font-semibold text-xs text-on-surface dark:text-inverse-on-surface uppercase tracking-wider mb-2">
                Phased Execution Milestones
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(meta.engineeringInsights.phasesTimeline || meta.engineeringInsights.estimatedMilestones).map(
                  (p: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg border border-outline-variant/40 bg-white dark:bg-surface-dim">
                      <div className="text-[10px] font-semibold text-primary dark:text-primary-fixed-dim uppercase">
                        {p.phase || p.milestone || `Phase ${idx + 1}`}
                      </div>
                      <div className="text-xs font-bold text-on-surface dark:text-inverse-on-surface mt-0.5">
                        {p.duration || (p.durationWeeks ? `${p.durationWeeks} weeks` : '4 weeks')}
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-1">
                        {p.deliverable || (p.costSharePercent ? `${p.costSharePercent}% of budget` : 'Deliverable')}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="px-5 py-3 text-[11px] text-on-surface-variant dark:text-surface-variant border-t border-outline-variant dark:border-outline">
        AI estimates are preliminary civil engineering takeoffs and require licensed structural engineer sign-off prior to procurement.
      </p>

      {/* Forward to Client Modal */}
      {forwardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4" onClick={() => !forwarding && setForwardModalOpen(false)}>
          <div className="bg-white dark:bg-surface-dim rounded-2xl p-6 w-full max-w-lg shadow-xl border border-outline-variant" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                <span className="material-symbols-outlined text-[22px]">send</span>
              </div>
              <div>
                <h4 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">Forward Estimate & BOQ to Client</h4>
                <p className="text-body-sm text-on-surface-variant">The client will view this in their &quot;Estimates & BOQs&quot; dashboard tab.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-container-low dark:bg-surface-variant text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Document:</span>
                  <strong className="text-on-surface dark:text-inverse-on-surface">{boq.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Estimated Total:</span>
                  <strong className="text-primary font-mono-technical">{fmt(total)} {boq.currency}</strong>
                </div>
                {meta?.grossAreaM2 && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Gross Floor Area:</span>
                    <span>{meta.grossAreaM2} m²</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-label-md text-on-surface dark:text-inverse-on-surface mb-1">
                  Message / Deliverable Note for Client (Optional)
                </label>
                <textarea
                  className={inputClass}
                  rows={3}
                  placeholder="e.g. Please find the preliminary Bill of Quantities and bulk material estimation for the 3-Bedroom Villa floor plan..."
                  value={forwardMessage}
                  onChange={(e) => setForwardMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className={btnGhost}
                  onClick={() => setForwardModalOpen(false)}
                  disabled={forwarding}
                >
                  Cancel
                </button>
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm shadow-sm transition-all disabled:opacity-50"
                  onClick={forwardToClient}
                  disabled={forwarding}
                >
                  {forwarding ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      Forwarding...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Confirm & Forward to Client
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function NewBoqModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [generating, setGenerating] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGenerating(true);
    try {
      const res = await api('POST', '/api/architect/boq', { projectId: fd.get('projectId') || null, name: fd.get('name'), generate: fd.get('generate') === 'on' });
      toast.success('BOQ created');
      onDone(res.boq.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };
  return (
    <Modal open title="New BOQ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="BOQ name"><input className={inputClass} name="name" required minLength={2} placeholder="e.g. Villa — Structural BOQ" /></Field>
        <Field label="Project">
          <select className={inputClass} name="projectId" defaultValue="">
            <option value="">Standalone BOQ</option>
            {(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-body-sm text-on-surface dark:text-on-surface">
          <input type="checkbox" name="generate" defaultChecked className="accent-[#315C4C]" />
          Generate AI material estimate from project brief
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={generating}>{generating ? 'Generating…' : 'Create BOQ'}</button>
        </div>
      </form>
    </Modal>
  );
}
