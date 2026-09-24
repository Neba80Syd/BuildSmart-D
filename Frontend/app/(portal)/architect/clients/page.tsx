'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader, Card, StatusPill, EmptyState, Modal, Skeleton } from '@/Frontend/components/architect/ui';
import { useApi } from '@/Frontend/components/architect/hooks';

export default function ArchitectClientsPage() {
  const { data, loading } = useApi<{ clients: any[] }>('/api/architect/clients');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const clients = (data?.clients ?? []).filter((c) => (c.name ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1200px] mx-auto">
      <PageHeader title="Clients" subtitle="Your client relationships, projects and history." crumbs={['Architect', 'Workspace', 'Clients']} actions={
        <input className="bg-white dark:bg-surface-dim border border-outline-variant dark:border-outline rounded-lg px-3 py-2 text-body-sm w-64" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
      } />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : clients.length === 0 ? (
        <EmptyState icon="groups" title="No clients yet" body="Clients appear once they submit a request or you start a project." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-container text-white flex items-center justify-center font-bold">{initials(c.name)}</div>
                <div className="min-w-0">
                  <h3 className="text-headline-sm text-on-surface dark:text-inverse-on-surface truncate">{c.name}</h3>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant truncate">{c.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-surface-container-low dark:bg-surface-variant rounded-lg p-2">
                  <p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{c.projects}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Projects</p>
                </div>
                <div className="bg-surface-container-low dark:bg-surface-variant rounded-lg p-2">
                  <p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{c.activeProjects}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Active</p>
                </div>
                <div className="bg-surface-container-low dark:bg-surface-variant rounded-lg p-2">
                  <p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{c.requests}</p>
                  <p className="text-label-md text-on-surface-variant dark:text-surface-variant">Requests</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-label-md text-on-surface-variant dark:text-surface-variant">
                <span>Last interaction</span>
                <span className="font-semibold text-on-surface dark:text-inverse-on-surface">{c.lastInteraction ? new Date(c.lastInteraction).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-outline-variant dark:border-outline">
                <button onClick={() => setSelected(c.id)} className="flex-1 text-label-md text-primary dark:text-primary-fixed-dim hover:underline text-left">View profile</button>
                <Link href="/architect/messages" className="flex-1 text-label-md text-primary dark:text-primary-fixed-dim hover:underline text-right">Message</Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && <ClientModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ClientModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useApi<any>(`/api/architect/clients?id=${id}`);
  return (
    <Modal open title="Client Profile" onClose={onClose} wide>
      {loading ? <Skeleton className="h-40" /> : data && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-lg">{initials(data.client.name)}</div>
            <div>
              <h3 className="text-headline-md text-on-surface dark:text-inverse-on-surface">{data.client.name}</h3>
              <p className="text-body-sm text-on-surface-variant dark:text-surface-variant">{data.client.id}</p>
            </div>
          </div>
          <div>
            <h4 className="text-label-md uppercase tracking-wide text-on-surface-variant dark:text-surface-variant mb-2">Projects</h4>
            <div className="space-y-2">
              {data.projects.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant">
                  <span className="text-body-sm text-on-surface dark:text-inverse-on-surface">{p.name}</span>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant"><p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{data.requests.length}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Requests</p></div>
            <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant"><p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{data.documents.length}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Documents</p></div>
            <div className="p-3 rounded-lg bg-surface-container-low dark:bg-surface-variant"><p className="text-headline-sm text-primary dark:text-primary-fixed-dim">{data.appointments.length}</p><p className="text-label-md text-on-surface-variant dark:text-surface-variant">Appointments</p></div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function initials(name?: string) {
  return (name ?? '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
