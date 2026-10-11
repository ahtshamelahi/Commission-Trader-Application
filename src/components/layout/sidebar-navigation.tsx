'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
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
import { createBrowserClient } from '@supabase/ssr';

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

export function SidebarNavigation() {
  const pathname = usePathname();
  const router = useRouter();

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
    <aside className="hidden md:flex flex-col w-56 bg-slate-900 text-slate-300 border-r border-slate-800 h-screen sticky top-0 overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base leading-tight">M-Shafiq</h1>
          <h3 className="text-xs text-slate-400">Commission Shop</h3>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer info & Logout */}
      <div className="p-3 border-t border-slate-800 text-xs text-slate-500 text-center">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-3 rounded-md text-sm font-medium text-rose-400 hover:text-white hover:bg-rose-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
        <p>M Shafiq Commission Traders</p>
        {/* <p className="text-[10px] text-slate-600 mt-0.5">PKR / 40kg Maund Standard</p> */}
      </div>
    </aside>
  );
}
