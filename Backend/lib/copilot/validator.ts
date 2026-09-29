// Validates structured AI output before it is returned to the client.
// Arbitrary AI-generated code or schema-less payloads are rejected.

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function validateBOQDraft(data: any): ValidationResult<any> {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Invalid BOQ payload' };
  const rows = Array.isArray(data.sections) ? data.sections : [];
  const bad = rows.find((r: any) => typeof r?.material !== 'string' || typeof r?.unit !== 'string');
  if (bad) return { ok: false, error: 'BOQ row is missing material or unit' };
  return {
    ok: true,
    value: {
      ...data,
      disclaimer: 'AI-generated preliminary estimate — requires professional verification.',
      sections: rows.map((r: any) => ({
        category: String(r.category ?? 'General').slice(0, 60),
        material: String(r.material).slice(0, 160),
        description: String(r.description ?? '').slice(0, 300),
        quantity: Number(r.quantity ?? 0),
        unit: String(r.unit).slice(0, 30),
        estimatedUnitCost: Number(r.estimatedUnitCost ?? 0),
        estimatedTotal: Number(r.estimatedTotal ?? 0),
        notes: String(r.notes ?? '').slice(0, 300),
      })),
    },
  };
}

export function validateDesignBrief(data: any): ValidationResult<any> {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Invalid design brief payload' };
  if (typeof data.requirements !== 'string') return { ok: false, error: 'Design brief is missing requirements' };
  return {
    ok: true,
    value: {
      projectId: data.projectId ?? null,
      projectName: String(data.projectName ?? 'Unspecified project').slice(0, 120),
      source: String(data.source ?? 'Architect').slice(0, 80),
      requirements: data.requirements.slice(0, 4000),
      status: 'DRAFT',
      disclaimer: 'Structured extract — architect to confirm with client.',
    },
  };
}

export function validateSanitizedProducts(data: any): ValidationResult<any> {
  const products = Array.isArray(data?.products) ? data.products : [];
  if (products.length > 50) return { ok: false, error: 'Too many products returned' };
  return {
    ok: true,
    value: {
      products: products.map((p: any) => ({
        id: String(p.id ?? '').slice(0, 80),
        name: String(p.name ?? '').slice(0, 160),
        category: String(p.category ?? '').slice(0, 80),
        unit: String(p.unit ?? '').slice(0, 40),
        price: Number(p.price ?? 0),
        currency: 'XAF',
        stock: Number(p.stock ?? 0),
      })),
    },
  };
}
