'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, iconBtn, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const CATEGORIES = ['Residential', 'Commercial', 'Apartment', 'Duplex', 'Bungalow', 'Villa', 'Office', 'Hotel', 'Institutional', 'Custom'];
const THUMBS = ['/images/project-villa.png', '/images/project-eco-office.png', '/images/project-floorplan.png', '/images/hero-villa.png', '/images/hero-interior.png'];

export default function ArchitectDesignsPage() {
  const { data, loading, refetch } = useApi<{ designs: any[] }>('/api/architect/designs');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('ALL');
  const [modal, setModal] = useState(false);

  const designs = (data?.designs ?? []).filter((d) =>
    (cat === 'ALL' || d.category === cat) && (d.name ?? '').toLowerCase().includes(q.toLowerCase())
  );

  const act = async (d: any, action: string) => {
    try {
      await api('PATCH', '/api/architect/designs', { id: d.id, action });
      toast.success('Design updated');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const del = async (d: any) => {
    try {
      await api('DELETE', `/api/architect/designs?id=${d.id}`);
      toast.success('Design deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
      <PageHeader title="Design Library" subtitle="Centralized storage for your architectural designs." crumbs={['Architect', 'Workspace', 'Design Library']} actions={
        <button className={btnPrimary} onClick={() => setModal(true)}><span className="material-symbols-outlined text-[18px]">add</span>New Design</button>
      } />

      <div className="flex flex-wrap gap-1 mb-4">
        <button onClick={() => setCat('ALL')} className={`px-3 py-1.5 rounded-full text-label-md border ${cat === 'ALL' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline'}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-label-md border ${cat === c ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline'}`}>{c}</button>
        ))}
        <input className={inputClass + ' w-56 ml-auto'} placeholder="Search designs…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div>
      ) : designs.length === 0 ? (
        <EmptyState icon="collections_bookmark" title="No designs" body="Create a design or generate one with the AI Studio." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {designs.map((d) => (
            <Card key={d.id} pad={false} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-surface-container-low dark:bg-surface-variant">
                <img src={d.thumbnail || THUMBS[0]} alt={d.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2"><StatusPill status={d.status} /></div>
                {d.aiGenerated && <span className="absolute top-2 right-2 bg-black/50 text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">auto_awesome</span>AI</span>}
              </div>
              <div className="p-4 flex flex-col gap-2 flex-1">
                <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface leading-tight">{d.name}</h3>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{d.category} · V{d.version} · {d.projectName ?? 'No project'}</p>
                {(d.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(d.tags ?? []).slice(0, 3).map((t: string) => <span key={t} className="text-label-md px-2 py-0.5 rounded bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant">#{t}</span>)}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-auto border-t border-outline-variant dark:border-outline pt-2">
                  <button className={iconBtn} title="New version" onClick={() => act(d, 'newVersion')}><span className="material-symbols-outlined">versioning</span></button>
                  <button className={iconBtn} title="Duplicate" onClick={() => act(d, 'duplicate')}><span className="material-symbols-outlined">content_copy</span></button>
                  <button className={iconBtn} title="Share with client" onClick={() => act(d, 'share')}><span className="material-symbols-outlined">ios_share</span></button>
                  {d.status === 'ARCHIVED' ? (
                    <button className={iconBtn} title="Restore" onClick={() => act(d, 'restore')}><span className="material-symbols-outlined">unarchive</span></button>
                  ) : (
                    <button className={iconBtn} title="Archive" onClick={() => act(d, 'archive')}><span className="material-symbols-outlined">archive</span></button>
                  )}
                  <ConfirmButton icon="delete" label="" onConfirm={() => del(d)} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && <CreateDesignModal onClose={() => setModal(false)} onDone={() => { setModal(false); refetch(); }} />}
    </div>
  );
}

function CreateDesignModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api('POST', '/api/architect/designs', {
        name: fd.get('name'),
        category: fd.get('category'),
        type: fd.get('type'),
        projectId: fd.get('projectId') || null,
        thumbnail: THUMBS[Math.floor(Math.random() * THUMBS.length)],
        tags: String(fd.get('tags') || '').split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast.success('Design created');
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  return (
    <Modal open title="New Design" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Design name"><input className={inputClass} name="name" required minLength={2} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={inputClass} name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Type">
            <select className={inputClass} name="type">
              {['concept', 'floorplan', 'facade', 'section', '3d'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Project (optional)">
          <select className={inputClass} name="projectId" defaultValue="">
            <option value="">None</option>
            {(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Tags (comma-separated)"><input className={inputClass} name="tags" placeholder="villa, tropical" /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary}>Create</button>
        </div>
      </form>
    </Modal>
  );
}
