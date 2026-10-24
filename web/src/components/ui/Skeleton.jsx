import React from 'react';

/**
 * Skeleton — Low-bandwidth friendly placeholder that prevents layout shift.
 */
export default function Skeleton({
  variant = 'line',
  width = '100%',
  height = null,
  count = 1,
  className = ''
}) {
  const items = Array.from({ length: count });

  if (variant === 'stat-card') {
    return (
      <div className={`glass-card p-5 animate-pulse flex flex-col justify-between ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="h-3 w-20 bg-line rounded" />
          <div className="w-9 h-9 rounded-xl bg-line" />
        </div>
        <div className="h-8 w-32 bg-line rounded mb-2" />
        <div className="h-3 w-24 bg-line rounded" />
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <>
        {items.map((_, i) => (
          <tr key={i} className="animate-pulse border-b border-line">
            <td className="p-4"><div className="h-4 w-6 bg-line rounded" /></td>
            <td className="p-4"><div className="h-4 w-32 bg-line rounded" /></td>
            <td className="p-4"><div className="h-4 w-24 bg-line rounded" /></td>
            <td className="p-4"><div className="h-4 w-16 bg-line rounded" /></td>
            <td className="p-4"><div className="h-4 w-20 bg-line rounded" /></td>
          </tr>
        ))}
      </>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={`glass-card p-6 animate-pulse flex flex-col ${className}`}>
        <div className="h-4 w-32 bg-line rounded mb-2" />
        <div className="h-3 w-48 bg-line rounded mb-6" />
        <div className="h-56 w-full bg-line/60 rounded-xl" />
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div
        className={`rounded-full bg-line animate-pulse shrink-0 ${className}`}
        style={{ width: width || height || '40px', height: height || width || '40px' }}
      />
    );
  }

  // Default line/block
  return (
    <div className="space-y-2 w-full">
      {items.map((_, i) => (
        <div
          key={i}
          className={`bg-line rounded animate-pulse ${className}`}
          style={{ width, height: height || '1rem' }}
        />
      ))}
    </div>
  );
}
