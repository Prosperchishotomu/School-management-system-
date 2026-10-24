import React from 'react';

/**
 * Card — Flexible, responsive container for dashboards, tables, and visual sections.
 * Automatically adapts headers, padding, and borders according to importance and screen size.
 */
export default function Card({
  title = null,
  header = null,
  heading = null,
  label = null,

  subtitle = null,
  subtext = null,
  desc = null,
  description = null,

  action = null,
  children,
  footer = null,
  padding = 'p-3.5 sm:p-4.5',
  importance = 'normal', // 'primary' | 'featured' | 'normal' | 'compact'
  className = ''
}) {
  const cardTitle = title || header || heading || label;
  const cardSubtitle = subtitle || subtext || desc || description;
  const isPrimary = importance === 'primary' || importance === 'featured';

  const borderClasses = isPrimary
    ? 'border border-brand-500/35 shadow-xs ring-1 ring-brand-500/10 rounded-xl'
    : 'border border-line shadow-2xs rounded-xl';

  const headerBg = isPrimary
    ? 'bg-gradient-to-r from-brand-50/40 via-surface to-surface dark:from-brand-950/30 dark:via-surface'
    : 'bg-surface/50';

  return (
    <div className={`glass-card overflow-hidden flex flex-col w-full min-w-0 ${borderClasses} ${className}`}>
      {(cardTitle || cardSubtitle || action) && (
        <div className={`px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-line flex items-center justify-between gap-2.5 sm:gap-3 flex-wrap ${headerBg}`}>
          <div className="min-w-0 flex-1">
            {cardTitle && (
              <h3 className={`font-display font-bold text-ink tracking-tight truncate ${
                isPrimary ? 'text-sm sm:text-base text-brand-950 dark:text-brand-100' : 'text-xs sm:text-sm'
              }`}>
                {cardTitle}
              </h3>
            )}
            {cardSubtitle && (
              <p className="text-[11px] sm:text-xs text-muted mt-0.5 truncate leading-normal">
                {cardSubtitle}
              </p>
            )}
          </div>
          {action && (
            <div className="shrink-0 flex items-center gap-1.5">
              {action}
            </div>
          )}
        </div>
      )}

      <div className={`flex-1 min-w-0 overflow-hidden ${padding}`}>
        {children}
      </div>

      {footer && (
        <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 border-t border-line bg-canvas/30 dark:bg-canvas/15">
          {footer}
        </div>
      )}
    </div>
  );
}
