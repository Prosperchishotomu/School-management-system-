import React from 'react';

/**
 * ProgressRing — SVG circular progress ring for rates (attendance, pass rate, collection rate).
 * Meaningful visual carrying clear percentage without decorative noise.
 */
export default function ProgressRing({
  value = 0,
  size = 80,
  strokeWidth = 8,
  color = 'brand',
  label = null,
  sublabel = null,
  showPercentage = true,
  className = ''
}) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const colorStyles = {
    brand:  'text-brand-500 dark:text-brand-400',
    accent: 'text-accent dark:text-amber-400',
    danger: 'text-danger dark:text-red-400',
    info:   'text-info dark:text-blue-400',
    violet: 'text-violet-500 dark:text-violet-400'
  }[color] || 'text-brand-500';

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 origin-center"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-line dark:opacity-30"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`transition-all duration-700 ease-out ${colorStyles}`}
          />
        </svg>

        {showPercentage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display font-extrabold text-sm md:text-base text-ink tabular-nums leading-none">
              {Math.round(clamped)}%
            </span>
            {sublabel && (
              <span className="text-[10px] text-muted leading-tight mt-0.5">
                {sublabel}
              </span>
            )}
          </div>
        )}
      </div>

      {label && (
        <span className="mt-2 text-xs font-semibold text-muted text-center tracking-tight">
          {label}
        </span>
      )}
    </div>
  );
}
