'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Sparkles,
  Calculator,
  Send,
  X,
  FileSpreadsheet,
  Download,
  Building2,
  HardHat,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  TrendingDown,
  Clock,
  Coins,
  Check,
  Package,
} from 'lucide-react';
import { api } from '@/Frontend/components/architect/hooks';

export interface AiFloorPlanBoqModalProps {
  isOpen: boolean;
  onClose: () => void;
  floorPlan: {
    id: string;
    name: string;
    kind?: string;
    version?: number;
    previewUrl?: string;
  };
  projectId?: string;
  projectName?: string;
  onBoqSaved?: (boqId: string) => void;
  onBoqSent?: (boqId: string) => void;
}

export function AiFloorPlanBoqModal({
  isOpen,
  onClose,
  floorPlan,
  projectId,
  projectName = 'Architectural Project',
  onBoqSaved,
  onBoqSent,
}: AiFloorPlanBoqModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'boq' | 'materials' | 'insights'>('boq');
  const [architectNotes] = useState('');
  const [data, setData] = useState<any | null>(null);

  // Forwarding to client state
  const [showForwardDialog, setShowForwardDialog] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(
    'Please review the Preliminary Bill of Quantities (BOQ) and Bulk Material Takeoff generated from our latest floor plan design.'
  );
  const [forwarding, setForwarding] = useState(false);
  const [forwardedSuccess, setForwardedSuccess] = useState(false);

  const runAiEstimation = useCallback(async () => {
    if (!floorPlan?.id) return;
    setLoading(true);
    setData(null);
    setForwardedSuccess(false);

    try {
      const res = await api('POST', '/api/architect/boq/generate-from-floorplan', {
        floorPlanId: floorPlan.id,
        projectId,
        architectNotes,
      });

      setData(res);
      toast.success('Preliminary BOQ & Material Estimation generated!');
      if (onBoqSaved && res.boq?.id) {
        onBoqSaved(res.boq.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate BOQ from floor plan');
    } finally {
      setLoading(false);
    }
  }, [floorPlan?.id, projectId, architectNotes, onBoqSaved]);

  // Auto-generate on open if not already loaded for this floor plan
  useEffect(() => {
    if (isOpen && floorPlan?.id && (!data || data.floorPlanDetails?.id !== floorPlan.id)) {
      runAiEstimation();
    }
  }, [isOpen, floorPlan?.id, data, runAiEstimation]);

  const handleForwardToClient = async () => {
    if (!data?.boq?.id) return;
    setForwarding(true);
    try {
      await api('POST', '/api/architect/boq/send-to-client', {
        boqId: data.boq.id,
        message: forwardMessage,
        notifyClient: true,
        postToChat: true,
      });
      toast.success('BOQ & Material Estimation forwarded to client dashboard!');
      setForwardedSuccess(true);
      setShowForwardDialog(false);
      onBoqSent?.(data.boq.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to forward BOQ to client');
    } finally {
      setForwarding(false);
    }
  };

  const exportCsv = () => {
    if (!data?.items) return;
    const header = 'Trade Category,Material,Description,Unit,Quantity,Unit Price (XAF),Total Cost (XAF),Notes\n';
    const rows = data.items
      .map(
        (i: any) =>
          `"${i.category}","${i.material}","${(i.description || '').replace(/"/g, '""')}","${i.unit}",${i.quantity},${i.unitPrice},${i.total},"${(i.notes || '').replace(/"/g, '""')}"`
      )
      .join('\n');
    const totalRow = `\n"TOTAL ESTIMATE","","","","","",${data.summary?.totalEstimatedCostXaf || 0},""`;

    const blob = new Blob([header + rows + totalRow], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOQ_${floorPlan.name.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('BOQ spreadsheet exported');
  };

  if (!isOpen) return null;

  const fmt = (n: number) => Math.round(n || 0).toLocaleString();

  // Group items by trade category
  const categories = data?.items
    ? Array.from(new Set(data.items.map((i: any) => i.category)))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface dark:bg-surface-container w-full max-w-5xl rounded-2xl shadow-2xl border border-outline-variant/60 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/60 dark:border-outline/40 flex items-center justify-between bg-surface-container-low/40 dark:bg-surface-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-headline-sm font-semibold text-on-surface">
                  AI Material Estimation & Preliminary BOQ
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-secondary-container dark:bg-primary-container text-primary">
                  {floorPlan.kind || '2D'} V{floorPlan.version || 1}
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant">
                Synthesized for <span className="font-semibold text-on-surface">{floorPlan.name}</span> · {projectName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {data && !loading && (
              <>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-label-sm font-medium flex items-center gap-1.5 text-on-surface transition-colors"
                  title="Export to CSV Spreadsheet"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>

                <button
                  type="button"
                  onClick={() => setShowForwardDialog(true)}
                  className={`px-3 py-1.5 rounded-lg text-label-sm font-medium flex items-center gap-1.5 transition-all shadow-xs ${
                    forwardedSuccess
                      ? 'bg-emerald-600 text-white'
                      : 'bg-teal-600 hover:bg-teal-500 text-white'
                  }`}
                >
                  {forwardedSuccess ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  {forwardedSuccess ? 'Forwarded to Client' : 'Forward to Client'}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            /* Loading & AI Takeoff Progress State */
            <div className="py-16 flex flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border-2 border-teal-500/40 flex items-center justify-center animate-pulse">
                  <Calculator className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              </div>

              <div className="text-center space-y-2 max-w-md">
                <h4 className="text-headline-sm font-semibold text-on-surface">
                  Analyzing Floor Plan Geometry & Generating BOQ...
                </h4>
                <p className="text-body-sm text-on-surface-variant">
                  Gemini AI is parsing architectural rooms, computing concrete & masonry takeoffs, and indexing current Central African market rates (FCFA).
                </p>
              </div>

              <div className="w-full max-w-md bg-surface-container-low dark:bg-surface-variant/40 rounded-xl p-4 border border-outline-variant/60 space-y-3 text-label-sm">
                <div className="flex items-center gap-2 text-teal-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Decomposing spatial boundaries & wall perimeters</span>
                </div>
                <div className="flex items-center gap-2 text-teal-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Calculating SMM7 quantities for concrete, rebar & blocks</span>
                </div>
                <div className="flex items-center gap-2 text-teal-600 animate-pulse">
                  <Clock className="w-4 h-4" />
                  <span>Applying regional labor and material cost benchmarks</span>
                </div>
              </div>
            </div>
          ) : !data ? (
            /* Error or Empty State */
            <div className="py-12 text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <h4 className="text-headline-sm font-semibold text-on-surface">No Estimate Generated</h4>
              <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
                Unable to compile BOQ. You can re-run the architectural takeoff engine.
              </p>
              <button
                type="button"
                onClick={runAiEstimation}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white font-medium text-body-sm"
              >
                Retry AI Takeoff
              </button>
            </div>
          ) : (
            /* Results View */
            <div className="space-y-6">
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant/30 border border-outline-variant/60">
                  <span className="text-[12px] font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
                    <Coins className="w-4 h-4 text-teal-600" />
                    Grand Total Estimate
                  </span>
                  <p className="text-headline-md font-bold text-teal-700 dark:text-teal-400 font-mono-technical">
                    {fmt(data.summary.grandTotalWithContingencyXaf)} <span className="text-xs font-normal">XAF</span>
                  </p>
                  <span className="text-[11px] text-on-surface-variant">
                    Incl. {data.summary.contingencyPercent}% contingency
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant/30 border border-outline-variant/60">
                  <span className="text-[12px] font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
                    <Building2 className="w-4 h-4 text-primary" />
                    Gross Floor Area
                  </span>
                  <p className="text-headline-md font-bold text-on-surface font-mono-technical">
                    {data.summary.grossFloorAreaM2} <span className="text-xs font-normal">m²</span>
                  </p>
                  <span className="text-[11px] text-on-surface-variant">
                    Cost: {fmt(data.summary.structuralCostPerM2)} XAF/m²
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant/30 border border-outline-variant/60">
                  <span className="text-[12px] font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Estimated Duration
                  </span>
                  <p className="text-headline-md font-bold text-on-surface font-mono-technical">
                    {data.summary.estimatedDurationMonths} <span className="text-xs font-normal">Months</span>
                  </p>
                  <span className="text-[11px] text-on-surface-variant">
                    From foundation to lockup
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low dark:bg-surface-variant/30 border border-outline-variant/60">
                  <span className="text-[12px] font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
                    <Package className="w-4 h-4 text-indigo-500" />
                    Takeoff Scope
                  </span>
                  <p className="text-headline-md font-bold text-on-surface font-mono-technical">
                    {data.summary.itemCount} <span className="text-xs font-normal">Line Items</span>
                  </p>
                  <span className="text-[11px] text-on-surface-variant">
                    Across {data.summary.tradeCount} trade categories
                  </span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('boq')}
                  className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'boq'
                      ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Bill of Quantities (BOQ)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'materials'
                      ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  Bulk Material Takeoff
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('insights')}
                  className={`px-4 py-2 rounded-lg text-body-sm font-medium transition-colors flex items-center gap-2 ${
                    activeTab === 'insights'
                      ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <HardHat className="w-4 h-4" />
                  Engineering & Site Insights
                </button>
              </div>

              {/* TAB 1: Itemized Trade BOQ */}
              {activeTab === 'boq' && (
                <div className="space-y-6">
                  {categories.map((cat: any) => {
                    const catItems = data.items.filter((i: any) => i.category === cat);
                    const catTotal = catItems.reduce((s: number, i: any) => s + (i.total || 0), 0);

                    return (
                      <div
                        key={cat}
                        className="rounded-xl border border-outline-variant/60 overflow-hidden bg-surface dark:bg-surface-container"
                      >
                        <div className="px-4 py-3 bg-surface-container-low dark:bg-surface-variant/40 border-b border-outline-variant/60 flex items-center justify-between">
                          <span className="font-semibold text-body-sm text-on-surface flex items-center gap-2">
                            <Layers className="w-4 h-4 text-teal-600" />
                            {cat}
                          </span>
                          <span className="font-mono-technical font-semibold text-primary dark:text-primary-fixed-dim text-body-sm">
                            {fmt(catTotal)} XAF
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-body-sm">
                            <thead>
                              <tr className="text-left text-label-md text-on-surface-variant border-b border-outline-variant/40">
                                <th className="px-4 py-2.5">Material & Specification</th>
                                <th className="px-4 py-2.5">Unit</th>
                                <th className="px-4 py-2.5 text-right">Quantity</th>
                                <th className="px-4 py-2.5 text-right">Unit Rate (XAF)</th>
                                <th className="px-4 py-2.5 text-right">Total (XAF)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-outline-variant/30">
                              {catItems.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-surface-container-low/50">
                                  <td className="px-4 py-2.5">
                                    <div className="font-medium text-on-surface">{item.material}</div>
                                    <div className="text-[12px] text-on-surface-variant">{item.description}</div>
                                    {item.notes && (
                                      <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-0.5">
                                        💡 {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-on-surface-variant font-mono">{item.unit}</td>
                                  <td className="px-4 py-2.5 text-right font-mono-technical">{item.quantity}</td>
                                  <td className="px-4 py-2.5 text-right font-mono-technical">{fmt(item.unitPrice)}</td>
                                  <td className="px-4 py-2.5 text-right font-mono-technical font-semibold text-on-surface">
                                    {fmt(item.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: Bulk Materials Takeoff */}
              {activeTab === 'materials' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 text-body-sm text-teal-900 dark:text-teal-200">
                    <p className="font-medium">Consolidated Bulk Procurement Takeoff</p>
                    <p className="text-[12px] text-teal-700 dark:text-teal-300 mt-0.5">
                      Quantities incorporate standard 5% - 10% site cutting and breakage waste allowances.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.materials?.map((mat: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 dark:bg-surface-variant/20 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h5 className="font-semibold text-body-sm text-on-surface">{mat.material}</h5>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
                              +{mat.wasteAllowancePercent}% waste
                            </span>
                          </div>
                          <p className="text-label-sm text-on-surface-variant">{mat.specification}</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                          <div>
                            <span className="text-[11px] text-on-surface-variant">Estimated Quantity</span>
                            <p className="font-mono-technical font-bold text-headline-sm text-primary">
                              {mat.estimatedQuantity} <span className="text-xs font-normal">{mat.unit}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-on-surface-variant">Estimated Budget</span>
                            <p className="font-mono-technical font-bold text-body-sm text-on-surface">
                              {fmt(mat.totalCost)} XAF
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Engineering Insights & Recommendations */}
              {activeTab === 'insights' && (
                <div className="space-y-6">
                  {/* Site Analysis */}
                  <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 space-y-2">
                    <h5 className="font-semibold text-body-sm text-on-surface flex items-center gap-2">
                      <HardHat className="w-4 h-4 text-teal-600" />
                      Structural & Soil Baseline
                    </h5>
                    <p className="text-body-sm text-on-surface-variant">
                      {data.engineeringInsights.siteAnalysis}
                    </p>
                    <p className="text-[12px] font-mono text-teal-700 dark:text-teal-400">
                      Concrete Grade: {data.summary.concreteGradeSpecification} · Soil: {data.summary.soilAssumption}
                    </p>
                  </div>

                  {/* Structural & Value Engineering Recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 space-y-3">
                      <h5 className="font-semibold text-body-sm text-on-surface flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Structural Execution Guidelines
                      </h5>
                      <ul className="space-y-2 text-body-sm text-on-surface-variant">
                        {data.engineeringInsights.structuralRecommendations?.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 space-y-3">
                      <h5 className="font-semibold text-body-sm text-on-surface flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-indigo-500" />
                        Value Engineering Opportunities
                      </h5>
                      <ul className="space-y-2 text-body-sm text-on-surface-variant">
                        {data.engineeringInsights.valueEngineeringTips?.map((tip: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Construction Milestones */}
                  <div className="p-4 rounded-xl border border-outline-variant/60 bg-surface-container-low/40 space-y-3">
                    <h5 className="font-semibold text-body-sm text-on-surface flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Phased Construction Timeline & Cost Allocation
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {data.engineeringInsights.estimatedMilestones?.map((m: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg bg-surface dark:bg-surface-container border border-outline-variant/40">
                          <span className="font-semibold text-body-sm text-on-surface block truncate">{m.milestone}</span>
                          <div className="flex items-center justify-between text-[12px] text-on-surface-variant mt-1">
                            <span>Duration: {m.durationWeeks} weeks</span>
                            <span className="font-semibold text-teal-600 font-mono">{m.costSharePercent}% budget</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Forward Dialog Modal Overlay */}
        {showForwardDialog && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-20">
            <div className="bg-surface dark:bg-surface-container p-6 rounded-2xl max-w-md w-full border border-outline-variant shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-headline-sm text-on-surface flex items-center gap-2">
                  <Send className="w-4 h-4 text-teal-600" />
                  Forward BOQ to Client
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForwardDialog(false)}
                  className="p-1 rounded-full hover:bg-surface-container-low"
                >
                  <X className="w-4 h-4 text-on-surface-variant" />
                </button>
              </div>

              <p className="text-body-sm text-on-surface-variant">
                This will publish the Preliminary BOQ & Material Estimation directly to the client&apos;s <strong>Estimates & BOQs</strong> page and post a deliverable card to the project team chat.
              </p>

              <div className="space-y-1.5">
                <label className="text-label-sm font-medium text-on-surface">Architect Note to Client</label>
                <textarea
                  rows={3}
                  value={forwardMessage}
                  onChange={(e) => setForwardMessage(e.target.value)}
                  className="w-full text-body-sm rounded-lg border border-outline-variant/60 p-2.5 bg-surface-container-low dark:bg-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter message for client..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForwardDialog(false)}
                  className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-label-sm text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleForwardToClient}
                  disabled={forwarding}
                  className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-label-sm flex items-center gap-1.5 shadow-xs"
                >
                  {forwarding ? 'Sending…' : 'Confirm & Forward'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
