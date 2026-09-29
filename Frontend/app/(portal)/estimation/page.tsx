'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type BoqRow = { id: string; description: string; quantity: number; unit: string; unitCost: number };
type BoqSection = { title: string; rows: BoqRow[] };

const INITIAL_SECTIONS: BoqSection[] = [
  {
    title: '1.0 Substructure & Framing',
    rows: [
      { id: '1.1', description: 'Structural Steel (W-Shapes, Grade 50)', quantity: 45200, unit: 'lbs', unitCost: 1.45 },
      { id: '1.2', description: 'Reinforced Concrete (4000 PSI)', quantity: 320, unit: 'cu yd', unitCost: 155.0 },
    ],
  },
  {
    title: '2.0 Masonry & Finishes',
    rows: [
      { id: '2.1', description: 'Portland Cement (Type I/II)', quantity: 150, unit: 'bags', unitCost: 14.5 },
      { id: '2.2', description: 'Ceramic Tiles (600x600mm, Non-slip)', quantity: 4500, unit: 'sq ft', unitCost: 4.2 },
    ],
  },
];

const xaf = (n: number) => `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF`;

export default function EstimationPage() {
  const [sections, setSections] = useState<BoqSection[]>(INITIAL_SECTIONS);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [newRow, setNewRow] = useState({ description: '', quantity: '1', unit: 'pc', unitCost: '0' });

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data.projects ?? []);
      if (data.projects?.[0]) setSelectedProject(data.projects[0].id);
    })();
  }, []);

  const allRows = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const subtotal = useMemo(() => allRows.reduce((sum, r) => sum + r.quantity * r.unitCost, 0), [allRows]);
  const contingency = subtotal * 0.1;
  const total = subtotal + contingency;

  const updateRow = (rowId: string, patch: Partial<BoqRow>) =>
    setSections((secs) => secs.map((s) => ({ ...s, rows: s.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) })));

  const removeRow = (rowId: string) =>
    setSections((secs) => secs.map((s) => ({ ...s, rows: s.rows.filter((r) => r.id !== rowId) })).filter((s) => s.rows.length > 0));

  const addRow = () => {
    if (!newRow.description.trim()) {
      toast.error('Enter a description for the line item');
      return;
    }
    const row: BoqRow = {
      id: `${sections.length + 1}.${Date.now().toString(36)}`,
      description: newRow.description,
      quantity: parseFloat(newRow.quantity) || 0,
      unit: newRow.unit,
      unitCost: parseFloat(newRow.unitCost) || 0,
    };
    // Append to the last section (or create an "Additional Items" section).
    setSections((secs) => {
      const last = secs[secs.length - 1];
      if (last && last.title.startsWith('1') === false && !last.title.includes('Additional')) {
        return [...secs.slice(0, -1), { ...last, rows: [...last.rows, row] }];
      }
      return [...secs, { title: `${secs.length + 1}.0 Additional Items`, rows: [row] }];
    });
    setNewRow({ description: '', quantity: '1', unit: 'pc', unitCost: '0' });
    toast.success('Line item added');
  };

  const downloadCSV = () => {
    const header = ['Item', 'Description', 'Quantity', 'Unit', 'Unit Cost (XAF)', 'Total (XAF)'];
    const lines = allRows.map((r) => [r.id, `"${r.description}"`, r.quantity, r.unit, r.unitCost.toFixed(2), (r.quantity * r.unitCost).toFixed(2)]);
    const footer = [
      ['', 'Subtotal', '', '', '', subtotal.toFixed(2)],
      ['', 'Contingency (10%)', '', '', '', contingency.toFixed(2)],
      ['', 'Total Estimated Project Cost', '', '', '', total.toFixed(2)],
    ];
    const csv = [header, ...lines, ...footer].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedProject || 'project'}-boq.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('BOQ exported as CSV');
  };

  const selectedName = projects.find((p) => p.id === selectedProject)?.name;

  return (
    <div className="max-w-[1200px] mx-auto p-margin-mobile md:p-margin-desktop">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-xl gap-md">
        <div>
          <h1 className="text-headline-lg text-on-background dark:text-on-background mb-1">Material Estimation &amp; BOQ</h1>
          <p className="text-body-sm text-on-surface-variant dark:text-outline-variant">
            Bill of Quantities and cost estimation for selected project phases.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-sm w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full appearance-none bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-outline rounded-lg py-2 pl-3 pr-10 text-body-sm text-on-surface dark:text-inverse-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 transform -translate-y-1/2 text-on-surface-variant dark:text-outline-variant pointer-events-none">expand_more</span>
          </div>
          <button onClick={downloadCSV} className="px-4 py-2 border border-outline-variant dark:border-outline rounded-lg text-label-md text-on-surface dark:text-on-surface hover:bg-surface-container-high dark:hover:bg-tertiary-container transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span> CSV
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-primary text-on-primary dark:bg-inverse-primary dark:text-on-primary-container rounded-lg text-label-md hover:bg-primary-container dark:hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-elevation">
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span> Export PDF
          </button>
          <Link href="/sourcing" className="px-4 py-2 bg-primary text-on-primary dark:bg-inverse-primary dark:text-on-primary-container rounded-lg text-label-md hover:bg-primary-container dark:hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-elevation">
            <span className="material-symbols-outlined text-sm">sync_alt</span> Source Materials
          </Link>
        </div>
      </div>

      {/* BOQ table */}
      <div className="bg-surface-container-lowest dark:bg-tertiary border border-outline-variant dark:border-outline rounded-xl overflow-hidden shadow-elevation mb-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low dark:bg-inverse-surface border-b border-outline-variant dark:border-outline">
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant w-16">Item</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant">Description</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant text-right">Quantity</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant w-24">Unit</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant text-right">Est. Unit Cost</th>
                <th className="py-3 px-4 text-label-md text-on-surface-variant dark:text-outline-variant text-right">Est. Total</th>
                <th className="py-3 px-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="font-mono-technical text-on-surface dark:text-on-surface divide-y divide-outline-variant dark:divide-outline">
              {sections.map((section) => (
                <SectionRows key={section.title} section={section} updateRow={updateRow} removeRow={removeRow} />
              ))}
            </tbody>
            <tfoot className="bg-surface-container dark:bg-inverse-surface border-t-2 border-outline dark:border-outline-variant">
              <tr>
                <td className="py-4 px-4 text-body-sm font-semibold text-right" colSpan={5}>Subtotal:</td>
                <td className="py-4 px-4 font-mono-technical font-bold text-right text-lg">{xaf(subtotal)}</td>
                <td></td>
              </tr>
              <tr>
                <td className="py-2 px-4 text-body-sm text-on-surface-variant dark:text-outline-variant text-right border-none" colSpan={5}>Contingency (10%):</td>
                <td className="py-2 px-4 font-mono-technical text-right text-on-surface-variant dark:text-outline-variant border-none">{xaf(contingency)}</td>
                <td></td>
              </tr>
              <tr>
                <td className="py-4 px-4 text-headline-sm font-bold text-primary dark:text-inverse-primary text-right" colSpan={5}>Total Estimated Project Cost:</td>
                <td className="py-4 px-4 text-display font-bold text-primary dark:text-inverse-primary text-right">{xaf(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add line item */}
      <div className="flex flex-wrap items-end gap-3 mb-xl bg-surface-container-lowest dark:bg-tertiary border border-outline-variant dark:border-outline rounded-xl p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-label-md text-on-surface-variant dark:text-outline-variant mb-1">Add line item</label>
          <input className="input w-full" placeholder="Description" value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} />
        </div>
        <input className="input w-24" type="number" placeholder="Qty" value={newRow.quantity} onChange={(e) => setNewRow({ ...newRow, quantity: e.target.value })} />
        <input className="input w-24" placeholder="Unit" value={newRow.unit} onChange={(e) => setNewRow({ ...newRow, unit: e.target.value })} />
        <input className="input w-28" type="number" placeholder="Cost" value={newRow.unitCost} onChange={(e) => setNewRow({ ...newRow, unitCost: e.target.value })} />
        <button onClick={addRow} className="btn-secondary px-4 py-2 rounded-lg text-label-md flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span> Add
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-lg bg-surface-container-low dark:bg-tertiary border border-outline-variant dark:border-outline rounded-xl">
        <span className="material-symbols-outlined text-outline">info</span>
        <p className="text-body-sm text-on-surface-variant dark:text-outline-variant max-w-2xl">
          <strong>Disclaimer:</strong> This Bill of Quantities is AI-generated based on preliminary architectural models for{' '}
          <strong>{selectedName ?? 'the selected project'}</strong>. Prices are estimates reflecting current market averages and do not
          constitute a binding quote. Always verify quantities and local material costs before final procurement.
        </p>
      </div>
    </div>
  );
}

function SectionRows({ section, updateRow, removeRow }: { section: BoqSection; updateRow: (id: string, patch: Partial<BoqRow>) => void; removeRow: (id: string) => void }) {
  return (
    <>
      <tr className="hover:bg-surface-container-lowest dark:hover:bg-tertiary transition-colors">
        <td className="py-4 px-4 text-body-sm font-semibold text-on-surface dark:text-on-surface bg-surface-container-lowest dark:bg-tertiary" colSpan={7}>{section.title}</td>
      </tr>
      {section.rows.map((r) => (
        <tr key={r.id} className="hover:bg-surface-container-high dark:hover:bg-tertiary-container transition-colors">
          <td className="py-3 px-4 text-on-surface-variant dark:text-outline-variant">{r.id}</td>
          <td className="py-3 px-4 text-body-sm">{r.description}</td>
          <td className="py-3 px-4 text-right">
            <input type="number" className="w-24 text-right bg-transparent border border-outline-variant dark:border-outline rounded px-1 py-0.5" value={r.quantity} onChange={(e) => updateRow(r.id, { quantity: parseFloat(e.target.value) || 0 })} />
          </td>
          <td className="py-3 px-4 text-on-surface-variant dark:text-outline-variant">{r.unit}</td>
          <td className="py-3 px-4 text-right">
            <input type="number" className="w-24 text-right bg-transparent border border-outline-variant dark:border-outline rounded px-1 py-0.5" value={r.unitCost} onChange={(e) => updateRow(r.id, { unitCost: parseFloat(e.target.value) || 0 })} />
          </td>
          <td className="py-3 px-4 text-right font-medium">{xaf(r.quantity * r.unitCost)}</td>
          <td className="py-3 px-2">
            <button onClick={() => removeRow(r.id)} className="text-on-surface-variant dark:text-outline-variant hover:text-error dark:hover:text-error-container" aria-label="Remove row">
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}
