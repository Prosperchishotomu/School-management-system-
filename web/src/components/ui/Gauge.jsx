import React from 'react';

/**
 * Gauge — Semi-circular meter for Target vs Actual, Student License Limit, Capacity.
 */
export default function Gauge({
  value = 0,
  target = 100,
  min = 0,
  max = 100,
  size = 180,
  label = null,
  formatValue = (v) => `${v}%`,
  formatTarget = (t) => `Target: ${t}%`,
  className = ''
}) {
  const effectiveMax = max || 100;
  const pct = Math.min(100, Math.max(0, ((value - min) / (effectiveMax - min)) * 100));
  const targetPct = target ? Math.min(100, Math.max(0, ((target - min) / (effectiveMax - min)) * 100)) : null;

  // Arc geometry: 180 degree semi-circle
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half circle length
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  // Color logic
  const isTargetMet = target ? value >= target : pct >= 80;
  const colorClass = isTargetMet
    ? 'text-brand-500'
    : pct >= 50
      ? 'text-accent'
      : 'text-danger';

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <div className="relative flex items-center justify-center" style={{ width: size, height: size / 2 + 10 }}>
        <svg
          width={size}
          height={size / 2 + 10}
          viewBox={`0 0 ${size} ${size / 2 + 10}`}
          className="overflow-visible"
        >
          {/* Base track (semi-circle from left to right) */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-line dark:opacity-30"
          />

          {/* Progress fill */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-700 ease-out ${colorClass}`}
          />

          {/* Target marker line if target is defined */}
          {targetPct !== null && (
            <g transform={`rotate(${(targetPct / 100) * 180 - 180} ${size / 2} ${size / 2})`}>
              <line
                x1={size / 2 - radius - strokeWidth / 2 - 2}
                y1={size / 2}
                x2={size / 2 - radius + strokeWidth / 2 + 2}
                y2={size / 2}
                stroke="currentColor"
                strokeWidth={3}
                className="text-ink dark:text-white"
              />
            </g>
          )}
        </svg>

        {/* Center reading */}
        <div className="absolute bottom-0 inset-x-0 flex flex-col items-center justify-center">
          <span className="font-display font-extrabold text-2xl text-ink tabular-nums leading-none">
            {formatValue(value)}
          </span>
          {target && (
            <span className="text-[11px] text-muted font-medium mt-1">
              {formatTarget(target)}
            </span>
          )}
        </div>
      </div>

      {label && (
        <span className="mt-3 text-xs font-semibold text-muted text-center tracking-tight">
          {label}
        </span>
      )}
    </div>
  );
}
