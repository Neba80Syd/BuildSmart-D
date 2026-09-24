'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Field, inputClass, btnPrimary, btnGhost, iconBtn, Skeleton, ConfirmButton } from '@/Frontend/components/architect/ui';
import { useApi, api } from '@/Frontend/components/architect/hooks';

const TYPES = ['CONSULTATION', 'PRESENTATION', 'REVIEW', 'SITE', 'MEETING'];
const METHODS = ['IN_PERSON', 'VIDEO', 'PHONE', 'SITE'];

export default function ArchitectAppointmentsPage() {
  const { data, loading, refetch } = useApi<{ appointments: any[] }>('/api/architect/appointments');
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const [modal, setModal] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const appts = data?.appointments ?? [];
  const upcoming = appts.filter((a) => a.date >= today && a.status !== 'CANCELLED').sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const past = appts.filter((a) => a.date < today || a.status === 'COMPLETED').sort((a, b) => (b.date + b.startTime).localeCompare(a.date + a.startTime));
  const list = view === 'upcoming' ? upcoming : past;

  const setStatus = async (a: any, status: string) => {
    try { await api('PATCH', '/api/architect/appointments', { id: a.id, status }); toast.success('Appointment updated'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };
  const del = async (a: any) => {
    try { await api('DELETE', `/api/architect/appointments?id=${a.id}`); toast.success('Appointment deleted'); refetch(); }
    catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Appointments" subtitle="Manage meetings, consultations and site visits." crumbs={['Architect', 'Collaboration', 'Appointments']} actions={
        <button className={btnPrimary} onClick={() => setModal(true)}><span className="material-symbols-outlined text-[18px]">add</span>New Appointment</button>
      } />

      <div className="flex gap-1 mb-4">
        {(['upcoming', 'past'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={`px-4 py-2 rounded-lg text-label-md capitalize ${view === v ? 'bg-primary text-white' : 'bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline text-on-surface-variant dark:text-surface-variant'}`}>{v}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon="calendar_month" title="No appointments" body={view === 'upcoming' ? 'Schedule your first appointment.' : 'Completed appointments will appear here.'} actionLabel={view === 'upcoming' ? 'New Appointment' : undefined} onAction={view === 'upcoming' ? () => setModal(true) : undefined} />
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id} pad={false} className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex md:flex-col items-center justify-center md:w-24 md:self-stretch p-4 bg-surface-container-low dark:bg-surface-variant md:border-r border-outline-variant dark:border-outline text-center">
                <span className="text-headline-md text-primary dark:text-primary-fixed-dim">{new Date(a.date + 'T00:00:00').getDate()}</span>
                <span className="text-label-md uppercase text-on-surface-variant dark:text-surface-variant">{new Date(a.date + 'T00:00:00').toLocaleString('en', { month: 'short' })}</span>
              </div>
              <div className="flex-1 p-4 md:p-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface">{a.title}</h3>
                  <StatusPill status={a.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{a.startTime}{a.endTime ? ` – ${a.endTime}` : ''} · {a.method.replace(/_/g, ' ')} · {a.clientName ?? 'No client'}{a.projectName ? ` · ${a.projectName}` : ''}{a.location ? ` · ${a.location}` : ''}</p>
                {a.notes && <p className="text-body-sm text-on-surface-variant dark:text-surface-variant italic mt-1">{a.notes}</p>}
              </div>
              <div className="flex items-center gap-1 p-4 md:p-0 md:pr-4">
                {a.status === 'PENDING' && <button className={btnGhost} onClick={() => setStatus(a, 'CONFIRMED')}>Confirm</button>}
                {['PENDING', 'CONFIRMED'].includes(a.status) && <button className={btnGhost} onClick={() => setStatus(a, 'COMPLETED')}>Complete</button>}
                {['PENDING', 'CONFIRMED'].includes(a.status) && <button className={iconBtn} title="Cancel" onClick={() => setStatus(a, 'CANCELLED')}><span className="material-symbols-outlined">close</span></button>}
                <ConfirmButton icon="delete" label="" onConfirm={() => del(a)} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {modal && <AppointmentModal onClose={() => setModal(false)} onDone={() => { setModal(false); refetch(); }} />}
    </div>
  );
}

function AppointmentModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { data: projectsData } = useApi<{ projects: any[] }>('/api/architect/projects');
  const { data: clientsData } = useApi<{ clients: any[] }>('/api/architect/clients');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api('POST', '/api/architect/appointments', {
        title: fd.get('title'), type: fd.get('type'), clientId: fd.get('clientId') || null, projectId: fd.get('projectId') || null,
        date: fd.get('date'), startTime: fd.get('startTime'), endTime: fd.get('endTime') || undefined, method: fd.get('method'),
        location: fd.get('location'), notes: fd.get('notes'),
      });
      toast.success('Appointment scheduled');
      onDone();
    } catch (err: any) { toast.error(err.message); }
  };
  return (
    <Modal open title="New Appointment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title"><input className={inputClass} name="title" required minLength={2} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type"><select className={inputClass} name="type">{TYPES.map((t) => <option key={t}>{t.replace(/_/g, ' ')}</option>)}</select></Field>
          <Field label="Method"><select className={inputClass} name="method">{METHODS.map((m) => <option key={m}>{m.replace(/_/g, ' ')}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><input className={inputClass} name="date" type="date" required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start"><input className={inputClass} name="startTime" type="time" required /></Field>
            <Field label="End"><input className={inputClass} name="endTime" type="time" /></Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client">
            <select className={inputClass} name="clientId" defaultValue=""><option value="">—</option>{(clientsData?.clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="Project">
            <select className={inputClass} name="projectId" defaultValue=""><option value="">—</option>{(projectsData?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </Field>
        </div>
        <Field label="Location"><input className={inputClass} name="location" /></Field>
        <Field label="Notes"><textarea className={inputClass} name="notes" rows={2} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary}>Schedule</button>
        </div>
      </form>
    </Modal>
  );
}
