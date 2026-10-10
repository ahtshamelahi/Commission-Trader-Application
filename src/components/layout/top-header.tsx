'use client';

import React from 'react';
import { Calendar, Building2 } from 'lucide-react';

interface TopHeaderProps {
  title?: string;
  subtitle?: string;
}

export function TopHeader({ title = 'Dashboard', subtitle }: TopHeaderProps) {
  const currentDate = new Date().toLocaleDateString('en-PK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  });

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-2 shadow-2xs">
      <div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{currentDate} (PKT)</span>
        </div>

        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200">
          <Building2 className="w-3.5 h-3.5 text-emerald-700" />
          <span className="font-semibold">Shop Active</span>
        </div>
      </div>
    </header>
  );
}
