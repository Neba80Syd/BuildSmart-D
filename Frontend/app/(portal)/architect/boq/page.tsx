'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number) => Math.round(n).toLocaleString();

export default function ArchitectBoqPage() {
  const { data, loading, refetch } = useApi<{ boqs: any[]; itemsByBoq: Record<string, any[]> }>('/api/architect/boq');
  const [active, setActive] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  const boqs = data?.boqs ?? [];
  const items = active ? (data?.itemsByBoq?.[active] ?? []) : [];

  const activeBoq = boqs.find((b) => b.id === active);
  const total = items.reduce((s, i) => s + (i.total ?? 0), 0);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1400px] mx-auto">
      <PageHeader title="Material Estimation & BOQ" subtitle="Estimate materials and generate Bills of Quantities for your projects." crumbs={['Architect', 'Design Studio', 'Materials & BOQ']} actions={
        <button className={btnPrimary} onClick={() => setModal(true)}><span className="material-symbols-outlined text-[18px]">add</span>New BOQ</button>
      } />

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      ) : boqs.length === 0 ? (
        <EmptyState icon="request_quote" title="No BOQs yet" body="Generate a material estimate from a project." actionLabel="Create BOQ" onAction={() => setModal(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-3">
            {boqs.map((b) => (
              <button key={b.id} onClick={() => setActive(b.id)} className={`w-full text-left p-4 rounded-xl border transition-colors ${active === b.id ? 'bg-secondary-container dark:bg-primary-container border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline hover:border-primary'}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-headline-sm text-on-surface dark:text-on-surface">{b.name}</h3>
                  <StatusPill status={b.status} />
                </div>
                <p className="text-label-md text-on-surface-variant dark:text-surface-variant">V{b.version} · {(data?.itemsByBoq?.[b.id] ?? []).length} items</p>
                <p className="text-body-sm font-semibold text-primary dark:text-primary-fixed-dim mt-1">{fmt((data?.itemsByBoq?.[b.id] ?? []).reduce((s, i) => s + (i.total ?? 0), 0))} {b.currency}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!activeBoq ? (
              <Card className="text-center py-16 text-on-surface-variant dark:text-surface-variant">Select a BOQ to view and edit its items.</Card>
            ) : (
              <BoqDetail boq={activeBoq} items={items} total={total} onChanged={refetch} onDeleted={() => { setActive(null); refetch(); }} />
            )}
          </div>
        </div>
      )}

      {modal && <NewBoqModal onClose={() => setModal(false)} onDone={(id) => { setModal(false); setActive(id); refetch(); }} />}
    </div>
  );
}

function BoqDetail({ boq, items, total, onChanged, onDeleted }: { boq: any; items: any[]; total: number; onChanged: () => void; onDeleted: () => void }) {
  const [edit, setEdit] = useState<any[] | null>(null);
  const rows = edit ?? items;

  const setItem = (id: string, patch: any) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch, total: (patch.quantity ?? r.quantity) * (patch.unitPrice ?? r.unitPrice) } : r));
    setEdit(next);
  };

  const save = async () => {
    try {
      await api('PATCH', '/api/architect/boq', { id: boq.id, items: edit!.map(({ category, material, description, unit, quantity, unitPrice, source, notes, linkedProductId }) => ({ category, material, description, unit, quantity, unitPrice, source, notes, linkedProductId })) });
      toast.success('BOQ saved');
      setEdit(null);
      onChanged();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const setStatus = async (status: string) => {
    try {
      await api('PATCH', '/api/architect/boq', { id: boq.id, status });
      toast.success('Status updated');
      onChanged();
    } catch (err: any) { toast.error(err.message); }
  };

  const del = async () => {
    try {
      await api('DELETE', `/api/architect/boq?id=${boq.id}`);
      toast.success('BOQ deleted');
      onDeleted();
    } catch (err: any) { toast.error(err.message); }
  };

  const exportCsv = () => {
    const head = 'Category,Material,Description,Unit,Quantity,Unit Price,Total,Source';
    const lines = rows.map((r) => [r.category, r.material, r.description ?? '', r.unit, r.quantity, r.unitPrice, r.total, r.source].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [head, ...lines, `"","","","","","","TOTAL",${total}`].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${boq.name.replace(/\s+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('BOQ exported as CSV');
  };

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-outline-variant dark:border-outline">
        <div>
          <h3 className="text-headline-md text-on-surface dark:text-on-surface">{boq.name}</h3>
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{boq.notes || 'No notes'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass + ' w-auto'} value={boq.status} onChange={(e) => setStatus(e.target.value)}>
            {['DRAFT', 'FINAL', 'SENT'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className={btnGhost} onClick={exportCsv}><span className="material-symbols-outlined text-[18px]">download</span>Export</button>
          {edit ? <button className={btnPrimary} onClick={save}>Save Changes</button> : <button className={btnGhost} onClick={() => setEdit(items)}>Edit Quantities</button>}
          <ConfirmButton icon="delete" label="" onConfirm={del} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="text-left text-label-md text-on-surface-variant dark:text-surface-variant border-b border-outline-variant dark:border-outline">
              <th className="px-4 py-2">Category</th><th className="px-4 py-2">Material</th><th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Unit Price</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/50 dark:border-outline/40 hover:bg-surface-container-low dark:hover:bg-surface-variant">
                <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{r.category}</td>
                <td className="px-4 py-2">
                  <div className="font-semibold text-on-surface dark:text-on-surface">{r.material}</div>
                  {r.description && <div className="text-label-md text-on-surface-variant dark:text-surface-variant">{r.description}</div>}
                  {r.notes && <div className="text-[11px] text-on-surface-variant dark:text-surface-variant italic">{r.notes}</div>}
                </td>
                <td className="px-4 py-2 text-on-surface-variant dark:text-surface-variant">{r.unit}</td>
                <td className="px-4 py-2 text-right">
                  {edit ? <input className={inputClass + ' w-20 text-right'} type="number" value={r.quantity} onChange={(e) => setItem(r.id, { quantity: Number(e.target.value) })} /> : <span className="font-mono-technical">{r.quantity}</span>}
                </td>
                <td className="px-4 py-2 text-right">
                  {edit ? <input className={inputClass + ' w-28 text-right'} type="number" value={r.unitPrice} onChange={(e) => setItem(r.id, { unitPrice: Number(e.target.value) })} /> : <span className="font-mono-technical">{fmt(r.unitPrice)}</span>}
                </td>
                <td className="px-4 py-2 text-right font-semibold text-primary dark:text-primary-fixed-dim font-mono-technical">{fmt(r.total)}</td>
                <td className="px-4 py-2">
                  <span className={`text-label-md px-2 py-0.5 rounded ${r.source === 'AI_ESTIMATE' ? 'bg-[#EAF3FB] text-[#2F5F8A]' : r.source === 'MARKETPLACE' ? 'bg-[#F3EEFB] text-[#6B4FA0]' : 'bg-surface-container-low text-on-surface-variant'}`}>{r.source}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container-low dark:bg-surface-variant">
              <td colSpan={5} className="px-4 py-3 text-label-md uppercase tracking-wide text-on-surface-variant dark:text-surface-variant">Estimated Total</td>
              <td className="px-4 py-3 text-right font-bold text-on-surface dark:text-on-surface font-mono-technical">{fmt(total)} {boq.currency}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-on-surface-variant dark:text-surface-variant border-t border-outline-variant dark:border-outline">
        AI estimates are preliminary and require professional review. AI-generated quantities can be manually overridden.
      </p>
    </Card>
  );
}

function NewBoqModal({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const [generating, setGenerating] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGenerating(true);
    try {
      const res = await api('POST', '/api/architect/boq', { projectId: fd.get('projectId') || null, name: fd.get('name'), generate: fd.get('generate') === 'on' });
      toast.success('BOQ created');
      onDone(res.boq.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };
  return (
    <Modal open title="New BOQ" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="BOQ name"><input className={inputClass} name="name" required minLength={2} placeholder="e.g. Villa — Structural BOQ" /></Field>
        <Field label="Project">
          <select className={inputClass} name="projectId" defaultValue="">
            <option value="">Standalone BOQ</option>
            {(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-body-sm text-on-surface dark:text-on-surface">
          <input type="checkbox" name="generate" defaultChecked className="accent-[#315C4C]" />
          Generate AI material estimate from project brief
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={generating}>{generating ? 'Generating…' : 'Create BOQ'}</button>
        </div>
      </form>
    </Modal>
  );
}
