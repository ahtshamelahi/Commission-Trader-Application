'use client';

import React, { useState } from 'react';
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
  BookOpen,
  ChevronDown,
  ChevronRight,
  Truck,
  UserCheck,
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

const khataSubItems = [
  { name: 'Sales Khata', href: '/khata/sales', icon: UserCheck, desc: 'Buyers' },
  { name: 'Purchase Khata', href: '/khata/purchases', icon: Truck, desc: 'Suppliers' },
];

export function SidebarNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [khataOpen, setKhataOpen] = useState(pathname.startsWith('/khata'));

  const handleLogout = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
    );
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isKhataActive = pathname.startsWith('/khata');

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

        {/* Khata Expandable Section */}
        <div>
          <button
            onClick={() => setKhataOpen((o) => !o)}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isKhataActive
              ? 'bg-violet-700 text-white'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <BookOpen className={`w-4 h-4 ${isKhataActive ? 'text-white' : 'text-slate-400'}`} />
            <span className="flex-1 text-left">Khata</span>
            {khataOpen
              ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>

          {khataOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
              {khataSubItems.map((sub) => {
                const Icon = sub.icon;
                const isActive = pathname === sub.href || pathname.startsWith(sub.href + '/');
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    prefetch={true}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{sub.name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
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
        <p>M Shafiq Commission Shop</p>
      </div>
    </aside>
  );
}


