import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyState — Displays a designed, friendly empty message when a list or chart has no rows.
 * Fulfills non-negotiable rule #1: never show a silent 0.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There is currently no data matching your criteria.',
  action = null,
  compact = false,
  className = ''
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center select-none ${
        compact ? 'py-6 px-4' : 'py-12 px-6'
      } ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-500 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 stroke-[1.75]" />
      </div>
      <h4 className="font-display font-bold text-base text-ink tracking-tight mb-1">
        {title}
      </h4>
      <p className="text-xs text-muted max-w-sm mb-4 leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
