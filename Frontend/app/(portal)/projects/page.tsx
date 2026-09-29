'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Project = {
  id: string;
  name: string;
  description: string;
  status: string;
  budget: number;
  location: string;
  progress: number;
  architectName: string;
  updatedAt: string;
};

const PROJECT_IMAGES: Record<string, string> = {
  DESIGNING: '/images/project-villa.png',
  PROCUREMENT: '/images/project-floorplan.png',
  APPROVED: '/images/project-eco-office.png',
  COMPLETED: '/images/project-eco-office.png',
};

const statusTone: Record<string, string> = {
  DESIGNING: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
  PROCUREMENT: 'bg-[#315C4C]/10 text-[#315C4C] dark:bg-primary-container dark:text-on-primary-container',
  APPROVED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
  COMPLETED: 'bg-surface-variant text-on-surface-variant dark:bg-surface-variant dark:text-on-surface-variant',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', budget: '', status: 'DESIGNING', description: '' });

  const load = async () => {
    const res = await fetch('/api/projects');
    const data = await res.json();
    setProjects(data.projects ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, budget: parseFloat(form.budget) || 0 }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      toast.success('Project created');
      setShowForm(false);
      setForm({ name: '', location: '', budget: '', status: 'DESIGNING', description: '' });
      load();
    } else toast.error(data.error ?? 'Could not create project');
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Project deleted');
      load();
    } else toast.error('Could not delete project');
  };

  const cycleStatus = async (p: Project) => {
    const order = ['DESIGNING', 'PROCUREMENT', 'APPROVED', 'COMPLETED'];
    const next = order[(order.indexOf(p.status) + 1) % order.length];
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, status: next }),
    });
    if (res.ok) {
      toast.success(`Status → ${next}`);
      load();
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto p-margin-mobile md:p-margin-desktop">
      <div className="flex items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-surface-container-lowest mb-1">Projects</h1>
          <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Manage all your construction projects in one place.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-on-primary hover:bg-[#264B3E] transition-colors py-2.5 px-5 rounded-lg text-label-md flex items-center gap-2 whitespace-nowrap">
          <span className="material-symbols-outlined text-sm">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-6 shadow-elevation mb-8">
          <h2 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest mb-4">Create Project</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Project Name</label>
              <input className="input w-full" placeholder="e.g. Lakeside Residence" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Location</label>
              <input className="input w-full" placeholder="e.g. Douala, CM" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Budget (XAF)</label>
              <input type="number" className="input w-full" placeholder="e.g. 85000000" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Status</label>
              <select className="input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['DESIGNING', 'PROCUREMENT', 'APPROVED', 'COMPLETED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-body-sm font-medium mb-1.5 text-on-background dark:text-surface-container-lowest">Description</label>
              <input className="input w-full" placeholder="Brief description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <button onClick={create} disabled={saving} className="btn-primary px-6 py-2.5 rounded-lg text-label-md mt-4 disabled:opacity-60">
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-body-md text-on-surface-variant dark:text-surface-variant">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl p-10 text-center text-on-surface-variant dark:text-surface-variant">
          No projects yet. Create your first project to get started.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div key={p.id} className="bg-white dark:bg-surface-container border border-outline-variant dark:border-outline rounded-xl overflow-hidden hover:shadow-elevation transition-all flex flex-col">
              <div className="h-40 w-full relative">
                <Image src={PROJECT_IMAGES[p.status] ?? '/images/project-villa.png'} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${statusTone[p.status]}`}>{p.status}</span>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="text-headline-sm font-semibold text-on-background dark:text-surface-container-lowest">{p.name}</h3>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant mt-0.5">Architect: {p.architectName}</p>
                    <p className="text-label-md text-on-surface-variant dark:text-surface-variant">{p.location || 'No location'} · {p.budget ? `${p.budget.toLocaleString()} XAF` : 'Budget TBD'}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <div className="h-1.5 bg-surface-variant dark:bg-tertiary-container rounded mb-1 overflow-hidden">
                    <div className="h-1.5 bg-primary dark:bg-inverse-primary rounded" style={{ width: `${p.progress ?? 0}%` }} />
                  </div>
                  <div className="flex justify-between text-body-sm mb-5 text-on-surface-variant dark:text-surface-variant">
                    <span>Progress</span>
                    <span>{p.progress ?? 0}%</span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Link href="/estimation" className="flex-1 btn-secondary py-2 rounded-lg text-label-md flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">request_quote</span> BOQ
                    </Link>
                    <Link href="/ai-design" className="flex-1 btn-secondary py-2 rounded-lg text-label-md flex justify-center items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">design_services</span> AI Studio
                    </Link>
                    <button onClick={() => cycleStatus(p)} className="flex-1 btn-secondary py-2 rounded-lg text-label-md flex justify-center items-center gap-2" title="Advance status">
                      <span className="material-symbols-outlined text-[18px]">swap_horiz</span> Advance
                    </button>
                    <button onClick={() => remove(p.id)} className="px-3 py-2 rounded-lg text-label-md text-error dark:text-error-container border border-outline-variant dark:border-outline hover:bg-error/5 transition-colors" title="Delete project">
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
