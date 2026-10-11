import React from 'react';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { MobileNavigation } from '@/components/layout/mobile-navigation';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Desktop sidebar — hidden on mobile */}
      <SidebarNavigation />

      {/* Right side: mobile nav + content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top nav — hidden on desktop */}
        <MobileNavigation />

        <main className="flex-1 p-3 md:p-4 w-full mx-auto max-w-7xl">{children}</main>
      </div>
    </div>
  );
}
