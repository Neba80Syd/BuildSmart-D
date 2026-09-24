'use client';

type ExportRow = { id: string; description: string; quantity: number; unit: string; unitCost: number };

export function ExportButtons({
  rows,
  subtotal,
  contingency,
  total,
}: {
  rows: ExportRow[];
  subtotal: number;
  contingency: number;
  total: number;
}) {
  const downloadCSV = () => {
    const header = ['Item', 'Description', 'Quantity', 'Unit', 'Unit Cost (XAF)', 'Total (XAF)'];
    const lines = rows.map((r) => [r.id, `"${r.description}"`, r.quantity, r.unit, r.unitCost.toFixed(2), (r.quantity * r.unitCost).toFixed(2)]);
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
    a.download = 'boq-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-sm">
      <button
        onClick={downloadCSV}
        className="px-4 py-2 border border-outline-variant dark:border-outline rounded-lg text-label-md text-on-surface dark:text-on-surface hover:bg-surface-container-high dark:hover:bg-tertiary-container transition-colors flex items-center gap-2"
      >
        <span className="material-symbols-outlined text-sm">download</span> CSV
      </button>
      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-primary text-on-primary dark:bg-inverse-primary dark:text-on-primary-container rounded-lg text-label-md hover:bg-primary-container dark:hover:bg-primary-fixed transition-colors flex items-center gap-2 shadow-elevation"
      >
        <span className="material-symbols-outlined text-sm">picture_as_pdf</span> Export PDF
      </button>
    </div>
  );
}
