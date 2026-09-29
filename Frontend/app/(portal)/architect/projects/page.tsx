'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, iconBtn, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const STATUSES = ['DRAFT', 'REQUIREMENTS', 'DESIGNING', 'AI_GENERATED', 'ARCHITECT_REVIEW', 'CLIENT_REVIEW', 'REVISION', 'APPROVED', 'CONSTRUCTION_PLANNING', 'COMPLETED', 'ARCHIVED'];
const TYPES = ['Residential', 'Commercial', 'Office', 'Apartment', 'Villa', 'Duplex', 'Bungalow', 'Hotel', 'School', 'Industrial', 'Institutional', 'Custom'];

const fmt = (n: number) => Math.round(n).toLocaleString();
const IMG: Record<string, string> = {
  Villa: '/images/project-villa.png', Office: '/images/project-eco-office.png', Institutional: '/images/hero-interior.png',
  Bungalow: '/images/hero-villa.png', Duplex: '/images/project-villa.png', default: '/images/project-floorplan.png',
};

export default function ArchitectProjectsPage() {
  const { data, loading, refetch } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<null | { mode: 'create' | 'edit'; project?: any }>(null);

  const projects = (data?.projects ?? []).filter((p) => showArchived || !p.archived);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      name: fd.get('name'),
      projectType: fd.get('projectType'),
      clientId: fd.get('clientId'),
      description: fd.get('description'),
      location: fd.get('location'),
      siteArea: Number(fd.get('siteArea') || 0),
      floors: Number(fd.get('floors') || 1),
      rooms: Number(fd.get('rooms') || 1),
      style: fd.get('style'),
      budget: Number(fd.get('budget') || 0),
      deadline: fd.get('deadline') || null,
      requirements: (String(fd.get('requirements') || '')).split('\n').map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (modal?.mode === 'create') await api('POST', '/api/architect/projects', body);
      else await api('PATCH', '/api/architect/projects', { id: modal!.project!.id, ...body });
      toast.success(modal?.mode === 'create' ? 'Project created' : 'Project updated');
      setModal(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const act = async (project: any, action: string, status?: string) => {
    try {
      await api('PATCH', '/api/architect/projects', { id: project.id, action, ...(status ? { status } : {}) });
      toast.success(`Project ${action === 'archive' ? 'archived' : action === 'restore' ? 'restored' : 'updated'}`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const del = async (project: any) => {
    try {
      await api('DELETE', `/api/architect/projects?id=${project.id}`);
      toast.success('Project deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader
        title="Projects"
        subtitle="Manage your architectural projects through their full lifecycle."
        crumbs={['Architect', 'Workspace', 'Projects']}
        actions={
          <>
            <button className={btnGhost} onClick={() => setShowArchived((v) => !v)}>
              <span className="material-symbols-outlined text-[18px]">{showArchived ? 'unarchive' : 'archive'}</span>
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
            <button className={btnPrimary} onClick={() => setModal({ mode: 'create' })}>
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Project
            </button>
          </>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56" />)}</div>
      ) : projects.length === 0 ? (
        <EmptyState icon="architecture" title="No projects yet" body="Create your first architectural project." actionLabel="Create Project" onAction={() => setModal({ mode: 'create' })} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} className="flex flex-col" pad={false}>
              <div className="relative aspect-video bg-surface-container-low dark:bg-surface-variant overflow-hidden">
                <img src={IMG[p.projectType] ?? IMG.default} alt={p.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2"><StatusPill status={p.status} /></div>
                {p.archived && <span className="absolute top-2 right-2 material-symbols-outlined text-white bg-black/40 rounded-full p-1">archive</span>}
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div>
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{p.name}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{p.projectType ?? 'Project'} · {p.location ?? 'No location'} · {p.clientName}</p>
                </div>
                <div className="text-label-md grid grid-cols-3 gap-2">
                  <span className="text-on-surface-variant dark:text-surface-variant">Floors</span><span className="col-span-2 font-semibold text-on-surface dark:text-inverse-on-surface">{p.floors ?? '—'}</span>
                  <span className="text-on-surface-variant dark:text-surface-variant">Rooms</span><span className="col-span-2 font-semibold text-on-surface dark:text-inverse-on-surface">{p.rooms ?? '—'}</span>
                  <span className="text-on-surface-variant dark:text-surface-variant">Budget</span><span className="col-span-2 font-semibold text-on-surface dark:text-inverse-on-surface">{p.budget ? `${fmt(p.budget)} XAF` : 'TBD'}</span>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between text-label-md mb-1">
                    <span className="text-on-surface-variant dark:text-surface-variant">Progress</span>
                    <span className="text-on-surface dark:text-inverse-on-surface">{p.progress ?? 0}%</span>
                  </div>
                  <div className="w-full bg-surface-variant dark:bg-surface-container-high rounded-full h-1.5 overflow-hidden">
                    <div className="bg-primary dark:bg-primary-fixed-dim h-1.5 rounded-full" style={{ width: `${p.progress ?? 0}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant dark:border-outline pt-3">
                  <select className={inputClass + ' w-auto'} value={p.status} onChange={(e) => act(p, 'status', e.target.value)} aria-label="Change status">
                    {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                  <Link href={`/architect/floor-plan-studio?project=${p.id}`} className={iconBtn} title="Open Floor Plan Studio">
                    <span className="material-symbols-outlined text-primary">magic_button</span>
                  </Link>
                  <button className={iconBtn} title="Edit" onClick={() => setModal({ mode: 'edit', project: p })}><span className="material-symbols-outlined">edit</span></button>
                  <button className={iconBtn} title="Duplicate" onClick={() => act(p, 'duplicate')}><span className="material-symbols-outlined">content_copy</span></button>
                  {p.archived ? (
                    <button className={iconBtn} title="Restore" onClick={() => act(p, 'restore')}><span className="material-symbols-outlined">unarchive</span></button>
                  ) : (
                    <button className={iconBtn} title="Archive" onClick={() => act(p, 'archive')}><span className="material-symbols-outlined">archive</span></button>
                  )}
                  {['DRAFT', 'ARCHIVED'].includes(p.status) && <ConfirmButton icon="delete" label="" confirmLabel="Delete?" onConfirm={() => del(p)} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal open title={modal.mode === 'create' ? 'Create Project' : 'Edit Project'} onClose={() => setModal(null)} wide>
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Project Name"><input className={inputClass} name="name" required minLength={2} maxLength={120} defaultValue={modal.project?.name ?? ''} /></Field>
            </div>
            <Field label="Project Type">
              <select className={inputClass} name="projectType" defaultValue={modal.project?.projectType ?? 'Residential'}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Client ID">
              <input className={inputClass} name="clientId" placeholder="u_client" defaultValue={modal.project?.ownerId ?? 'u_client'} />
            </Field>
            <Field label="Location"><input className={inputClass} name="location" defaultValue={modal.project?.location ?? ''} /></Field>
            <Field label="Architectural Style"><input className={inputClass} name="style" defaultValue={modal.project?.style ?? ''} /></Field>
            <Field label="Site Area (m²)"><input className={inputClass} name="siteArea" type="number" min={0} defaultValue={modal.project?.siteArea ?? ''} /></Field>
            <Field label="Budget (XAF)"><input className={inputClass} name="budget" type="number" min={0} defaultValue={modal.project?.budget ?? ''} /></Field>
            <Field label="Floors"><input className={inputClass} name="floors" type="number" min={1} defaultValue={modal.project?.floors ?? 1} /></Field>
            <Field label="Rooms"><input className={inputClass} name="rooms" type="number" min={1} defaultValue={modal.project?.rooms ?? 1} /></Field>
            <Field label="Deadline"><input className={inputClass} name="deadline" type="date" defaultValue={modal.project?.deadline ? String(modal.project.deadline).slice(0, 10) : ''} /></Field>
            <div className="sm:col-span-2">
              <Field label="Description"><textarea className={inputClass} name="description" rows={2} defaultValue={modal.project?.description ?? ''} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Requirements (one per line)"><textarea className={inputClass} name="requirements" rows={3} defaultValue={(modal.project?.requirements ?? []).join('\n')} /></Field>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className={btnPrimary}>{modal.mode === 'create' ? 'Create Project' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
