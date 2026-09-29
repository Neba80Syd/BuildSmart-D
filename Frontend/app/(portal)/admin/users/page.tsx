'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, toneFor } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, SearchBox, FilterChips, Confirm, timeAgo, fmtDate } from '@/Frontend/components/admin/shared';

const roleTone: Record<string, string> = { ADMIN: 'purple', ARCHITECT: 'blue', VENDOR: 'green', CLIENT: 'gray' };

export default function AdminUsersPage() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (role) p.set('role', role);
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    return p.toString();
  }, [q, role, status]);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/users${query ? `?${query}` : ''}`);

  const act = async (id: string, action: string) => {
    setBusy(id + action);
    try {
      await api('PATCH', '/api/admin/users', { id, action });
      toast.success(`User ${action.replace('_', ' ')}`);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Users" subtitle="Manage platform accounts, roles and account status" crumbs={['Admin', 'User Management', 'Users']} />

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="w-full md:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search name, email or role…" /></div>
          <FilterChips options={data?.roles ?? ['ADMIN', 'ARCHITECT', 'VENDOR', 'CLIENT']} value={role} onChange={setRole} label="Role" />
          <FilterChips options={data?.statuses ?? ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']} value={status} onChange={setStatus} label="Status" />
        </div>
      </Card>

      <Card pad={false}>
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load users.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={6} /></tbody></TableShell>
        ) : !data?.users?.length ? (
          <EmptyState icon="group" title="No users match" body="Try adjusting the search or filters." />
        ) : (
          <>
            <TableShell>
              <thead><tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th>Verification</Th><Th>Projects</Th><Th>Last active</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {data.users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                    <Td>
                      <div>
                        <p className="font-semibold text-on-surface dark:text-inverse-on-surface">{u.name}</p>
                        <p className="text-on-surface-variant dark:text-surface-variant text-body-sm">{u.email}</p>
                      </div>
                    </Td>
                    <Td><StatusPill status={u.role} tone={roleTone[u.role] ?? 'gray'} /></Td>
                    <Td><StatusPill status={u.status} /></Td>
                    <Td>{u.verification ? <StatusPill status={u.verification} /> : <span className="text-on-surface-variant dark:text-surface-variant">—</span>}</Td>
                    <Td>{u.projectCount}</Td>
                    <Td>{u.lastActiveAt ? timeAgo(u.lastActiveAt) : '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {u.role !== 'ADMIN' && u.status === 'ACTIVE' && (
                          <button disabled={busy === u.id + 'suspend'} onClick={() => act(u.id, 'suspend')} className="text-label-md text-error dark:text-red-300 hover:underline disabled:opacity-50">Suspend</button>
                        )}
                        {u.role !== 'ADMIN' && u.status !== 'ACTIVE' && (
                          <button disabled={busy === u.id + 'restore'} onClick={() => act(u.id, 'restore')} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline disabled:opacity-50">Restore</button>
                        )}
                        <button disabled={busy === u.id + 'revoke_sessions'} onClick={() => act(u.id, 'revoke_sessions')} className="text-label-md text-on-surface-variant dark:text-surface-variant hover:underline disabled:opacity-50">Revoke sessions</button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="px-4 py-3 flex items-center justify-between text-label-md text-on-surface-variant dark:text-surface-variant">
              <span>{data.total} users</span>
              <span>Page {data.page} of {data.pages}</span>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
