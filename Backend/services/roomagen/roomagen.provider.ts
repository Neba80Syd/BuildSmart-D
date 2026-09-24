// BuildSmart AI — Floor Plan Generation Provider Layer
// Decouples BuildSmart from Roomagen API direct implementation.
// Allows seamless switching between Live Roomagen API and a realistic Mock Provider for dev/tests.

import { RoomagenApiClient } from './roomagen.client.ts';
import { getRoomagenConfig } from './roomagen.config.ts';
import { sketchSynthesizer } from './sketch-synthesizer.ts';
import { roomagenLogger } from './roomagen.logger.ts';
import type {
  CreateJobParams,
  FloorPlanGenerationProvider,
  ProviderJobResponse,
  RoomagenJobStatus,
} from './roomagen.types.ts';

/**
 * Live Roomagen Provider — talks to real Roomagen API.
 */
export class RoomagenProvider implements FloorPlanGenerationProvider {
  readonly name = 'roomagen';
  private readonly client: RoomagenApiClient;

  constructor(client?: RoomagenApiClient) {
    this.client = client || new RoomagenApiClient();
  }

  async createJob(params: CreateJobParams): Promise<ProviderJobResponse> {
    try {
      return await this.client.createJob(params);
    } catch (err: any) {
      roomagenLogger.logProviderFallback({
        reason: err?.message || 'Live API request failed',
        fallbackProvider: 'mock (Intelligent Sketch Synthesizer)',
      });
      const fallback = new MockRoomagenProvider();
      return fallback.createJob(params);
    }
  }

  async getJob(jobId: string): Promise<ProviderJobResponse> {
    if (jobId.startsWith('mock_job_')) {
      const fallback = new MockRoomagenProvider();
      return fallback.getJob(jobId);
    }
    return this.client.getJob(jobId);
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    if (jobId.startsWith('mock_job_')) {
      const fallback = new MockRoomagenProvider();
      return fallback.cancelJob(jobId);
    }
    return this.client.cancelJob(jobId);
  }

  normalizeStatus(status: string): RoomagenJobStatus {
    return this.client.normalizeJobStatus(status);
  }
}

/** In-memory store for mock jobs during local development and testing */
interface MockJobState {
  id: string;
  tool: string;
  imageUrl: string;
  status: RoomagenJobStatus;
  createdAt: number;
  outputUrl?: string;
  error?: string;
  analysis?: any;
}

const mockJobsStore = new Map<string, MockJobState>();

/**
 * Controlled Mock Provider for local development & automated test suites.
 * Dynamically synthesizes 2D CAD floor plans, 3D visualizations, and colorizations tailored to the uploaded sketch.
 */
export class MockRoomagenProvider implements FloorPlanGenerationProvider {
  readonly name = 'mock';

  async createJob(params: CreateJobParams): Promise<ProviderJobResponse> {
    const id = `mock_job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();

    // Dynamically analyze the uploaded sketch to generate matching architectural visualization
    const analysis =
      (params.metadata as any)?.analysis ||
      (await sketchSynthesizer.analyzeSketch(
        params.imageUrl,
        params.options?.prompt || (params.metadata as any)?.prompt,
        params.options
      ));
    const outputUrl = await sketchSynthesizer.synthesizeOutput(
      params.tool as any,
      analysis,
      {
        userId: (params.metadata as any)?.userId,
        projectId: (params.metadata as any)?.projectId,
        ...(params.options || {}),
      }
    );

    mockJobsStore.set(id, {
      id,
      tool: params.tool,
      imageUrl: params.imageUrl,
      status: 'PROCESSING',
      createdAt: now,
      outputUrl,
      analysis,
    });

    roomagenLogger.logLocalSynthesis({
      jobId: id,
      tool: params.tool,
      typology: analysis?.typology,
      spaces: analysis?.detectedSpaces,
      confidence: analysis?.confidence,
      outputUrl,
    });

    return {
      id,
      status: 'PROCESSING',
      createdAt: new Date(now).toISOString(),
      outputUrl,
    };
  }

  async getJob(jobId: string): Promise<ProviderJobResponse> {
    const job = mockJobsStore.get(jobId);
    if (!job) {
      // If job wasn't created in memory (e.g. fresh process), return completed state
      return {
        id: jobId,
        status: 'COMPLETED',
        outputUrl: null,
      };
    }

    const elapsed = Date.now() - job.createdAt;
    // Advance state: 0-1.5s -> PROCESSING, >1.5s -> COMPLETED
    if (elapsed > 1500 && job.status === 'PROCESSING') {
      job.status = 'COMPLETED';
      roomagenLogger.logStatusCheck({
        jobId: job.id,
        previousStatus: 'PROCESSING',
        status: 'COMPLETED',
        outputUrl: job.outputUrl,
      });
    }

    return {
      id: job.id,
      status: job.status,
      outputUrl: job.status === 'COMPLETED' ? job.outputUrl : null,
      error: job.error || null,
      createdAt: new Date(job.createdAt).toISOString(),
      completedAt: job.status === 'COMPLETED' ? new Date().toISOString() : undefined,
    };
  }

  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    const job = mockJobsStore.get(jobId);
    if (job) {
      job.status = 'CANCELLED';
      return { success: true };
    }
    return { success: false };
  }

  normalizeStatus(status: string): RoomagenJobStatus {
    const s = String(status || '').toUpperCase();
    if (['COMPLETED', 'SUCCEEDED'].includes(s)) return 'COMPLETED';
    if (['PROCESSING', 'IN_PROGRESS'].includes(s)) return 'PROCESSING';
    if (['FAILED', 'ERROR'].includes(s)) return 'FAILED';
    if (['CANCELLED'].includes(s)) return 'CANCELLED';
    return 'PENDING';
  }
}

let activeProvider: FloorPlanGenerationProvider | null = null;

/**
 * Factory that instantiates or returns the configured provider singleton.
 */
export function getGenerationProvider(): FloorPlanGenerationProvider {
  if (activeProvider) return activeProvider;

  const config = getRoomagenConfig();
  if (config.provider === 'mock') {
    activeProvider = new MockRoomagenProvider();
  } else {
    try {
      activeProvider = new RoomagenProvider();
    } catch (err: any) {
      // Fallback to mock if key is missing in development
      if (process.env.NODE_ENV !== 'production') {
        roomagenLogger.logProviderFallback({
          reason: err?.message || 'ROOMAGEN_API_KEY not configured for live provider',
          fallbackProvider: 'mock (Intelligent Sketch Synthesizer)',
        });
        activeProvider = new MockRoomagenProvider();
      } else {
        throw new Error('Roomagen live provider could not be initialized: missing configuration');
      }
    }
  }

  return activeProvider;
}

/** Reset active provider singleton (used for tests) */
export function setGenerationProviderForTest(provider: FloorPlanGenerationProvider | null): void {
  activeProvider = provider;
}
