// BuildSmart AI — Roomagen Dedicated Terminal Logger
// Provides clear, structured, color-formatted terminal logs for all Roomagen
// requests, HTTP network calls, API responses, errors, retries, and state transitions.

const isColorSupported =
  !process.env.NO_COLOR &&
  (process.stdout?.isTTY || process.env.TERM || process.env.NODE_ENV !== 'production');

const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  brightCyan: isColorSupported ? '\x1b[96m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  brightGreen: isColorSupported ? '\x1b[92m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  brightYellow: isColorSupported ? '\x1b[93m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  brightRed: isColorSupported ? '\x1b[91m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  brightMagenta: isColorSupported ? '\x1b[95m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  brightBlue: isColorSupported ? '\x1b[94m' : '',
  gray: isColorSupported ? '\x1b[90m' : '',
};

const BADGE = `${colors.bold}${colors.brightCyan}[ROOMAGEN]${colors.reset}`;

function getTimestamp(): string {
  return new Date().toISOString();
}

/** Truncates raw base64 or extra-long URLs so terminal remains readable */
function formatImageUrl(url?: string | null): string {
  if (!url) return `${colors.dim}(none)${colors.reset}`;
  if (url.startsWith('data:image/')) {
    const semiIdx = url.indexOf(';');
    const mime = semiIdx > 5 ? url.substring(5, semiIdx) : 'image';
    const sizeKb = (url.length / 1024).toFixed(1);
    const preview = url.slice(0, 30);
    return `${colors.dim}${preview}... [${mime}, ${sizeKb} KB]${colors.reset}`;
  }
  if (url.length > 90) {
    return `${url.slice(0, 87)}...`;
  }
  return url;
}

/** Recursively sanitizes data objects for safe terminal logging */
function sanitizeForLog(data: any): any {
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string' && data.startsWith('data:image/')) {
      return formatImageUrl(data);
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }
  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (lower.includes('key') || lower.includes('secret') || lower.includes('auth')) {
      sanitized[key] =
        typeof val === 'string' && val.length > 8
          ? `${val.slice(0, 4)}...${val.slice(-4)}`
          : '******';
    } else if (typeof val === 'string' && val.startsWith('data:image/')) {
      sanitized[key] = formatImageUrl(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeForLog(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export class RoomagenLogger {
  /**
   * Log an incoming floorplan generation request
   */
  logGenerationRequest(params: {
    internalJobId: string;
    tool: string;
    userId: string;
    projectId?: string | null;
    version?: number;
    prompt?: string | null;
    imageUrl: string;
    provider: string;
    options?: Record<string, any>;
  }): void {
    const ts = getTimestamp();
    const border = '─'.repeat(68);

    console.log(`\n${colors.brightCyan}┌${border}┐${colors.reset}`);
    console.log(
      `${colors.brightCyan}│${colors.reset} ${BADGE} ${colors.bold}${colors.brightGreen}🚀 FLOOR PLAN GENERATION REQUEST INITIATED${colors.reset}`
    );
    console.log(`${colors.brightCyan}│${colors.reset} ${colors.dim}Timestamp:${colors.reset}   ${ts}`);
    console.log(`${colors.brightCyan}│${colors.reset} ${colors.dim}Job ID:${colors.reset}      ${colors.bold}${params.internalJobId}${colors.reset}`);
    console.log(`${colors.brightCyan}│${colors.reset} ${colors.dim}Tool:${colors.reset}        ${colors.brightYellow}${params.tool}${colors.reset}`);
    console.log(
      `${colors.brightCyan}│${colors.reset} ${colors.dim}User ID:${colors.reset}     ${params.userId}`
    );
    if (params.projectId) {
      console.log(
        `${colors.brightCyan}│${colors.reset} ${colors.dim}Project ID:${colors.reset}  ${params.projectId} (Version ${params.version ?? 1})`
      );
    }
    if (params.prompt) {
      console.log(
        `${colors.brightCyan}│${colors.reset} ${colors.dim}Prompt:${colors.reset}      "${colors.brightCyan}${params.prompt}${colors.reset}"`
      );
    }
    console.log(
      `${colors.brightCyan}│${colors.reset} ${colors.dim}Input Image:${colors.reset} ${formatImageUrl(params.imageUrl)}`
    );
    console.log(
      `${colors.brightCyan}│${colors.reset} ${colors.dim}Provider:${colors.reset}    ${colors.bold}${params.provider}${colors.reset}`
    );
    if (params.options && Object.keys(params.options).length > 0) {
      const cleanOpts = JSON.stringify(sanitizeForLog(params.options));
      console.log(
        `${colors.brightCyan}│${colors.reset} ${colors.dim}Options:${colors.reset}     ${cleanOpts}`
      );
    }
    console.log(`${colors.brightCyan}└${border}┘${colors.reset}\n`);
  }

  /**
   * Log an outgoing HTTP request to Roomagen Live API
   */
  logHttpRequest(params: {
    method: string;
    url: string;
    attempt: number;
    maxRetries: number;
    body?: any;
  }): void {
    const ts = getTimestamp();
    const attemptStr =
      params.attempt > 1
        ? ` ${colors.yellow}(Attempt ${params.attempt}/${params.maxRetries})${colors.reset}`
        : '';

    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightBlue}🌐 HTTP ${params.method}${colors.reset} -> ${params.url}${attemptStr}`
    );
    if (params.body) {
      const sanitized = sanitizeForLog(params.body);
      console.log(
        `  ${colors.dim}Payload:${colors.reset} ${JSON.stringify(sanitized)}`
      );
    }
  }

  /**
   * Log a successful HTTP response from Roomagen Live API
   */
  logHttpResponse(params: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
    data?: any;
  }): void {
    const ts = getTimestamp();
    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightGreen}✅ HTTP ${params.status} OK${colors.reset} <- ${params.url} ${colors.dim}(${params.durationMs}ms)${colors.reset}`
    );
    if (params.data) {
      const sanitized = sanitizeForLog(params.data);
      console.log(
        `  ${colors.dim}Response:${colors.reset} ${JSON.stringify(sanitized)}`
      );
    }
  }

  /**
   * Log an HTTP error response from Roomagen Live API
   */
  logHttpError(params: {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    message: string;
    errorBody?: any;
    attempt?: number;
    maxRetries?: number;
  }): void {
    const ts = getTimestamp();
    const statusStr = params.status
      ? `${colors.brightRed}HTTP ${params.status}${colors.reset}`
      : `${colors.brightRed}NETWORK_ERROR${colors.reset}`;
    const durationStr = params.durationMs ? ` ${colors.dim}(${params.durationMs}ms)${colors.reset}` : '';

    console.error(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.bold}${colors.brightRed}❌ ${statusStr}${colors.reset} <- ${params.url}${durationStr}`
    );
    console.error(`  ${colors.brightRed}Error Message:${colors.reset} ${params.message}`);
    if (params.errorBody) {
      console.error(
        `  ${colors.dim}Error Body:${colors.reset}   ${JSON.stringify(sanitizeForLog(params.errorBody))}`
      );
    }
    if (params.attempt && params.maxRetries) {
      console.error(
        `  ${colors.dim}Attempt:${colors.reset}      ${params.attempt} of ${params.maxRetries}`
      );
    }
  }

  /**
   * Log a retry event with exponential backoff delay
   */
  logHttpRetry(params: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    reason: string;
  }): void {
    const ts = getTimestamp();
    console.warn(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightYellow}⚠️  RETRYING (${params.attempt}/${params.maxRetries})${colors.reset}: ${params.reason} — waiting ${params.delayMs}ms...`
    );
  }

  /**
   * Log provider fallback to local synthesis
   */
  logProviderFallback(params: {
    reason: string;
    fallbackProvider: string;
  }): void {
    const ts = getTimestamp();
    console.warn(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightYellow}⚠️  LIVE API UNAVAILABLE:${colors.reset} ${params.reason}`
    );
    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightCyan}🔄 Switched to provider:${colors.reset} ${colors.bold}${params.fallbackProvider}${colors.reset} (Intelligent CAD Synthesizer)`
    );
  }

  /**
   * Log local sketch / CAD synthesis details
   */
  logLocalSynthesis(params: {
    jobId: string;
    tool: string;
    typology?: string;
    spaces?: string[];
    confidence?: number;
    outputUrl?: string;
  }): void {
    const ts = getTimestamp();
    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightMagenta}📐 Local CAD Synthesis:${colors.reset} Job ${params.jobId}`
    );
    if (params.typology) {
      const confStr = params.confidence ? ` (confidence: ${(params.confidence * 100).toFixed(0)}%)` : '';
      console.log(`  ${colors.dim}Typology:${colors.reset}  ${params.typology}${confStr}`);
    }
    if (params.spaces && params.spaces.length > 0) {
      console.log(`  ${colors.dim}Spaces:${colors.reset}    ${params.spaces.join(', ')}`);
    }
    if (params.outputUrl) {
      console.log(`  ${colors.dim}Generated:${colors.reset} ${params.outputUrl}`);
    }
  }

  /**
   * Log job status check or state change
   */
  logStatusCheck(params: {
    jobId: string;
    status: string;
    previousStatus?: string;
    outputUrl?: string | null;
    error?: string | null;
  }): void {
    const ts = getTimestamp();
    const statusColor =
      params.status === 'COMPLETED'
        ? colors.brightGreen
        : params.status === 'FAILED'
        ? colors.brightRed
        : colors.yellow;

    const transitionStr = params.previousStatus && params.previousStatus !== params.status
      ? `${params.previousStatus} -> ${statusColor}${params.status}${colors.reset}`
      : `${statusColor}${params.status}${colors.reset}`;

    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.cyan}🔄 Status Update:${colors.reset} [${params.jobId}] status = ${transitionStr}`
    );
    if (params.outputUrl) {
      console.log(`  ${colors.dim}Output URL:${colors.reset} ${params.outputUrl}`);
    }
    if (params.error) {
      console.error(`  ${colors.brightRed}Error:${colors.reset} ${params.error}`);
    }
  }

  /**
   * Log incoming Roomagen webhook
   */
  logWebhook(params: {
    providerJobId: string;
    status: string;
    outputUrl?: string | null;
    error?: string | null;
    action: string;
  }): void {
    const ts = getTimestamp();
    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightBlue}📩 Webhook Received:${colors.reset} Job [${params.providerJobId}] -> ${params.status} (${params.action})`
    );
    if (params.outputUrl) {
      console.log(`  ${colors.dim}Output URL:${colors.reset} ${params.outputUrl}`);
    }
    if (params.error) {
      console.error(`  ${colors.brightRed}Error:${colors.reset} ${params.error}`);
    }
  }

  /**
   * Log chained pipeline stage transitions
   */
  logPipelineStage(params: {
    pipelineId: string;
    stage: number;
    totalStages: number;
    tool: string;
    status: string;
    outputUrl?: string | null;
    error?: string | null;
  }): void {
    const ts = getTimestamp();
    const stageColor =
      params.status === 'COMPLETED'
        ? colors.brightGreen
        : params.status === 'FAILED'
        ? colors.brightRed
        : colors.brightCyan;

    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.bold}⚡ Chained Pipeline [${params.pipelineId}]${colors.reset} Stage ${params.stage}/${params.totalStages} (${params.tool}) -> ${stageColor}${params.status}${colors.reset}`
    );
    if (params.outputUrl) {
      console.log(`  ${colors.dim}Stage Output:${colors.reset} ${params.outputUrl}`);
    }
    if (params.error) {
      console.error(`  ${colors.brightRed}Stage Error:${colors.reset}  ${params.error}`);
    }
  }

  /**
   * Log overall generation completion
   */
  logJobCompleted(params: {
    jobId: string;
    tool: string;
    version?: number;
    outputUrl: string;
    durationMs?: number;
  }): void {
    const ts = getTimestamp();
    const border = '─'.repeat(68);
    const durationStr = params.durationMs ? ` in ${(params.durationMs / 1000).toFixed(1)}s` : '';

    console.log(`\n${colors.brightGreen}┌${border}┐${colors.reset}`);
    console.log(
      `${colors.brightGreen}│${colors.reset} ${BADGE} ${colors.bold}${colors.brightGreen}🎉 FLOOR PLAN GENERATION COMPLETED${colors.reset}${durationStr}`
    );
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.dim}Timestamp:${colors.reset}   ${ts}`);
    console.log(`${colors.brightGreen}│${colors.reset} ${colors.dim}Job ID:${colors.reset}      ${colors.bold}${params.jobId}${colors.reset}`);
    console.log(
      `${colors.brightGreen}│${colors.reset} ${colors.dim}Tool:${colors.reset}        ${params.tool} (v${params.version ?? 1})`
    );
    console.log(
      `${colors.brightGreen}│${colors.reset} ${colors.dim}Output URL:${colors.reset}  ${colors.brightCyan}${params.outputUrl}${colors.reset}`
    );
    console.log(`${colors.brightGreen}└${border}┘${colors.reset}\n`);
  }

  /**
   * Log overall generation failure
   */
  logJobFailed(params: {
    jobId: string;
    tool: string;
    error: string;
    durationMs?: number;
  }): void {
    const ts = getTimestamp();
    const border = '─'.repeat(68);

    console.error(`\n${colors.brightRed}┌${border}┐${colors.reset}`);
    console.error(
      `${colors.brightRed}│${colors.reset} ${BADGE} ${colors.bold}${colors.brightRed}❌ FLOOR PLAN GENERATION FAILED${colors.reset}`
    );
    console.error(`${colors.brightRed}│${colors.reset} ${colors.dim}Timestamp:${colors.reset}   ${ts}`);
    console.error(`${colors.brightRed}│${colors.reset} ${colors.dim}Job ID:${colors.reset}      ${colors.bold}${params.jobId}${colors.reset}`);
    console.error(`${colors.brightRed}│${colors.reset} ${colors.dim}Tool:${colors.reset}        ${params.tool}`);
    console.error(`${colors.brightRed}│${colors.reset} ${colors.brightRed}Error:${colors.reset}       ${params.error}`);
    console.error(`${colors.brightRed}└${border}┘${colors.reset}\n`);
  }

  /**
   * Log API Route calls for floor plan endpoints
   */
  logApiRoute(params: {
    endpoint: string;
    method: string;
    userId?: string;
    bodySummary?: Record<string, any>;
  }): void {
    const ts = getTimestamp();
    console.log(
      `${colors.dim}[${ts}]${colors.reset} ${BADGE} ${colors.brightMagenta}📥 API Request:${colors.reset} ${params.method} ${params.endpoint} ${params.userId ? `(user: ${params.userId})` : ''}`
    );
    if (params.bodySummary) {
      console.log(`  ${colors.dim}Parameters:${colors.reset} ${JSON.stringify(sanitizeForLog(params.bodySummary))}`);
    }
  }
}

export const roomagenLogger = new RoomagenLogger();
