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
  const user = await resolveUser('ARCHITECT');
  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
  const credentials = safeJson(profile?.credentials, { identity: [], education: [], professional: [], business: [] });
  const verificationDocs = safeJson(profile?.verificationDocs, []);
  return NextResponse.json({
    role: 'ARCHITECT',
    name: user.name,
    verificationStatus: profile?.verificationStatus ?? 'UNVERIFIED',
    licenseNumber: profile?.licenseNumber ?? '',
    experience: profile?.experience ?? null,
    title: profile?.title ?? '',
    credentials,
    verificationDocs,
  });
}

const DocSchema = z.object({
  name: z.string().min(2).max(200),
  kind: z.enum(['identity', 'education', 'professional', 'business']),
  fileData: z.string().optional(), // base64 / data URL
  fileType: z.string().optional(), // mime type (image/jpeg, application/pdf, etc.)
  fileSize: z.number().int().nonnegative().optional(), // bytes
});

export async function POST(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = DocSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid document' }, { status: 400 });

  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });
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
    await dbClient.architectProfile.update({ where: { userId: user.id }, data: { verificationDocs: docs } });
  } else {
    await dbClient.architectProfile.create({
      data: {
        userId: user.id,
        verificationStatus: 'UNVERIFIED',
        verificationDocs: docs,
        specializations: '[]',
        portfolio: '[]',
      },
    });
  }

  await dbClient.activity.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Document uploaded', body: parsed.data.name } });
  return NextResponse.json({ success: true, verificationDocs: docs, doc }, { status: 201 });
}

const UpdateSchema = z.object({
  action: z.enum(['submit', 'save_details', 'replace', 'delete', 'set_status']),
  licenseNumber: z.string().max(100).optional(),
  experience: z.coerce.number().int().min(0).max(80).optional(),
  name: z.string().optional(),
  id: z.string().optional(),
  kind: z.enum(['identity', 'education', 'professional', 'business']).optional(),
  status: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED']).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await resolveUser('ARCHITECT');
  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid payload' }, { status: 400 });
  const d = parsed.data;

  const profile: any = await dbClient.architectProfile.findUnique({ where: { userId: user.id } });

  if (d.action === 'save_details') {
    const data: any = {};
    if (d.licenseNumber !== undefined) data.licenseNumber = d.licenseNumber;
    if (d.experience !== undefined) data.experience = d.experience;
    if (profile) {
      await dbClient.architectProfile.update({ where: { userId: user.id }, data });
    } else {
      await dbClient.architectProfile.create({
        data: { userId: user.id, licenseNumber: d.licenseNumber ?? '', experience: d.experience ?? 0, verificationStatus: 'UNVERIFIED', specializations: '[]', portfolio: '[]' },
      });
    }
    return NextResponse.json({ success: true, licenseNumber: d.licenseNumber, experience: d.experience });
  }

  if (d.action === 'set_status' && d.status) {
    const data: any = { verificationStatus: d.status };
    if (d.status === 'VERIFIED') data.verifiedAt = new Date().toISOString();
    else data.verifiedAt = null;
    await dbClient.architectProfile.update({ where: { userId: user.id }, data });
    return NextResponse.json({ success: true, verificationStatus: d.status });
  }

  if (d.action === 'submit') {
    const existing: any = profile ?? {};
    const data: any = { verificationStatus: 'PENDING', verifiedAt: null };
    if (d.licenseNumber) data.licenseNumber = d.licenseNumber;
    if (d.experience != null) data.experience = d.experience;
    if (existing) {
      await dbClient.architectProfile.update({ where: { userId: user.id }, data });
    } else {
      await dbClient.architectProfile.create({
        data: { userId: user.id, licenseNumber: d.licenseNumber ?? '', experience: d.experience ?? 0, verificationStatus: 'PENDING', location: '', biography: '', rating: 0, reviewCount: 0, specializations: '[]', portfolio: '[]', hourlyRate: 0 },
      });
    }
    await dbClient.activity.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Verification submitted', body: 'Your credentials are under review.' } });
    await dbClient.notification.create({ data: { userId: user.id, type: 'VERIFICATION', title: 'Verification submitted', body: 'Your credentials are now under review by our admin team.', read: 0 } });
    return NextResponse.json({ success: true, status: 'PENDING' });
  }

  const docs = safeJson(profile?.verificationDocs, []);
  if (d.action === 'delete') {
    const updated = docs.filter((x: any) => (d.id ? x.id !== d.id : x.name !== d.name));
    await dbClient.architectProfile.update({ where: { userId: user.id }, data: { verificationDocs: updated } });
    return NextResponse.json({ success: true, verificationDocs: updated });
  }
  if (d.action === 'replace') {
    const updated = docs.filter((x: any) => (d.id ? x.id !== d.id : x.name !== d.name));
    updated.push({ name: d.name, kind: d.kind, status: 'PENDING', uploadedAt: new Date().toISOString() });
    await dbClient.architectProfile.update({ where: { userId: user.id }, data: { verificationDocs: updated } });
    return NextResponse.json({ success: true, verificationDocs: updated });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
