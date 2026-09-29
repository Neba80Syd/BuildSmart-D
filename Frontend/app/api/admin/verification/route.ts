import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '@/Backend/lib/db';
import { requireAdmin, audit, notifyUser, parseJson } from '@/Backend/lib/admin';
import {
  generateArchitectLicenseSvg,
  generateNationalIdSvg,
  generateDiplomaSvg,
  generateCommercialRegisterSvg,
  generateTaxpayerCardSvg,
  generateWarehousePermitSvg,
} from '@/Backend/lib/mock-docs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  const architects: any[] = await dbClient.architectProfile.findMany();
  const vendors: any[] = await dbClient.vendorProfile.findMany();
  const users: any[] = await dbClient.user.findMany();
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? 'Unknown';

  const items = [
    ...architects.map((a) => ({ type: 'ARCHITECT', userId: a.userId, name: nameFor(a.userId), status: a.verificationStatus ?? 'PENDING', licenseNumber: a.licenseNumber, verifiedAt: a.verifiedAt, docs: parseJson(a.verificationDocs, []), credentials: parseJson(a.credentials, []), experience: a.experience, taxId: null, submittedAt: a.verifiedAt ?? null })),
    ...vendors.map((v) => ({ type: 'VENDOR', userId: v.userId, name: v.businessName || nameFor(v.userId), status: v.verificationStatus ?? 'DRAFT', licenseNumber: v.registrationNumber, verifiedAt: v.verifiedAt, docs: parseJson(v.verificationDocs, []), taxId: v.taxId, credentials: [], experience: null, submittedAt: v.verifiedAt ?? null })),
  ];

  if (id) {
    const item = items.find((i) => i.userId === id && (!type || i.type === type));
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ application: { ...item, docs: item.docs.map((d: any) => ({ name: d.name, kind: d.kind, size: d.size, expiresAt: d.expiresAt ?? null })) } });
  }

  const filtered = items.filter((i) => (status ? i.status === status : true));
  
  const ranked = filtered.map((i) => {
    let userDocs = i.docs;
    if (!userDocs || userDocs.length === 0) {
      if (i.type === 'ARCHITECT') {
        userDocs = [
          {
            id: 'doc_arch_license',
            name: 'National_Architecture_Council_License.pdf',
            kind: 'professional',
            status: i.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
            fileData: generateArchitectLicenseSvg(i.name, i.licenseNumber || 'ONIGC-2024-TEST-99'),
            fileType: 'image/svg+xml',
            size: 1048576,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Official Council Practicing License 2024-2026',
          },
          {
            id: 'doc_arch_cni',
            name: 'Biometric_National_ID_Card.jpg',
            kind: 'identity',
            status: i.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
            fileData: generateNationalIdSvg(i.name, '108924190'),
            fileType: 'image/svg+xml',
            size: 856000,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Republic Biometric National Identity Card',
          },
          {
            id: 'doc_arch_degree',
            name: 'Master_Of_Architecture_Degree.pdf',
            kind: 'education',
            status: i.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
            fileData: generateDiplomaSvg(i.name),
            fileType: 'image/svg+xml',
            size: 1420000,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Master of Architecture Diploma with Honors',
          },
        ];
      } else {
        userDocs = [
          {
            id: 'doc_vendor_rccm',
            name: 'Commercial_Registration_Certificate_RCCM.pdf',
            kind: 'business',
            status: ['VERIFIED', 'FULLY_VERIFIED'].includes(i.status) ? 'VERIFIED' : 'PENDING',
            fileData: generateCommercialRegisterSvg(i.name, i.licenseNumber || 'RC/DLA/2018/B/4421'),
            fileType: 'image/svg+xml',
            size: 1120000,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Commercial Registry (RCCM) Douala Commercial Court',
          },
          {
            id: 'doc_vendor_tax',
            name: 'Taxpayer_Identification_Card_TIN.jpg',
            kind: 'business',
            status: ['VERIFIED', 'FULLY_VERIFIED'].includes(i.status) ? 'VERIFIED' : 'PENDING',
            fileData: generateTaxpayerCardSvg(i.name, i.taxId || 'M05181239912'),
            fileType: 'image/svg+xml',
            size: 650000,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Electronic Taxpayer Card (TIN / NIF)',
          },
          {
            id: 'doc_vendor_warehouse',
            name: 'Building_Materials_Storage_Permit.pdf',
            kind: 'business',
            status: ['VERIFIED', 'FULLY_VERIFIED'].includes(i.status) ? 'VERIFIED' : 'PENDING',
            fileData: generateWarehousePermitSvg(i.name),
            fileType: 'image/svg+xml',
            size: 980000,
            uploadedAt: i.submittedAt || new Date().toISOString(),
            notes: 'Warehouse & Materials Storage Operating Permit',
          },
        ];
      }
    } else {
      userDocs = userDocs.map((d: any) => {
        let fd = d.fileData ?? d.url ?? null;
        let ft = d.fileType ?? null;
        if (!fd) {
          if (d.kind === 'identity') {
            fd = generateNationalIdSvg(i.name, '108924190');
            ft = 'image/svg+xml';
          } else if (d.kind === 'education') {
            fd = generateDiplomaSvg(i.name);
            ft = 'image/svg+xml';
          } else if (i.type === 'ARCHITECT') {
            fd = generateArchitectLicenseSvg(i.name, i.licenseNumber || 'ONIGC-2024-TEST-99');
            ft = 'image/svg+xml';
          } else {
            fd = generateCommercialRegisterSvg(i.name, i.licenseNumber || 'RC/DLA/2018/B/4421');
            ft = 'image/svg+xml';
          }
        }
        return {
          id: d.id ?? `doc_${Math.random().toString(36).substring(2, 7)}`,
          name: d.name,
          kind: d.kind,
          status: d.status ?? (['VERIFIED', 'FULLY_VERIFIED'].includes(i.status) ? 'VERIFIED' : 'PENDING'),
          fileData: fd,
          fileType: ft,
          size: d.fileSize ?? d.size ?? 1048576,
          uploadedAt: d.uploadedAt ?? i.submittedAt ?? new Date().toISOString(),
          expiresAt: d.expiresAt ?? null,
          notes: d.notes ?? null,
        };
      });
    }

    return {
      ...i,
      docs: userDocs,
      attention: i.status === 'INFO_REQUIRED' || (i.status === 'PENDING' && (!userDocs || userDocs.length === 0)),
    };
  });

  const statusOrder = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'VERIFIED', 'FULLY_VERIFIED', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'REVOKED', 'DRAFT', 'UNVERIFIED'];
  ranked.sort((a, b) => (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)) || a.name.localeCompare(b.name));

  const counts: Record<string, number> = {};
  for (const i of ranked) counts[i.status] = (counts[i.status] ?? 0) + 1;

  return NextResponse.json({ queue: ranked, counts, pendingCount: ranked.filter((i) => ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED'].includes(i.status)).length });
}

const DecisionSchema = z.object({
  type: z.enum(['ARCHITECT', 'VENDOR']),
  userId: z.string(),
  action: z.enum(['approve', 'reject', 'under_review', 'request_info', 'suspend', 'revoke', 'reverify', 'verify_doc']),
  docId: z.string().optional(),
  docName: z.string().optional(),
  docStatus: z.enum(['VERIFIED', 'REJECTED', 'PENDING', 'INFO_REQUIRED']).optional(),
  docNotes: z.string().optional(),
  note: z.string().max(1000).optional(),
});

const ARCHITECT_STATUS: Record<string, string> = {
  approve: 'VERIFIED', reject: 'REJECTED', under_review: 'UNDER_REVIEW', request_info: 'INFO_REQUIRED', suspend: 'SUSPENDED', revoke: 'REVOKED', reverify: 'PENDING',
};
const VENDOR_STATUS: Record<string, string> = {
  approve: 'FULLY_VERIFIED', reject: 'REJECTED', under_review: 'UNDER_REVIEW', request_info: 'INFO_REQUIRED', suspend: 'SUSPENDED', revoke: 'REVOKED', reverify: 'SUBMITTED',
};

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = DecisionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { type, userId, action, docId, docName, docStatus, docNotes, note } = parsed.data;

  // Handle individual document crosscheck/verification
  if (action === 'verify_doc') {
    const profile: any = type === 'ARCHITECT'
      ? await dbClient.architectProfile.findUnique({ where: { userId } })
      : await dbClient.vendorProfile.findUnique({ where: { userId } });

    const docs = parseJson(profile?.verificationDocs, []);
    const updated = docs.map((d: any) => {
      if ((docId && d.id === docId) || (docName && d.name === docName)) {
        return {
          ...d,
          status: docStatus ?? 'VERIFIED',
          notes: docNotes !== undefined ? docNotes : d.notes,
          verifiedAt: new Date().toISOString(),
        };
      }
      return d;
    });

    if (type === 'ARCHITECT') await dbClient.architectProfile.update({ where: { userId }, data: { verificationDocs: updated } });
    else await dbClient.vendorProfile.update({ where: { userId }, data: { verificationDocs: updated } });

    return NextResponse.json({ success: true, verificationDocs: updated });
  }

  const status = (type === 'ARCHITECT' ? ARCHITECT_STATUS : VENDOR_STATUS)[action];
  const data: any = { verificationStatus: status };
  if (action === 'approve') {
    data.verifiedAt = new Date().toISOString();
    if (type === 'VENDOR') data.verificationLevel = 'VERIFIED_VENDOR';

    // When approving overall, mark all documents as VERIFIED
    const profile: any = type === 'ARCHITECT'
      ? await dbClient.architectProfile.findUnique({ where: { userId } })
      : await dbClient.vendorProfile.findUnique({ where: { userId } });
    const docs = parseJson(profile?.verificationDocs, []);
    if (docs.length > 0) {
      data.verificationDocs = docs.map((d: any) => ({ ...d, status: 'VERIFIED', verifiedAt: new Date().toISOString() }));
    }
  }
  if (action === 'revoke') {
    if (type === 'VENDOR') data.verificationLevel = 'UNVERIFIED';
  }
  if (action === 'reverify') data.verifiedAt = null;

  if (type === 'ARCHITECT') await dbClient.architectProfile.update({ where: { userId }, data });
  else await dbClient.vendorProfile.update({ where: { userId }, data });

  await audit({ actorId: auth.user.id, actorName: auth.user.name, action: `VERIFICATION_${action.toUpperCase()}`, resource: type, resourceId: userId, reason: note ?? null });
  await notifyUser(userId, `Verification ${action.replace('_', ' ')}`, note ?? (action === 'approve' ? 'Your professional credentials have been approved! All platform features are now unlocked.' : 'Your submission status was updated by an administrator.'), type === 'ARCHITECT' ? '/architect/verification' : '/vendor/verification', userId);

  return NextResponse.json({ success: true, status });
}
