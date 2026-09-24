// Per-user rate limiting for the Copilot endpoint.
// Prevents a single user from exhausting the Gemini quota while keeping the
// implementation cheap enough for the embedded preview database.

import { dbClient } from '../db';

const WINDOW_MS = 60_000;
const HOUR_MS = 3_600_000;
const PER_MINUTE = 20;
const PER_HOUR = 120;

// In-memory sliding window is cheap and survives HMR; the DB ledger gives a
// durable record for monitoring.
const memory = new Map<string, number[]>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: 'RATE_LIMIT' | null;
};

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const now = Date.now();
  const minuteThreshold = now - WINDOW_MS;
  const hourThreshold = now - HOUR_MS;

  // In-memory window.
  let hits = memory.get(userId) ?? [];
  hits = hits.filter((t) => t > minuteThreshold);
  memory.set(userId, hits);

  if (hits.length >= PER_MINUTE) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + WINDOW_MS - now) / 1000)),
      reason: 'RATE_LIMIT',
    };
  }

  // Durable hourly cap, using the DB ledger if it is reachable.
  try {
    const hourCount = await dbClient.aiUsageLog.countForWindow({ userId, since: new Date(hourThreshold) });
    if (hourCount >= PER_HOUR) {
      return { allowed: false, retryAfterSeconds: 60, reason: 'RATE_LIMIT' };
    }
  } catch {
    // The DB ledger is best-effort; the in-memory window still protects quota.
  }

  return { allowed: true, retryAfterSeconds: 0, reason: null };
}

export function recordUserHit(userId: string): void {
  const now = Date.now();
  const hits = memory.get(userId) ?? [];
  hits.push(now);
  memory.set(userId, hits.filter((t) => t > now - WINDOW_MS));
}
