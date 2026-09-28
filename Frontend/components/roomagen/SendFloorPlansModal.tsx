'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Send,
  X,
  Layers,
  Box,
  Bell,
  MessageSquare,
  User,
  Building,
  Check,
  Loader2,
  FileCheck,
} from 'lucide-react';

export interface PlanDeliverableItem {
  id: string; // FloorPlan ID or RoomagenJob ID
  name: string;
  kind: '2D' | '3D';
  version?: number;
  previewUrl?: string;
  isJob?: boolean; // true if it's a RoomagenJob that needs auto-saving
  jobId?: string;
  tool?: string;
  status?: string;
}

interface SendFloorPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  clientId?: string;
  clientName?: string;
  initialPlans?: PlanDeliverableItem[];
  onSentSuccessfully?: (deliveredCount: number) => void;
}

export function SendFloorPlansModal({
  isOpen,
  onClose,
  projectId,
  projectName = 'Architectural Project',
  clientId,
  clientName,
  initialPlans = [],
  onSentSuccessfully,
}: SendFloorPlansModalProps) {
  const [plans, setPlans] = useState<PlanDeliverableItem[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [resolvedClient, setResolvedClient] = useState<{ id: string; name: string; email?: string }>({
    id: clientId || '',
    name: clientName || 'Client',
  });
  const [message, setMessage] = useState<string>('');
  const [notifyClient, setNotifyClient] = useState<boolean>(true);
  const [postToChat, setPostToChat] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingPlans, setFetchingPlans] = useState<boolean>(false);

  // Load project details and existing floorplans if needed
  useEffect(() => {
    if (!isOpen || !projectId) return;

    let isMounted = true;
    async function fetchProjectAndPlans() {
      setFetchingPlans(true);
      try {
        // Fetch project floor plans from DB
        const res = await fetch(`/api/architect/floorplans?projectId=${projectId}`);
        const data = await res.json();
        const existingPlans: any[] = data.floorPlans || [];

        // Also fetch project to get client details
        const projRes = await fetch(`/api/architect/projects`);
        const projData = await projRes.json();
        const currentProj = (projData.projects || []).find((p: any) => p.id === projectId);

        if (isMounted && currentProj) {
          setResolvedClient({
            id: currentProj.ownerId,
            name: currentProj.clientName || 'Client',
          });
        }

        // Merge initialPlans with existing project plans
        const mergedMap = new Map<string, PlanDeliverableItem>();

        // Add initial plans (e.g. currently generated in Roomagen)
        initialPlans.forEach((p) => {
          mergedMap.set(p.id, p);
        });

        // Add existing DB floor plans
        existingPlans.forEach((ep) => {
          if (!mergedMap.has(ep.id)) {
            let preview = ep.svgData;
            if (!preview && ep.data) {
              try {
                const parsed = typeof ep.data === 'string' ? JSON.parse(ep.data) : ep.data;
                preview = parsed?.imageUrl || parsed?.outputAssetUrl;
              } catch {}
            }
            mergedMap.set(ep.id, {
              id: ep.id,
              name: ep.name,
              kind: ep.kind === '3D' ? '3D' : '2D',
              version: ep.version,
              previewUrl: preview,
              isJob: false,
              status: ep.status,
            });
          }
        });

        const list = Array.from(mergedMap.values());
        if (isMounted) {
          setPlans(list);
          // By default, select all completed/available plans
          setSelectedPlanIds(new Set(list.map((p) => p.id)));
        }
      } catch (err) {
        console.error('Failed to load project plans', err);
      } finally {
        if (isMounted) setFetchingPlans(false);
      }
    }

    fetchProjectAndPlans();

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, initialPlans]);

  // Handle template selection
  const applyTemplate = (type: 'standard' | 'revision' | 'detailed') => {
    const cName = resolvedClient.name.split(' ')[0] || 'there';
    switch (type) {
      case 'standard':
        setMessage(`Hello ${cName}, I've finalized the architectural floor plans using Roomagen. Please review the 2D layout and 3D spatial perspective and share your feedback.`);
        break;
      case 'revision':
        setMessage(`Hello ${cName}, here are the updated 2D blueprint and 3D floor plan visualizations incorporating our recent discussions.`);
        break;
      case 'detailed':
        setMessage(`Hello ${cName}, please explore both the 2D CAD floor plan for dimensional layout and the 3D perspective visualization. Let me know if you would like any modifications before we proceed.`);
        break;
    }
  };

  const togglePlan = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectFilter = (filter: 'all' | '2D' | '3D') => {
    if (filter === 'all') {
      setSelectedPlanIds(new Set(plans.map((p) => p.id)));
    } else {
      setSelectedPlanIds(new Set(plans.filter((p) => p.kind === filter).map((p) => p.id)));
    }
  };

  const handleSend = async () => {
    if (selectedPlanIds.size === 0) {
      toast.error('Please select at least one floor plan to send to the client.');
      return;
    }

    setLoading(true);

    try {
      const selectedItems = plans.filter((p) => selectedPlanIds.has(p.id));
      const floorPlanIds = selectedItems.filter((p) => !p.isJob).map((p) => p.id);
      const jobIds = selectedItems.filter((p) => p.isJob).map((p) => p.jobId || p.id);

      const res = await fetch('/api/architect/floorplans/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          clientId: resolvedClient.id,
          floorPlanIds,
          jobIds,
          message: message.trim() || undefined,
          notifyClient,
          postToChat,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send floor plans to client');
      }

      toast.success(`Successfully sent ${data.deliveredCount || selectedPlanIds.size} floor plan(s) to ${resolvedClient.name}!`);
      if (onSentSuccessfully) {
        onSentSuccessfully(data.deliveredCount || selectedPlanIds.size);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error sending floor plans');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const count2D = plans.filter((p) => p.kind === '2D').length;
  const count3D = plans.filter((p) => p.kind === '3D').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                Send Floor Plans to Client
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-500/15 text-teal-300 border border-teal-500/30">
                  Roomagen AI Deliverable
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Publish 2D layouts and 3D visualizations directly to your client for real-time review.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Target Client & Project Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/70">
            <div className="flex items-center gap-2.5">
              <Building className="w-4 h-4 text-zinc-400 shrink-0" />
              <div className="overflow-hidden">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block font-medium">Project</span>
                <span className="text-xs font-semibold text-zinc-200 truncate block">{projectName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-teal-400 shrink-0" />
              <div className="overflow-hidden">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 block font-medium">Recipient Client</span>
                <span className="text-xs font-semibold text-zinc-200 truncate block">{resolvedClient.name}</span>
              </div>
            </div>
          </div>

          {/* Floor Plans Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-teal-400" />
                Select Deliverables ({selectedPlanIds.size} of {plans.length} selected)
              </label>

              {/* Filter pills */}
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => selectFilter('all')}
                  className="px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                >
                  All ({plans.length})
                </button>
                {count2D > 0 && (
                  <button
                    type="button"
                    onClick={() => selectFilter('2D')}
                    className="px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                  >
                    2D Only ({count2D})
                  </button>
                )}
                {count3D > 0 && (
                  <button
                    type="button"
                    onClick={() => selectFilter('3D')}
                    className="px-2 py-0.5 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors"
                  >
                    3D Only ({count3D})
                  </button>
                )}
              </div>
            </div>

            {fetchingPlans ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-zinc-500">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
                <span className="text-xs">Loading project floor plans...</span>
              </div>
            ) : plans.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 text-center text-xs text-zinc-500">
                No floor plans found for this project yet. Generate a 2D floor plan or 3D visualization above first!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {plans.map((p) => {
                  const isChecked = selectedPlanIds.has(p.id);
                  const is3D = p.kind === '3D';

                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePlan(p.id)}
                      className={`cursor-pointer p-3 rounded-xl border transition-all flex items-start gap-3 select-none ${
                        isChecked
                          ? 'border-teal-500/50 bg-teal-950/20 text-zinc-100 ring-1 ring-teal-500/20'
                          : 'border-zinc-800/80 bg-zinc-900/30 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-teal-500 text-black' : 'border border-zinc-600 bg-zinc-900'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      {/* Icon */}
                      <div className="w-8 h-8 rounded-lg bg-zinc-800/70 border border-zinc-700/60 flex items-center justify-center shrink-0">
                        {is3D ? (
                          <Box className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Layers className="w-4 h-4 text-teal-400" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs text-zinc-200 truncate block">{p.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                              is3D ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {p.kind}
                          </span>
                          {p.version && (
                            <span className="text-[10px] text-zinc-500 font-mono">v{p.version}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {is3D ? '3D Neural Visualization' : '2D Architectural Layout'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message to Client */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                Message / Review Instructions
              </label>

              {/* Quick Template Buttons */}
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span className="text-zinc-500 mr-1">Templates:</span>
                <button
                  type="button"
                  onClick={() => applyTemplate('standard')}
                  className="hover:text-teal-300 underline underline-offset-2 transition-colors"
                >
                  Standard
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => applyTemplate('revision')}
                  className="hover:text-teal-300 underline underline-offset-2 transition-colors"
                >
                  Revision
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => applyTemplate('detailed')}
                  className="hover:text-teal-300 underline underline-offset-2 transition-colors"
                >
                  Detailed
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Hi Jordan, please take a look at the revised 2D room layouts and 3D architectural renders. Let me know your thoughts on the living room spatial distribution!"
              className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
            />
          </div>

          {/* Delivery Channels */}
          <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              Delivery Channels
            </span>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={notifyClient}
                onChange={(e) => setNotifyClient(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-teal-500 focus:ring-0"
              />
              <Bell className="w-3.5 h-3.5 text-zinc-400" />
              <span>Send in-app notification with instant link to 2D & 3D visualizers</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={postToChat}
                onChange={(e) => setPostToChat(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-teal-500 focus:ring-0"
              />
              <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
              <span>Share deliverable summary and card directly into Project Discussion chat</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 hidden sm:block">
            {selectedPlanIds.size} deliverable{selectedPlanIds.size === 1 ? '' : 's'} ready to dispatch
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={loading || selectedPlanIds.size === 0}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-zinc-950 flex items-center gap-2 shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching to Client...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Floor Plans to {resolvedClient.name.split(' ')[0]}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
