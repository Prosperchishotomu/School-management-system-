import React from 'react';

/**
 * ThreeDBarChart renders rich isometric 3D bars with volumetric lighting,
 * faceted side depth, specular top caps, and responsive tooltips.
 */
export const ThreeDBarChart = ({
  data = [],
  title = '',
  subtitle = '',
  height = 240,
  barWidth = 44,
  maxVal = null,
  currency = false,
}) => {
  if (!data || data.length === 0) return null;

  const highest = maxVal || Math.max(...data.map(d => Number(d.value) || 0), 1);

  return (
    <div className="w-full flex flex-col">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-bold text-ink uppercase tracking-wider">{title}</h3>}
          {subtitle && <p className="text-xs text-ink/60 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div 
        className="w-full flex items-end justify-around pt-6 pb-2 px-2 relative" 
        style={{ height: `${height}px`, minHeight: '180px' }}
      >
        {/* Subtle Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-15">
          <div className="border-b border-line-border w-full" />
          <div className="border-b border-line-border w-full" />
          <div className="border-b border-line-border w-full" />
          <div className="border-b border-line-border w-full" />
        </div>

        {data.map((item, idx) => {
          const val = Number(item.value) || 0;
          const pct = Math.max(8, Math.min(100, Math.round((val / highest) * 100)));
          const baseColor = item.color || '#6366F1';
          const topColor = item.topColor || '#A5B4FC';
          const sideColor = item.sideColor || '#4338CA';

          return (
            <div
              key={idx}
              className="group relative flex flex-col items-center justify-end h-full flex-1 max-w-[90px] cursor-pointer"
            >
              {/* Floating Value Pill */}
              <div className="absolute -top-3 transform -translate-y-full opacity-90 group-hover:opacity-100 group-hover:-translate-y-full transition-all duration-200 z-20 pointer-events-none">
                <span className="px-2 py-1 rounded-md text-[10px] font-bold font-mono tracking-tight bg-slate-900/90 text-white shadow-lg border border-white/10 whitespace-nowrap">
                  {currency ? `$${val.toLocaleString()}` : val.toLocaleString()}
                  {item.suffix ? item.suffix : ''}
                </span>
              </div>

              {/* 3D Isometric Bar Column */}
              <div 
                className="relative w-full flex justify-center items-end"
                style={{ height: `${pct}%`, transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              >
                <div 
                  className="relative transition-transform duration-300 group-hover:scale-105"
                  style={{ width: `${barWidth}px`, height: '100%' }}
                >
                  {/* Top 3D Diamond Cap */}
                  <div
                    className="absolute -top-2 left-0 right-0 h-4 z-10"
                    style={{
                      backgroundColor: topColor,
                      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                      filter: 'brightness(1.15)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  />

                  {/* Left Facet (Light Source Front) */}
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1/2 z-0 animate-bar-3d"
                    style={{
                      background: `linear-gradient(to right, ${baseColor}, ${topColor}77)`,
                      borderTopLeftRadius: '2px',
                    }}
                  />

                  {/* Right Facet (Shadow Depth Side) */}
                  <div
                    className="absolute top-0 bottom-0 right-0 w-1/2 z-0 animate-bar-3d"
                    style={{
                      background: `linear-gradient(to right, ${sideColor}, ${sideColor}dd)`,
                      borderTopRightRadius: '2px',
                    }}
                  />

                  {/* Specular Glare Reflection */}
                  <div 
                    className="absolute inset-y-0 left-1 w-1 bg-white/30 rounded-full opacity-60 pointer-events-none" 
                  />
                </div>
              </div>

              {/* Label & Details */}
              <div className="mt-3 text-center w-full">
                <p className="text-[11px] font-bold text-ink font-sans truncate" title={item.label}>
                  {item.label}
                </p>
                {item.sublabel && (
                  <p className="text-[9px] text-ink/50 uppercase tracking-wider font-semibold">
                    {item.sublabel}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThreeDBarChart;
