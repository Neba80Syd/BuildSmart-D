'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const TYPES = ['CONSULTATION', 'PRESENTATION', 'REVIEW', 'SITE', 'MEETING'];
const METHODS = ['IN_PERSON', 'VIDEO', 'PHONE', 'SITE'];
const EMPTY = { architectId: '', projectId: '', title: '', type: 'MEETING', date: '', startTime: '10:00', endTime: '11:00', method: 'VIDEO', location: '', notes: '' };

export default function ClientAppointmentsPage() {
  const { data, loading, refetch } = useApi<any>('/api/client/appointments');
  const architects = useApi<any>('/api/client/architects');
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const appointments = data?.appointments ?? [];
  const upcoming = appointments.filter((a: any) => a.date >= today && !['COMPLETED', 'CANCELLED'].includes(a.status));
  const past = appointments.filter((a: any) => a.date < today || ['COMPLETED', 'CANCELLED'].includes(a.status));
  const list = view === 'upcoming' ? upcoming : past;

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const create = async () => {
    setSaving(true);
    try { await api('POST', '/api/client/appointments', { ...form, projectId: form.projectId || null }); toast.success('Appointment requested'); setOpen(false); setForm(EMPTY); refetch(); }
    catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const act = async (id: string, action: string) => {
    try { await api('PATCH', '/api/client/appointments', { id, action }); toast.success(action + 'ed'); refetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <div className="p-margin-mobile md:p-margin-desktop space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64" /></div>;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1000px] mx-auto">
      <PageHeader title="Appointments" subtitle="Schedule and manage meetings with your architect." crumbs={['Client', 'Communication', 'Appointments']}
        actions={<button className={btnPrimary} onClick={() => setOpen(true)}>Request Appointment</button>} />

      <div className="flex gap-2 mb-4">
        {(['upcoming', 'past'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-label-md capitalize ${view === v ? 'bg-primary text-white' : 'bg-surface-container-low dark:bg-surface-variant text-on-surface-variant dark:text-surface-variant'}`}>{v}</button>)}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="calendar_month" title={view === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'} />
      ) : (
        <div className="space-y-3">
          {list.map((a: any) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{a.title}</h3>
                  <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{a.date} · {a.startTime}{a.endTime ? '–' + a.endTime : ''} · {a.method} · {a.architectName}</p>
                  {a.projectName && <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Project: {a.projectName}</p>}
                  {a.notes && <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-1">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={a.status} />
                  {a.status === 'PENDING' && <button className={btnPrimary} onClick={() => act(a.id, 'confirm')}>Confirm</button>}
                  {!['COMPLETED', 'CANCELLED'].includes(a.status) && <ConfirmButton label="Cancel" confirmLabel="Cancel?" onConfirm={() => act(a.id, 'cancel')} className={btnGhost} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Request Appointment">
        <div className="space-y-4">
          <Field label="Architect"><select className={inputClass} value={form.architectId} onChange={(e) => set('architectId', e.target.value)}>{<option value="">Select…</option>}{(architects.data?.architects ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <Field label="Project (optional)"><select className={inputClass} value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>{<option value="">None</option>}{(data?.projects ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Title"><input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type"><select className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Method"><select className={inputClass} value={form.method} onChange={(e) => set('method', e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
            <Field label="Date"><input className={inputClass} type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start"><input className={inputClass} type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} /></Field>
              <Field label="End"><input className={inputClass} type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></Field>
            </div>
          </div>
          <Field label="Location"><input className={inputClass} value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Notes"><textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
          <button className={btnPrimary} onClick={create} disabled={saving}>{saving ? 'Sending…' : 'Request Appointment'}</button>
        </div>
      </Modal>
    </div>
  );
}
