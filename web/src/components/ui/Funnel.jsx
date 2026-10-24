import React from 'react';
import { ArrowDown } from 'lucide-react';

/**
 * Funnel — Conversion pipeline component (e.g. Admissions Funnel: Enquiries -> Applied -> Enrolled).
 */
export default function Funnel({
  stages = [], // [{ label: 'Enquiries', value: 140, href: '/enquiries' }, ...]
  onStageClick = null,
  className = ''
}) {
  const maxVal = Math.max(...stages.map(s => Number(s.value) || 0), 1);

  return (
    <div className={`flex flex-col gap-2.5 ${className}`}>
      {stages.map((stage, idx) => {
        const val = Number(stage.value) || 0;
        const widthPct = Math.max(25, (val / maxVal) * 100);
        const prevVal = idx > 0 ? Number(stages[idx - 1].value) || 0 : null;
        const convPct = prevVal ? Math.round((val / prevVal) * 100) : null;

        return (
          <div key={stage.label} className="flex flex-col">
            {convPct !== null && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted pl-4 py-0.5">
                <ArrowDown className="w-3 h-3 text-brand-500" />
                <span>{convPct}% conversion</span>
              </div>
            )}
            <div
              onClick={() => onStageClick && onStageClick(stage)}
              role={onStageClick ? 'button' : undefined}
              className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                onStageClick ? 'cursor-pointer hover:shadow-sm hover:scale-[1.01]' : ''
              }`}
              style={{
                width: `${widthPct}%`,
                background: `color-mix(in srgb, var(--brand-500) ${Math.max(12, 100 - idx * 25)}%, var(--surface))`,
                border: '1px solid var(--line)'
              }}
            >
              <span className="font-semibold text-xs text-ink truncate pr-2">
                {stage.label}
              </span>
              <span className="font-mono font-bold text-sm text-ink tabular-nums shrink-0">
                {val.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
