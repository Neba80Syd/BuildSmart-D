import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { resolveUser } from '@/Backend/lib/preview';

export const dynamic = 'force-dynamic';

const safeJson = (v: any, fallback: any) => {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
};

export async function GET() {
  const user = await resolveUser('VENDOR');
  const profile: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
  const verificationDocs = safeJson(profile?.verificationDocs, []);
  return NextResponse.json({
    role: 'VENDOR',
    name: user.name,
    businessName: profile?.businessName ?? '',
    registrationNumber: profile?.registrationNumber ?? '',
    taxId: profile?.taxId ?? '',
    verificationStatus: profile?.verificationStatus ?? 'DRAFT',
    verificationLevel: profile?.verificationLevel ?? 'UNVERIFIED',
    verifiedAt: profile?.verifiedAt ?? null,
    verificationDocs,
  });
}

const DocSchema = z.object({
  name: z.string().min(2).max(200),
  kind: z.enum(['business_registration', 'tax_id', 'identity', 'store_permit', 'business']),
  fileData: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = DocSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid document' }, { status: 400 });

  const profile: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });
  const docs = safeJson(profile?.verificationDocs, []);
  const doc = {
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: parsed.data.name,
    kind: parsed.data.kind,
    fileData: parsed.data.fileData ?? null,
    fileType: parsed.data.fileType ?? 'application/octet-stream',
    fileSize: parsed.data.fileSize ?? 0,
    status: 'PENDING',
    uploadedAt: new Date().toISOString(),
  };
  docs.push(doc);

  if (profile) {
    await dbClient.vendorProfile.update({ where: { userId: user.id }, data: { verificationDocs: docs } });
  } else {
    await dbClient.vendorProfile.create({
      data: {
        userId: user.id,
        businessName: `${user.name} Supplies`,
        verificationStatus: 'DRAFT',
        verificationLevel: 'UNVERIFIED',
        verificationDocs: docs,
      },
    });
  }

  await dbClient.activity.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Vendor document uploaded', body: parsed.data.name } });
  return NextResponse.json({ success: true, verificationDocs: docs, doc }, { status: 201 });
}

const UpdateSchema = z.object({
  action: z.enum(['submit', 'save_details', 'delete', 'set_status']),
  businessName: z.string().max(160).optional(),
  registrationNumber: z.string().max(100).optional(),
  taxId: z.string().max(100).optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'FULLY_VERIFIED', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('VENDOR');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const profile: any = await dbClient.vendorProfile.findUnique({ where: { userId: user.id } });

  if (d.action === 'save_details') {
    const data: any = {};
    if (d.businessName !== undefined) data.businessName = d.businessName;
    if (d.registrationNumber !== undefined) data.registrationNumber = d.registrationNumber;
    if (d.taxId !== undefined) data.taxId = d.taxId;

    if (profile) {
      await dbClient.vendorProfile.update({ where: { userId: user.id }, data });
    } else {
      await dbClient.vendorProfile.create({
        data: {
          userId: user.id,
          businessName: d.businessName || `${user.name} Supplies`,
          registrationNumber: d.registrationNumber || '',
          taxId: d.taxId || '',
          verificationStatus: 'DRAFT',
          verificationLevel: 'UNVERIFIED',
        },
      });
    }
    return NextResponse.json({ success: true, profile: data });
  }

  if (d.action === 'set_status' && d.status) {
    const isVerified = d.status === 'FULLY_VERIFIED' || d.status === 'VERIFIED';
    const data: any = {
      verificationStatus: d.status,
      verificationLevel: isVerified ? 'VERIFIED_VENDOR' : 'UNVERIFIED',
      verifiedAt: isVerified ? new Date().toISOString() : null,
    };
    await dbClient.vendorProfile.update({ where: { userId: user.id }, data });
    return NextResponse.json({ success: true, verificationStatus: d.status });
  }

  if (d.action === 'submit') {
    const data: any = {
      verificationStatus: 'PENDING',
      verifiedAt: null,
    };
    if (d.businessName) data.businessName = d.businessName;
    if (d.registrationNumber) data.registrationNumber = d.registrationNumber;
    if (d.taxId) data.taxId = d.taxId;

    if (profile) {
      await dbClient.vendorProfile.update({ where: { userId: user.id }, data });
    } else {
      await dbClient.vendorProfile.create({
        data: {
          userId: user.id,
          businessName: d.businessName || `${user.name} Supplies`,
          registrationNumber: d.registrationNumber || '',
          taxId: d.taxId || '',
          verificationStatus: 'PENDING',
          verificationLevel: 'UNVERIFIED',
        },
      });
    }

    await dbClient.activity.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Vendor verification submitted', body: 'Store credentials are under review.' } });
    await dbClient.notification.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Vendor credentials submitted', body: 'Your store verification application is under review by our admin team.', read: 0 } });
    return NextResponse.json({ success: true, status: 'PENDING' });
  }

  const docs = safeJson(profile?.verificationDocs, []);
  if (d.action === 'delete') {
    const updated = docs.filter((x: any) => (d.id ? x.id !== d.id : x.name !== d.name));
    await dbClient.vendorProfile.update({ where: { userId: user.id }, data: { verificationDocs: updated } });
    return NextResponse.json({ success: true, verificationDocs: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
