'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Menu,
  X,
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  TrendingUp,
  ClipboardList,
  Receipt,
  Users,
  BarChart3,
  Store,
  LogOut,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Sale', href: '/sales/new', icon: TrendingUp },
  { name: 'All Sales', href: '/sales/all', icon: ClipboardList },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'Current Stock', href: '/stock', icon: Boxes },
  { name: 'Parties', href: '/parties', icon: Users },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
    );
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="md:hidden bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
      <div className="flex items-center justify-between px-3 py-2.5">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-emerald-600 shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight truncate">M-Shafiq Commission Shop</span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Navigation Menu"
          className="p-1.5 rounded-md hover:bg-slate-800 focus:outline-none shrink-0 ml-2"
        >
          {isOpen ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
        </button>
      </div>

      {/* Slide-down menu */}
      {isOpen && (
        <nav className="px-2 pb-3 pt-1 bg-slate-950 border-t border-slate-800">
          {/* Nav links — 2 column grid for compact layout */}
          <div className="grid grid-cols-2 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Logout button */}
          <div className="mt-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-rose-400 hover:text-white hover:bg-rose-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
