import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  generateArchitecturalPlan3D,
  type ArchitectPlanRequirements,
} from '@/Backend/lib/ai-plan-generator';
import { resolveUser } from '@/Backend/lib/preview';

const PlanRequestSchema = z.object({
  buildingType: z.string().min(1).default('Residential'),
  floors: z.number().int().min(1).max(5).default(1),
  sqft: z.number().optional().default(2500),
  bedrooms: z.number().int().min(1).max(10).default(3),
  bathrooms: z.string().default('2'),
  style: z.string().min(1).default('Modern Minimalist'),
  budget: z.number().int().min(1).max(4).default(2),
  customPrompt: z.string().optional(),
  location: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser('ARCHITECT').catch(() => ({
      id: 'architect_guest',
      name: 'Architect',
      role: 'ARCHITECT',
    }));

    const raw = await req.json().catch(() => ({}));
    const parsed = PlanRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid plan requirements', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const requirements: ArchitectPlanRequirements = parsed.data;
    const plan = await generateArchitecturalPlan3D(requirements);

    return NextResponse.json({
      success: true,
      plan,
      generatedBy: user.name,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[api/ai/plan/generate] Error generating plan:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate 3D architectural plan' },
      { status: 500 },
    );
  }
}
