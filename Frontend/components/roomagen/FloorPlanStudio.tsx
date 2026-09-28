'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Card,
  StatusPill,
  btnPrimary,
  btnGhost,
  inputClass,
  Spinner,
} from '@/Frontend/components/architect/ui';
import { ImageComparisonSlider } from './ImageComparisonSlider';
import { ProcessingStages } from './ProcessingStages';
import { SendFloorPlansModal } from './SendFloorPlansModal';
import { AiFloorPlanBoqModal } from './AiFloorPlanBoqModal';

export type RoomagenTool = 'SKETCH_TO_FLOOR_PLAN' | 'FLOOR_PLAN_TO_3D' | 'FLOOR_PLAN_COLORIZE';

interface FloorPlanStudioProps {
  initialProjectId?: string;
  projects?: Array<{ id: string; name: string }>;
  onFloorPlanSaved?: (floorPlan: any) => void;
}

export function FloorPlanStudio({
  initialProjectId,
  projects = [],
  onFloorPlanSaved,
}: FloorPlanStudioProps) {
  const [projectId, setProjectId] = useState<string>(initialProjectId || projects[0]?.id || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedAssetUrl, setUploadedAssetUrl] = useState<string | null>(null);
  const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Active Job State
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [selectedTool, setSelectedTool] = useState<RoomagenTool>('SKETCH_TO_FLOOR_PLAN');
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [showSendModal, setShowSendModal] = useState<boolean>(false);
  const [boqModalPlan, setBoqModalPlan] = useState<any | null>(null);

  // History / Versions
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequest = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollController = useRef<AbortController | null>(null);

  // Fetch project generations history
  const fetchHistory = useCallback(async (projId: string) => {
    const request = ++historyRequest.current;
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const res = await fetch('/api/roomagen/jobs' + (projId ? '?projectId=' + encodeURIComponent(projId) : ''));
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error('Unable to load history');
      if (request === historyRequest.current) setHistory(data.data?.jobs || []);
    } catch {
      if (request === historyRequest.current) setHistoryError('Unable to load generation history. Please refresh.');
    } finally {
      if (request === historyRequest.current) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setHistory([]);
    fetchHistory(projectId);
  }, [projectId, fetchHistory]);

  useEffect(() => () => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    pollController.current?.abort();
  }, []);

  // Schedule only after the previous request finishes; cancel stale job requests.
  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    pollController.current?.abort();
    const controller = new AbortController();
    pollController.current = controller;
    const startedAt = Date.now();
    const poll = async () => {
      if (controller.signal.aborted) return;
      try {
        const res = await fetch('/api/roomagen/jobs/' + jobId, { signal: controller.signal });
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (data?.success && data?.data) {
          const job = data.data;
          setCurrentJob(job);
          if (['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(job.status)) {
            setIsGenerating(false);
            if (job.status === 'COMPLETED') toast.success('AI generation completed!');
            else toast.error(job.errorMessage || 'Generation ' + job.status.toLowerCase());
            fetchHistory(projectId);
            return;
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (Date.now() - startedAt > 10 * 60_000) {
        setIsGenerating(false);
        toast.info('Generation is taking longer than expected. Check project history later.');
        return;
      }
      const delay = document.hidden ? 15_000 : Date.now() - startedAt > 60_000 ? 8_000 : 4_000;
      pollingRef.current = setTimeout(poll, delay);
    };
    pollingRef.current = setTimeout(poll, 4_000);
  }, [projectId, fetchHistory]);

  // Handle local file selection
  const handleFileChange = (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size exceeds 10 MB limit');
      return;
    }
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast.error('Please upload a PNG, JPG, or WebP image');
      return;
    }

    setSelectedFile(file);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploadedAssetUrl(null);
    setUploadedAssetId(null);
    setCurrentJob(null);
  };

  // Upload image to BuildSmart storage
  const uploadImage = async (): Promise<{ url: string; assetId: string } | null> => {
    if (uploadedAssetUrl && uploadedAssetId) {
      return { url: uploadedAssetUrl, assetId: uploadedAssetId };
    }
    if (!selectedFile) return null;

    setIsUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    if (projectId) fd.append('projectId', projectId);

    try {
      const res = await fetch('/api/roomagen/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error?.message || 'Upload failed');
      }

      setUploadedAssetUrl(data.data.url);
      setUploadedAssetId(data.data.assetId);
      return { url: data.data.url, assetId: data.data.assetId };
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload image');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Trigger Generation
  const handleGenerate = async (tool: RoomagenTool) => {
    setSelectedTool(tool);
    setIsGenerating(true);

    let assetUrl = uploadedAssetUrl;
    let assetId = uploadedAssetId;

    if (!assetUrl) {
      const uploadRes = await uploadImage();
      if (!uploadRes) {
        setIsGenerating(false);
        return;
      }
      assetUrl = uploadRes.url;
      assetId = uploadRes.assetId;
    }

    try {
      const endpoint = projectId
        ? `/api/projects/${projectId}/roomagen`
        : '/api/roomagen/jobs';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool,
          imageUrl: assetUrl,
          inputAssetId: assetId,
          projectId: projectId || null,
        }),
      });

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error?.message || 'Failed to start generation');
      }

      const job = data.data;
      setCurrentJob(job);

      if (job.status === 'COMPLETED') {
        setIsGenerating(false);
        toast.success('AI generation completed!');
        fetchHistory(projectId);
      } else {
        startPolling(job.id);
      }
    } catch (err: any) {
      setIsGenerating(false);
      toast.error(err.message || 'Generation failed to start');
    }
  };

  // Save generated floor plan as official BuildSmart version
  const handleSaveToProject = async () => {
    if (!currentJob || !projectId || currentJob.status !== 'COMPLETED') return;

    setSavingPlan(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/roomagen/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: currentJob.id,
          name: `${currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D Visualization' : 'AI Floor Plan'} v${currentJob.version}`,
        }),
      });

      const data = await res.json();
      if (!data?.success) {
        throw new Error(data?.error?.message || 'Failed to save floor plan');
      }

      toast.success('Saved to project floor plans!');
      if (onFloorPlanSaved) onFloorPlanSaved(data.data.floorPlan);
      fetchHistory(projectId);
    } catch (err: any) {
      toast.error(err.message || 'Could not save floor plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // Download Output
  const handleDownload = () => {
    if (!currentJob?.outputAssetUrl) return;
    const a = document.createElement('a');
    a.href = currentJob.outputAssetUrl;
    const isSvg = currentJob.outputAssetUrl.includes('.svg') || currentJob.outputAssetUrl.includes('/assets/');
    const ext = isSvg ? 'svg' : 'png';
    const toolSlug = currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D_Visualization' : 'FloorPlan';
    a.download = `BuildSmart_${projectId || 'Design'}_${toolSlug}_v${currentJob.version || 1}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasOutput = currentJob?.status === 'COMPLETED' && Boolean(currentJob?.outputAssetUrl);

  return (
    <div className="space-y-6">
      {/* Studio Header & Project Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-surface-dim p-4 rounded-xl border border-outline-variant dark:border-outline">
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[24px]">magic_button</span>
            Floor Plan Studio
          </h2>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">
            Transform hand-drawn architectural sketches into 2D floor plans & 3D visualizations with Roomagen AI.
          </p>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-label-md text-on-surface-variant dark:text-surface-variant whitespace-nowrap">
              Project:
            </span>
            <select
              className={inputClass + ' w-auto max-w-[200px]'}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Select Project"
            >
              <option value="">All projects / unassigned</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {projectId && (
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                title="Send generated 2D/3D floor plans to client for visualization"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Send to Client</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input & Actions */}
        <div className="space-y-4 lg:col-span-1">
          <Card pad={true} className="space-y-4">
            <h3 className="text-label-lg font-semibold text-on-surface dark:text-inverse-on-surface flex items-center justify-between">
              <span>Input Design</span>
              {previewUrl && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setUploadedAssetUrl(null);
                    setUploadedAssetId(null);
                    setCurrentJob(null);
                  }}
                  className="text-label-sm text-error hover:underline"
                >
                  Remove
                </button>
              )}
            </h3>

            {/* Upload Area */}
            {!previewUrl ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-outline-variant hover:border-primary dark:border-outline rounded-xl p-8 text-center cursor-pointer transition-colors bg-surface-container-lowest dark:bg-surface-dim hover:bg-surface-container-low"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
                <span className="material-symbols-outlined text-[48px] text-primary/70 mb-2 block">
                  cloud_upload
                </span>
                <p className="text-label-lg font-semibold text-on-surface dark:text-inverse-on-surface mb-1">
                  Drag & drop your sketch here
                </p>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-3">
                  or browse from your device
                </p>
                <span className="inline-block text-[11px] font-medium text-on-surface-variant/70 border border-outline-variant/60 rounded px-2 py-0.5">
                  PNG, JPG, WebP up to 10 MB
                </span>
              </div>
            ) : (
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-outline-variant dark:border-outline bg-black/5 dark:bg-white/5 flex items-center justify-center group">
                <img
                  src={previewUrl}
                  alt="Selected input sketch"
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-label-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 backdrop-blur-sm transition-colors opacity-90 group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-[16px]">change_circle</span>
                  Replace
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />
              </div>
            )}

            {/* Generation Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-outline-variant dark:border-outline">
              <span className="text-label-md font-medium text-on-surface-variant dark:text-surface-variant block mb-2">
                Generation Actions
              </span>

              {/* Action 1: Sketch to 2D Floor Plan */}
              <button
                onClick={() => handleGenerate('SKETCH_TO_FLOOR_PLAN')}
                disabled={!previewUrl || isGenerating || isUploading}
                className={`${btnPrimary} w-full`}
                title={!previewUrl ? 'Please upload a sketch first' : ''}
              >
                {isGenerating && selectedTool === 'SKETCH_TO_FLOOR_PLAN' ? (
                  <>
                    <Spinner size={18} />
                    Processing 2D Plan...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">floor</span>
                    Convert to 2D Floor Plan
                  </>
                )}
              </button>

              {/* Action 2: 2D Floor Plan to 3D Visualization */}
              <button
                onClick={() => handleGenerate('FLOOR_PLAN_TO_3D')}
                disabled={!previewUrl || isGenerating || isUploading}
                className={`${btnGhost} w-full`}
              >
                {isGenerating && selectedTool === 'FLOOR_PLAN_TO_3D' ? (
                  <>
                    <Spinner size={18} />
                    Generating 3D Scene...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
                    Generate 3D Visualization
                  </>
                )}
              </button>

              {/* Action 3: Colorize Floor Plan */}
              <button
                onClick={() => handleGenerate('FLOOR_PLAN_COLORIZE')}
                disabled={!previewUrl || isGenerating || isUploading}
                className={`${btnGhost} w-full`}
              >
                {isGenerating && selectedTool === 'FLOOR_PLAN_COLORIZE' ? (
                  <>
                    <Spinner size={18} />
                    Colorizing...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">palette</span>
                    Colorize Floor Plan
                  </>
                )}
              </button>
            </div>
          </Card>

          {/* Architectural Advisory Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-yellow-950/20 border border-amber-200 dark:border-yellow-800/40 text-amber-900 dark:text-amber-200 text-body-sm flex gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-amber-600 dark:text-yellow-400 flex-shrink-0 mt-0.5">
              info
            </span>
            <p className="text-[12px] leading-relaxed">
              <strong>Professional Notice:</strong> Roomagen AI generates visual design representations. Output is conceptual design assistance and requires professional architect review and dimensional validation before construction planning.
            </p>
          </div>
        </div>

        {/* Right Column: Display / Processing / Result View */}
        <div className="space-y-4 lg:col-span-2">
          {isGenerating ? (
            <Card pad={true}>
              <ProcessingStages tool={selectedTool} isProcessing={isGenerating} />
            </Card>
          ) : hasOutput && previewUrl ? (
            <div className="space-y-4">
              <Card pad={false} className="overflow-hidden">
                <ImageComparisonSlider
                  beforeImage={previewUrl}
                  afterImage={currentJob.outputAssetUrl}
                  beforeLabel="Original Input"
                  afterLabel={
                    currentJob.tool === 'FLOOR_PLAN_TO_3D'
                      ? 'AI 3D Visualization'
                      : 'AI Floor Plan'
                  }
                />
                
                {/* Result Actions Bar */}
                <div className="p-4 bg-white dark:bg-surface-dim border-t border-outline-variant dark:border-outline flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <StatusPill status="COMPLETED" />
                      <span className="text-label-sm font-semibold text-on-surface dark:text-white">
                        {currentJob.metadata?.analysis?.title || `Version ${currentJob.version || 1} · ${currentJob.tool.replace(/_/g, ' ')}`}
                      </span>
                    </div>
                    {currentJob.metadata?.analysis?.summary && (
                      <p className="text-[11px] text-on-surface-variant dark:text-zinc-400 line-clamp-1">
                        {currentJob.metadata.analysis.summary}
                      </p>
                    )}
                    {currentJob.metadata?.analysis?.rooms && currentJob.metadata.analysis.rooms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentJob.metadata.analysis.rooms.map((r: any, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-container px-2 py-0.5 rounded-full"
                          >
                            <span className="material-symbols-outlined text-[11px]">
                              {r.type === 'bedroom' ? 'bed' : r.type === 'kitchen' ? 'countertops' : r.type === 'bath' ? 'bathtub' : 'door_sliding'}
                            </span>
                            {r.name} {r.dimensions ? `(${r.dimensions})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleDownload}
                      className={btnGhost}
                      title="Download high-resolution image"
                    >
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      Download
                    </button>

                    {projectId && (
                      <button
                        onClick={handleSaveToProject}
                        disabled={savingPlan}
                        className={btnPrimary}
                        title="Promote to official project floor plan"
                      >
                        {savingPlan ? (
                          <>
                            <Spinner size={16} />
                            Saving...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[18px]">bookmark</span>
                            Save to Project
                          </>
                        )}
                      </button>
                    )}

                    {projectId && (
                      <button
                        type="button"
                        onClick={() => setShowSendModal(true)}
                        className="btnPrimary !bg-teal-600 hover:!bg-teal-500 text-white flex items-center gap-1.5 shadow-md shadow-teal-600/20"
                        title="Send 2D & 3D floor plans to client for review and visualization"
                      >
                        <span className="material-symbols-outlined text-[18px]">send</span>
                        Send to Client
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setBoqModalPlan({
                          id: currentJob.id,
                          name: `${currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D Visualization' : 'AI Floor Plan'} V${currentJob.version || 1}`,
                          kind: currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D' : '2D',
                          version: currentJob.version || 1,
                          previewUrl: currentJob.outputAssetUrl,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-teal-950/40 border border-teal-500/40 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/40 flex items-center gap-1.5 transition-colors shadow-xs"
                      title="Analyze floor plan and generate preliminary BOQ and material estimation"
                    >
                      <span className="material-symbols-outlined text-[16px] text-teal-600">calculate</span>
                      AI Estimate & BOQ
                    </button>

                    {currentJob.tool === 'SKETCH_TO_FLOOR_PLAN' && (
                      <button
                        onClick={() => {
                          setPreviewUrl(currentJob.outputAssetUrl);
                          setUploadedAssetUrl(currentJob.outputAssetUrl);
                          handleGenerate('FLOOR_PLAN_TO_3D');
                        }}
                        className={`${btnGhost} text-primary font-semibold`}
                        title="Take this 2D floor plan and generate a 3D visualization"
                      >
                        <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
                        Generate 3D
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card pad={true} className="text-center py-16">
              <span className="material-symbols-outlined text-[64px] text-outline-variant dark:text-outline mb-3 block">
                architecture
              </span>
              <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-2">
                Start Your Project Design
              </h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant max-w-md mx-auto mb-6">
                Upload a hand-drawn sketch, conceptual doodle, or existing floor plan to begin generating AI visual floor plans and 3D scenes.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={btnPrimary}
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Upload Sketch to Begin
              </button>
            </Card>
          )}

          {/* Project Generation History & Versioning */}
          {(
            <Card pad={true} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                  Generation History ({history.length})
                </h3>
                <div className="flex items-center gap-2">
                  {projectId && history.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSendModal(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 shadow-sm transition-colors"
                      title="Send selected 2D/3D floor plans to client"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      Send to Client
                    </button>
                  )}
                  <button type="button" onClick={() => fetchHistory(projectId)} disabled={loadingHistory} className={btnGhost}>
                    {loadingHistory ? <Spinner size={16} /> : 'Refresh'}
                  </button>
                </div>
              </div>

              {historyError && <p role="alert" className="text-sm text-red-600">{historyError}</p>}
              {!loadingHistory && !historyError && history.length === 0 && <p className="text-sm text-on-surface-variant">No generations yet. Your 2D plans and 3D renders will appear here automatically.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {history.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      if (pollingRef.current) clearTimeout(pollingRef.current);
                      pollController.current?.abort();
                      setCurrentJob(item);
                      setSelectedTool(item.tool);
                      setSelectedFile(null);
                      setPreviewUrl(item.inputAssetUrl || null);
                      setUploadedAssetUrl(item.inputAssetUrl || null);
                      setUploadedAssetId(item.inputAssetId || null);
                      const pending = ['PROCESSING', 'PENDING'].includes(item.status);
                      setIsGenerating(pending);
                      if (pending) startPolling(item.id);
                    }}
                    className={`cursor-pointer rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                      currentJob?.id === item.id
                        ? 'border-primary ring-2 ring-primary/20 bg-secondary-container/20 dark:bg-primary-container/10'
                        : 'border-outline-variant dark:border-outline hover:border-primary/60 bg-surface-container-lowest dark:bg-surface-dim'
                    }`}
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                      <img
                        src={item.outputAssetUrl || item.inputAssetUrl || '/images/project-floorplan.png'}
                        loading="lazy"
                        alt={`Version ${item.version}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-1.5 left-1.5">
                        <StatusPill status={item.status} />
                      </div>
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/70 text-white">
                        v{item.version}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-label-sm">
                      <span className="font-semibold text-on-surface dark:text-inverse-on-surface truncate">
                        {item.tool === 'FLOOR_PLAN_TO_3D' ? '3D Render' : item.tool === 'FLOOR_PLAN_COLORIZE' ? 'Colorized Plan' : '2D Floor Plan'}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Send Floor Plans to Client Modal */}
      <SendFloorPlansModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        projectId={projectId}
        projectName={projects.find((p) => p.id === projectId)?.name}
        initialPlans={
          currentJob && currentJob.status === 'COMPLETED'
            ? [
                {
                  id: currentJob.id,
                  name: `${currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D Visualization' : '2D Floor Plan'} v${currentJob.version || 1}`,
                  kind: currentJob.tool === 'FLOOR_PLAN_TO_3D' ? '3D' : '2D',
                  version: currentJob.version,
                  previewUrl: currentJob.outputAssetUrl,
                  isJob: true,
                  jobId: currentJob.id,
                  tool: currentJob.tool,
                },
              ]
            : []
        }
        onSentSuccessfully={() => {
          fetchHistory(projectId);
        }}
      />

      {/* AI Floor Plan BOQ & Material Estimation Modal */}
      {boqModalPlan && (
        <AiFloorPlanBoqModal
          isOpen={Boolean(boqModalPlan)}
          onClose={() => setBoqModalPlan(null)}
          floorPlan={boqModalPlan}
          projectId={projectId}
          projectName={projects.find((p) => p.id === projectId)?.name}
        />
      )}
    </div>
  );
}
