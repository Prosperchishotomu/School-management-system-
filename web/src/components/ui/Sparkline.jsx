import React from 'react';

/**
 * Sparkline — Lightweight micro trend line rendered with SVG.
 */
export default function Sparkline({
  data = [],
  width = 96,
  height = 36,
  color = 'brand',
  strokeWidth = 2,
  className = ''
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Generate points
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - strokeWidth * 2) - strokeWidth;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const colorConfig = {
    brand:  { stroke: 'var(--brand-500)', fill: 'color-mix(in srgb, var(--brand-500) 15%, transparent)' },
    accent: { stroke: 'var(--accent)', fill: 'color-mix(in srgb, var(--accent) 15%, transparent)' },
    danger: { stroke: 'var(--danger)', fill: 'color-mix(in srgb, var(--danger) 15%, transparent)' },
    info:   { stroke: 'var(--info)', fill: 'color-mix(in srgb, var(--info) 15%, transparent)' },
  }[color] || { stroke: 'var(--brand-500)', fill: 'color-mix(in srgb, var(--brand-500) 15%, transparent)' };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible shrink-0 ${className}`}
      aria-hidden="true"
    >
      <path d={areaD} fill={colorConfig.fill} />
      <path
        d={pathD}
        fill="none"
        stroke={colorConfig.stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
