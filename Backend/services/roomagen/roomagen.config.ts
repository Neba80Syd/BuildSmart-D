// BuildSmart AI — Roomagen Configuration
// Centralized server-side configuration for Roomagen integration.
// Never exposes secrets to browser JavaScript or client-facing bundles.

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { RoomagenConfigError } from './roomagen.errors.ts';

// Load environment files cleanly if not already set
const envCandidates = [
  path.resolve(process.cwd(), 'Frontend/.env.local'),
  path.resolve(process.cwd(), 'Frontend/.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

export interface RoomagenConfig {
  apiKey: string;
  baseUrl: string;
  provider: 'roomagen' | 'mock';
  webhookSecret?: string;
  timeoutMs: number;
  maxRetries: number;
  pollingIntervalMs: number;
  maxPollingAttempts: number;
}

export function getRoomagenConfig(): RoomagenConfig {
  const rawKey = process.env.ROOMAGEN_API_KEY?.trim() || '';
  const configuredProvider = (process.env.ROOMAGEN_PROVIDER || '').trim().toLowerCase();

  // Determine provider mode:
  // If explicitly set to 'mock', use mock.
  // If no API key is provided and running in dev/test, fallback to mock to prevent crashing.
  // If API key is provided and provider is not set to 'mock', use 'roomagen'.
  let provider: 'roomagen' | 'mock' = 'roomagen';
  if (configuredProvider === 'mock' || (!rawKey && process.env.NODE_ENV !== 'production')) {
    provider = 'mock';
  }

  const baseUrl = (process.env.ROOMAGEN_BASE_URL?.trim() || 'https://api.roomagen.com/api/v1').replace(/\/+$/, '');

  return {
    apiKey: rawKey,
    baseUrl,
    provider,
    webhookSecret: process.env.ROOMAGEN_WEBHOOK_SECRET?.trim() || undefined,
    timeoutMs: parseInt(process.env.ROOMAGEN_TIMEOUT_MS || '60000', 10),
    maxRetries: 3,
    pollingIntervalMs: 3000,
    maxPollingAttempts: 40, // 40 * 3s = 2 minutes max
  };
}

/**
 * Validate that configuration is ready for live API operations.
 * Throws a safe RoomagenConfigError if key is missing when live provider is required.
 */
export function validateLiveConfig(): RoomagenConfig {
  const config = getRoomagenConfig();
  if (config.provider === 'roomagen' && (!config.apiKey || config.apiKey.length < 5)) {
    throw new RoomagenConfigError(
      'ROOMAGEN_API_KEY is not configured on the server. Please set ROOMAGEN_API_KEY or use ROOMAGEN_PROVIDER=mock for local development.'
    );
  }
  return config;
}
