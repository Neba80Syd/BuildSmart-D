// Lightweight, dependency-free SVG charts for analytics/reporting.
export function BarChart({
  data,
  height = 200,
  format = (n: number) => String(n),
}: {
  data: { label: string; value: number }[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 100;
        return (
          <g key={d.label}>
            <rect
              x={i * w + w * 0.2}
              y={100 - h}
              width={w * 0.6}
              height={h}
              rx={0.8}
              className="fill-[#315C4C] dark:fill-[#a2d0bc]"
            />
            <title>{`${d.label}: ${format(d.value)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  data,
  height = 200,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => ({
    x: (i / Math.max(1, data.length - 1)) * 100,
    y: 100 - (d.value / max) * 100,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} fill="none" stroke="#315C4C" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`${path} L100,100 L0,100 Z`} fill="rgba(49,92,76,0.08)" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="#315C4C">
          <title>{`${data[i].label}: ${data[i].value}`}</title>
        </circle>
      ))}
    </svg>
  );
}
