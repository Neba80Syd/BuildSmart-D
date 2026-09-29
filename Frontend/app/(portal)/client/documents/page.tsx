'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, EmptyState, StatusPill, Skeleton, inputClass, btnPrimary, btnGhost, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

export default function ClientDocumentsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/documents');
  const [project, setProject] = useState('');
  const [cat, setCat] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, category: string, projectId: string) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('category', category); if (projectId) fd.append('projectId', projectId);
      await api('POST', '/api/client/documents', fd);
      toast.success('Document uploaded'); refetch();
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const download = async (d: any) => {
    const res = await fetch(`/api/documents/${d.id}`);
    if (!res.ok) return toast.error('Could not download');
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.name; a.click(); URL.revokeObjectURL(a.href);
  };

  const remove = async (id: string) => {
    try { await api('DELETE', `/api/client/documents?id=${id}`); toast.success('Document deleted'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  const docs = (data?.documents ?? []).filter((d: any) => (project ? d.projectId === project : true)).filter((d: any) => (cat ? d.category === cat : true));

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1100px] mx-auto">
      <PageHeader title="Documents" subtitle="Secure access to documents shared with your projects." crumbs={['Client', 'Account', 'Documents']}
        actions={<><input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, 'Project', project); e.target.value = ''; }} /><button className={btnPrimary} onClick={() => fileRef.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload Document'}</button></>} />

      <div className="flex gap-3 mb-4 flex-wrap">
        <select className={inputClass} value={project} onChange={(e) => setProject(e.target.value)}>{<option value="">All projects</option>}{(data?.projects ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className={inputClass} value={cat} onChange={(e) => setCat(e.target.value)}>{<option value="">All categories</option>}{(data?.categories ?? []).map((c: any) => <option key={c}>{c}</option>)}</select>
      </div>

      {docs.length === 0 ? (
        <EmptyState icon="folder" title="No documents" body="Upload a document or ask your architect to share files with this project." />
      ) : (
        <div className="space-y-2">
          {docs.map((d: any) => (
            <Card key={d.id} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[24px] text-primary dark:text-primary-fixed-dim">description</span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold text-on-surface dark:text-inverse-on-surface truncate">{d.name}</p>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{d.category} · {d.projectName || 'General'} · {d.ownerName}{d.mine ? ' (you)' : ''}</p>
              </div>
              <span className="text-label-md text-on-surface-variant dark:text-surface-variant">{(d.size / 1024).toFixed(0)} KB</span>
              <button className={btnGhost} onClick={() => download(d)}><span className="material-symbols-outlined text-[18px]">download</span></button>
              {d.mine && <ConfirmButton label="" confirmLabel="Delete?" icon="delete" onConfirm={() => remove(d.id)} className={btnGhost} />}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
