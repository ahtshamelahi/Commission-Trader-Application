'use client';

// components/layout/dashboard-shell.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SidebarNavigation } from '@/components/layout/sidebar-navigation';
import { MobileNavigation } from '@/components/layout/mobile-navigation';

/** Pages that open full screen (sidebar hidden). Exact paths only. */
const FULL_SCREEN_ROUTES = ['/sales/new', '/purchases'];

/** Page background per route, so Purchases looks different from Sales. Others use the default. */
const ROUTE_BACKGROUNDS: Record<string, string> = {
  '/purchases': 'bg-amber-50',
};
const DEFAULT_BACKGROUND = 'bg-slate-50';

interface DashboardShellContextValue {
  isFullScreen: boolean;
  openMenu: () => void;
}

const DashboardShellContext = createContext<DashboardShellContextValue>({
  isFullScreen: false,
  openMenu: () => {},
});

/** Used by TopHeader to show the Menu + Back buttons on full-screen pages. */
export const useDashboardShell = () => useContext(DashboardShellContext);

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_ROUTES.includes(pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  // close the menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // close the menu with the Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const value = useMemo(() => ({ isFullScreen, openMenu }), [isFullScreen, openMenu]);

  return (
    <DashboardShellContext.Provider value={value}>
      <div
        className={`min-h-screen ${ROUTE_BACKGROUNDS[pathname] ?? DEFAULT_BACKGROUND} text-slate-900 flex flex-col md:flex-row`}
      >
        {/* Desktop sidebar: always mounted, only hidden with CSS on full-screen pages */}
        <div className={isFullScreen ? 'hidden' : 'contents'}>
          <SidebarNavigation />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top nav: always mounted, hidden on full-screen pages */}
          <div className={isFullScreen ? 'hidden' : 'contents'}>
            <MobileNavigation />
          </div>

          <main
            className={`flex-1 p-3 md:p-4 w-full ${isFullScreen ? '' : 'mx-auto max-w-7xl'}`}
          >
            {children}
          </main>
        </div>

        {/* Menu drawer (only on full-screen pages, opened from the Menu button) */}
        {isFullScreen && menuOpen && (
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Menu">
            <div
              className="h-full"
              onClick={(e) => {
                // close after the user picks a link
                if ((e.target as HTMLElement).closest('a')) setMenuOpen(false);
              }}
            >
              <SidebarNavigation variant="drawer" />
            </div>
            <button
              type="button"
              aria-label="Close menu"
              className="flex-1 bg-slate-900/50"
              onClick={() => setMenuOpen(false)}
            />
          </div>
        )}
      </div>
    </DashboardShellContext.Provider>
  );
}