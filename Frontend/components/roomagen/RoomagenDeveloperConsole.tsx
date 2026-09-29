'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  Code2,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
  Radio,
  Webhook,
  Activity,
  Copy,
  Check,
  Download,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Maximize2,
  FolderPlus,
  Clock,
  ArrowRight,
  Eye,
  Info,
  Zap,
} from 'lucide-react';
import { ImageComparisonSlider } from './ImageComparisonSlider';

export type ToolType = 'SKETCH_TO_FLOOR_PLAN' | 'FLOOR_PLAN_TO_3D' | 'FLOOR_PLAN_COLORIZE';

interface SampleItem {
  id: string;
  title: string;
  category: string;
  recommendedTool: ToolType;
  imageUrl: string;
  description: string;
  suggestedPrompt: string;
  stylePreset: string;
}

interface HealthData {
  status: string;
  provider: string;
  configured: boolean;
  baseUrl: string;
  webhookEndpoint: string;
  webhookSecretConfigured: boolean;
  tools: string[];
  latencyMs: number;
}

const STYLE_PRESETS = [
  'Modern Minimalist',
  'Contemporary Luxury',
  'Scandinavian Simplicity',
  'Industrial Loft',
  'Bauhaus Architectural',
  'Japandi Organic',
  'Mediterranean Coastal',
  'Tropical Modernism',
];

const VIEW_MODES = [
  { id: 'isometric_cutaway', label: 'Isometric Cutaway (Axonometric)' },
  { id: 'eye_level_interior', label: 'Eye-Level Walkthrough' },
  { id: 'aerial_top_down', label: 'Aerial Top-Down (Bird’s Eye)' },
];

const LIGHTING_MODES = [
  { id: 'natural_daylight', label: 'Natural Daylight (Crisp Morning)' },
  { id: 'golden_hour', label: 'Golden Hour (Warm Architectural)' },
  { id: 'evening_ambient', label: 'Evening Ambient (Interior Fixtures)' },
  { id: 'high_contrast_museum', label: 'Dramatic Architectural Accent' },
];

const MATERIAL_PALETTES = [
  { id: 'hardwood_marble', label: 'Warm Hardwood & Carrara Marble' },
  { id: 'concrete_steel', label: 'Polished Concrete & Brushed Steel' },
  { id: 'scandinavian_oak', label: 'Natural Nordic Oak & Linen' },
  { id: 'travertine_bronze', label: 'Honed Travertine & Aged Bronze' },
];

export default function RoomagenDeveloperConsole({ initialProjectId }: { initialProjectId?: string }) {
  const [activeTab, setActiveTab] = useState<'playground' | 'pipeline' | 'catalog' | 'webhook' | 'telemetry'>('playground');
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [samples, setSamples] = useState<SampleItem[]>([]);

  // Playground State
  const [selectedTool, setSelectedTool] = useState<ToolType>('SKETCH_TO_FLOOR_PLAN');
  const [selectedStyle, setSelectedStyle] = useState('Modern Minimalist');
  const [selectedViewMode, setSelectedViewMode] = useState('isometric_cutaway');
  const [selectedLighting, setSelectedLighting] = useState('natural_daylight');
  const [selectedMaterial, setSelectedMaterial] = useState('hardwood_marble');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '4:3'>('1:1');
  const [prompt, setPrompt] = useState('Modern 3-bedroom residential layout with open kitchen and master ensuite');
  const [inputImageUrl, setInputImageUrl] = useState('/images/blueprint-ai.png');
  const [uploading, setUploading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionTimer, setExecutionTimer] = useState(0);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'curl' | 'typescript' | 'python' | 'json'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);

  // Chained Pipeline State
  const [pipelineSketchUrl, setPipelineSketchUrl] = useState('/images/blueprint-ai.png');
  const [pipelinePrompt, setPipelinePrompt] = useState('Luxury contemporary villa with pool patio');
  const [pipelineStyle, setPipelineStyle] = useState('Contemporary Luxury');
  const [runningPipeline, setRunningPipeline] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);

  // Webhook Simulator State
  const [simWebhookStatus, setSimWebhookStatus] = useState<'COMPLETED' | 'FAILED'>('COMPLETED');
  const [simJobId, setSimJobId] = useState('');
  const [simOutputUrl, setSimOutputUrl] = useState('/images/project-floorplan.png');
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [simWebhookResult, setSimWebhookResult] = useState<any>(null);

  // Telemetry & Logs
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [inspectJob, setInspectJob] = useState<any>(null);

  // Promotion / Save State
  const [projectId, setProjectId] = useState(initialProjectId || '');
  const [planTitle, setPlanTitle] = useState('AI Concept Floor Plan');
  const [savingPlan, setSavingPlan] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<any>(null);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/roomagen/health');
      const data = await res.json();
      if (data.success) {
        setHealth(data.data);
      }
    } catch {
      // Ignored in offline
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchSamples = useCallback(async () => {
    try {
      const res = await fetch('/api/roomagen/samples');
      const data = await res.json();
      if (data.success) {
        setSamples(data.data);
      }
    } catch {}
  }, []);

  const fetchRecentJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await fetch('/api/roomagen/jobs');
      const data = await res.json();
      if (data.success && data.data?.jobs) {
        setRecentJobs(data.data.jobs);
      }
    } catch {} finally {
      setJobsLoading(false);
    }
  }, []);

  // Initial Data Fetching
  useEffect(() => {
    fetchHealth();
    fetchSamples();
    fetchRecentJobs();
  }, [fetchHealth, fetchSamples, fetchRecentJobs]);

  // Execution Timer Effect
  useEffect(() => {
    if (executing || runningPipeline) {
      setExecutionTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setExecutionTimer((prev) => prev + 100);
      }, 100);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [executing, runningPipeline]);

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('projectId', projectId);

      const res = await fetch('/api/roomagen/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setInputImageUrl(data.data.url);
      } else {
        alert(data.error?.message || 'Upload failed');
      }
    } catch (err: any) {
      alert(err.message || 'Network error during upload');
    } finally {
      setUploading(false);
    }
  };

  // Execute Playground Request
  const handleExecute = async () => {
    if (!inputImageUrl) {
      alert('Please provide or select an input image first.');
      return;
    }

    setExecuting(true);
    setExecutionResult(null);
    setSaveSuccess(null);

    const payload = {
      tool: selectedTool,
      imageUrl: inputImageUrl,
      projectId: projectId || undefined,
      prompt: prompt || undefined,
      options: {
        stylePreset: selectedStyle,
        viewMode: selectedTool === 'FLOOR_PLAN_TO_3D' ? selectedViewMode : undefined,
        lighting: selectedTool === 'FLOOR_PLAN_TO_3D' ? selectedLighting : undefined,
        materialPalette: selectedTool === 'FLOOR_PLAN_COLORIZE' ? selectedMaterial : undefined,
        aspectRatio,
      },
    };

    try {
      const startTime = performance.now();
      const res = await fetch('/api/roomagen/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      if (!data.success) {
        setExecutionResult({
          status: res.status,
          latency: elapsed,
          error: data.error,
          raw: data,
        });
        return;
      }

      let job = data.data;

      // Poll until COMPLETED or FAILED
      let attempts = 0;
      while (job.status === 'PROCESSING' && attempts < 20) {
        await new Promise((r) => setTimeout(r, 600));
        attempts++;
        const statusRes = await fetch(`/api/roomagen/jobs/${job.id}`);
        const statusData = await statusRes.json();
        if (statusData.success && statusData.data) {
          job = statusData.data;
        }
      }

      setExecutionResult({
        status: 200,
        latency: elapsed + attempts * 600,
        job,
        outputUrl: job.outputAssetUrl || job.inputAssetUrl,
        raw: job,
      });

      fetchRecentJobs();
    } catch (err: any) {
      setExecutionResult({
        status: 500,
        error: { message: err.message || 'Execution network error' },
      });
    } finally {
      setExecuting(false);
    }
  };

  // Run Chained Pipeline
  const handleRunPipeline = async () => {
    if (!pipelineSketchUrl) {
      alert('Please provide a sketch URL.');
      return;
    }

    setRunningPipeline(true);
    setPipelineResult(null);

    try {
      const res = await fetch('/api/roomagen/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sketchUrl: pipelineSketchUrl,
          projectId: projectId || undefined,
          prompt: pipelinePrompt,
          style: pipelineStyle,
        }),
      });

      const data = await res.json();
      setPipelineResult(data);
      fetchRecentJobs();
    } catch (err: any) {
      setPipelineResult({
        success: false,
        error: { message: err.message || 'Failed to execute pipeline' },
      });
    } finally {
      setRunningPipeline(false);
    }
  };

  // Simulate Webhook Delivery
  const handleSimulateWebhook = async () => {
    setSimulatingWebhook(true);
    setSimWebhookResult(null);

    try {
      const res = await fetch('/api/roomagen/webhook/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: simWebhookStatus,
          jobId: simJobId || undefined,
          outputUrl: simOutputUrl,
        }),
      });
      const data = await res.json();
      setSimWebhookResult(data);
      fetchRecentJobs();
    } catch (err: any) {
      setSimWebhookResult({
        success: false,
        error: { message: err.message },
      });
    } finally {
      setSimulatingWebhook(false);
    }
  };

  // Promote to Official Floor Plan
  const handleSaveToProject = async () => {
    if (!projectId) {
      alert('Please enter or assign a Project ID to save this floor plan.');
      return;
    }
    if (!executionResult?.job?.id) return;

    setSavingPlan(true);
    setSaveSuccess(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/roomagen/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: executionResult.job.id,
          title: planTitle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(`Floor plan successfully saved as official project deliverable! (ID: ${data.data.floorPlan?.id})`);
      } else {
        alert(data.error?.message || 'Failed to save floor plan');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving floor plan');
    } finally {
      setSavingPlan(false);
    }
  };

  // Code generator string builders
  const getCurlSnippet = () => {
    const payload = {
      tool: selectedTool,
      imageUrl: inputImageUrl,
      prompt,
      options: {
        stylePreset: selectedStyle,
        aspectRatio,
      },
    };
    return `curl -X POST "http://localhost:3000/api/roomagen/jobs" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  };

  const getTypeScriptSnippet = () => {
    return `import { roomagenService } from '@/Backend/services/roomagen/roomagen.service';

// Submit Roomagen generation job
const job = await roomagenService.submitGeneration({
  userId: 'user_architect_id',
  tool: '${selectedTool}',
  imageUrl: '${inputImageUrl}',
  prompt: '${prompt}',
  options: {
    stylePreset: '${selectedStyle}',
    aspectRatio: '${aspectRatio}',
  },
});

console.log('Roomagen Job Dispatched:', job.id, job.status);`;
  };

  const getPythonSnippet = () => {
    return `import requests

url = "http://localhost:3000/api/roomagen/jobs"
headers = {"Content-Type": "application/json"}
payload = {
    "tool": "${selectedTool}",
    "imageUrl": "${inputImageUrl}",
    "prompt": "${prompt}",
    "options": {
        "stylePreset": "${selectedStyle}",
        "aspectRatio": "${aspectRatio}"
    }
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;
  };

  const getJsonSnippet = () => {
    return JSON.stringify(
      {
        tool: selectedTool,
        imageUrl: inputImageUrl,
        prompt,
        options: {
          stylePreset: selectedStyle,
          viewMode: selectedTool === 'FLOOR_PLAN_TO_3D' ? selectedViewMode : undefined,
          lighting: selectedTool === 'FLOOR_PLAN_TO_3D' ? selectedLighting : undefined,
          materialPalette: selectedTool === 'FLOOR_PLAN_COLORIZE' ? selectedMaterial : undefined,
          aspectRatio,
        },
      },
      null,
      2
    );
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0E1514] text-zinc-100 font-sans p-4 md:p-8">
      {/* ── TOP HEADER & TELEMETRY BANNER ──────────────────────── */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <Terminal className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                  Roomagen Developer Console
                  <span className="text-xs px-2.5 py-1 rounded-full bg-teal-500/20 text-teal-300 font-mono font-medium border border-teal-500/30">
                    API v1.0
                  </span>
                </h1>
                <p className="text-sm text-zinc-400 mt-0.5">
                  Architectural AI visualization playground, multi-stage pipelines, webhook diagnostics, and schema reference.
                </p>
              </div>
            </div>
          </div>

          {/* Telemetry pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-400">Provider:</span>
              <span className="font-semibold text-zinc-200 capitalize">{health?.provider || 'Detecting...'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-zinc-400">Ping:</span>
              <span className="font-mono text-zinc-200">{health?.latencyMs !== undefined ? `${health.latencyMs}ms` : '–'}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
              <Webhook className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-400">Webhook:</span>
              <span className="text-emerald-400 font-medium">Idempotent</span>
            </div>
            <button
              onClick={fetchHealth}
              disabled={healthLoading}
              title="Refresh Health"
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── NAVIGATION TABS ─────────────────────────────────── */}
        <div className="flex overflow-x-auto gap-2 pt-4 border-b border-zinc-800/60 pb-px scrollbar-none">
          <button
            onClick={() => setActiveTab('playground')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'playground'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            API Playground & Console
          </button>

          <button
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'pipeline'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Chained Pipeline Runner
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              2-Stage
            </span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'catalog'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Services & Capabilities Catalog
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'webhook'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Webhook className="w-4 h-4" />
            Webhook & Idempotency Lab
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'telemetry'
                ? 'border-teal-400 text-teal-300 bg-teal-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Activity className="w-4 h-4" />
            Job Telemetry & Payloads
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ───────────────────────────────────── */}
      <div className="max-w-7xl mx-auto">
        {/* ─────────────────────────────────────────────────────────────
            TAB 1: API PLAYGROUND & CONSOLE
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'playground' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Parameter Configuration (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              {/* Tool Selection Bar */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl backdrop-blur-sm">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 block">
                  Select Roomagen Tool Endpoint
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setSelectedTool('SKETCH_TO_FLOOR_PLAN');
                      setInputImageUrl('/images/blueprint-ai.png');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedTool === 'SKETCH_TO_FLOOR_PLAN'
                        ? 'bg-teal-950/40 border-teal-500/60 shadow-[0_0_20px_rgba(42,157,143,0.2)]'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">Sketch → 2D</span>
                      {selectedTool === 'SKETCH_TO_FLOOR_PLAN' && (
                        <span className="w-2 h-2 rounded-full bg-teal-400" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">Transforms pencil or digital sketch into structured 2D CAD layout</p>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTool('FLOOR_PLAN_TO_3D');
                      setInputImageUrl('/images/project-floorplan.png');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedTool === 'FLOOR_PLAN_TO_3D'
                        ? 'bg-teal-950/40 border-teal-500/60 shadow-[0_0_20px_rgba(42,157,143,0.2)]'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">Floor Plan → 3D</span>
                      {selectedTool === 'FLOOR_PLAN_TO_3D' && (
                        <span className="w-2 h-2 rounded-full bg-teal-400" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">Synthesizes 3D photorealistic perspective & isometric cutaways</p>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTool('FLOOR_PLAN_COLORIZE');
                      setInputImageUrl('/images/project-eco-office.png');
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedTool === 'FLOOR_PLAN_COLORIZE'
                        ? 'bg-teal-950/40 border-teal-500/60 shadow-[0_0_20px_rgba(42,157,143,0.2)]'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-white">Colorize Floor Plan</span>
                      {selectedTool === 'FLOOR_PLAN_COLORIZE' && (
                        <span className="w-2 h-2 rounded-full bg-teal-400" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">Enriches CAD line-art with textures, floor materials, and shading</p>
                  </button>
                </div>
              </div>

              {/* Input Image & Quick Sample Presets */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Input Architectural Drawing
                  </label>
                  <span className="text-xs text-zinc-500 font-mono">PNG / JPEG / WebP / SVG (max 10MB)</span>
                </div>

                {/* 1-Click Samples Row */}
                <div>
                  <span className="text-xs text-zinc-400 mb-2 block font-medium">1-Click Architectural Test Presets:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {samples.map((sample) => (
                      <button
                        key={sample.id}
                        onClick={() => {
                          setInputImageUrl(sample.imageUrl);
                          setSelectedTool(sample.recommendedTool);
                          if (sample.suggestedPrompt) setPrompt(sample.suggestedPrompt);
                          if (sample.stylePreset) setSelectedStyle(sample.stylePreset);
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                          inputImageUrl === sample.imageUrl
                            ? 'bg-teal-500/10 border-teal-500/40'
                            : 'bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <img
                          src={sample.imageUrl}
                          alt={sample.title}
                          className="w-10 h-10 rounded-lg object-cover bg-zinc-900 border border-zinc-700/50 shrink-0"
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-zinc-200 truncate">{sample.title}</p>
                          <p className="text-[10px] text-teal-400 uppercase font-mono">{sample.category}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Preview & Upload Controls */}
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <div className="relative w-full sm:w-36 h-36 rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center group">
                    {inputImageUrl ? (
                      <img src={inputImageUrl} alt="Input" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-xs text-zinc-600">No Image</span>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-xs text-white transition-opacity"
                    >
                      <Download className="w-5 h-5 mb-1 rotate-180" />
                      Replace
                    </button>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="text"
                      value={inputImageUrl}
                      onChange={(e) => setInputImageUrl(e.target.value)}
                      placeholder="https://... or /images/..."
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 flex items-center justify-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 rotate-180" />
                      {uploading ? 'Uploading Asset...' : 'Upload Local Sketch / Plan'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Architectural Parameters & Tuning */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block">
                  Architectural Parameter Tuning
                </label>

                {/* Prompt */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between">
                    <span>Architectural Specification Prompt</span>
                    <span className="text-[10px] text-zinc-500">Natural language design guidance</span>
                  </label>
                  <textarea
                    rows={2}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                    placeholder="e.g. Modern open-plan 3-bedroom layout with timber finishes..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Style Presets */}
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 block">Architectural Style Preset</label>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                    >
                      {STYLE_PRESETS.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="text-xs text-zinc-400 mb-1.5 block">Output Aspect Ratio</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['1:1', '16:9', '4:3'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAspectRatio(ratio)}
                          className={`py-2 rounded-xl text-xs font-medium border transition-colors ${
                            aspectRatio === ratio
                              ? 'bg-teal-500/20 border-teal-500/60 text-teal-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tool-specific conditional parameters */}
                  {selectedTool === 'FLOOR_PLAN_TO_3D' && (
                    <>
                      <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">3D Perspective View Mode</label>
                        <select
                          value={selectedViewMode}
                          onChange={(e) => setSelectedViewMode(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                        >
                          {VIEW_MODES.map((mode) => (
                            <option key={mode.id} value={mode.id}>
                              {mode.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs text-zinc-400 mb-1.5 block">Atmospheric Lighting</label>
                        <select
                          value={selectedLighting}
                          onChange={(e) => setSelectedLighting(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                        >
                          {LIGHTING_MODES.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {selectedTool === 'FLOOR_PLAN_COLORIZE' && (
                    <div className="sm:col-span-2">
                      <label className="text-xs text-zinc-400 mb-1.5 block">Presentation Material Palette</label>
                      <select
                        value={selectedMaterial}
                        onChange={(e) => setSelectedMaterial(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                      >
                        {MATERIAL_PALETTES.map((mat) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Project Scope Assignment */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 flex items-center justify-between">
                    <span>Target Project ID (Optional)</span>
                    <span className="text-[10px] text-zinc-500">Links generation to BuildSmart project version history</span>
                  </label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="e.g. proj_mubfk82d_c0sjd3"
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Execution Action Button */}
              <div>
                <button
                  onClick={handleExecute}
                  disabled={executing || uploading}
                  className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-xl ${
                    executing
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-700'
                      : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-zinc-950 shadow-teal-500/20 active:scale-[0.99]'
                  }`}
                >
                  {executing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin text-teal-400" />
                      <span>Executing Roomagen Call ({Math.round(executionTimer / 1000)}s)...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Execute Roomagen API Call</span>
                    </>
                  )}
                </button>
              </div>

              {/* Real-time Code Snippet Generator */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Auto-Generated Code Snippet
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
                      {(['curl', 'typescript', 'python', 'json'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveCodeTab(tab)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize transition-colors ${
                            activeCodeTab === tab
                              ? 'bg-teal-500/20 text-teal-300 font-semibold'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const snippet =
                          activeCodeTab === 'curl'
                            ? getCurlSnippet()
                            : activeCodeTab === 'typescript'
                            ? getTypeScriptSnippet()
                            : activeCodeTab === 'python'
                            ? getPythonSnippet()
                            : getJsonSnippet();
                        copySnippet(snippet);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      title="Copy Code"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-teal-300/90 overflow-x-auto max-h-48 scrollbar-thin">
                  {activeCodeTab === 'curl' && getCurlSnippet()}
                  {activeCodeTab === 'typescript' && getTypeScriptSnippet()}
                  {activeCodeTab === 'python' && getPythonSnippet()}
                  {activeCodeTab === 'json' && getJsonSnippet()}
                </pre>
              </div>
            </div>

            {/* Right Column: Execution Response & Comparison (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Output Response Card */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4 min-h-[480px] flex flex-col">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                      Live Output & Inspection
                    </span>
                  </div>
                  {executionResult && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border ${
                          executionResult.status === 200
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/30'
                        }`}
                      >
                        HTTP {executionResult.status}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">{executionResult.latency}ms</span>
                    </div>
                  )}
                </div>

                {/* Main Visual Workspace */}
                <div className="flex-1 flex flex-col justify-center items-center">
                  {executing ? (
                    <div className="text-center py-16 space-y-4">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-2 border-emerald-500/20 border-b-emerald-400 animate-spin [animation-direction:reverse]" />
                      </div>
                      <p className="text-sm font-semibold text-white">Roomagen AI Synthesizing...</p>
                      <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                        Analyzing layout geometry, rendering materials, and compiling high-resolution drawings.
                      </p>
                    </div>
                  ) : executionResult?.outputUrl ? (
                    <div className="w-full space-y-4">
                      {/* Image Comparison Slider */}
                      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                        <ImageComparisonSlider
                          beforeImage={inputImageUrl}
                          afterImage={executionResult.outputUrl}
                          beforeLabel="Original Input"
                          afterLabel="Roomagen AI Render"
                        />
                      </div>

                      {/* Promotion / Project Bridge */}
                      <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                            <FolderPlus className="w-3.5 h-3.5 text-teal-400" />
                            Promote to Official Project Floor Plan
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">v{executionResult.job?.version || 1}</span>
                        </div>

                        <div className="space-y-2">
                          <input
                            type="text"
                            value={planTitle}
                            onChange={(e) => setPlanTitle(e.target.value)}
                            placeholder="Floor plan title..."
                            className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                          />
                          <button
                            onClick={handleSaveToProject}
                            disabled={savingPlan || !projectId}
                            className="w-full py-2 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {savingPlan ? 'Promoting Plan...' : 'Promote & Publish for Client Review'}
                          </button>
                        </div>

                        {saveSuccess && (
                          <p className="text-xs text-emerald-400 bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/50">
                            {saveSuccess}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-zinc-600 space-y-2">
                      <Terminal className="w-12 h-12 mx-auto text-zinc-700" />
                      <p className="text-sm font-medium text-zinc-400">Ready for Execution</p>
                      <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                        Choose an architectural preset or upload a sketch, then click &quot;Execute Roomagen API Call&quot;.
                      </p>
                    </div>
                  )}
                </div>

                {/* Raw JSON Response Accordion */}
                {executionResult && (
                  <div className="border-t border-zinc-800/80 pt-3">
                    <details className="group">
                      <summary className="text-xs font-mono text-zinc-400 cursor-pointer flex items-center justify-between hover:text-zinc-200">
                        <span>Inspect Raw Server Response JSON</span>
                        <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                      </summary>
                      <pre className="mt-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300 max-h-44 overflow-y-auto scrollbar-thin">
                        {JSON.stringify(executionResult.raw, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: CHAINED MULTI-STAGE PIPELINE RUNNER
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Layers className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Chained 2-Stage Transformation Pipeline</h2>
                  <p className="text-xs text-zinc-400">
                    Automated sequential workflow: converts rough hand-drawn sketches into clean 2D floor plans, then automatically synthesizes a 3D perspective visualization.
                  </p>
                </div>
              </div>

              {/* Pipeline Diagram */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-teal-400">1</span>
                    <span>Rough Hand-Drawn Sketch</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-teal-500 hidden md:block" />
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-teal-400">2</span>
                    <span>Stage 1: 2D Floor Plan (CAD Layout)</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-teal-500 hidden md:block" />
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-teal-400">3</span>
                    <span>Stage 2: 3D Photorealistic Scene</span>
                  </div>
                </div>
              </div>

              {/* Configuration Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="sm:col-span-2">
                  <label className="text-xs text-zinc-400 mb-1.5 block">Pipeline Input Sketch URL</label>
                  <input
                    type="text"
                    value={pipelineSketchUrl}
                    onChange={(e) => setPipelineSketchUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1.5 block">Architectural Style</label>
                  <select
                    value={pipelineStyle}
                    onChange={(e) => setPipelineStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-teal-500"
                  >
                    {STYLE_PRESETS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleRunPipeline}
                disabled={runningPipeline}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 hover:from-amber-400 hover:to-teal-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                {runningPipeline ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    <span>Executing Chained Pipeline ({Math.round(executionTimer / 1000)}s)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Run Full Chained Pipeline</span>
                  </>
                )}
              </button>
            </div>

            {/* Pipeline Outputs Display */}
            {pipelineResult && (
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Pipeline Execution Results ({pipelineResult.data?.status || 'COMPLETED'})
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">{pipelineResult.data?.pipelineId}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 Original */}
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                    <span className="text-xs font-semibold text-zinc-400">Step 1: Input Sketch</span>
                    <div className="h-48 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                      <img src={pipelineSketchUrl} alt="Sketch" className="w-full h-full object-contain p-2" />
                    </div>
                  </div>

                  {/* Step 2: 2D Plan */}
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                    <span className="text-xs font-semibold text-teal-400">Step 2: 2D Architectural Plan</span>
                    <div className="h-48 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                      <img
                        src={pipelineResult.data?.plan2DUrl || '/images/project-floorplan.png'}
                        alt="2D Plan"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  </div>

                  {/* Step 3: 3D Visualization */}
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2">
                    <span className="text-xs font-semibold text-amber-400">Step 3: 3D Concept Visualization</span>
                    <div className="h-48 rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                      <img
                        src={pipelineResult.data?.scene3DUrl || '/images/hero-villa.png'}
                        alt="3D Scene"
                        className="w-full h-full object-contain p-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: SERVICES & CAPABILITIES CATALOG
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Tool 1 */}
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-400 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20">
                    sketch-to-floor-plan
                  </span>
                  <span className="text-xs text-zinc-500">2D CAD</span>
                </div>
                <h3 className="text-base font-bold text-white">Sketch to 2D Floor Plan</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Processes hand-drawn sketches, architect doodles, and raster blueprints into vectorized, structured 2D architectural CAD representations.
                </p>
                <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-xs text-zinc-300">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Input Formats:</span>
                    <span>PNG, JPG, WebP, SVG</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Max Resolution:</span>
                    <span>4096 × 4096 px</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Expected Latency:</span>
                    <span>1.8s – 3.5s</span>
                  </div>
                </div>
              </div>

              {/* Tool 2 */}
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-400 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20">
                    floor-plan-to-3d
                  </span>
                  <span className="text-xs text-zinc-500">3D Render</span>
                </div>
                <h3 className="text-base font-bold text-white">Floor Plan to 3D Visualization</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Extracts spatial geometry and interior partitions from 2D floor plans to render photorealistic 3D perspective scenes, isometric cutaways, and interior walk-throughs.
                </p>
                <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-xs text-zinc-300">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Output Views:</span>
                    <span>Isometric, Eye-Level, Top-Down</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Lighting Models:</span>
                    <span>Daylight, Golden Hour, Ambient</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Expected Latency:</span>
                    <span>2.2s – 4.0s</span>
                  </div>
                </div>
              </div>

              {/* Tool 3 */}
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-400 px-2.5 py-1 rounded-md bg-teal-500/10 border border-teal-500/20">
                    floor-plan-colorize
                  </span>
                  <span className="text-xs text-zinc-500">Styling</span>
                </div>
                <h3 className="text-base font-bold text-white">Floor Plan Colorization</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Enhances monochrome CAD drawings with high-end presentation finishes, material swatches (marble, hardwood, concrete), and realistic furniture fills.
                </p>
                <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-xs text-zinc-300">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Finishes:</span>
                    <span>Hardwood, Travertine, Steel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Color Models:</span>
                    <span>Editorial, Blueprint, Watercolor</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Expected Latency:</span>
                    <span>1.5s – 2.8s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Architectural Advisory Notice */}
            <div className="p-5 rounded-2xl bg-teal-950/20 border border-teal-500/30 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
              <div className="text-xs text-zinc-300 space-y-1">
                <p className="font-semibold text-white">Architectural Certification Invariant</p>
                <p className="text-zinc-400 leading-relaxed">
                  All Roomagen-generated visual artifacts provide conceptual design assistance. Under BuildSmart policy, plans must undergo review and seal by a licensed architect before construction execution or milestone escrow release.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: WEBHOOK & IDEMPOTENCY LAB
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'webhook' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <Webhook className="w-5 h-5 text-amber-400" />
                  <h2 className="text-base font-bold text-white">Webhook Ingestion & Idempotency Testing</h2>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  BuildSmart receives asynchronous completion callbacks at the registered endpoint below. The handler verifies signature authenticity and enforces strict idempotency guards to prevent duplicate state transitions.
                </p>

                {/* Webhook URL bar */}
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-300">
                    POST /api/webhooks/roomagen
                  </span>
                  <button
                    onClick={() => copySnippet('http://localhost:3000/api/webhooks/roomagen')}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5"
                  >
                    <Copy className="w-3 h-3" />
                    Copy Endpoint
                  </button>
                </div>

                {/* Simulation Form */}
                <div className="space-y-4 pt-2">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
                    Dispatch Simulated Webhook Delivery
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Callback Event Status</label>
                      <select
                        value={simWebhookStatus}
                        onChange={(e: any) => setSimWebhookStatus(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                      >
                        <option value="COMPLETED">COMPLETED (job.completed)</option>
                        <option value="FAILED">FAILED (job.failed)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 mb-1 block">Target Provider Job ID (Optional)</label>
                      <input
                        type="text"
                        value={simJobId}
                        onChange={(e) => setSimJobId(e.target.value)}
                        placeholder="Auto-detects recent job"
                        className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Simulated Output Asset URL</label>
                    <input
                      type="text"
                      value={simOutputUrl}
                      onChange={(e) => setSimOutputUrl(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 font-mono"
                    />
                  </div>

                  <button
                    onClick={handleSimulateWebhook}
                    disabled={simulatingWebhook}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/10"
                  >
                    {simulatingWebhook ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-zinc-950" />
                    ) : (
                      <Radio className="w-4 h-4" />
                    )}
                    <span>Dispatch Test Webhook Event</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Simulation Response / Logs */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-3 min-h-[360px]">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Webhook Receiver Response Log
                </h3>

                {simWebhookResult ? (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Processing Status:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        {simWebhookResult.data?.status || 'PROCESSED'}
                      </span>
                    </div>
                    <pre className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-72 overflow-y-auto">
                      {JSON.stringify(simWebhookResult, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-24 text-zinc-600 space-y-2">
                    <Radio className="w-10 h-10 mx-auto text-zinc-700" />
                    <p className="text-xs text-zinc-500">No simulated webhooks dispatched yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 5: JOB TELEMETRY & RAW PAYLOADS
        ────────────────────────────────────────────────────────────── */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-teal-400" />
                  <h2 className="text-base font-bold text-white">Recent Roomagen Generation Jobs</h2>
                </div>
                <button
                  onClick={fetchRecentJobs}
                  disabled={jobsLoading}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${jobsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3">Job ID</th>
                      <th className="p-3">Tool</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Version</th>
                      <th className="p-3">Provider ID</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {recentJobs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                          {jobsLoading ? 'Loading telemetry records...' : 'No Roomagen jobs recorded yet.'}
                        </td>
                      </tr>
                    ) : (
                      recentJobs.map((job) => (
                        <tr key={job.id} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="p-3 font-mono text-zinc-300 font-medium">{job.id}</td>
                          <td className="p-3 font-mono text-teal-400">{job.tool}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                                job.status === 'COMPLETED'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : job.status === 'PROCESSING'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-red-500/20 text-red-300 border-red-500/30'
                              }`}
                            >
                              {job.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-zinc-400">v{job.version}</td>
                          <td className="p-3 font-mono text-zinc-500 truncate max-w-[140px]">
                            {job.roomagenJobId || '–'}
                          </td>
                          <td className="p-3 text-zinc-400">
                            {job.createdAt ? new Date(job.createdAt).toLocaleTimeString() : '–'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setInspectJob(job)}
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-teal-300 font-medium transition-colors"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inspect Modal Drawer */}
            {inspectJob && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-teal-400" />
                      Payload Inspector: {inspectJob.id}
                    </h3>
                    <button
                      onClick={() => setInspectJob(null)}
                      className="text-zinc-400 hover:text-white text-xs px-2 py-1 rounded bg-zinc-800"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {inspectJob.inputAssetUrl && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-mono text-zinc-400">Input Image</span>
                          <img
                            src={inspectJob.inputAssetUrl}
                            alt="Input"
                            className="w-full h-36 object-contain rounded-lg bg-zinc-950 border border-zinc-800"
                          />
                        </div>
                      )}
                      {inspectJob.outputAssetUrl && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-mono text-zinc-400">Output Image</span>
                          <img
                            src={inspectJob.outputAssetUrl}
                            alt="Output"
                            className="w-full h-36 object-contain rounded-lg bg-zinc-950 border border-zinc-800"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-mono text-zinc-400 block mb-1">
                        Complete Database Record JSON
                      </span>
                      <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-60 overflow-y-auto">
                        {JSON.stringify(inspectJob, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
