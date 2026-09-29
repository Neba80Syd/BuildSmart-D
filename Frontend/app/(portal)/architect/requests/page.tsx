'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, iconBtn, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const fmt = (n: number | null | undefined) => (n == null ? '—' : Math.round(n).toLocaleString());

export default function ArchitectRequestsPage() {
  const { data, loading, refetch } = useApi<{ requests: any[] }>('/api/architect/requests');
  const router = useRouter();
  const [filter, setFilter] = useState('ALL');
  const [modal, setModal] = useState<null | { request: any; mode: 'accept' | 'request_info' }>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // When opened from a notification (?request=<id>), highlight that request and
  // make sure it is visible in the current list.
  useEffect(() => {
    const request = new URLSearchParams(window.location.search).get('request');
    if (request) setHighlightId(request);
  }, []);

  const requests = data?.requests ?? [];
  const filtered = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);
  const reqsOf = (r: any): any =>
    r?.requirements && typeof r.requirements === 'object' && !Array.isArray(r.requirements) ? r.requirements : {};

  const act = async (id: string, action: string, extra?: any) => {
    try {
      await api('PATCH', '/api/architect/requests', { id, action, ...extra });
      toast.success('Request updated');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const convert = async (r: any) => {
    try {
      const res = await api('PATCH', '/api/architect/requests', { id: r.id, action: 'CONVERT' });
      toast.success(`Converted to project "${res.project.name}"`);
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Start implementation directly: create the project + floor-plan draft and
  // take the architect straight into the 2D floor-plan editor.
  const start = async (r: any) => {
    try {
      const res = await api('PATCH', '/api/architect/requests', { id: r.id, action: 'START' });
      toast.success(`Project "${res.project.name}" started. Open the floor plan and begin implementation.`);
      router.push(`/architect/floorplans?project=${res.project.id}&plan=${res.floorPlan?.id ?? ''}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const del = async (r: any) => {
    try {
      await api('DELETE', `/api/architect/requests?id=${r.id}`);
      toast.success('Request deleted');
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const FILTERS = ['ALL', 'NEW', 'UNDER_REVIEW', 'INFO_REQUIRED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'CANCELLED', 'ARCHIVED'];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Design Requests" subtitle="Review and act on architectural requests from clients." crumbs={['Architect', 'Workspace', 'Design Requests']} />

      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-full text-label-md whitespace-nowrap border transition-colors ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-surface-dim border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant hover:border-primary'}`}>
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="inbox" title="No requests" body="Design requests from clients will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Card key={r.id} className={`flex flex-col md:flex-row gap-4 ${r.id === highlightId ? 'ring-2 ring-primary dark:ring-primary-fixed-dim' : ''}`} pad={false}>
              <div className="p-5 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{reqsOf(r).projectName || r.projectType} — {r.clientName}</h3>
                  <StatusPill status={r.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-2">{r.description}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-label-md text-on-surface-variant dark:text-surface-variant">
                  <span><strong className="text-on-surface dark:text-inverse-on-surface">{r.location ?? '—'}</strong> location</span>
                  <span><strong className="text-on-surface dark:text-inverse-on-surface">{fmt(r.budget)} XAF</strong> budget</span>
                  <span><strong className="text-on-surface dark:text-inverse-on-surface">{r.siteArea ?? '—'} m²</strong> site</span>
                  <span><strong className="text-on-surface dark:text-inverse-on-surface">{r.floors ?? '—'} floors</strong></span>
                  <span><strong className="text-on-surface dark:text-inverse-on-surface">{r.style ?? '—'}</strong> style</span>
                </div>
                {reqsOf(r).bedrooms ? <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1"><strong className="text-on-surface dark:text-inverse-on-surface">{reqsOf(r).bedrooms}</strong> bed · <strong className="text-on-surface dark:text-inverse-on-surface">{reqsOf(r).bathrooms}</strong> bath · <strong className="text-on-surface dark:text-inverse-on-surface">{reqsOf(r).parking || '—'}</strong> parking</p> : null}
                {reqsOf(r).kitchen && <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">Kitchen: {reqsOf(r).kitchen}</p>}
                {reqsOf(r).specialRequirements && <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">Special: {reqsOf(r).specialRequirements}</p>}
                {reqsOf(r).additionalInfo && (
                  <p className="text-body-sm text-on-surface dark:text-inverse-on-surface bg-surface-container-low dark:bg-surface-variant rounded-lg px-3 py-2 mt-2">Client response: {reqsOf(r).additionalInfo}</p>
                )}
              </div>
              <div className="flex md:flex-col gap-2 p-5 md:border-l border-outline-variant dark:border-outline justify-end">
                {['NEW', 'UNDER_REVIEW', 'INFO_REQUIRED'].includes(r.status) && (
                  <>
                    <button className={btnPrimary} onClick={() => setModal({ request: r, mode: 'accept' })}>Accept</button>
                    <button className={btnGhost} onClick={() => setModal({ request: r, mode: 'request_info' })}>Request Info</button>
                  </>
                )}
                {r.status === 'ACCEPTED' && (
                  <>
                    <button className={btnPrimary} onClick={() => start(r)}>
                      <span className="material-symbols-outlined text-[18px]">edit_square</span>
                      Start Project & Floor Plan
                    </button>
                    <button className={btnGhost} onClick={() => convert(r)}>Convert to Project</button>
                  </>
                )}
                {['NEW', 'UNDER_REVIEW', 'INFO_REQUIRED', 'ACCEPTED'].includes(r.status) && (
                  <button className={btnGhost} onClick={() => act(r.id, 'REJECT')}>Reject</button>
                )}
                {['CANCELLED', 'REJECTED', 'ARCHIVED'].includes(r.status) && (
                  <ConfirmButton icon="delete" label="Delete" onConfirm={() => del(r)} />
                )}
                {!['ARCHIVED', 'CANCELLED'].includes(r.status) && (
                  <button className={iconBtn} title="Archive" onClick={() => act(r.id, 'ARCHIVE')}><span className="material-symbols-outlined">archive</span></button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal open title={modal.mode === 'accept' ? 'Accept Request' : 'Request Clarification'} onClose={() => setModal(null)}>
          <AcceptForm request={modal.request} mode={modal.mode} onDone={() => { setModal(null); refetch(); }} />
        </Modal>
      )}
    </div>
  );
}

function AcceptForm({ request, mode, onDone }: { request: any; mode: string; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      if (mode === 'accept') {
        await api('PATCH', '/api/architect/requests', { id: request.id, action: 'ACCEPT', timeline: fd.get('timeline'), price: Number(fd.get('price') || 0) });
        toast.success('Request accepted');
      } else {
        await api('PATCH', '/api/architect/requests', { id: request.id, action: 'REQUEST_INFO', note: fd.get('note') });
        toast.success('Clarification requested');
      }
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === 'accept' ? (
        <>
          <Field label="Estimated timeline"><input className={inputClass} name="timeline" placeholder="e.g. 8–10 weeks" /></Field>
          <Field label="Preliminary price (XAF)"><input className={inputClass} name="price" type="number" min={0} /></Field>
        </>
      ) : (
        <Field label="What additional information do you need?"><textarea className={inputClass} name="note" rows={3} required /></Field>
      )}
      <div className="flex justify-end gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Confirm'}</button>
      </div>
    </form>
  );
}
