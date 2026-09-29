'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, money } from '@/Frontend/components/admin/shared';

export default function AdminProductsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (category) p.set('category', category);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, status, category]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/products${query ? `?${query}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/products', { id, action });
      toast.success(`Product ${action}ed`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Products" subtitle="Moderate marketplace listings" crumbs={['Admin', 'Marketplace', 'Products']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search products…" /></div>
          <FilterChips options={data?.statuses ?? ['APPROVED', 'PENDING', 'REJECTED', 'SUSPENDED']} value={status} onChange={setStatus} label="Approval" />
          <FilterChips options={data?.categories ?? []} value={category} onChange={setCategory} label="Category" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load products.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.products?.length ? (
          <EmptyState icon="inventory_2" title="No products" />
        ) : (
          <TableShell>
            <thead><tr><Th>Product</Th><Th>Vendor</Th><Th>Category</Th><Th>Price</Th><Th>Approval</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.products.map((p: any) => (
                <tr key={p.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <div className="flex items-center gap-3">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
                      <div>
                        <p className="font-semibold text-on-surface dark:text-inverse-on-surface">{p.name}</p>
                        <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.sku ?? '—'}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>{p.vendorName}</Td>
                  <Td>{p.category}</Td>
                  <Td>{money(p.price)} / {p.unit}</Td>
                  <Td><StatusPill status={p.approvalStatus} /></Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {p.approvalStatus !== 'APPROVED' && <button disabled={busy === p.id + 'approve'} onClick={() => act(p.id, 'approve')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Approve</button>}
                      {p.approvalStatus === 'APPROVED' && <button disabled={busy === p.id + 'suspend'} onClick={() => act(p.id, 'suspend')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Suspend</button>}
                      {p.approvalStatus !== 'REJECTED' && <button disabled={busy === p.id + 'reject'} onClick={() => act(p.id, 'reject')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Reject</button>}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
