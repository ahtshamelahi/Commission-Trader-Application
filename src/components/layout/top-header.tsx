'use client';

// components/layout/top-header.tsx
import React from 'react';
import { Calendar, Building2, LogOut, Menu, ArrowLeft } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useDashboardShell } from '@/components/layout/dashboard-shell';

interface TopHeaderProps {
  title?: string;
  subtitle?: string;
}

export function TopHeader({ title = 'Dashboard', subtitle }: TopHeaderProps) {
  const router = useRouter();
  // isFullScreen is true only on pages where the sidebar is hidden (New Sale, Purchases)
  const { isFullScreen, openMenu } = useDashboardShell();

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

  // go to the previous page; if there is none (page opened directly), go to the dashboard
  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/dashboard');
  };

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-3 py-2 shadow-2xs gap-2">
      {/* Left: Menu + Back (full-screen pages only) and page title */}
      <div className="flex items-center gap-2 min-w-0">
        {isFullScreen && (
          <>
            <button
              type="button"
              onClick={openMenu}
              aria-label="Open menu"
              title="Menu"
              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
            >
              <Menu className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleBack}
              aria-label="Back"
              title="Back"
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          </>
        )}
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate hidden sm:block">{subtitle}</p>}
        </div>
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

        {/* Company Logo on the right side */}
        <div className="flex items-center">
          <img
            src="/images/shafiq shop logo.jpeg"
            alt="M-Shafiq Logo"
            className="w-8 h-8 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shadow-2xs hover:scale-105 transition-transform"
            title="M-Shafiq Commission Shop"
          />
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