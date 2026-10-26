import React from 'react';

/**
 * KpiStrip — Adaptive Responsive Container for KPI cards with dynamic importance hierarchy.
 * Ensures the primary/hero metric takes a dominant visual footprint, while supporting metrics
 * are proportionally sized according to importance across mobile, tablet, desktop, and ultrawide.
 */
export default function KpiStrip({
  children,
  columns = null,
  asymmetrical = true,
  className = ''
}) {
  const childArray = React.Children.toArray(children).filter(Boolean);
  const count = childArray.length;

  if (count === 0) return null;

  // If caller explicitly requested asymmetrical={false} and passed custom columns, honor legacy uniform grid
  if (!asymmetrical && columns) {
    return (
      <div className={`grid gap-3.5 sm:gap-4 mb-6 ${columns} ${className}`}>
        {childArray.map((child, idx) => {
          if (!React.isValidElement(child)) return child;
          const isFirst = idx === 0;
          return React.cloneElement(child, {
            importance: child.props.importance || (isFirst ? 'primary' : 'normal'),
            className: `${child.props.className || ''}`
          });
        })}
      </div>
    );
  }

  // Helper to determine importance tier for a card
  const getChildImportance = (child, fallback) => {
    if (!React.isValidElement(child)) return fallback;
    if (child.props.importance) return child.props.importance;
    if (
      child.props.warning ||
      child.props.color === 'danger' ||
      child.props.color === 'red' ||
      child.props.iconColor === 'danger' ||
      child.props.iconColor === 'red'
    ) {
      return 'alert';
    }
    return fallback;
  };

  // Clean, professional, balanced responsive grid layouts
  // 1 card
  if (count === 1) {
    return (
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 mb-4 sm:mb-5 ${className}`}>
        {React.cloneElement(childArray[0], {
          importance: childArray[0].props.importance || 'normal'
        })}
      </div>
    );
  }

  // 2 cards: 50% / 50%
  if (count === 2) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-6 ${className}`}>
        {childArray.map((child, idx) => (
          <div key={idx} className="min-w-0">
            {React.cloneElement(child, {
              importance: child.props.importance || 'normal'
            })}
          </div>
        ))}
      </div>
    );
  }

  // 3 cards: 1/3 each
  if (count === 3) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-6 ${className}`}>
        {childArray.map((child, idx) => (
          <div key={idx} className="min-w-0">
            {React.cloneElement(child, {
              importance: child.props.importance || 'normal'
            })}
          </div>
        ))}
      </div>
    );
  }

  // 4 cards (Standard across all admin modules: Students, Staff, Timetable, Tasks, etc.)
  if (count === 4) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-6 ${className}`}>
        {childArray.map((child, idx) => (
          <div key={idx} className="min-w-0">
            {React.cloneElement(child, {
              importance: child.props.importance || 'normal'
            })}
          </div>
        ))}
      </div>
    );
  }

  // 5 cards
  if (count === 5) {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 mb-6 ${className}`}>
        {childArray.map((child, idx) => (
          <div key={idx} className="min-w-0">
            {React.cloneElement(child, {
              importance: child.props.importance || 'normal'
            })}
          </div>
        ))}
      </div>
    );
  }

  // 6 or more cards
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-5 mb-6 ${className}`}>
      {childArray.map((child, idx) => (
        <div key={idx} className="min-w-0">
          {React.cloneElement(child, {
            importance: child.props.importance || 'normal'
          })}
        </div>
      ))}
    </div>
  );
}
