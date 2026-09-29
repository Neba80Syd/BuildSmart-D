'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, inputClass, btnPrimary, Skeleton, ConfirmButton, StatusPill } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const CATEGORIES = ['Floor Plan', 'Drawing', '3D File', 'BOQ', 'Report', 'Contract', 'Invoice', 'Certificate', 'License', 'Identity', 'Brief', 'Structural', 'Survey', 'Other'];

export default function ArchitectDocumentsPage() {
  const { data, loading, refetch } = useApi<{ documents: any[] }>('/api/architect/documents');
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [cat, setCat] = useState('ALL');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [upForm, setUpForm] = useState<{ category: string; projectId: string }>({ category: 'Floor Plan', projectId: '' });

  const docs = data?.documents ?? [];
  const filtered = cat === 'ALL' ? docs : docs.filter((d) => d.category === cat);
  const cats = ['ALL', ...Array.from(new Set(docs.map((d) => d.category)))];

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', upForm.category);
      if (upForm.projectId) form.append('projectId', upForm.projectId);
      const res = await fetch('/api/architect/documents', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? 'Upload failed');
      toast.success('Document uploaded');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const del = async (id: string) => {
    try { await api('DELETE', `/api/architect/documents?id=${id}`); toast.success('Document deleted'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };

  const download = (id: string) => {
    window.open(`/api/documents/${id}`, '_blank');
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Documents" subtitle="Centralize project and professional documents." crumbs={['Architect', 'Professional', 'Documents']} actions={
        <button className={btnPrimary} onClick={() => fileRef.current?.click()}>
          <span className="material-symbols-outlined text-[18px]">upload</span>Upload Document
        </button>
      } />

      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ''; }} />

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex gap-1 overflow-x-auto flex-1 pb-1">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-full text-label-md whitespace-nowrap border ${cat === c ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{c}</button>
          ))}
        </div>
        <select className={inputClass + ' w-44'} value={upForm.category} onChange={(e) => setUpForm((f) => ({ ...f, category: e.target.value }))}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={inputClass + ' w-56'} value={upForm.projectId} onChange={(e) => setUpForm((f) => ({ ...f, projectId: e.target.value }))}>
          <option value="">No project</option>
          {(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="folder" title="No documents" body="Upload your first document." />
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <Card key={d.id} pad={false} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant p-4 text-[26px]">{iconFor(d.type)}</span>
              <div className="flex-1 min-w-0 py-3">
                <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">{d.name}</p>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{d.category} · V{d.version} · {(d.size / 1024).toFixed(0)} KB · {new Date(d.createdAt).toLocaleDateString()}</p>
              </div>
              <StatusPill status={d.category} />
              <div className="flex items-center gap-1 pr-3">
                <button className="p-2 rounded-lg hover:bg-surface-container-high dark:hover:bg-surface-variant" title="Download" onClick={() => download(d.id)}><span className="material-symbols-outlined text-on-surface-variant dark:text-surface-variant">download</span></button>
                <ConfirmButton icon="delete" label="" onConfirm={() => del(d.id)} />
              </div>
            </Card>
          ))}
        </div>
      )}
      {uploading && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mt-3 flex items-center gap-2"><span className="material-symbols-outlined animate-spin">progress_activity</span>Uploading…</p>}
    </div>
  );
}

function iconFor(type: string) {
  if (type.includes('pdf')) return 'picture_as_pdf';
  if (type.includes('image')) return 'image';
  if (type.includes('dwg')) return 'architecture';
  if (type.includes('zip')) return 'folder_zip';
  if (type.includes('xlsx') || type.includes('csv')) return 'table';
  return 'description';
}
