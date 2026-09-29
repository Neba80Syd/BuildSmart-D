'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type Doc = { id: string; name: string; type: string; size: number; category: string; version: number; createdAt: string };

const TYPE_ICONS: Record<string, string> = {
  'application/pdf': 'picture_as_pdf',
  'text/csv': 'table_chart',
  'application/x-dwg': 'architecture',
  'application/zip': 'folder_zip',
};

function fmtSize(bytes: number) {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  const load = async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocs(data.documents ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Choose a file first');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', categoryRef.current?.value ?? 'Project');
    const res = await fetch('/api/documents', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);
    if (res.ok) {
      toast.success('File uploaded');
      if (fileRef.current) fileRef.current.value = '';
      load();
    } else toast.error(data.error ?? 'Upload failed');
  };

  const remove = async (id: string) => {
    await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
    toast.success('File deleted');
    load();
  };

  const download = (id: string) => {
    const a = document.createElement('a');
    a.href = `/api/documents/${id}`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="max-w-4xl mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="mb-8">
        <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Documents</h1>
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Securely manage project files, drawings, and credentials.</p>
      </div>

      {/* Upload */}
      <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation mb-8">
        <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Upload File</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input ref={fileRef} type="file" className="input flex-1" />
          <select ref={categoryRef} className="input w-44">
            {['Project', 'Drawing', 'BOQ', 'Credential', 'Invoice'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={upload} disabled={uploading} className="btn-primary px-5 py-2.5 rounded-lg text-label-md disabled:opacity-60">
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-2">PDF, images, CSV, ZIP, DWG up to 5 MB. Access is owner-only.</p>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-10 text-center text-on-surface-variant dark:text-surface-variant">
          No documents uploaded yet.
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl divide-y divide-outline-variant dark:divide-outline overflow-hidden shadow-elevation">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-4 p-4 hover:bg-surface-container-low dark:hover:bg-tertiary-container transition-colors">
              <span className="material-symbols-outlined text-primary dark:text-primary-fixed text-[28px]">{TYPE_ICONS[d.type] ?? 'description'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-body-md font-semibold text-on-background dark:text-surface-container-lowest truncate">{d.name}</div>
                <div className="text-label-md text-on-surface-variant dark:text-surface-variant">
                  {fmtSize(d.size)} · {d.category} · v{d.version} · {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => download(d.id)} className="text-primary dark:text-primary-fixed hover:underline text-label-md">Download</button>
              <button onClick={() => remove(d.id)} className="text-error dark:text-error-container hover:underline text-label-md">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
