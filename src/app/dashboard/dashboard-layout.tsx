'use client';

import React from 'react';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { MobileNavigation } from '@/components/layout/mobile-navigation';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      <SidebarNavigation />
      <MobileNavigation />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-3 md:p-4 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
