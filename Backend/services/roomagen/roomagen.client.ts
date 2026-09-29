// BuildSmart AI — Server-Side Roomagen API Client
// Securely communicates with the Roomagen Developer API (https://api.roomagen.com/api/v1).
// Implements bounded retries, exponential backoff, timeout handling, and status normalization.

import type { RoomagenConfig } from './roomagen.config.ts';
import { validateLiveConfig } from './roomagen.config.ts';
import type {
  CreateJobParams,
  ProviderJobResponse,
  RoomagenJobStatus,
} from './roomagen.types.ts';
import { ROOMAGEN_TOOL_SLUGS } from './roomagen.types.ts';
import { RoomagenApiError, RoomagenValidationError } from './roomagen.errors.ts';
import { roomagenLogger } from './roomagen.logger.ts';

export class RoomagenApiClient {
  private readonly config: RoomagenConfig;

  constructor(customConfig?: RoomagenConfig) {
    this.config = customConfig || validateLiveConfig();
  }

  // https://developers.roomagen.com/docs/tools: common options for tool handlers.
  private mapOptions(tool: CreateJobParams['tool'], options: CreateJobParams['options'] = {}): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const key of ['resolution', 'tier', 'customPrompt']) {
      if (options[key] !== undefined) result[key] = options[key];
    }
    const userPrompt = options.customPrompt || options.prompt || '';
    if (typeof userPrompt !== 'string') {
      throw new RoomagenValidationError('Roomagen instructions must be text');
    }
    const labelInstructions = tool === 'SKETCH_TO_FLOOR_PLAN'
      ? 'Create a clean 2D floor plan. Preserve the sketch layout and all legible room labels, dimensions, and units exactly, in their original language and corresponding locations. Render text clearly. Do not invent unreadable labels or missing measurements.'
      : '';
    const prompt = [labelInstructions, userPrompt.trim()].filter(Boolean).join('\n');
    if (prompt) {
      if (typeof prompt !== 'string' || prompt.length > 500) {
        const available = labelInstructions ? 500 - labelInstructions.length - 1 : 500;
        throw new RoomagenValidationError(`Roomagen instructions must be at most ${available} characters${labelInstructions ? ' to leave space for preserving sketch labels' : ''}`);
      }
      result.customPrompt = prompt;
      result.tier = 'custom';
    }
    return result;
  }

  /** Normalizes external Roomagen status strings to BuildSmart status enum */
  normalizeJobStatus(status: string): RoomagenJobStatus {
    const s = String(status || '').trim().toUpperCase();
    if (['COMPLETED', 'SUCCEEDED', 'SUCCESS', 'DONE'].includes(s)) return 'COMPLETED';
    if (['PROCESSING', 'IN_PROGRESS', 'RUNNING', 'GENERATING'].includes(s)) return 'PROCESSING';
    if (['PENDING', 'QUEUED', 'ACCEPTED', 'SUBMITTED'].includes(s)) return 'PENDING';
    if (['CANCELLED', 'CANCELED'].includes(s)) return 'CANCELLED';
    if (['EXPIRED'].includes(s)) return 'EXPIRED';
    if (['FAILED', 'ERROR', 'REJECTED'].includes(s)) return 'FAILED';
    return 'PROCESSING';
  }

  /** Execute an authenticated HTTP request with retries on transient errors */
  private async request<T>(
    endpoint: string,
    options: { method?: string; body?: any; attempt?: number } = {}
  ): Promise<T> {
    const { method = 'GET', body, attempt = 1 } = options;
    const url = `${this.config.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Api-Key': this.config.apiKey,
      'User-Agent': 'BuildSmart-AI/1.0',
    };

    roomagenLogger.logHttpRequest({
      method,
      url,
      attempt,
      maxRetries: this.config.maxRetries,
      body,
    });

    const startTime = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      // Check for transient network error / timeout and retry if under maxRetries
      if (attempt < this.config.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 500;
        roomagenLogger.logHttpRetry({
          attempt,
          maxRetries: this.config.maxRetries,
          delayMs: backoffMs,
          reason: err?.message || 'Network request failed/timed out',
        });
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.request<T>(endpoint, { method, body, attempt: attempt + 1 });
      }

      roomagenLogger.logHttpError({
        method,
        url,
        durationMs,
        message: `Failed to communicate with Roomagen API: ${err?.message || 'Network request failed'}`,
        attempt,
        maxRetries: this.config.maxRetries,
      });

      throw new RoomagenApiError(
        `Failed to communicate with Roomagen API: ${err?.message || 'Network request failed'}`
      );
    }

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      let errorBody: any = null;
      try {
        errorBody = await res.json();
      } catch {
        // Response was not JSON
      }

      const extractedMessage =
        (typeof errorBody?.error === 'object' ? errorBody?.error?.message : errorBody?.error) ||
        errorBody?.message ||
        `Roomagen API returned HTTP ${res.status}`;
      const errorCode = (typeof errorBody?.error === 'object' ? errorBody?.error?.code : null) || errorBody?.code;
      const errorMessage = errorCode ? `[${errorCode}] ${extractedMessage}` : extractedMessage;

      // Retry transient 5xx errors or 429 rate limits
      if ((res.status >= 500 || res.status === 429) && attempt < this.config.maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 600;
        roomagenLogger.logHttpRetry({
          attempt,
          maxRetries: this.config.maxRetries,
          delayMs: backoffMs,
          reason: `HTTP ${res.status}: ${errorMessage}`,
        });
        await new Promise((r) => setTimeout(r, backoffMs));
        return this.request<T>(endpoint, { method, body, attempt: attempt + 1 });
      }

      roomagenLogger.logHttpError({
        method,
        url,
        status: res.status,
        durationMs,
        message: errorMessage,
        errorBody,
        attempt,
        maxRetries: this.config.maxRetries,
      });

      if (res.status === 400 || res.status === 422) {
        throw new RoomagenValidationError(`Roomagen input validation failed: ${errorMessage}`);
      }

      throw new RoomagenApiError(errorMessage, res.status, JSON.stringify(errorBody));
    }

    try {
      const data = (await res.json()) as T;
      roomagenLogger.logHttpResponse({
        method,
        url,
        status: res.status,
        durationMs,
        data,
      });
      return data;
    } catch {
      roomagenLogger.logHttpError({
        method,
        url,
        status: res.status,
        durationMs,
        message: 'Roomagen API returned invalid JSON response',
      });
      throw new RoomagenApiError('Roomagen API returned invalid JSON response');
    }
  }

  /**
   * Create an asynchronous generation job.
   * Maps internal tool enum to the documented Roomagen tool slug.
   */
  async createJob(params: CreateJobParams): Promise<ProviderJobResponse> {
    const slug = ROOMAGEN_TOOL_SLUGS[params.tool] || params.tool;

    const payload: Record<string, any> = {
      tool: slug,
      image_url: params.imageUrl,
      options: this.mapOptions(params.tool, params.options),
    };

    if (params.webhookUrl) {
      const url = new URL(params.webhookUrl);
      if (url.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        payload.webhook_url = params.webhookUrl;
      }
    }


    const res = await this.request<any>('/jobs', {
      method: 'POST',
      body: payload,
    });

    const data = res?.data || res;
    return {
      id: String(data?.job_id || data?.id || data?.jobId || ''),
      status: String(data?.status || 'PENDING'),
      outputUrl: data?.result_urls?.[0] || data?.outputUrl || data?.resultUrl || null,
      error: data?.error || null,
      metadata: data?.metadata || {},
      createdAt: data?.created_at || data?.createdAt || new Date().toISOString(),
    };
  }

  /**
   * Retrieve the current status and output of an asynchronous job.
   */
  async getJob(jobId: string): Promise<ProviderJobResponse> {
    if (!jobId) {
      throw new RoomagenValidationError('jobId is required');
    }

    const res = await this.request<any>(`/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    const data = res?.data || res;
    return {
      id: String(data?.job_id || data?.id || jobId),
      status: String(data?.status || 'PENDING'),
      outputUrl: data?.result_urls?.[0] || data?.outputUrl || data?.resultUrl || data?.output?.url || null,
      error: data?.error || null,
      metadata: data?.metadata || {},
      createdAt: data?.created_at || data?.createdAt,
      completedAt: data?.completed_at || data?.completedAt,
    };
  }

  /**
   * Cancel a running or queued job if supported.
   */
  async cancelJob(jobId: string): Promise<{ success: boolean }> {
    try {
      await this.request<any>(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
      });
      return { success: true };
    } catch {
      return { success: false };
    }
  }
}
