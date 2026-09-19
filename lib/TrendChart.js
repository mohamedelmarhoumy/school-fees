'use client';

/**
 * رسم بياني بسيط بالأعمدة (Bar Chart) بدون أي مكتبة خارجية.
 * data: [{ label, value }]
 */
export default function TrendChart({ data, valueSuffix = '' }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const width = 320;
  const height = 140;
  const barGap = 10;
  const barWidth = (width - barGap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height + 24}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => {
        const barHeight = (d.value / max) * height;
        const x = i * (barWidth + barGap);
        const y = height - barHeight;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx={4}
              fill="var(--accent)"
              opacity={i === data.length - 1 ? 1 : 0.55}
            />
            <text x={x + barWidth / 2} y={height + 14} fontSize="10" textAnchor="middle" fill="var(--muted)">
              {d.label}
            </text>
            <text x={x + barWidth / 2} y={y - 4} fontSize="9.5" textAnchor="middle" fill="var(--text)">
              {d.value > 0 ? `${d.value}${valueSuffix}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
