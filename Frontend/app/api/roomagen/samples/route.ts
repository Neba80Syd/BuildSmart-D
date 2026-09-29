import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export interface ArchitecturalSample {
  id: string;
  title: string;
  category: 'sketch' | 'floorplan' | 'colorized';
  recommendedTool: 'SKETCH_TO_FLOOR_PLAN' | 'FLOOR_PLAN_TO_3D' | 'FLOOR_PLAN_COLORIZE';
  imageUrl: string;
  description: string;
  suggestedPrompt: string;
  stylePreset: string;
}

const SAMPLES: ArchitecturalSample[] = [
  {
    id: 'sample_sketch_villa',
    title: 'Hand-Drawn Villa Sketch',
    category: 'sketch',
    recommendedTool: 'SKETCH_TO_FLOOR_PLAN',
    imageUrl: '/images/blueprint-ai.png',
    description: 'Rough pencil sketch of a 3-bedroom modern residential villa with master ensuite and open-concept patio.',
    suggestedPrompt: 'Modern 3-bedroom residential layout with open living room, island kitchen, and master ensuite bathroom.',
    stylePreset: 'Modern Minimalist',
  },
  {
    id: 'sample_floorplan_apartment',
    title: 'Monochrome 2D CAD Blueprint',
    category: 'floorplan',
    recommendedTool: 'FLOOR_PLAN_TO_3D',
    imageUrl: '/images/project-floorplan.png',
    description: 'Technical 2D floor plan drawing with dimension lines, partition walls, door swings, and window openings.',
    suggestedPrompt: 'Photorealistic architectural 3D cutaway visualization with warm natural daylight, oak hardwood flooring, and marble kitchen counters.',
    stylePreset: 'Contemporary Luxury',
  },
  {
    id: 'sample_colorized_penthouse',
    title: 'Presentation Floor Plan Layout',
    category: 'colorized',
    recommendedTool: 'FLOOR_PLAN_COLORIZE',
    imageUrl: '/images/project-eco-office.png',
    description: 'CAD architectural layout ready for presentation colorization, materials staging, and furniture fills.',
    suggestedPrompt: 'High-end interior presentation colorization with travertine tiles, matte black fixtures, and indoor potted botanicals.',
    stylePreset: 'Scandinavian Simplicity',
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: SAMPLES,
  });
}
