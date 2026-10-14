// app/(dashboard)/layout.tsx
import React from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';

/**
 * Persistent dashboard layout — stays mounted across dashboard navigations.
 * DashboardShell (client) decides whether the sidebar is shown or hidden
 * (full-screen pages such as New Sale and Purchases).
 */
export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}