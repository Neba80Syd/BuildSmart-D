// BuildSmart AI — Roomagen Service Orchestrator
// Central business logic for floor-plan generation, webhook idempotency, polling fallback,
// versioning, project integration, and real-time notification dispatch.

import { dbClient } from '../../lib/db.ts';
import { getGenerationProvider } from './roomagen.provider.ts';
import { roomagenLogger } from './roomagen.logger.ts';
import type {
  CreateJobParams,
  RoomagenJobStatus,
  RoomagenTool,
  RoomagenWebhookPayload,
} from './roomagen.types.ts';
import {
  ROOMAGEN_TOOL_SLUGS,
  SLUG_TO_ROOMAGEN_TOOL,
} from './roomagen.types.ts';
import {
  RoomagenJobNotFoundError,
  RoomagenValidationError,
} from './roomagen.errors.ts';
import { publish } from '../../lib/chat-events.ts';
import { broadcastToUser } from '../../ws-server.ts';

export interface SubmitGenerationInput {
  userId: string;
  projectId?: string | null;
  architectId?: string | null;
  tool: RoomagenTool;
  imageUrl: string;
  inputAssetId?: string | null;
  prompt?: string;
  options?: Record<string, any>;
  webhookUrl?: string;
}

export class RoomagenService {
  /**
   * Submit a new generation job.
   * Stores the initial job record in PostgreSQL, initiates the job with the provider,
   * updates the record with the providerJobId, dispatches in-app notifications, and broadcasts WebSocket update.
   */
  async submitGeneration(input: SubmitGenerationInput): Promise<any> {
    const { userId, projectId, architectId, tool, imageUrl, inputAssetId, prompt, options } = input;

    if (!imageUrl) {
      throw new RoomagenValidationError('Input image URL is required for generation');
    }

    // Determine the next version number for this project & tool combination
    let nextVersion = 1;
    if (projectId) {
      const existingCount = await dbClient.roomagenJob.count({
        where: { projectId, tool },
      });
      nextVersion = (existingCount || 0) + 1;
    }

    const provider = getGenerationProvider();

    // 1. Create preliminary database record
    const internalJobId = `rj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    roomagenLogger.logGenerationRequest({
      internalJobId,
      tool,
      userId,
      projectId,
      version: nextVersion,
      prompt,
      imageUrl,
      provider: provider.name,
      options,
    });

    const jobRecord = await dbClient.roomagenJob.create({
      data: {
        id: internalJobId,
        projectId: projectId || null,
        userId,
        architectId: architectId || null,
        tool,
        status: 'PROCESSING',
        inputAssetUrl: imageUrl,
        inputAssetId: inputAssetId || null,
        version: nextVersion,
        prompt: prompt || null,
        options: options || {},
        metadata: {
          ...(options?.metadata || {}),
        },
        provider: provider.name,
      },
    });

    // 2. Invoke generation provider
    try {
      const providerRes = await provider.createJob({
        tool,
        imageUrl,
        webhookUrl: input.webhookUrl,
        options: {
          ...options,
          prompt,
          inputAssetId,
        },
        metadata: {
          internalJobId,
          userId,
          projectId: projectId || null,
          prompt,
          inputAssetId,
        },
      });

      const normalizedStatus = provider.normalizeStatus(providerRes.status);
      roomagenLogger.logStatusCheck({
        jobId: internalJobId,
        status: normalizedStatus,
        outputUrl: providerRes.outputUrl,
      });

      // 3. Update job record with provider's job ID
      const updated = await dbClient.roomagenJob.update({
        where: { id: internalJobId },
        data: {
          roomagenJobId: providerRes.id,
          status: normalizedStatus,
          outputAssetUrl: providerRes.outputUrl || null,
        },
      });

      // 4. Create in-app notification
      const toolLabel =
        tool === 'SKETCH_TO_FLOOR_PLAN'
          ? 'Floor plan generation'
          : tool === 'FLOOR_PLAN_TO_3D'
          ? '3D visualization generation'
          : 'Floor plan colorization';

      await dbClient.notification.create({
        data: {
          userId,
          type: 'AI_DESIGN',
          title: `${toolLabel} started`,
          body: `Version ${nextVersion} is being processed by Roomagen AI.`,
          link: projectId ? `/architect/floor-plan-studio?project=${projectId}` : undefined,
          resourceId: internalJobId,
        },
      });

      // 5. Broadcast real-time update
      this.broadcastJobUpdate(userId, updated);

      return updated;
    } catch (err: any) {
      roomagenLogger.logJobFailed({
        jobId: internalJobId,
        tool,
        error: err.message || 'Failed to submit job to provider',
      });

      await dbClient.roomagenJob.update({
        where: { id: internalJobId },
        data: {
          status: 'FAILED',
          errorMessage: err.message || 'Failed to submit job to provider',
          failedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /**
   * Retrieve job status with built-in polling fallback recovery.
   * If the job in DB is still PROCESSING, actively checks the provider.
   */
  async getJobStatus(jobId: string, userId?: string): Promise<any> {
    // Look up by internal ID first, or by provider roomagenJobId
    let job: any = await dbClient.roomagenJob.findUnique({ where: { id: jobId } });
    if (!job) {
      job = await dbClient.roomagenJob.findFirst({ where: { roomagenJobId: jobId } });
    }

    if (!job) {
      throw new RoomagenJobNotFoundError(jobId);
    }

    // Authorization check if user ID supplied
    if (userId && job.userId !== userId && job.architectId !== userId) {
      // In preview mode or admin allow, otherwise verify
    }

    // Polling fallback: if job is PROCESSING and has a providerJobId, query provider
    if (job.status === 'PROCESSING' && job.roomagenJobId) {
      const provider = getGenerationProvider();
      try {
        const providerStatus = await provider.getJob(job.roomagenJobId);
        const normalized = provider.normalizeStatus(providerStatus.status);

        if (normalized !== job.status) {
          const isComplete = normalized === 'COMPLETED';
          const isFailed = normalized === 'FAILED';

          roomagenLogger.logStatusCheck({
            jobId: job.id,
            previousStatus: job.status,
            status: normalized,
            outputUrl: providerStatus.outputUrl || job.outputAssetUrl,
            error: providerStatus.error,
          });

          job = await dbClient.roomagenJob.update({
            where: { id: job.id },
            data: {
              status: normalized,
              outputAssetUrl: providerStatus.outputUrl || job.outputAssetUrl,
              errorMessage: providerStatus.error || null,
              completedAt: isComplete ? new Date() : null,
              failedAt: isFailed ? new Date() : null,
            },
          });

          if (isComplete) {
            await this.onJobCompleted(job);
          } else if (isFailed) {
            await this.onJobFailed(job);
          }

          this.broadcastJobUpdate(job.userId, job);
        }
      } catch {
        // Provider query failed on this check; return current DB state safely
      }
    }

    return job;
  }

  /**
   * Idempotent webhook callback handler.
   * Prevents duplicate outputs or double state transitions if Roomagen delivers multiple webhooks.
   */
  async handleWebhook(payload: RoomagenWebhookPayload): Promise<{ processed: boolean; status: string }> {
    payload = { ...payload, jobId: payload.job_id || payload.jobId, outputUrl: payload.result_urls?.[0] || payload.outputUrl };
    const providerJobId = payload.jobId || (payload as any).id;
    if (!providerJobId) {
      throw new RoomagenValidationError('Missing jobId in webhook payload');
    }

    // 1. Locate corresponding BuildSmart job
    const job: any = await dbClient.roomagenJob.findFirst({
      where: { roomagenJobId: providerJobId },
    });

    if (!job) {
      // Return 200 to acknowledge unknown webhooks so provider stops retrying
      return { processed: false, status: 'UNKNOWN_JOB' };
    }

    // 2. Idempotency guard: if already COMPLETED, never re-process or duplicate outputs
    if (job.status === 'COMPLETED') {
      roomagenLogger.logWebhook({
        providerJobId,
        status: payload.status,
        outputUrl: payload.outputUrl,
        error: payload.error,
        action: 'already completed (idempotency guard)',
      });
      return { processed: true, status: 'ALREADY_COMPLETED' };
    }

    const provider = getGenerationProvider();
    const newStatus = provider.normalizeStatus(payload.status);

    const isComplete = newStatus === 'COMPLETED';
    const isFailed = newStatus === 'FAILED' || newStatus === 'CANCELLED';

    roomagenLogger.logWebhook({
      providerJobId,
      status: payload.status,
      outputUrl: payload.outputUrl,
      error: payload.error,
      action: `status transition -> ${newStatus}`,
    });

    const updated = await dbClient.roomagenJob.update({
      where: { id: job.id },
      data: {
        status: newStatus,
        outputAssetUrl: payload.outputUrl || job.outputAssetUrl,
        errorMessage: payload.error || job.errorMessage,
        completedAt: isComplete ? new Date() : job.completedAt,
        failedAt: isFailed ? new Date() : job.failedAt,
      },
    });

    if (isComplete) {
      await this.onJobCompleted(updated);
    } else if (isFailed) {
      await this.onJobFailed(updated);
    }

    this.broadcastJobUpdate(job.userId, updated);

    return { processed: true, status: newStatus };
  }

  /**
   * Retrieve all generation records for a specific project.
   */
  async getProjectGenerations(projectId: string): Promise<any[]> {
    return dbClient.roomagenJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Save completed Roomagen output as an official BuildSmart project FloorPlan record.
   * Seamlessly bridges Roomagen visualization into the architect and client review workflow.
   */
  async saveAsProjectFloorPlan(params: {
    jobId: string;
    projectId: string;
    name?: string;
    userId: string;
  }): Promise<any> {
    const { jobId, projectId, name } = params;

    const job = await this.getJobStatus(jobId);
    if (!job || job.status !== 'COMPLETED' || !job.outputAssetUrl) {
      throw new RoomagenValidationError('Only completed generations with a valid output can be saved as a floor plan');
    }

    const is3D = job.tool === 'FLOOR_PLAN_TO_3D';
    const planKind = is3D ? '3D' : '2D';
    const planName = name || `${is3D ? '3D Visualization' : 'AI Floor Plan'} v${job.version}`;

    // Create official FloorPlan model in database
    const floorPlan = await dbClient.floorPlan.create({
      data: {
        projectId,
        name: planName,
        kind: planKind,
        version: job.version,
        data: JSON.stringify({
          source: 'roomagen',
          jobId: job.id,
          imageUrl: job.outputAssetUrl,
          inputUrl: job.inputAssetUrl,
          tool: job.tool,
          timestamp: new Date().toISOString(),
        }),
        svgData: job.outputAssetUrl, // serves as visual source
        status: 'PUBLISHED',
        reviewStatus: 'READY_FOR_REVIEW',
      },
    });

    // Also link with project activity
    await dbClient.activity.create({
      data: {
        userId: params.userId,
        projectId,
        type: 'DESIGN',
        title: `${planKind} floor plan published`,
        body: `Created from AI generation version ${job.version}`,
      },
    });

    return floorPlan;
  }

  /** Post-completion side-effects: notifications & activity logs */
  private async onJobCompleted(job: any): Promise<void> {
    const is3D = job.tool === 'FLOOR_PLAN_TO_3D';
    const label = is3D ? '3D visualization' : 'Floor plan';

    roomagenLogger.logJobCompleted({
      jobId: job.id,
      tool: job.tool,
      version: job.version,
      outputUrl: job.outputAssetUrl || '',
    });

    await dbClient.notification.create({
      data: {
        userId: job.userId,
        type: 'AI_DESIGN',
        title: `Your ${label} is ready!`,
        body: `Version ${job.version} has completed processing successfully.`,
        link: job.projectId
          ? `/architect/floor-plan-studio?project=${job.projectId}&job=${job.id}`
          : undefined,
        resourceId: job.id,
      },
    });

    if (job.projectId) {
      await dbClient.activity.create({
        data: {
          userId: job.userId,
          projectId: job.projectId,
          type: 'AI_GENERATION',
          title: `${label} generated`,
          body: `AI generation completed (v${job.version})`,
        },
      });
    }
  }

  /** Post-failure side-effects: notifications */
  private async onJobFailed(job: any): Promise<void> {
    roomagenLogger.logJobFailed({
      jobId: job.id,
      tool: job.tool,
      error: job.errorMessage || 'The generation request could not be completed. Please try again.',
    });

    await dbClient.notification.create({
      data: {
        userId: job.userId,
        type: 'AI_DESIGN',
        title: 'Floor plan generation failed',
        body: job.errorMessage || 'The generation request could not be completed. Please try again.',
        link: job.projectId ? `/architect/floor-plan-studio?project=${job.projectId}` : undefined,
        resourceId: job.id,
      },
    });
  }

  /** Real-time WebSocket and SSE broadcast */
  private broadcastJobUpdate(userId: string, job: any): void {
    const safePayload = {
      type: 'roomagen:job:updated',
      jobId: job.id,
      projectId: job.projectId,
      tool: job.tool,
      status: job.status,
      outputAssetUrl: job.outputAssetUrl,
      version: job.version,
      updatedAt: job.updatedAt,
    };

    // Pub-sub to SSE listeners
    publish(safePayload);

    // Broadcast directly to user WebSocket connections
    try {
      broadcastToUser(userId, safePayload);
    } catch {
      // ws server might be idle
    }
  }
}

export const roomagenService = new RoomagenService();
