import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

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
  padding = 'p-5 sm:p-6',
  importance = 'normal', // 'primary' | 'featured' | 'normal' | 'compact'
  to = null,
  onClick = null,
  className = ''
}) {
  const navigate = useNavigate();
  const cardTitle = title || header || heading || label;
  const cardSubtitle = subtitle || subtext || desc || description;
  const isPrimary = importance === 'primary' || importance === 'featured';
  const isClickable = Boolean(to || onClick);

  const handleClick = (e) => {
    // If the click happened on a button, link, or input, do not trigger card navigation
    if (e.target.closest('button, a, input, select, textarea, [role="button"]')) {
      return;
    }
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  const borderClasses = isPrimary
    ? 'border border-teal-primary/30 shadow-xs ring-1 ring-teal-primary/10 rounded-2xl bg-white dark:bg-surface'
    : 'border border-line-border/30 shadow-xs rounded-2xl bg-white dark:bg-surface';

  const headerBg = isPrimary
    ? 'bg-gradient-to-r from-teal-primary/5 via-surface to-surface'
    : 'bg-surface/50';

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`glass-card overflow-hidden flex flex-col w-full min-w-0 ${borderClasses} ${
        isClickable ? 'cursor-pointer hover:border-teal-primary/40 hover:shadow-md transition-all group' : ''
      } ${className}`}
    >
      {(cardTitle || cardSubtitle || action) && (
        <div className={`px-5 py-3.5 sm:px-6 sm:py-4 border-b border-line-border/20 flex items-center justify-between gap-3 flex-wrap ${headerBg}`}>
          <div className="min-w-0 flex-1">
            {cardTitle && (
              <h3 className={`font-display font-bold text-ink tracking-tight truncate ${
                isPrimary ? 'text-sm sm:text-base text-teal-dark dark:text-teal-primary' : 'text-xs sm:text-sm'
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
          {action ? (
            <div className="shrink-0 flex items-center gap-1.5">
              {action}
            </div>
          ) : to ? (
            <div className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
              <span>Drill down</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          ) : null}
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
