import React from 'react';

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-3 md:p-4">
      {/* Page title skeleton */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="h-5 w-36 bg-slate-200 rounded mb-1" />
          <div className="h-3 w-52 bg-slate-100 rounded hidden sm:block" />
        </div>
        <div className="h-7 w-16 bg-slate-100 rounded-md" />
      </div>

      {/* Stat cards skeleton — 2 col on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-2 sm:p-3 bg-white border border-slate-200 rounded-sm">
            <div className="h-2 w-16 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-20 bg-slate-300 rounded" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden mt-2">
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-4">
          {[80, 100, 60, 90, 70].map((w, i) => (
            <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-3 py-2 border-b border-slate-100">
            {[70, 90, 55, 80, 60].map((w, j) => (
              <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
