'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  TrendingUp,
  Receipt,
  Users,
  BarChart3,
  Store,
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'Current Stock', href: '/stock', icon: Boxes },
  { name: 'Sales', href: '/sales', icon: TrendingUp },
  { name: 'Expenses', href: '/expenses', icon: Receipt },
  { name: 'Parties', href: '/parties', icon: Users },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden bg-slate-900 text-white border-b border-slate-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-emerald-600 font-bold">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">M-Shafiq Commission Shop</span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Navigation Menu"
          className="p-1.5 rounded-md hover:bg-slate-800 focus:outline-none"
        >
          {isOpen ? <X className="w-6 h-6 text-slate-300" /> : <Menu className="w-6 h-6 text-slate-300" />}
        </button>
      </div>

      {isOpen && (
        <nav className="px-3 pb-4 pt-1 space-y-1 bg-slate-950 border-t border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
