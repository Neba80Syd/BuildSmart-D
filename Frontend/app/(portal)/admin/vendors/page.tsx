'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox } from '@/Frontend/components/admin/shared';

export default function AdminVendorsPage() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => (q ? `?q=${encodeURIComponent(q)}` : ''), [q]);
  const { data, loading, error, refetch } = useApi<any>(`/api/admin/vendors${query}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/vendors', { id, action });
      toast.success(`Vendor ${action}ed`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Vendors" subtitle="Manage marketplace sellers and their verification" crumbs={['Admin', 'Marketplace', 'Vendors']} />

      <Card className="mb-6">
        <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search vendors…" /></div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load vendors.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={7} /></tbody></TableShell>
        ) : !data?.vendors?.length ? (
          <EmptyState icon="storefront" title="No vendors" />
        ) : (
          <TableShell>
            <thead><tr><Th>Vendor</Th><Th>Status</Th><Th>Verification</Th><Th>Products</Th><Th>Rating</Th><Th>Complaints</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {data.vendors.map((v: any) => (
                <tr key={v.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <p className="font-semibold text-on-surface dark:text-inverse-on-surface">{v.name}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{v.email}</p>
                  </Td>
                  <Td><StatusPill status={v.status} /></Td>
                  <Td><StatusPill status={v.verificationStatus} /></Td>
                  <Td>{v.productCount} <span className="text-on-surface-variant dark:text-surface-variant">({v.activeListings} active)</span></Td>
                  <Td>★ {v.rating?.toFixed?.(1) ?? '0.0'} <span className="text-on-surface-variant dark:text-surface-variant">({v.reviewCount})</span></Td>
                  <Td>{v.complaints}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {v.status === 'ACTIVE' ? (
                        <button disabled={busy === v.id + 'suspend'} onClick={() => act(v.id, 'suspend')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Suspend</button>
                      ) : (
                        <button disabled={busy === v.id + 'restore'} onClick={() => act(v.id, 'restore')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Restore</button>
                      )}
                      {v.verificationStatus !== 'FULLY_VERIFIED' && <button disabled={busy === v.id + 'verify'} onClick={() => act(v.id, 'verify')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Verify</button>}
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
