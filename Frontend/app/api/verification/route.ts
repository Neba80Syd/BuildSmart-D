import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser, type SessionUser } from '@/Backend/lib/preview';

const ROLES: SessionUser['role'][] = ['ARCHITECT', 'VENDOR'];

function roleFrom(req: NextRequest): SessionUser['role'] {
  const r = new URL(req.url).searchParams.get('role')?.toUpperCase();
  return ROLES.includes(r as any) ? (r as SessionUser['role']) : 'ARCHITECT';
}

export async function GET(req: NextRequest) {
  const role = roleFrom(req);
  const user = await resolveUser(role);

  let status: any = null;
  if (role === 'ARCHITECT') status = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  if (role === 'VENDOR') status = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    role,
    name: user.name,
    verificationStatus: status?.verificationStatus ?? 'UNVERIFIED',
    licenseNumber: status?.licenseNumber ?? status?.registrationNumber ?? '',
    experience: status?.experience ?? null,
  });
}

const SubmitSchema = z.object({
  fullName: z.string().min(2).max(120),
  licenseNumber: z.string().min(2).max(80),
  experience: z.coerce.number().int().min(0).max(80),
});

export async function POST(req: NextRequest) {
  const role = roleFrom(req);
  const user = await resolveUser(role);
  const parsed = SubmitSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid submission' }, { status: 400 });

  if (role === 'ARCHITECT') {
    const existing = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
    if (existing) {
      await dbClient.architectProfile.update({
        where: { userId: user.id },
        data: { licenseNumber: parsed.data.licenseNumber, experience: parsed.data.experience, verificationStatus: 'PENDING', verifiedAt: null },
      });
    } else {
      await dbClient.architectProfile.create({
        data: { userId: user.id, licenseNumber: parsed.data.licenseNumber, experience: parsed.data.experience, verificationStatus: 'PENDING', location: '', biography: '', rating: 0, reviewCount: 0, specializations: '[]', portfolio: '[]', hourlyRate: 0 },
      });
    }
  } else {
    const existing = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
    if (existing) {
      await dbClient.vendorProfile.update({
        where: { userId: user.id },
        data: { registrationNumber: parsed.data.licenseNumber, verificationStatus: 'PENDING', verifiedAt: null },
      });
    } else {
      await dbClient.vendorProfile.create({
        data: { userId: user.id, businessName: parsed.data.fullName, location: '', registrationNumber: parsed.data.licenseNumber, verificationLevel: 'UNVERIFIED', verificationStatus: 'PENDING', rating: 0, reviewCount: 0, description: '' },
      });
    }
  }

  await dbClient.notification.create({
    data: { userId: user.id, type: 'VERIFICATION', title: 'Verification submitted', body: 'Your credentials are now under review by our team.', read: 0 },
  });

  return NextResponse.json({ success: true, status: 'PENDING' }, { status: 201 });
}
