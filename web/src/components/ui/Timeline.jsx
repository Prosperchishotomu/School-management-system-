import React from 'react';
import { relativeTime } from '../../utils/format';

/**
 * Timeline — Vertical history feed (Audit logs, Discipline merits vs infractions, Health visits).
 */
export default function Timeline({
  items = [], // [{ id, title, description, timestamp, icon, badge, type }]
  className = ''
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-line ${className}`}>
      {items.map((item) => {
        const typeColor = {
          positive: 'bg-brand-500 text-white',
          warning:  'bg-accent text-white',
          danger:   'bg-danger text-white',
          info:     'bg-info text-white'
        }[item.type] || 'bg-brand-700 text-white';

        return (
          <div key={item.id} className="relative group">
            {/* Timeline dot */}
            <div
              className={`absolute -left-6 top-1 w-5 h-5 rounded-full flex items-center justify-center ring-4 ring-surface text-[10px] ${typeColor}`}
            >
              {item.icon ? item.icon : <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold text-xs md:text-sm text-ink font-display">
                  {item.title}
                </span>
                <span className="text-[11px] text-muted font-mono tabular-nums">
                  {relativeTime(item.timestamp)}
                </span>
              </div>

              {item.description && (
                <p className="text-xs text-muted leading-relaxed">
                  {item.description}
                </p>
              )}

              {item.badge && (
                <div className="mt-1">
                  {item.badge}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
