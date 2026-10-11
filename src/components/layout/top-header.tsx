'use client';

import React from 'react';
import { Calendar, Building2, LogOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

interface TopHeaderProps {
  title?: string;
  subtitle?: string;
}

export function TopHeader({ title = 'Dashboard', subtitle }: TopHeaderProps) {
  const router = useRouter();

  const currentDate = new Date().toLocaleDateString('en-PK', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  });

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
    );
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-3 py-2 shadow-2xs gap-2">
      {/* Page title */}
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Date pill — hidden on very small screens */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span className="hidden md:inline">{currentDate} (PKT)</span>
          <span className="md:hidden">{currentDate}</span>
        </div>

        {/* Shop active badge — hidden on mobile (shown in sidebar/top nav instead) */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
          <Building2 className="w-3 h-3 text-emerald-700" />
          <span className="font-semibold">Active</span>
        </div>

        {/* Logout button — always visible */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="flex items-center gap-1.5 text-xs font-semibold text-rose-500 hover:text-white hover:bg-rose-600 px-2 py-1.5 rounded-md border border-rose-200 hover:border-rose-600 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
