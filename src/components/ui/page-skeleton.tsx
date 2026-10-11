import React from 'react';

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2">
        <div>
          <div className="h-5 w-40 bg-slate-200 rounded mb-1" />
          <div className="h-3 w-64 bg-slate-100 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-28 bg-slate-100 rounded-full" />
          <div className="h-6 w-24 bg-slate-100 rounded-full" />
        </div>
      </div>

      <div className="p-3 md:p-4 space-y-4">
        {/* Stat cards skeleton — 2 col on mobile, 5 col on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-2 sm:p-3 bg-white border border-slate-200 rounded-sm">
              <div className="h-2 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-5 w-24 bg-slate-300 rounded" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 bg-slate-200 rounded" style={{ width: `${60 + i * 10}px` }} />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-3 py-2 border-b border-slate-100">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 bg-slate-100 rounded" style={{ width: `${50 + j * 15}px` }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
