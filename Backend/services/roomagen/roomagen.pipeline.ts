// BuildSmart AI — Roomagen Chained Multi-Stage Pipeline Orchestrator
// Coordinates automated sequential workflows: Sketch ➔ 2D Architectural Plan ➔ 3D Concept Visualization.

import { dbClient } from '../../lib/db.ts';
import { RoomagenService } from './roomagen.service.ts';
import type { RoomagenTool } from './roomagen.types.ts';
import { RoomagenValidationError } from './roomagen.errors.ts';
import { roomagenLogger } from './roomagen.logger.ts';

export interface ChainedPipelineInput {
  userId: string;
  projectId?: string | null;
  architectId?: string | null;
  sketchUrl: string;
  prompt?: string;
  style?: string;
  lighting?: string;
  viewMode?: string;
  options?: Record<string, any>;
}

export interface PipelineStageResult {
  tool: RoomagenTool;
  jobId: string;
  status: string;
  inputUrl: string;
  outputUrl?: string | null;
  version?: number;
  completedAt?: Date | null;
}

export interface ChainedPipelineResult {
  pipelineId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  currentStage: number;
  totalStages: number;
  stages: PipelineStageResult[];
  plan2DUrl?: string | null;
  scene3DUrl?: string | null;
  error?: string | null;
}

export class RoomagenPipelineService {
  private roomagenService: RoomagenService;

  constructor() {
    this.roomagenService = new RoomagenService();
  }

  /**
   * Run the full chained pipeline:
   * 1. Convert rough sketch ➔ structured 2D floor plan
   * 2. Synthesize 2D floor plan ➔ photorealistic 3D visual concept scene
   */
  async executeChainedPipeline(input: ChainedPipelineInput): Promise<ChainedPipelineResult> {
    const { userId, projectId, architectId, sketchUrl, prompt, style, lighting, viewMode, options } = input;

    if (!sketchUrl) {
      throw new RoomagenValidationError('Sketch image URL is required to start the pipeline');
    }

    const pipelineId = `pipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const stages: PipelineStageResult[] = [];

    // ── STAGE 1: Sketch to 2D Floor Plan ───────────────────────────
    roomagenLogger.logPipelineStage({
      pipelineId,
      stage: 1,
      totalStages: 2,
      tool: 'SKETCH_TO_FLOOR_PLAN',
      status: 'PROCESSING',
    });

    const stage1Job = await this.roomagenService.submitGeneration({
      userId,
      projectId: projectId || null,
      architectId: architectId || null,
      tool: 'SKETCH_TO_FLOOR_PLAN',
      imageUrl: sketchUrl,
      prompt: prompt ? `2D Architectural CAD layout: ${prompt}` : undefined,
      options: {
        ...options,
        pipelineId,
        pipelineStage: 1,
        stylePreset: style || 'Modern Minimalist',
      },
    });

    stages.push({
      tool: 'SKETCH_TO_FLOOR_PLAN',
      jobId: stage1Job.id,
      status: stage1Job.status,
      inputUrl: sketchUrl,
      outputUrl: stage1Job.outputAssetUrl,
      version: stage1Job.version,
    });

    // Wait or poll for stage 1 completion (fast in mock mode or with quick provider)
    let completedStage1 = stage1Job;
    let attempts = 0;
    const maxAttempts = 15;

    while (completedStage1.status === 'PROCESSING' && attempts < maxAttempts) {
      await new Promise((res) => setTimeout(res, 800));
      attempts++;
      completedStage1 = await this.roomagenService.getJobStatus(stage1Job.id, userId);
    }

    const plan2DUrl = completedStage1.outputAssetUrl || completedStage1.inputAssetUrl;

    roomagenLogger.logPipelineStage({
      pipelineId,
      stage: 1,
      totalStages: 2,
      tool: 'SKETCH_TO_FLOOR_PLAN',
      status: completedStage1.status,
      outputUrl: plan2DUrl,
      error: completedStage1.errorMessage,
    });

    if (completedStage1.status === 'FAILED') {
      return {
        pipelineId,
        status: 'FAILED',
        currentStage: 1,
        totalStages: 2,
        stages,
        error: completedStage1.errorMessage || 'Stage 1 (2D Floor Plan) failed',
      };
    }

    // ── STAGE 2: 2D Floor Plan to 3D Visualization ────────────────
    roomagenLogger.logPipelineStage({
      pipelineId,
      stage: 2,
      totalStages: 2,
      tool: 'FLOOR_PLAN_TO_3D',
      status: 'PROCESSING',
    });

    const stage2Job = await this.roomagenService.submitGeneration({
      userId,
      projectId: projectId || null,
      architectId: architectId || null,
      tool: 'FLOOR_PLAN_TO_3D',
      imageUrl: plan2DUrl,
      prompt: prompt ? `3D Concept Render: ${prompt}` : undefined,
      options: {
        ...options,
        pipelineId,
        pipelineStage: 2,
        parentJobId: completedStage1.id,
        stylePreset: style || 'Modern Minimalist',
        lighting: lighting || 'natural_daylight',
        viewMode: viewMode || 'isometric_cutaway',
      },
    });

    stages.push({
      tool: 'FLOOR_PLAN_TO_3D',
      jobId: stage2Job.id,
      status: stage2Job.status,
      inputUrl: plan2DUrl,
      outputUrl: stage2Job.outputAssetUrl,
      version: stage2Job.version,
    });

    // Poll for stage 2 completion
    let completedStage2 = stage2Job;
    attempts = 0;
    while (completedStage2.status === 'PROCESSING' && attempts < maxAttempts) {
      await new Promise((res) => setTimeout(res, 800));
      attempts++;
      completedStage2 = await this.roomagenService.getJobStatus(stage2Job.id, userId);
    }

    const scene3DUrl = completedStage2.outputAssetUrl || completedStage2.inputAssetUrl;
    const isSuccess = completedStage2.status === 'COMPLETED';

    roomagenLogger.logPipelineStage({
      pipelineId,
      stage: 2,
      totalStages: 2,
      tool: 'FLOOR_PLAN_TO_3D',
      status: completedStage2.status,
      outputUrl: scene3DUrl,
      error: completedStage2.errorMessage,
    });

    return {
      pipelineId,
      status: isSuccess ? 'COMPLETED' : completedStage2.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
      currentStage: 2,
      totalStages: 2,
      stages,
      plan2DUrl,
      scene3DUrl,
      error: completedStage2.errorMessage || null,
    };
  }
}
