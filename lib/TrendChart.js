'use client';

import { useState } from 'react';

/**
 * رسم بياني خطي منحني بتدرج لوني (Gradient Line/Area Chart) — بدون أي مكتبة خارجية.
 * data: [{ label, value }] — label المفروض يكون اسم الشهر كامل.
 * القيمة الكاملة بتظهر في تولتيب لما تدوس/تمرر على النقطة، مش ظاهرة دايماً فوقها،
 * عشان الرسم يفضل نضيف ومفيش أرقام بتتلخبط فوق بعض.
 */
export default function TrendChart({ data, valueSuffix = ' ج.م' }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const width = 340;
  const height = 130;
  const padTop = 36;
  const padBottom = 30;
  const sidePad = 14;
  const chartHeight = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);

  const usableWidth = width - sidePad * 2;
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;
  const points = data.map((d, i) => ({
    x: data.length > 1 ? sidePad + i * stepX : width / 2,
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

  const clampX = (x, halfW) => Math.max(halfW, Math.min(width - halfW, x));

  return (
    <svg viewBox={`0 0 ${width} ${height + 22}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
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

      {points.map((p, i) => {
        const tooltipCx = clampX(p.x, 32);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={i === points.length - 1 ? 4.5 : 3} fill="#a855f7" stroke="var(--card-bg)" strokeWidth="1.5" />
            {/* دائرة أكبر شفافة لتسهيل اللمس على الموبايل */}
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            />
            {activeIndex === i && (
              <g style={{ pointerEvents: 'none' }}>
                <rect x={tooltipCx - 32} y={Math.max(0, p.y - 30)} width={64} height={20} rx={7} fill="var(--text)" opacity="0.92" />
                <text x={tooltipCx} y={Math.max(0, p.y - 30) + 14} fontSize="10.5" fontWeight="700" textAnchor="middle" fill="var(--card-bg)">
                  {p.value.toLocaleString('ar-EG')}{valueSuffix}
                </text>
              </g>
            )}
            <text x={p.x} y={height + 16} fontSize="10.5" textAnchor="middle" fill="var(--muted)">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
