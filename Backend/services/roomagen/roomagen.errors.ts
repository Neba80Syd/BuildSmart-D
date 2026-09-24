// BuildSmart AI — Roomagen Typed Errors
// Safe, structured error types with sanitized user-facing messages.

export class RoomagenError extends Error {
  readonly code: string;
  readonly status: number;
  readonly isTransient: boolean;

  constructor(message: string, code = 'ROOMAGEN_ERROR', status = 500, isTransient = false) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.isTransient = isTransient;
  }

  /** Safe message suitable for display to clients without exposing internals */
  getUserMessage(): string {
    return 'An error occurred during floor plan generation. Please try again.';
  }
}

export class RoomagenConfigError extends RoomagenError {
  constructor(message = 'Roomagen API key is not configured or invalid on the server') {
    super(message, 'ROOMAGEN_CONFIG_ERROR', 503, false);
  }

  override getUserMessage(): string {
    return 'Floor plan AI generation service is temporarily unavailable. Please contact support.';
  }
}

export class RoomagenValidationError extends RoomagenError {
  constructor(message: string) {
    super(message, 'ROOMAGEN_VALIDATION_ERROR', 400, false);
  }

  override getUserMessage(): string {
    return this.message;
  }
}

export class RoomagenApiError extends RoomagenError {
  readonly providerStatus?: number;
  readonly providerError?: string;

  constructor(message: string, providerStatus?: number, providerError?: string) {
    const isTransient = typeof providerStatus === 'number' && (providerStatus >= 500 || providerStatus === 429);
    super(message, 'ROOMAGEN_API_ERROR', providerStatus && providerStatus >= 400 ? providerStatus : 502, isTransient);
    this.providerStatus = providerStatus;
    this.providerError = providerError;
  }

  override getUserMessage(): string {
    if (this.isTransient) {
      return 'The AI generation provider is temporarily busy. Please retry shortly.';
    }
    return 'Could not process the design with the AI generation provider. Please check the image and try again.';
  }
}

export class RoomagenJobNotFoundError extends RoomagenError {
  constructor(jobId: string) {
    super(`Roomagen job "${jobId}" was not found`, 'ROOMAGEN_JOB_NOT_FOUND', 404, false);
  }

  override getUserMessage(): string {
    return 'The requested floor plan generation job was not found.';
  }
}

export class RoomagenTimeoutError extends RoomagenError {
  constructor(jobId: string) {
    super(`Floor plan generation timed out for job "${jobId}"`, 'ROOMAGEN_TIMEOUT', 504, true);
  }

  override getUserMessage(): string {
    return 'Floor plan processing timed out. Please try again or check back shortly.';
  }
}

export class RoomagenRateLimitError extends RoomagenError {
  constructor(message = 'Too many generation requests. Please wait a moment before trying again.') {
    super(message, 'ROOMAGEN_RATE_LIMIT', 429, true);
  }

  override getUserMessage(): string {
    return this.message;
  }
}
