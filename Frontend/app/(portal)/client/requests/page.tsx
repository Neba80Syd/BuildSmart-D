'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const EMPTY = { architectId: '', projectName: '', projectType: 'Villa', description: '', location: '', budget: '', style: '', siteArea: '', floors: '', rooms: '', bedrooms: '', bathrooms: '', parking: '', kitchen: '', specialRequirements: '' };

export default function ClientRequestsPage() {
  const { data, loading, refetch } = useApi<{ requests: any[] }>('/api/client/requests');
  const architects = useApi<any>('/api/client/architects');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [infoFor, setInfoFor] = useState<any>(null);
  const [infoText, setInfoText] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Allow the discovery page to preselect the architect via ?architect=<id>
  // and open the request form immediately, or highlight a request referenced
  // from a notification via ?request=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const architect = params.get('architect');
    if (architect) {
      setForm((f: any) => ({ ...f, architectId: architect }));
      setOpen(true);
    }
    const request = params.get('request');
    if (request) setHighlightId(request);
  }, []);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const validate = () => {
    if (!form.architectId) {
      toast.error('Please select an architect.');
      return false;
    }
    if (!String(form.projectType ?? '').trim()) {
      toast.error('Please enter the building type.');
      return false;
    }
    if (!String(form.projectName ?? '').trim()) {
      toast.error('Please enter a project name.');
      return false;
    }
    const description = String(form.description ?? '').trim();
    if (!description) {
      toast.error('Please describe your project.');
      return false;
    }
    if (description.length < 10) {
      toast.error('Please describe your project with a few more details (at least 10 characters).');
      return false;
    }
    return true;
  };

  const submit = async (draft = false) => {
    setSaving(true);
    try {
      if (!draft && !validate()) return;
      if (draft && !form.architectId) {
        toast.error('Please select an architect before saving a draft.');
        return;
      }
      await api('POST', '/api/client/requests', {
        ...form,
        projectName: String(form.projectName ?? '').trim(),
        projectType: String(form.projectType ?? '').trim(),
        description: String(form.description ?? '').trim(),
        budget: form.budget === '' ? null : Number(form.budget),
        siteArea: form.siteArea === '' ? null : Number(form.siteArea),
        floors: form.floors === '' ? null : Number(form.floors),
        rooms: form.rooms === '' ? null : Number(form.rooms),
        bedrooms: form.bedrooms === '' ? 0 : Number(form.bedrooms),
        bathrooms: form.bathrooms === '' ? 0 : Number(form.bathrooms),
        draft,
      });
      toast.success(draft ? 'Draft saved' : 'Request submitted');
      setOpen(false); setForm(EMPTY); refetch();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const act = async (id: string, action: string, extra = {}) => {
    try { await api('PATCH', '/api/client/requests', { id, action, ...extra }); toast.success(`${action.replace('_', ' ')} done`); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const provideInfo = async () => {
    await act(infoFor.id, 'provide_info', { additionalInfo: infoText }); setInfoFor(null); setInfoText('');
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;
  const requests = data?.requests ?? [];

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Design Requests" subtitle="Submit architectural requirements to an architect." crumbs={['Client', 'My Projects', 'Design Requests']}
        actions={<button className={btnPrimary} onClick={() => setOpen(true)}>New Design Request</button>} />

      {requests.length === 0 ? (
        <EmptyState icon="inbox" title="No design requests yet" body="Submit your first request to start your project." actionLabel="New Design Request" onAction={() => setOpen(true)} />
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.id} className={r.id === highlightId ? 'ring-2 ring-primary dark:ring-primary-fixed-dim' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1"><h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{(r.requirements?.projectName ?? r.projectType)} — {r.location || 'unspecified'}</h3><StatusPill status={r.status} /></div>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-2">{r.description}</p>
                  {r.status === 'INFO_REQUIRED' && r.requirements?.architectNote && (
                    <p className="text-body-sm text-[#A66A00] dark:text-yellow-400 bg-[#FFF4E5] dark:bg-yellow-900/20 border border-[#F5D09D] dark:border-yellow-800 rounded-lg px-3 py-2 mb-2">
                      <strong>Architect:</strong> {r.requirements.architectNote}
                    </p>
                  )}
                  {r.requirements?.additionalInfo && (
                    <p className="text-body-sm text-on-surface-variant dark:text-surface-variant mb-2"><strong>Your additional information:</strong> {r.requirements.additionalInfo}</p>
                  )}
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Architect: {r.architectName} · Budget: {r.budget ? r.budget.toLocaleString() + ' XAF' : '—'} · {new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {r.status === 'DRAFT' && <button className={btnPrimary} onClick={() => act(r.id, 'submit')}>Submit</button>}
                  {r.status === 'INFO_REQUIRED' && <button className={btnPrimary} onClick={() => setInfoFor(r)}>Provide Info</button>}
                  {r.status === 'ACCEPTED' && <button className={btnPrimary} onClick={() => act(r.id, 'convert')}>Convert to Project</button>}
                  {!['CONVERTED', 'CANCELLED', 'REJECTED'].includes(r.status) && <ConfirmButton label="Cancel" confirmLabel="Cancel request?" onConfirm={() => act(r.id, 'cancel')} className={btnGhost} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New request modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Design Request" wide>
        <div className="space-y-4">
          <Field label="Architect" hint="Required — choose the architect who will receive your request."><select required className={inputClass} value={form.architectId} onChange={(e) => set('architectId', e.target.value)}>{<option value="">Select architect…</option>}{(architects.data?.architects ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name} — {a.title ?? 'Architect'}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project name" hint="Required"><input required className={inputClass} value={form.projectName} onChange={(e) => set('projectName', e.target.value)} /></Field>
            <Field label="Building type" hint="Required"><input required className={inputClass} value={form.projectType} onChange={(e) => set('projectType', e.target.value)} /></Field>
            <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
            <Field label="Preferred style"><input className={inputClass} value={form.style} onChange={(e) => set('style', e.target.value)} /></Field>
            <Field label="Budget (XAF)"><input className={inputClass} type="number" value={form.budget} onChange={(e) => set('budget', e.target.value)} /></Field>
            <Field label="Plot size (m²)"><input className={inputClass} type="number" value={form.siteArea} onChange={(e) => set('siteArea', e.target.value)} /></Field>
            <Field label="Floors"><input className={inputClass} type="number" value={form.floors} onChange={(e) => set('floors', e.target.value)} /></Field>
            <Field label="Rooms"><input className={inputClass} type="number" value={form.rooms} onChange={(e) => set('rooms', e.target.value)} /></Field>
            <Field label="Bedrooms"><input className={inputClass} type="number" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></Field>
            <Field label="Bathrooms"><input className={inputClass} type="number" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></Field>
          </div>
          <Field label="Kitchen requirements"><input className={inputClass} value={form.kitchen} onChange={(e) => set('kitchen', e.target.value)} /></Field>
          <Field label="Parking requirements"><input className={inputClass} value={form.parking} onChange={(e) => set('parking', e.target.value)} /></Field>
          <Field label="Special requirements"><textarea className={inputClass} rows={2} value={form.specialRequirements} onChange={(e) => set('specialRequirements', e.target.value)} /></Field>
          <Field label="Description" hint="Required — describe your vision, needs and expectations (at least 10 characters)."><textarea required className={inputClass} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="flex gap-2">
            <button className={btnGhost} onClick={() => submit(true)} disabled={saving}>Save Draft</button>
            <button className={btnPrimary} onClick={() => submit(false)} disabled={saving}>{saving ? 'Submitting…' : 'Submit Request'}</button>
          </div>
        </div>
      </Modal>

      {/* Provide info modal */}
      <Modal open={!!infoFor} onClose={() => setInfoFor(null)} title="Provide Additional Information">
        <div className="space-y-4">
          <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">The architect needs more detail before proceeding.</p>
          {infoFor?.requirements?.architectNote && (
            <div className="text-body-sm text-[#A66A00] dark:text-yellow-400 bg-[#FFF4E5] dark:bg-yellow-900/20 border border-[#F5D09D] dark:border-yellow-800 rounded-lg px-3 py-2">
              <strong>Architect&rsquo;s request:</strong> {infoFor.requirements.architectNote}
            </div>
          )}
          <Field label="Additional information"><textarea required className={inputClass} rows={4} value={infoText} onChange={(e) => setInfoText(e.target.value)} /></Field>
          <button className={btnPrimary} onClick={() => { if (!infoText.trim()) { toast.error('Please write the additional information.'); return; } provideInfo(); }}>Send Information</button>
        </div>
      </Modal>
    </div>
  );
}
