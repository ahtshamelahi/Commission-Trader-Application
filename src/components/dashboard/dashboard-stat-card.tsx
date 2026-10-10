'use client';

import React from 'react';
import { ShoppingCart, TrendingUp, Boxes, Receipt, DollarSign, Wallet, HelpCircle } from 'lucide-react';

export type StatIconName = 'shopping-cart' | 'trending-up' | 'boxes' | 'receipt' | 'dollar-sign' | 'wallet';

interface DashboardStatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  iconName: StatIconName;
  trend?: string;
  variant?: 'normal' | 'positive' | 'negative' | 'neutral';
}

const iconMap = {
  'shopping-cart': ShoppingCart,
  'trending-up': TrendingUp,
  'boxes': Boxes,
  'receipt': Receipt,
  'dollar-sign': DollarSign,
  'wallet': Wallet,
};

export function DashboardStatCard({
  title,
  value,
  unit,
  iconName,
  trend,
  variant = 'normal',
}: DashboardStatCardProps) {
  const Icon = iconMap[iconName] || HelpCircle;

  let valueClass = 'text-slate-900';

  if (variant === 'positive') {
    valueClass = 'text-emerald-700';
  } else if (variant === 'negative') {
    valueClass = 'text-rose-600';
  }

  return (
    <div className="p-2 sm:p-3 bg-white border border-slate-200 rounded-sm shadow-2xs transition-all hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
      </div>
      <div className="mt-1 sm:mt-2 flex items-baseline gap-1.5">
        <span className={`text-sm sm:text-lg font-bold tracking-tight ${valueClass}`}>{value}</span>
        {unit && <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500">{unit}</span>}
      </div>
      {trend && <p className="mt-0.5 text-[9px] sm:text-[10px] text-slate-400">{trend}</p>}
    </div>
  );
}
