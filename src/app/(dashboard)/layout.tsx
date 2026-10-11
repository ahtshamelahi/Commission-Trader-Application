import React from 'react';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { MobileNavigation } from '@/components/layout/mobile-navigation';

/**
 * Persistent dashboard layout — this component stays mounted across all
 * dashboard route navigations, so the sidebar and mobile nav never remount.
 * Only the inner {children} slot swaps out on each navigation.
 */
export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop sidebar — stays mounted, never remounts between navigations */}
      <SidebarNavigation />

      {/* Right side: mobile nav + page content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top nav — stays mounted */}
        <MobileNavigation />

        <main className="flex-1 p-3 md:p-4 w-full mx-auto max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
