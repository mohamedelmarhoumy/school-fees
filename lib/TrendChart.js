'use client';

/**
 * رسم بياني خطي منحني بتدرج لوني (Gradient Line/Area Chart) — بدون أي مكتبة خارجية.
 * data: [{ label, value }]
 */
export default function TrendChart({ data, valueSuffix = '' }) {
  const width = 320;
  const height = 130;
  const padTop = 22;
  const padBottom = 22;
  const chartHeight = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);

  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => ({
    x: data.length > 1 ? i * stepX : width / 2,
    y: padTop + chartHeight - (d.value / max) * chartHeight,
    label: d.label,
    value: d.value,
  }));

  const smoothPath = (pts) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const midX = (p0.x + p1.x) / 2;
      d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${height - padBottom} Z`;
  const gradId = 'trendGrad';
  const lineGradId = 'trendLineGrad';

  return (
    <svg viewBox={`0 0 ${width} ${height + 20}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={`url(#${lineGradId})`} strokeWidth="2.5" strokeLinecap="round" />

      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3} fill="#a855f7" stroke="var(--card-bg)" strokeWidth="1.5" />
          {p.value > 0 && (
            <text x={p.x} y={p.y - 9} fontSize="9.5" textAnchor="middle" fill="var(--text)">
              {p.value}{valueSuffix}
            </text>
          )}
          <text x={p.x} y={height + 12} fontSize="10" textAnchor="middle" fill="var(--muted)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
