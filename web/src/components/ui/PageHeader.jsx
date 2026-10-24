import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * PageHeader — standard header component following the template in Section 3:
 * Title, subtitle, optional breadcrumb, primary actions.
 */
export default function PageHeader({
  title,
  subtitle = null,
  breadcrumbs = null,
  actions = null,
  className = ''
}) {
  return (
    <div className={`mb-6 pb-4 border-b border-line flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${className}`}>
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted mb-2">
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={idx}>
                {bc.href ? (
                  <Link to={bc.href} className="hover:text-ink transition-colors">
                    {bc.label}
                  </Link>
                ) : (
                  <span className="text-ink font-medium">{bc.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted/60 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-2xl md:text-3xl font-bold font-display text-ink tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
