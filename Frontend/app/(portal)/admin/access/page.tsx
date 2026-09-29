'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, Confirm } from '@/Frontend/components/admin/shared';

export default function AdminAccessPage() {
  const { data, loading, error, refetch } = useApi<any>('/api/admin/access');
  const [editor, setEditor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const openEditor = (role?: any) => {
    const perms: Record<string, boolean> = {};
    (data?.permissionCatalog ?? []).forEach((p: string) => (perms[p] = (role?.permissions ?? []).includes(p)));
    setSelected(perms);
    setEditor(role ? { ...role, isNew: false } : { name: '', description: '', isNew: true });
  };

  const toggle = (p: string) => setSelected((s) => ({ ...s, [p]: !s[p] }));

  const save = async () => {
    setBusy(true);
    try {
      const perms = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      const payload = { name: editor.name, description: editor.description, permissions: perms };
      if (editor.isNew) await api('POST', '/api/admin/access', payload);
      else await api('PATCH', '/api/admin/access', { id: editor.id, ...payload });
      toast.success('Role saved');
      setEditor(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/access?id=${id}`);
      toast.success('Role deleted');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Access Control"
        subtitle="Roles & permission sets (RBAC)"
        crumbs={['Admin', 'Security', 'Access Control']}
        actions={
          <button className={btnPrimary} onClick={() => openEditor()}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            New role
          </button>
        }
      />

      <Card pad={false} className="mb-6">
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load roles.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={4} /></tbody></TableShell>
        ) : !data?.roles?.length ? (
          <EmptyState icon="admin_panel_settings" title="No roles" />
        ) : (
          <TableShell>
            <thead><tr><Th>Role</Th><Th>Description</Th><Th>Permissions</Th><Th>Type</Th><Th /></tr></thead>
            <tbody>
              {data.roles.map((r: any) => (
                <tr key={r.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td className="font-mono font-semibold text-on-surface dark:text-inverse-on-surface">{r.name}</Td>
                  <Td className="max-w-xs text-on-surface-variant dark:text-surface-variant">{r.description}</Td>
                  <Td>
                    <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{(r.permissions ?? []).length} granted</span>
                  </Td>
                  <Td>{r.isSystem ? <StatusPill status="System" tone="purple" /> : <StatusPill status="Custom" tone="gray" />}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => openEditor(r)} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Edit</button>
                      {!r.isSystem && <Confirm label="Delete" confirmLabel="Confirm?" onConfirm={() => remove(r.id)} />}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Card>
        <h2 className="text-headline-sm font-semibold text-on-surface dark:text-inverse-on-surface mb-2">Administrators</h2>
        <div className="divide-y divide-outline-variant dark:divide-outline">
          {(data?.admins ?? []).map((a: any) => (
            <div key={a.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-on-surface dark:text-inverse-on-surface">{a.name}</p>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{a.email}</p>
              </div>
              <StatusPill status={a.adminRole} tone="purple" />
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor?.isNew ? 'New role' : `Edit ${editor?.name ?? ''}`} wide>
        {editor && (
          <div className="space-y-4">
            <Field label="Role name" hint="UPPERCASE_UNDERSCORE">
              <input className={inputClass} value={editor.name} disabled={!editor.isNew} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </Field>
            <Field label="Description">
              <input className={inputClass} value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} />
            </Field>
            <div>
              <p className="text-label-md text-on-surface dark:text-inverse-on-surface mb-2">Permissions</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto p-2 border border-outline-variant dark:border-outline rounded-lg">
                {(data?.permissionCatalog ?? []).map((p: string) => (
                  <label key={p} className="flex items-center gap-2 text-body-sm p-1.5 rounded hover:bg-surface-container-low dark:hover:bg-surface-variant cursor-pointer">
                    <input type="checkbox" checked={!!selected[p]} onChange={() => toggle(p)} className="accent-[#2F6B50]" />
                    <span className="font-mono">{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button className={btnPrimary} disabled={busy || !editor.name} onClick={save}>Save role</button>
              <button className={btnGhost} onClick={() => setEditor(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
