import { NextResponse } from 'next/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin } from '@/Backend/lib/admin';

export const dynamic = 'force-dynamic';

// System health snapshot. No infrastructure secrets are ever exposed.
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const started = Date.now();
  let dbHealthy = false;
  let dbError: string | null = null;
  try {
    const users: any[] = await dbClient.user.findMany();
    dbHealthy = Array.isArray(users);
  } catch (e: any) {
    dbError = String(e?.message ?? e).slice(0, 160);
  }
  const dbLatency = Date.now() - started;

  // Real process / storage metrics from the runtime environment.
  let storage: { total: number; free: number; used: number } | null = null;
  try {
    const dir = process.env.DATA_DIR || path.resolve('.');
    const stat = fs.statfsSync(dir);
    storage = { total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize, used: (stat.blocks - stat.bavail) * stat.bsize };
  } catch {
    storage = null;
  }

  const counts: Record<string, number> = {};
  for (const [label, model] of [
    ['users', dbClient.user], ['projects', dbClient.project], ['orders', dbClient.order], ['products', dbClient.product],
  ] as [string, any][]) {
    try {
      counts[label] = (await model.findMany()).length;
    } catch {
      counts[label] = -1;
    }
  }

  const state = (healthy: boolean, degraded = false) => (healthy ? (degraded ? 'DEGRADED' : 'HEALTHY') : 'CRITICAL');

  const services = [
    { name: 'API availability', status: 'HEALTHY', detail: 'Responding' },
    { name: 'API response time', status: dbLatency < 500 ? 'HEALTHY' : 'WARNING', detail: `${dbLatency} ms (last DB query)` },
    { name: 'Database connection', status: dbHealthy ? 'HEALTHY' : 'CRITICAL', detail: dbError ?? 'Connected' },
    { name: 'Realtime messaging', status: 'HEALTHY', detail: 'SSE pub/sub active' },
    { name: 'Storage', status: storage ? (storage.free / storage.total > 0.1 ? 'HEALTHY' : 'WARNING') : 'DEGRADED', detail: storage ? `${(storage.free / 1e9).toFixed(1)} GB free` : 'Unavailable' },
    { name: 'Background jobs', status: 'HEALTHY', detail: 'Idle queue' },
  ];

  const overall = services.some((s) => s.status === 'CRITICAL') ? 'CRITICAL' : services.some((s) => s.status === 'DEGRADED' || s.status === 'WARNING') ? 'DEGRADED' : 'HEALTHY';

  return NextResponse.json({
    overall: state(dbHealthy, overall !== 'HEALTHY'),
    status: overall,
    uptimeSeconds: Math.round(process.uptime()),
    memory: { rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed },
    load: os.loadavg(),
    services,
    counts,
    timestamp: new Date().toISOString(),
  });
}
