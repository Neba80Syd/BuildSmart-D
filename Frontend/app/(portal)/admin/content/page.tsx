'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, Tabs, btnPrimary, btnGhost } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';
import { TableShell, Th, Td, SkeletonRows, Confirm, timeAgo } from '@/Frontend/components/admin/shared';

type Kind = 'blog' | 'faq' | 'announcement';

export default function AdminContentPage() {
  const [kind, setKind] = useState<Kind>('blog');
  const [editor, setEditor] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, refetch } = useApi<any>(`/api/admin/content?kind=${kind}`);

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await api('DELETE', `/api/admin/content?kind=${kind}&id=${id}`);
      toast.success('Deleted');
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const save = async (payload: any) => {
    setBusy(true);
    try {
      if (payload.id) await api('PATCH', '/api/admin/content', { ...payload, kind });
      else await api('POST', '/api/admin/content', { ...payload, kind });
      toast.success('Saved');
      setEditor(null);
      refetch();
    } catch (e: any) {
      toast.error(e.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Content"
        subtitle="Manage blog posts, FAQs and announcements"
        crumbs={['Admin', 'Content']}
        actions={
          <button className={btnPrimary} onClick={() => setEditor({ kind })}>
            <span className="material-symbols-outlined text-[18px]">add</span>
            New {kind}
          </button>
        }
      />

      <Tabs
        tabs={[
          { key: 'blog', label: 'Blog', icon: 'article' },
          { key: 'faq', label: 'FAQs', icon: 'quiz' },
          { key: 'announcement', label: 'Announcements', icon: 'campaign' },
        ]}
        active={kind}
        onChange={(k) => setKind(k as Kind)}
      />

      <Card pad={false} className="mt-4">
        {error && <p className="p-6 text-error dark:text-red-300">Failed to load content.</p>}
        {loading ? (
          <TableShell><tbody><SkeletonRows cols={4} /></tbody></TableShell>
        ) : !data?.items?.length ? (
          <EmptyState icon="article" title={`No ${kind}s yet`} body="Create your first item." />
        ) : (
          <TableShell>
            <thead>
              {kind === 'blog' && <tr><Th>Title</Th><Th>Slug</Th><Th>Category</Th><Th>Status</Th><Th>Updated</Th><Th /></tr>}
              {kind === 'faq' && <tr><Th>Question</Th><Th>Category</Th><Th>Position</Th><Th>Status</Th><Th /></tr>}
              {kind === 'announcement' && <tr><Th>Title</Th><Th>Audience</Th><Th>Status</Th><Th>Created</Th><Th /></tr>}
            </thead>
            <tbody>
              {data.items.map((i: any) => (
                <tr key={i.id} className="hover:bg-surface-container-low dark:hover:bg-surface-variant transition-colors">
                  <Td>
                    <button onClick={() => setEditor({ ...i, kind })} className="font-semibold text-on-surface dark:text-inverse-on-surface hover:text-primary dark:hover:text-primary-fixed-dim text-left">
                      {i.title ?? i.question}
                    </button>
                  </Td>
                  {kind === 'blog' && <Td className="font-mono">{i.slug}</Td>}
                  {kind !== 'announcement' && <Td>{i.category}</Td>}
                  {kind === 'faq' && <Td>{i.position}</Td>}
                  {kind === 'announcement' && <Td>{i.audience}</Td>}
                  <Td><StatusPill status={i.status} /></Td>
                  <Td>{kind === 'faq' ? '' : timeAgo(i.createdAt)}</Td>
                  <Td><div className="flex gap-2"><button onClick={() => setEditor({ ...i, kind })} className="text-label-md text-primary dark:text-primary-fixed-dim hover:underline">Edit</button><Confirm label="Delete" confirmLabel="Confirm?" onConfirm={() => remove(i.id)} /></div></Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <ContentEditor item={editor} onClose={() => setEditor(null)} onSave={save} busy={busy} />
    </div>
  );
}

function ContentEditor({ item, onClose, onSave, busy }: { item: any; onClose: () => void; onSave: (p: any) => void; busy: boolean }) {
  const [form, setForm] = useState<Record<string, any>>({});
  useEffect(() => {
    setForm(item ?? { kind: 'blog', status: 'DRAFT', audience: 'ALL', position: 0, category: 'General' });
  }, [item]);

  if (!item) return null;
  const kind: Kind = item.kind;
  const f = (k: string) => form[k] ?? '';
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Modal open onClose={onClose} title={`${item.id ? 'Edit' : 'New'} ${kind}`} wide>
      <div className="space-y-4">
        {kind === 'blog' && (
          <>
            <Field label="Title"><input className={inputClass} value={f('title')} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Slug" hint="lowercase-with-dashes"><input className={inputClass} value={f('slug')} onChange={(e) => set('slug', e.target.value)} /></Field>
            <Field label="Category"><input className={inputClass} value={f('category')} onChange={(e) => set('category', e.target.value)} /></Field>
            <Field label="Excerpt"><input className={inputClass} value={f('excerpt')} onChange={(e) => set('excerpt', e.target.value)} /></Field>
            <Field label="Content"><textarea className={inputClass} rows={6} value={f('content')} onChange={(e) => set('content', e.target.value)} /></Field>
            <Field label="Status">
              <select className={inputClass} value={f('status')} onChange={(e) => set('status', e.target.value)}>
                {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </>
        )}
        {kind === 'faq' && (
          <>
            <Field label="Question"><input className={inputClass} value={f('question')} onChange={(e) => set('question', e.target.value)} /></Field>
            <Field label="Answer"><textarea className={inputClass} rows={5} value={f('answer')} onChange={(e) => set('answer', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category"><input className={inputClass} value={f('category')} onChange={(e) => set('category', e.target.value)} /></Field>
              <Field label="Position"><input className={inputClass} type="number" value={f('position')} onChange={(e) => set('position', Number(e.target.value))} /></Field>
            </div>
            <Field label="Status">
              <select className={inputClass} value={f('status')} onChange={(e) => set('status', e.target.value)}>
                {['ACTIVE', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </>
        )}
        {kind === 'announcement' && (
          <>
            <Field label="Title"><input className={inputClass} value={f('title')} onChange={(e) => set('title', e.target.value)} /></Field>
            <Field label="Body"><textarea className={inputClass} rows={5} value={f('body')} onChange={(e) => set('body', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Audience">
                <select className={inputClass} value={f('audience')} onChange={(e) => set('audience', e.target.value)}>
                  {['ALL', 'CLIENTS', 'ARCHITECTS', 'VENDORS'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputClass} value={f('status')} onChange={(e) => set('status', e.target.value)}>
                  {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}
        <div className="flex gap-2 pt-2">
          <button className={btnPrimary} disabled={busy} onClick={() => onSave({ ...form, kind })}>Save</button>
          <button className={btnGhost} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
