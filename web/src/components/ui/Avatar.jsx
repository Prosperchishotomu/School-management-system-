import React, { useState } from 'react';

const PALETTES = [
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300',
  'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
];

function getHash(str) {
  let hash = 0;
  if (!str) return 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name = '',
  src = null,
  size = 'md',
  id = null,
  className = ''
}) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm font-semibold',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold'
  }[size] || 'w-10 h-10 text-sm';

  const hashKey = id ? String(id) : name;
  const colorIndex = getHash(hashKey) % PALETTES.length;
  const colorClass = PALETTES[colorIndex];
  const initials = getInitials(name);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 border border-line ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name || 'User avatar'}
      className={`rounded-full flex items-center justify-center shrink-0 border border-line select-none font-display ${colorClass} ${sizeClasses} ${className}`}
    >
      {initials}
    </div>
  );
}
