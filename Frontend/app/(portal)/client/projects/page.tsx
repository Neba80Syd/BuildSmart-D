'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n || 0).toLocaleString();

const TABS = ['Overview', 'Requirements', 'Architect', 'Designs', '2D Plans', '3D Models', '3D Feedback', 'Materials', 'BOQ', 'Documents', 'Messages', 'Appointments', 'Activity'];

export default function ClientProjectsPage() {
  const { data, loading, refetch } = useApi<{ projects: any[] }>('/api/client/projects');
  const [detail, setDetail] = useState<any | null>(null);
  const [tab, setTab] = useState('Overview');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div></div>;

  const projects = data?.projects ?? [];

  const openDetail = async (id: string) => {
    const res = await fetch(`/api/client/projects?id=${id}`);
    if (res.ok) { setDetail(await res.json()); setTab('Overview'); }
  };

  const edit = (p: any) => { setForm({ id: p.id, name: p.name, description: p.description ?? '', location: p.location ?? '', budget: p.budget ?? 0 }); setEditing(true); };

  const saveEdit = async () => {
    try {
      await api('PATCH', '/api/client/projects', { id: form.id, name: form.name, description: form.description, location: form.location, budget: Number(form.budget || 0) });
      toast.success('Project updated'); setEditing(false); refetch(); if (detail) openDetail(form.id);
    } catch (e: any) { toast.error(e.message); }
  };

  const archive = async (p: any, restore = false) => {
    try { await api('PATCH', '/api/client/projects', { id: p.id, action: restore ? 'restore' : 'archive' }); toast.success(restore ? 'Project restored' : 'Project archived'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const remove = async (p: any) => {
    try { await api('DELETE', `/api/client/projects?id=${p.id}`); toast.success('Project deleted'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="My Projects" subtitle="Monitor every architectural project associated with your account." crumbs={['Client', 'My Projects', 'Projects']}
        actions={<Link href="/client/requests" className={btnPrimary}>Request New Design</Link>} />

      {projects.length === 0 ? (
        <EmptyState icon="architecture" title="You don't have any projects yet" body="Start your first architectural project." actionLabel="Request a Design" onAction={() => (window.location.href = '/client/requests')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{p.name}</h3>
                <StatusPill status={p.status} />
              </div>
              <p className="text-label-md text-on-surface-variant dark:text-surface-variant mb-3">{p.projectType} · {p.location}</p>
              <div className="grid grid-cols-2 gap-2 text-body-sm mb-4">
                <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Architect</p><p className="text-on-surface dark:text-inverse-on-surface">{p.architectName}</p></div>
                <div><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Budget</p><p className="text-on-surface dark:text-inverse-on-surface">{fmt(p.budget)} XAF</p></div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-label-md mb-1"><span className="text-on-surface-variant dark:text-surface-variant">Progress</span><span className="text-on-surface dark:text-inverse-on-surface">{p.progress}%</span></div>
                <div className="h-2 bg-surface-container-high dark:bg-surface-variant rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} /></div>
              </div>
              <div className="mt-auto flex items-center gap-2">
                <button className={btnPrimary + ' flex-1'} onClick={() => openDetail(p.id)}>View Project</button>
                <button className={btnGhost} onClick={() => edit(p)} title="Edit"><span className="material-symbols-outlined text-[18px]">edit</span></button>
                <ConfirmButton label="" confirmLabel="Archive?" icon="archive" onConfirm={() => archive(p, p.archived)} className={btnGhost} />
                {['DRAFT', 'ARCHIVED'].includes(p.status) && <ConfirmButton label="" confirmLabel="Delete?" icon="delete" onConfirm={() => remove(p)} className={btnGhost} />}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.project?.name ?? ''} wide>
        {detail && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <StatusPill status={detail.project.status} />
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant">Architect: {detail.project.architectName} · Budget {fmt(detail.project.budget)} XAF · Progress {detail.project.progress}%</span>
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {TABS.map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-full text-label-md ${tab === t ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>{t}</button>
              ))}
            </div>

            {tab === 'Overview' && (
              <div className="space-y-3 text-body-sm text-on-surface dark:text-inverse-on-surface">
                <p>{detail.project.description || 'No description provided.'}</p>
                <p><span className="font-semibold">Location:</span> {detail.project.location}</p>
                <p><span className="font-semibold">Style:</span> {detail.project.style ?? '—'}</p>
                <p><span className="font-semibold">Floors / Rooms:</span> {detail.project.floors ?? '—'} / {detail.project.rooms ?? '—'}</p>
                <p><span className="font-semibold">Site area:</span> {detail.project.siteArea ?? '—'} m²</p>
                <p><span className="font-semibold">Last update:</span> {new Date(detail.project.updatedAt).toLocaleString()}</p>
              </div>
            )}
            {tab === 'Requirements' && (
              <ul className="list-disc list-inside space-y-1 text-body-sm text-on-surface dark:text-inverse-on-surface">
                {(detail.project.requirements ?? []).map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {tab === 'Architect' && (
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-xl">{detail.project.architectName.slice(0, 2)}</div>
                <div>
                  <p className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{detail.project.architectName}</p>
                  <Link href="/client/architect" className="text-label-md text-primary dark:text-primary-fixed-dim">View architect profile</Link>
                </div>
              </div>
            )}
            {tab === 'Designs' && <SimpleList items={(detail.designs ?? []).map((d: any) => ({ title: `${d.name} (V${d.version})`, meta: d.status, href: `/client/designs` }))} empty="No designs yet." />}
            {tab === '2D Plans' && <SimpleList items={(detail.plans ?? []).filter((p: any) => p.kind !== '3D' && p.status === 'PUBLISHED').map((p: any) => ({ title: p.name, meta: p.status }))} empty="No published 2D plans yet." />}
            {tab === '3D Models' && (
              <div className="space-y-2">
                {(detail.plans ?? []).filter((p: any) => p.kind === '3D').length === 0 && <EmptyState icon="view_in_ar" title="No 3D floorplans yet" body="You will be notified when the architect publishes one." />}
                {(detail.plans ?? []).filter((p: any) => p.kind === '3D').map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{p.name} (V{p.version})</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.status} · {p.reviewStatus}</p></div>
                    {p.status === 'PUBLISHED' && <Link href={`/client/3d?project=${p.projectId}&plan=${p.id}`} className={btnPrimary}>Open</Link>}
                  </div>
                ))}
              </div>
            )}
            {tab === '3D Feedback' && <SimpleList items={(detail.feedback ?? []).map((f: any) => ({ title: `${f.category} — ${f.description.slice(0, 60)}`, meta: f.status }))} empty="No feedback submitted yet." />}
            {tab === 'Materials' && <SimpleList items={(detail.boqs ?? []).flatMap((b: any) => (b.items ?? []).map((i: any) => ({ title: `${i.material} × ${i.quantity} ${i.unit}`, meta: `${fmt(i.total)} XAF` })))} empty="No materials yet." />}
            {tab === 'BOQ' && (
              <div className="space-y-2">
                {(detail.boqs ?? []).length === 0 && <EmptyState icon="request_quote" title="No BOQs yet" />}
                {(detail.boqs ?? []).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                    <div><p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{b.name} (V{b.version})</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">{b.items.length} line items</p></div>
                    <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface">{fmt(b.total)} XAF</p>
                  </div>
                ))}
              </div>
            )}
            {tab === 'Documents' && <SimpleList items={(detail.documents ?? []).map((d: any) => ({ title: d.name, meta: `${d.ownerName} · ${d.category}` }))} empty="No documents shared yet." />}
            {tab === 'Messages' && (
              <div className="space-y-2">
                {(detail.chatRooms ?? []).length === 0 && <EmptyState icon="forum" title="No conversation yet" />}
                {(detail.chatRooms ?? []).map((r: any) => <Link key={r.id} href="/client/messages" className="block p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant text-body-sm text-on-surface dark:text-inverse-on-surface">{r.name}</Link>)}
              </div>
            )}
            {tab === 'Appointments' && <SimpleList items={(detail.appointments ?? []).map((a: any) => ({ title: a.title, meta: `${a.date} ${a.startTime} · ${a.status}` }))} empty="No appointments for this project." />}
            {tab === 'Activity' && <SimpleList items={(detail.activities ?? []).map((a: any) => ({ title: a.title, meta: new Date(a.createdAt).toLocaleString() }))} empty="No activity yet." />}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit Project">
        <div className="space-y-4">
          <Field label="Project name"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <Field label="Budget (XAF)"><input className={inputClass} type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <button className={btnPrimary} onClick={saveEdit}>Save Changes</button>
        </div>
      </Modal>
    </div>
  );
}

function SimpleList({ items, empty }: { items: { title: string; meta?: string; href?: string }[]; empty: string }) {
  if (items.length === 0) return <EmptyState icon="inbox" title={empty} />;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
          <span className="text-body-sm text-on-surface dark:text-inverse-on-surface">{it.title}</span>
          {it.meta && <StatusPill status={it.meta} />}
        </div>
      ))}
    </div>
  );
}
