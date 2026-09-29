import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  mutateArchitecturalPlan,
  type Plan3DResult,
} from '@/Backend/lib/ai-plan-generator';
import { resolveUser } from '@/Backend/lib/preview';

const ChatRequestSchema = z.object({
  plan: z.any(),
  instruction: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  try {
    await resolveUser('ARCHITECT').catch(() => ({
      id: 'architect_guest',
      name: 'Architect',
      role: 'ARCHITECT',
    }));

    const raw = await req.json().catch(() => ({}));
    const parsed = ChatRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: plan and instruction are required' },
        { status: 400 },
      );
    }

    const { plan, instruction } = parsed.data;
    const result = await mutateArchitecturalPlan(plan as Plan3DResult, instruction);

    return NextResponse.json({
      success: true,
      reply: result.reply,
      updatedPlan: result.updatedPlan,
    });
  } catch (err: any) {
    console.error('[api/ai/plan/chat] Error mutating plan:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to process plan modification instruction' },
      { status: 500 },
    );
  }
}
