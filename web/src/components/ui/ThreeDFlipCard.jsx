import React, { useState } from 'react';
import { RotateCw } from 'lucide-react';

/**
 * ThreeDFlipCard provides a 3D isometric card that smoothly flips 180 degrees
 * on user interaction to reveal detailed analytics on the back.
 */
export const ThreeDFlipCard = ({
  frontContent,
  backContent,
  className = '',
  minHeight = '180px',
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className={`flip-card-container cursor-pointer select-none group ${isFlipped ? 'is-flipped' : ''} ${className}`}
      style={{ minHeight }}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div className="flip-card-inner">
        {/* Front Face */}
        <div className="flip-card-front glass-card p-5 flex flex-col justify-between shadow-md border border-line-border/40 hover:border-teal-primary/40 transition-colors">
          {frontContent}
          <div className="flex items-center justify-between pt-2 border-t border-line-border/30 text-[10px] text-ink/40 group-hover:text-teal-primary font-semibold">
            <span>Tap card to flip</span>
            <RotateCw className="w-3 h-3 transition-transform duration-500 group-hover:rotate-180" />
          </div>
        </div>

        {/* Back Face */}
        <div className="flip-card-back glass-panel p-5 flex flex-col justify-between shadow-xl border border-teal-primary/30 bg-surface/95 backdrop-blur-md">
          {backContent}
          <div className="flex items-center justify-between pt-2 border-t border-line-border/30 text-[10px] text-teal-primary font-semibold">
            <span>Tap card to return</span>
            <RotateCw className="w-3 h-3 rotate-180 transition-transform duration-500 group-hover:rotate-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeDFlipCard;
