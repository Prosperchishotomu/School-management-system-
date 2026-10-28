import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Enterprise SaaS Button Component
 * Standardized across all portals with optimal touch targets,
 * high-contrast colorways, micro-interactions, and accessible states.
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'accent' | 'warning' | 'info' | 'outline' | 'ghost'
  size = 'md',        // 'xs' | 'sm' | 'md' | 'lg'
  icon: Icon,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...rest
}) {
  const variantClass = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    accent: 'btn-accent',
    warning: 'btn-warning',
    info: 'btn-info',
    outline: 'btn-outline',
    ghost: 'btn-ghost'
  }[variant] || 'btn-primary';

  const sizeClass = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg'
  }[size] || 'btn-md';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
      ) : null}

      {children && <span>{children}</span>}

      {!loading && IconRight ? (
        <IconRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </button>
  );
}
