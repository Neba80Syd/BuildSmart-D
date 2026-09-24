'use client';

// Lightweight, dependency-free SVG charts (Stitch-style green palette).
// Used across the vendor dashboard for sales trends, traffic and stock.

const GREEN = '#2F6B50';
const GRID = '#E4E9E7';
const TEXT = '#5c6f68';

export function linePath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

export function areaPath(points: { x: number; y: number }[], baseline: number): string {
  if (points.length < 2) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${last.x.toFixed(1)},${baseline} L${first.x.toFixed(1)},${baseline} Z`;
}

function scale(points: number[], width: number, height: number, pad = 6) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = width / Math.max(points.length - 1, 1);
  return points.map((v, i) => ({
    x: i * step,
    y: pad + (height - pad * 2) * (1 - (v - min) / range),
  }));
}

export function SalesChart({ series, height = 180, showArea = true }: { series: { day: string; revenue: number }[]; height?: number; showArea?: boolean }) {
  const width = 640;
  const values = series.map((s) => s.revenue);
  const pts = scale(values, width, height);
  const labels = series.filter((_, i) => i % 5 === 0 || i === series.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Sales trend">
      {/* horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={GRID} strokeWidth={1} />
      ))}
      {showArea && <path d={areaPath(pts, height)} fill={GREEN} opacity={0.08} />}
      <path d={linePath(pts)} fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill={GREEN} />
      ))}
      {/* x labels */}
      {labels.map((l, i) => {
        const idx = series.indexOf(l);
        const p = pts[idx];
        return (
          <text key={i} x={p.x} y={height - 2} fontSize={9} fill={TEXT} textAnchor="middle">
            {l.day.slice(5)}
          </text>
        );
      })}
    </svg>
  );
}

export function BarChart({ data, height = 200, color = GREEN, labelKey = 'label', valueKey = 'value' }: { data: Record<string, any>[]; height?: number; color?: string; labelKey?: string; valueKey?: string }) {
  const width = 640;
  const values = data.map((d) => d[valueKey] as number);
  const max = Math.max(...values, 1);
  const barW = width / Math.max(data.length, 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Bar chart">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={GRID} strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const h = (d[valueKey] / max) * (height - 26);
        const x = i * barW + barW * 0.18;
        return (
          <g key={i}>
            <rect x={x} y={height - 20 - h} width={barW * 0.64} height={h} rx={3} fill={color} opacity={0.9} />
            <text x={x + barW * 0.32} y={height - 5} fontSize={9} fill={TEXT} textAnchor="middle">
              {String(d[labelKey]).slice(0, 11)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = ['#2F6B50', '#A66A00', '#ba1a1a', '#8bb8a4'];

type DonutSegment = { label: string; value: number };
type DonutArc = DonutSegment & { d: string };

function buildDonutArcs(segments: DonutSegment[], total: number, size: number): DonutArc[] {
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  return segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const start = (acc / total) * Math.PI * 2;
      const end = ((acc + s.value) / total) * Math.PI * 2;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.sin(start);
      const y1 = cy - r * Math.cos(start);
      const x2 = cx + r * Math.sin(end);
      const y2 = cy - r * Math.cos(end);
      const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
      acc += s.value;
      return { ...s, d };
    });
}

export function DonutChart({ segments, size = 132 }: { segments: DonutSegment[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;
  const arcs = buildDonutArcs(segments, total, size);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Stock distribution">
      {arcs.map((a, i) => (
        <path key={i} d={a.d} fill={DONUT_COLORS[i % DONUT_COLORS.length]} stroke="#fff" strokeWidth={1.5} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.58} fill="#fff" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight={700} fill="#17201e">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={9} fill={TEXT}>
        products
      </text>
    </svg>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
    PROCESSING: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
    SHIPPED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
    DELIVERED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
    CANCELLED: 'bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-error/20 dark:text-red-300',
    REQUESTED: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
    APPROVED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
    REJECTED: 'bg-[#ba1a1a]/10 text-[#ba1a1a] dark:bg-error/20 dark:text-red-300',
    REFUNDED: 'bg-surface-variant text-on-surface-variant dark:bg-surface-variant dark:text-on-surface-variant',
    OPEN: 'bg-[#A66A00]/10 text-[#A66A00] dark:bg-[#FFB951]/20 dark:text-[#FFB951]',
    RESOLVED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
    COMPLETED: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
    ACTIVE: 'bg-[#2F6B50]/10 text-[#2F6B50] dark:bg-primary-container dark:text-on-primary-container',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${map[status] ?? 'bg-surface-variant text-on-surface-variant'}`}>
      {status}
    </span>
  );
}
