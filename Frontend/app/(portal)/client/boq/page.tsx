'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Skeleton, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();
const ALL_CATS = [
  'Sub-structure & Earthworks',
  'Reinforced Concrete Frame',
  'Masonry & Enclosures',
  'Roofing & Waterproofing',
  'Carpentry & Metal Openings',
  'Plumbing & Drainage',
  'Electrical & Low-Voltage',
  'Finishes & Coating',
  'Structural',
  'Roofing',
  'Finishing',
  'Openings',
  'Plumbing',
  'Electrical',
];

export default function ClientBoqPage() {
  const { data, loading, refetch } = useApi<{ boqs: any[]; projects: any[] }>('/api/client/boq');
  const [active, setActive] = useState<string | null>(null);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [activeTab, setActiveTab] = useState<'boq' | 'materials' | 'engineering'>('boq');
  const [askFor, setAskFor] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const boqs = data?.boqs ?? [];
  const activeBoq = boqs.find((b) => b.id === active) ?? boqs[0] ?? null;

  // Parse rich JSON metadata if available
  const meta = useMemo(() => {
    if (!activeBoq?.notes) return null;
    try {
      if (activeBoq.notes.startsWith('{') || activeBoq.notes.startsWith('[')) {
        return JSON.parse(activeBoq.notes);
      }
    } catch {
      // plain text note
    }
    return null;
  }, [activeBoq]);

  const items = useMemo(() => {
    if (!activeBoq) return [];
    return (activeBoq.items ?? [])
      .filter((i: any) => (cat ? i.category?.toLowerCase() === cat.toLowerCase() : true))
      .filter((i: any) =>
        q ? (i.material + ' ' + (i.description ?? '') + ' ' + (i.category ?? '')).toLowerCase().includes(q.toLowerCase()) : true
      );
  }, [activeBoq, cat, q]);

  const availableCategories = useMemo(() => {
    if (!activeBoq?.items) return ALL_CATS.slice(0, 8);
    const set = new Set<string>();
    activeBoq.items.forEach((i: any) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [activeBoq]);

  const askUpdate = async () => {
    try {
      await api('POST', '/api/client/boq', { boqId: activeBoq.id, message: msg });
      toast.success('Update request sent to architect');
      setAskFor(null);
      setMsg('');
      refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const exportCsv = () => {
    if (!activeBoq) return;
    const head = 'Category,Material,Description,Unit,Quantity,Unit Price (XAF),Total (XAF),Source';
    const lines = (activeBoq.items ?? []).map((r: any) =>
      [r.category, r.material, r.description ?? '', r.unit, r.quantity, r.unitPrice, r.total, r.source]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [head, ...lines, `"","","","","","","TOTAL",${activeBoq.total}`].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBoq.name.replace(/\s+/g, '-')}-estimate.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Estimates & BOQ exported as CSV');
  };

  if (loading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (boqs.length === 0) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1300px] mx-auto">
        <PageHeader
          title="Estimates & BOQs"
          subtitle="Material estimates and bills of quantities prepared by your architect from generated floor plans."
          crumbs={['Client', 'Materials', 'Estimates & BOQs']}
        />
        <EmptyState
          icon="request_quote"
          title="No Estimates or BOQs yet"
          body="Your architect will prepare preliminary Bills of Quantities and material estimations from your project's floor plans."
        />
      </div>
    );
  }

  const costPerM2 = meta?.grossAreaM2 ? Math.round(activeBoq.total / meta.grossAreaM2) : null;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader
        title="Estimates & BOQs"
        subtitle="Material estimations, preliminary bills of quantities, and engineering specifications for your construction projects."
        crumbs={['Client', 'Materials', 'Estimates & BOQs']}
        actions={
          activeBoq && (
            <div className="flex items-center gap-2">
              <button className={btnGhost} onClick={exportCsv} title="Download spreadsheet">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Export CSV
              </button>
              <button
                className={btnGhost}
                onClick={() => setAskFor(activeBoq)}
                title="Request changes or update from architect"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Request Revision
              </button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Documents list & Active summary */}
        <div className="space-y-4">
          <Card>
            <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-2 font-semibold">
              Estimates & Takeoffs
            </h4>
            <div className="space-y-1.5">
              {boqs.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setActive(b.id);
                    setActiveTab('boq');
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    activeBoq?.id === b.id
                      ? 'bg-secondary-container dark:bg-primary-container border-primary shadow-xs'
                      : 'hover:bg-surface-container-low dark:hover:bg-surface-variant border-transparent text-on-surface'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-on-surface dark:text-inverse-on-surface line-clamp-1">
                      {b.name}
                    </span>
                    <StatusPill status={b.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-on-surface-variant dark:text-surface-variant">
                    <span className="line-clamp-1">{b.projectName || 'Project'}</span>
                    <span className="font-bold text-primary dark:text-primary-fixed-dim font-mono-technical">
                      {fmt(b.total)} {b.currency || 'XAF'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {activeBoq && (
            <Card>
              <h4 className="text-headline-sm text-on-surface dark:text-inverse-on-surface mb-3 font-semibold">
                Estimate Summary
              </h4>
              <div className="space-y-2 text-xs text-on-surface dark:text-inverse-on-surface">
                <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                  <span className="text-on-surface-variant">Status</span>
                  <StatusPill status={activeBoq.status} />
                </div>
                {meta?.grossAreaM2 && (
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                    <span className="text-on-surface-variant">Gross Floor Area</span>
                    <span className="font-semibold font-mono-technical">{meta.grossAreaM2} m²</span>
                  </div>
                )}
                {costPerM2 && (
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                    <span className="text-on-surface-variant">Cost per m²</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-mono-technical">
                      {fmt(costPerM2)} XAF/m²
                    </span>
                  </div>
                )}
                {meta?.durationMonths && (
                  <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                    <span className="text-on-surface-variant">Est. Realization</span>
                    <span className="font-semibold">{meta.durationMonths} months</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-outline-variant/40">
                  <span className="text-on-surface-variant">Total Line Items</span>
                  <span className="font-mono-technical">{activeBoq.items?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 font-bold text-sm text-primary dark:text-primary-fixed-dim">
                  <span>Grand Total</span>
                  <span className="font-mono-technical">{fmt(activeBoq.total)} {activeBoq.currency || 'XAF'}</span>
                </div>
              </div>

              {meta?.floorPlanId && (
                <div className="mt-4 pt-3 border-t border-outline-variant/60">
                  <Link
                    href={`/client/floorplans?plan=${meta.floorPlanId}`}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    View 2D/3D Floor Plan
                  </Link>
                </div>
              )}

              <button
                className={btnGhost + ' w-full mt-2 text-xs'}
                onClick={() => setAskFor(activeBoq)}
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Request Revision
              </button>
            </Card>
          )}
        </div>

        {/* Right 3-Columns: Deliverable View */}
        <div className="lg:col-span-3 space-y-4">
          {/* Header Banner */}
          {activeBoq && (
            <div className="p-4 rounded-2xl bg-white dark:bg-surface-dim border border-outline-variant shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-on-surface dark:text-inverse-on-surface">
                      {activeBoq.name}
                    </h3>
                    {meta?.floorPlanName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-[14px]">architecture</span>
                        Floor Plan: {meta.floorPlanName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant dark:text-surface-variant mt-1">
                    {typeof meta?.summary === 'string'
                      ? meta.summary
                      : meta?.summary
                      ? `${meta.summary.tradeCount || 8} construction trades · ${meta.summary.itemCount || activeBoq.items?.length || 0} line items · ${meta.summary.grossFloorAreaM2 || meta.grossAreaM2 || ''} m² GFA`
                      : activeBoq.notes && !meta
                      ? activeBoq.notes
                      : 'Preliminary Bill of Quantities & Material Estimates'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/client/marketplace"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-dim text-white font-medium text-xs shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">shopping_bag</span>
                    Order on Marketplace
                  </Link>
                </div>
              </div>

              {/* Architect's note if forwarded with message */}
              {meta?.architectMessage && (
                <div className="mt-3 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/50 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] text-teal-600 mt-0.5">format_quote</span>
                  <div>
                    <span className="font-semibold text-teal-800 dark:text-teal-300">Architect&apos;s Note: </span>
                    {meta.architectMessage}
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex border-b border-outline-variant dark:border-outline gap-6 mt-4 pt-1">
                <button
                  onClick={() => setActiveTab('boq')}
                  className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                    activeTab === 'boq'
                      ? 'border-primary text-primary dark:text-primary-fixed-dim'
                      : 'border-transparent text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                  Bill of Quantities ({activeBoq.items?.length || 0})
                </button>
                {meta?.materials && meta.materials.length > 0 && (
                  <button
                    onClick={() => setActiveTab('materials')}
                    className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                      activeTab === 'materials'
                        ? 'border-primary text-primary dark:text-primary-fixed-dim'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">inventory_2</span>
                    Bulk Materials Takeoff ({meta.materials.length})
                  </button>
                )}
                {meta?.engineeringInsights && (
                  <button
                    onClick={() => setActiveTab('engineering')}
                    className={`pb-2 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                      activeTab === 'engineering'
                        ? 'border-primary text-primary dark:text-primary-fixed-dim'
                        : 'border-transparent text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">engineering</span>
                    Engineering & Specs
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: Detailed Bill of Quantities */}
          {activeTab === 'boq' && (
            <Card pad={false} className="overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant dark:border-outline flex flex-wrap items-center gap-3">
                <select
                  className={inputClass + ' w-auto text-xs'}
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                >
                  <option value="">All Categories ({availableCategories.length})</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  className={inputClass + ' flex-1 min-w-[180px] text-xs'}
                  placeholder="Search materials, trades, specifications..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant/50 dark:border-outline/40 bg-surface-container-low dark:bg-surface-variant/50">
                      <th className="px-4 py-3">Trade & Description</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Unit Price (XAF)</th>
                      <th className="px-4 py-3 text-right">Total (XAF)</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {items.map((i: any) => (
                      <tr
                        key={i.id}
                        className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors"
                      >
                        <td className="px-4 py-3 text-on-surface dark:text-inverse-on-surface">
                          <div className="font-semibold">{i.material}</div>
                          {i.description && (
                            <div className="text-[11px] text-on-surface-variant dark:text-surface-variant">
                              {i.description}
                            </div>
                          )}
                          {i.notes && (
                            <div className="text-[10px] text-on-surface-variant/80 italic mt-0.5">
                              {i.notes}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant dark:text-surface-variant whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-container dark:bg-surface-dim border border-outline-variant/50">
                            {i.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold font-mono-technical">
                          {i.quantity?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{i.unit}</td>
                        <td className="px-4 py-3 text-right font-mono-technical">{fmt(i.unitPrice)}</td>
                        <td className="px-4 py-3 text-right font-bold text-primary dark:text-primary-fixed-dim font-mono-technical">
                          {fmt(i.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/client/marketplace?q=${encodeURIComponent(i.material)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-container dark:bg-primary-container text-primary font-medium text-[11px] hover:bg-primary hover:text-white transition-colors"
                            title="Find vendors supplying this on BuildSmart Marketplace"
                          >
                            <span className="material-symbols-outlined text-[13px]">shopping_cart</span>
                            Buy
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-container-low dark:bg-surface-variant font-bold">
                      <td colSpan={5} className="px-4 py-3 text-label-md uppercase tracking-wider text-on-surface-variant">
                        Subtotal ({items.length} items)
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-primary dark:text-primary-fixed-dim font-mono-technical">
                        {fmt(items.reduce((s: number, it: any) => s + (it.total || 0), 0))} XAF
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {items.length === 0 && (
                <div className="p-8">
                  <EmptyState icon="search_off" title="No matching items found" body="Try adjusting your filter or search query." />
                </div>
              )}
            </Card>
          )}

          {/* TAB 2: Consolidated Bulk Materials Takeoff */}
          {activeTab === 'materials' && meta?.materials && (
            <Card pad={false} className="overflow-hidden">
              <div className="p-4 border-b border-outline-variant dark:border-outline flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-on-surface dark:text-inverse-on-surface">
                    Consolidated Construction Materials Takeoff
                  </h4>
                  <p className="text-xs text-on-surface-variant">
                    Bulk aggregated quantities required for construction of this floor plan.
                  </p>
                </div>
                <Link
                  href="/client/marketplace"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">storefront</span>
                  Source All on Marketplace
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-label-md text-on-surface-variant bg-surface-container-low dark:bg-surface-variant/50 border-b border-outline-variant/50">
                      <th className="px-4 py-3">Material Item</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Estimated Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Avg Regional Rate</th>
                      <th className="px-4 py-3 text-right">Estimated Total</th>
                      <th className="px-4 py-3">Recommended Usage</th>
                      <th className="px-4 py-3 text-center">Procure</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/30">
                    {meta.materials.map((m: any, idx: number) => (
                      <tr key={idx} className="hover:bg-surface-container-low dark:hover:bg-surface-variant">
                        <td className="px-4 py-3 font-semibold text-on-surface dark:text-inverse-on-surface">
                          {m.item}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{m.category}</td>
                        <td className="px-4 py-3 text-right font-bold font-mono-technical">
                          {m.estimatedQuantity?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">{m.unit}</td>
                        <td className="px-4 py-3 text-right font-mono-technical">{fmt(m.unitPrice)} XAF</td>
                        <td className="px-4 py-3 text-right font-bold text-primary dark:text-primary-fixed-dim font-mono-technical">
                          {fmt(m.totalCost)} XAF
                        </td>
                        <td className="px-4 py-3 text-[11px] text-on-surface-variant italic">{m.usage}</td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            href={`/client/marketplace?q=${encodeURIComponent(m.item)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold hover:bg-teal-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                            Order
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* TAB 3: Structural & Site Specifications */}
          {activeTab === 'engineering' && meta?.engineeringInsights && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <h4 className="font-bold text-sm text-on-surface dark:text-inverse-on-surface flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[20px] text-teal-600">foundation</span>
                    Foundation & Structural Guidelines
                  </h4>
                  <p className="text-xs text-on-surface-variant dark:text-surface-variant mb-3 leading-relaxed">
                    {meta.engineeringInsights.foundationRecommendations ||
                      meta.engineeringInsights.siteAnalysis ||
                      'Strip / pad footings calibrated to regional soil bearing capacity.'}
                  </p>
                  <div className="p-3 rounded-xl bg-surface-container-low dark:bg-surface-variant text-xs space-y-1">
                    <div className="font-semibold text-on-surface dark:text-inverse-on-surface">Structural System:</div>
                    <div className="text-on-surface-variant">
                      {meta.engineeringInsights.structuralSystem ||
                        (Array.isArray(meta.engineeringInsights.structuralRecommendations)
                          ? meta.engineeringInsights.structuralRecommendations.join(' ')
                          : 'Reinforced concrete columns and ring beams with standard infill.')}
                    </div>
                  </div>
                </Card>

                <Card>
                  <h4 className="font-bold text-sm text-on-surface dark:text-inverse-on-surface flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[20px] text-emerald-600">science</span>
                    Concrete Batching & Soil Parameters
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="p-3 rounded-xl bg-surface-container-low dark:bg-surface-variant">
                      <div className="font-semibold text-on-surface dark:text-inverse-on-surface mb-0.5">Concrete Mix Ratios:</div>
                      <div className="text-on-surface-variant">
                        {meta.engineeringInsights.concreteBatchingMix ||
                          meta.summary?.concreteGradeSpecification ||
                          '350 kg/m³ for slabs, beams, columns; 300 kg/m³ for sub-structure.'}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low dark:bg-surface-variant">
                      <div className="font-semibold text-on-surface dark:text-inverse-on-surface mb-0.5">Soil Bearing Capacity:</div>
                      <div className="text-on-surface-variant">
                        {meta.engineeringInsights.soilBearingCapacity ||
                          meta.summary?.soilAssumption ||
                          '150-200 kN/m² typical lateritic soil.'}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {meta.engineeringInsights.valueEngineeringTips && (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20">
                  <h4 className="font-bold text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                    Value Engineering & Cost Optimization Recommendations
                  </h4>
                  <p className="text-xs text-amber-950/80 dark:text-amber-200/80 leading-relaxed">
                    {Array.isArray(meta.engineeringInsights.valueEngineeringTips)
                      ? meta.engineeringInsights.valueEngineeringTips.join(' • ')
                      : String(meta.engineeringInsights.valueEngineeringTips)}
                  </p>
                </div>
              )}

              {(meta.engineeringInsights.phasesTimeline || meta.engineeringInsights.estimatedMilestones) && (
                <Card>
                  <h4 className="font-bold text-sm text-on-surface dark:text-inverse-on-surface mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">timeline</span>
                    Phased Construction Milestones & Duration
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(meta.engineeringInsights.phasesTimeline || meta.engineeringInsights.estimatedMilestones).map(
                      (p: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest dark:bg-surface-dim"
                        >
                          <span className="text-[10px] font-bold text-primary dark:text-primary-fixed-dim uppercase tracking-wider">
                            Phase {idx + 1}
                          </span>
                          <h5 className="font-semibold text-xs text-on-surface dark:text-inverse-on-surface mt-1">
                            {p.phase || p.milestone || `Phase ${idx + 1}`}
                          </h5>
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                            {p.duration || (p.durationWeeks ? `${p.durationWeeks} weeks` : '4 weeks')}
                          </div>
                          <p className="text-[11px] text-on-surface-variant mt-2">
                            {p.deliverable || (p.costSharePercent ? `${p.costSharePercent}% of budget` : 'Deliverable')}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          <p className="text-[11px] text-on-surface-variant dark:text-surface-variant mt-2">
            AI-generated quantities are calibrated civil engineering preliminary estimates based on regional standard SMM7 methods. Actual site procurement requires licensed engineer review.
          </p>
        </div>
      </div>

      {/* Request Revision Modal */}
      {askFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setAskFor(null)}
        >
          <div
            className="bg-white dark:bg-surface-dim rounded-2xl p-6 w-full max-w-md shadow-xl border border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
              </div>
              <div>
                <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface">
                  Request Revision from Architect
                </h3>
                <p className="text-xs text-on-surface-variant">For &quot;{askFor.name}&quot;</p>
              </div>
            </div>

            <textarea
              className={inputClass + ' w-full text-xs'}
              rows={4}
              placeholder="e.g. Please update the tile finish specifications for the master bedroom or recalculate based on 2 stories..."
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />

            <div className="flex justify-end gap-2 mt-4">
              <button className={btnGhost} onClick={() => setAskFor(null)}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={askUpdate}>
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
