import React from 'react';

const SkeletonLoader = ({ type = 'table', rows = 5 }) => {
  if (type === 'table') {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-sage/20 rounded-xl w-full"></div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="flex space-x-4">
            <div className="h-6 bg-sage/15 rounded-lg flex-1"></div>
            <div className="h-6 bg-sage/15 rounded-lg flex-1"></div>
            <div className="h-6 bg-sage/15 rounded-lg flex-1"></div>
            <div className="h-6 bg-sage/15 rounded-lg w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-sage/20 rounded w-1/3"></div>
              <div className="w-8 h-8 bg-sage/20 rounded-lg"></div>
            </div>
            <div className="h-8 bg-sage/20 rounded w-1/2"></div>
            <div className="h-3 bg-sage/15 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 bg-sage/20 rounded w-1/4"></div>
      <div className="h-10 bg-sage/15 rounded-xl w-full"></div>
      <div className="h-10 bg-sage/15 rounded-xl w-5/6"></div>
    </div>
  );
};

export default SkeletonLoader;
