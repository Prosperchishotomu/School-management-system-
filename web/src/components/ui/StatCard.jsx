import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Animated count-up hook (respects prefers-reduced-motion)
 */
function useCountUp(targetValue, duration = 800) {
  const [current, setCurrent] = useState(typeof targetValue === 'number' ? 0 : targetValue);

  useEffect(() => {
    if (typeof targetValue !== 'number' || isNaN(targetValue)) {
      setCurrent(targetValue);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(targetValue);
      return;
    }

    let start = 0;
    const end = targetValue;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const factor = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const val = Math.round(start + (end - start) * factor);
      setCurrent(val);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setCurrent(end);
      }
    }

    requestAnimationFrame(step);
  }, [targetValue, duration]);

  return current;
}

export default function StatCard({
  // Header / Title aliases to ensure cards ALWAYS display a clear header
  title = null,
  label = null,
  header = null,
  heading = null,
  name = null,

  // Metric value & display
  value = undefined,
  amount = undefined,
  currency = null,
  displayValue = null,
  prefix = '',
  suffix = '',

  // Icon & color aliases
  icon: Icon = null,
  iconColor = 'brand',
  color = null,
  variant = null,
  warning = false,

  // Trend / delta
  delta = null,
  deltaText = '',
  trendText = '',
  sparkline = null,

  // Sublabel / description aliases
  sublabel = null,
  subtext = null,
  subtitle = null,
  desc = null,
  description = null,

  // Importance & Sizing hierarchy ('primary' | 'hero' | 'normal' | 'compact' | 'secondary' | 'alert' | 'critical')
  importance = 'normal',
  size = null,
  featured = false,
  badge = null,

  // Navigation & interactions
  to = null,
  onClick = null,
  className = ''
}) {
  const navigate = useNavigate();

  // Resolve metric value from either value or amount
  const rawValue = value !== undefined ? value : amount;
  const animatedNumber = useCountUp(typeof rawValue === 'number' ? rawValue : null);

  // Normalize prop aliases so cards NEVER miss headers or descriptions
  const cardTitle = title || label || header || heading || name || 'Metric';
  const cardSubtext = sublabel || subtext || subtitle || desc || description || '';
  const cardIconColor = color || iconColor || variant || (warning ? 'danger' : 'brand');
  const cardDeltaText = deltaText || trendText || '';

  // Determine visual hierarchy level
  const isAlert = warning || importance === 'alert' || importance === 'critical' || cardIconColor === 'danger' || cardIconColor === 'red';
  const isPrimary = !isAlert && (importance === 'primary' || importance === 'hero' || featured || size === 'lg');
  const isCompact = !isAlert && !isPrimary && (importance === 'compact' || importance === 'secondary' || size === 'sm');

  const handleClick = () => {
    if (to) navigate(to);
    else if (onClick) onClick();
  };

  const isClickable = Boolean(to || onClick);

  // Distinct color schemes: Prominent, vibrant theme color for the data (value),
  // paired with clean, readable neutral secondary tone for the description (subtext)
  const themeMap = {
    brand: {
      icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 ring-1 ring-emerald-500/25',
      value: 'text-emerald-700 dark:text-emerald-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-emerald-500/25 bg-surface hover:border-emerald-500/40',
      badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    },
    info: {
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 ring-1 ring-blue-500/25',
      value: 'text-blue-700 dark:text-blue-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-blue-500/25 bg-surface hover:border-blue-500/40',
      badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    },
    blue: {
      icon: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 ring-1 ring-blue-500/25',
      value: 'text-blue-700 dark:text-blue-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-blue-500/25 bg-surface hover:border-blue-500/40',
      badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
    },
    violet: {
      icon: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 ring-1 ring-purple-500/25',
      value: 'text-purple-700 dark:text-purple-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-purple-500/25 bg-surface hover:border-purple-500/40',
      badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
    },
    purple: {
      icon: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 ring-1 ring-purple-500/25',
      value: 'text-purple-700 dark:text-purple-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-purple-500/25 bg-surface hover:border-purple-500/40',
      badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
    },
    accent: {
      icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-1 ring-amber-500/25',
      value: 'text-amber-700 dark:text-amber-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-amber-500/25 bg-surface hover:border-amber-500/40',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 ring-1 ring-amber-500/25',
      value: 'text-amber-700 dark:text-amber-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-amber-500/25 bg-surface hover:border-amber-500/40',
      badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    },
    danger: {
      icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-1 ring-rose-500/25',
      value: 'text-rose-700 dark:text-rose-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-rose-500/25 bg-surface hover:border-rose-500/40',
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    },
    red: {
      icon: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 ring-1 ring-rose-500/25',
      value: 'text-rose-700 dark:text-rose-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-rose-500/25 bg-surface hover:border-rose-500/40',
      badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
    },
    teal: {
      icon: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 ring-1 ring-teal-500/25',
      value: 'text-teal-700 dark:text-teal-400',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-teal-500/25 bg-surface hover:border-teal-500/40',
      badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
    },
    neutral: {
      icon: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-white/60 ring-1 ring-slate-200 dark:ring-white/10',
      value: 'text-slate-900 dark:text-slate-100',
      subtext: 'text-slate-500 dark:text-slate-400',
      container: 'border-slate-200 dark:border-slate-800 bg-surface',
      badge: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  };

  const currentTheme = themeMap[cardIconColor] || themeMap.brand;

  // Format currency prefix if currency prop is supplied
  const resolvedPrefix = prefix || (currency ? (currency === 'USD' ? '$' : `${currency} `) : '');

  const renderedValue = displayValue !== null
    ? displayValue
    : typeof rawValue === 'number'
      ? `${resolvedPrefix}${animatedNumber.toLocaleString()}${suffix}`
      : `${resolvedPrefix}${rawValue ?? '-'}${suffix}`;

  // Compact, sleek card container sizing
  const containerClasses = `${currentTheme.container} p-2.5 sm:p-3 min-h-[66px] sm:min-h-[72px] rounded-xl border shadow-2xs`;

  // Value typography scaled to compact, crisp, readable proportions
  const valueTypography = `text-xl sm:text-2xl font-black font-display ${currentTheme.value} tracking-tight tabular-nums leading-none`;

  // Icon container sizes - compact, balanced
  const iconBoxClasses = 'w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg';

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } } : undefined}
      className={`glass-card flex flex-col justify-between transition-all select-none w-full min-w-0 ${containerClasses} ${
        isClickable ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xs hover:border-brand-500/50' : ''
      } ${className}`}
    >
      {/* Header Row: Displays label, icon, and optional badge */}
      <div className="flex items-center justify-between gap-1.5 mb-1 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 tracking-tight truncate block"
              title={cardTitle}
            >
              {cardTitle}
            </span>

            {badge && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-accent/20 text-accent font-mono uppercase tracking-wider">
                {badge}
              </span>
            )}

            {isPrimary && !badge && (
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${currentTheme.badge} uppercase tracking-wider`}>
                Key KPI
              </span>
            )}

            {isAlert && !badge && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                Alert
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={`${iconBoxClasses} flex items-center justify-center shrink-0 ${currentTheme.icon} transition-transform`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>

      {/* Metric Value & Sublabel / Trend Details */}
      <div className="flex items-baseline justify-between gap-2 min-w-0 mt-auto pt-0.5">
        <div className="min-w-0 flex-1">
          <div className={valueTypography}>
            {renderedValue}
          </div>

          {(delta !== null || cardDeltaText || cardSubtext) && (
            <div className="flex items-center gap-1.5 mt-0.5 text-xs flex-wrap">
              {delta !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    delta > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : delta < 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-neutral-100 text-muted dark:bg-neutral-800'
                  }`}
                >
                  {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                  {Math.abs(delta)}%
                </span>
              )}

              {(cardDeltaText || cardSubtext) && (
                <span className={`text-[10px] sm:text-[11px] truncate max-w-full font-sans font-medium ${currentTheme.subtext}`}>
                  {cardDeltaText || cardSubtext}
                </span>
              )}
            </div>
          )}
        </div>

        {sparkline && (
          <div className="w-14 sm:w-16 h-6 shrink-0">
            {sparkline}
          </div>
        )}
      </div>
    </div>
  );
}
