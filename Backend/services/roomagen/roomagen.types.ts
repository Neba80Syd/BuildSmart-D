// BuildSmart AI — Roomagen Types & Interfaces
// Strict type definitions for Roomagen tools, job statuses, parameters, and results.

export type RoomagenTool =
  | 'SKETCH_TO_FLOOR_PLAN'
  | 'FLOOR_PLAN_TO_3D'
  | 'FLOOR_PLAN_COLORIZE';

/** Canonical Roomagen API tool slugs */
export const ROOMAGEN_TOOL_SLUGS: Record<RoomagenTool, string> = {
  SKETCH_TO_FLOOR_PLAN: 'sketch-to-floor-plan',
  FLOOR_PLAN_TO_3D: 'floor-plan-to-3d',
  FLOOR_PLAN_COLORIZE: 'floor-plan-colorize',
};

/** Reverse lookup from slug to internal enum */
export const SLUG_TO_ROOMAGEN_TOOL: Record<string, RoomagenTool> = {
  'sketch-to-floor-plan': 'SKETCH_TO_FLOOR_PLAN',
  'floor-plan-to-3d': 'FLOOR_PLAN_TO_3D',
  'floor-plan-colorize': 'FLOOR_PLAN_COLORIZE',
};

export type RoomagenJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface RoomagenGenerationOptions {
  prompt?: string;
  style?: string;
  lighting?: 'daylight' | 'dusk' | 'studio';
  wallColor?: string;
  flooringType?: string;
  furnishingLevel?: 'minimal' | 'standard' | 'luxury';
  scale?: number;
  outputResolution?: '1024x1024' | '2048x2048';
  [key: string]: any;
}

export interface CreateJobParams {
  tool: RoomagenTool;
  imageUrl: string;
  webhookUrl?: string;
  options?: RoomagenGenerationOptions;
  metadata?: Record<string, any>;
}

export interface ProviderJobResponse {
  id: string;
  status: string;
  outputUrl?: string | null;
  error?: string | null;
  metadata?: Record<string, any>;
  createdAt?: string;
  completedAt?: string;
}

export interface NormalizedJob {
  id: string;
  providerJobId: string;
  tool: RoomagenTool;
  status: RoomagenJobStatus;
  inputAssetUrl?: string | null;
  outputAssetUrl?: string | null;
  errorMessage?: string | null;
  options?: RoomagenGenerationOptions | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date | null;
  failedAt?: Date | null;
}

export interface RoomagenWebhookPayload {
  jobId: string;
  status: string;
  outputUrl?: string;
  error?: string;
  tool?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

/** Floor Plan Generation Provider abstraction */
export interface FloorPlanGenerationProvider {
  readonly name: string;
  createJob(params: CreateJobParams): Promise<ProviderJobResponse>;
  getJob(jobId: string): Promise<ProviderJobResponse>;
  cancelJob?(jobId: string): Promise<{ success: boolean }>;
  normalizeStatus(status: string): RoomagenJobStatus;
}
