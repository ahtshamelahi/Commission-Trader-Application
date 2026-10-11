import React from 'react';
import { DashboardLayout } from './dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { DashboardStatCard } from '@/components/dashboard/dashboard-stat-card';
import { RecentTransactionsTable, RecentTransactionItem } from '@/components/dashboard/recent-transactions-table';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { ShoppingCart, TrendingUp, Boxes, Receipt, DollarSign, Wallet } from 'lucide-react';
import { calculateProfitAndLoss } from '@/lib/calculations/profit-loss-calculation';
import { calculateAvailableStock } from '@/lib/calculations/current-stock-calculation';

import { connection } from 'next/server';

export default async function DashboardPage() {
  const supabase = getSupabaseServerClient();

  // Define date range for "Today" in PKT (Asia/Karachi)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch real database records from Supabase
  const [purchasesRes, salesRes, expensesRes, stockRes] = await Promise.all([
    supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('stock_movements').select('quantity_kg'),
  ]);

  const purchases = purchasesRes.data || [];
  const sales = salesRes.data || [];
  const expenses = expensesRes.data || [];
  const stockMovements = stockRes.data || [];

  // Filter today's items
  const todayPurchases = purchases.filter((p) => new Date(p.created_at) >= todayStart);
  const todaySales = sales.filter((s) => new Date(s.created_at) >= todayStart);
  const todayExpenses = expenses.filter((e) => new Date(e.created_at) >= todayStart);

  const todayPurchasesPkr = todayPurchases.reduce((acc, p) => acc + Number(p.crop_amount), 0);
  const todaySalesPkr = todaySales.reduce((acc, s) => acc + Number(s.sale_amount), 0);
  const todayExpensesPkr = todayExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

  const totalStockKg = calculateAvailableStock(stockMovements);

  // Calculate profit and loss
  const pnl = calculateProfitAndLoss(sales, purchases, expenses);

  // Recent transactions list
  const recentPurchases: RecentTransactionItem[] = purchases.slice(0, 5).map((p) => ({
    id: `pur-${p.id}`,
    type: 'purchase',
    invoice_no: p.invoice_no,
    party_name: p.parties?.name || 'Supplier',
    crop_name: p.crops?.name || 'Crop',
    amount: Number(p.crop_amount),
    weight_kg: Number(p.net_weight_kg),
    date: p.created_at,
  }));

  const recentSales: RecentTransactionItem[] = sales.slice(0, 5).map((s) => ({
    id: `sale-${s.id}`,
    type: 'sale',
    invoice_no: s.invoice_no,
    party_name: s.parties?.name || 'Buyer',
    crop_name: s.crops?.name || 'Crop',
    amount: Number(s.sale_amount),
    weight_kg: Number(s.physical_weight_kg),
    date: s.created_at,
  }));

  const recentTransactions = [...recentPurchases, ...recentSales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <DashboardLayout>
      <TopHeader title="Shop Dashboard" subtitle="Real-time financial and crop inventory management" />

      <div className="mt-4 space-y-4">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          <DashboardStatCard
            title="Today Purchases"
            value={`Rs. ${todayPurchasesPkr.toLocaleString()}`}
            iconName="shopping-cart"
            trend={`${todayPurchases.length} invoice(s)`}
          />
          <DashboardStatCard
            title="Today Sales"
            value={`Rs. ${todaySalesPkr.toLocaleString()}`}
            iconName="trending-up"
            variant="positive"
            trend={`${todaySales.length} invoice(s)`}
          />

          <DashboardStatCard
            title="Today Expenses"
            value={`Rs. ${todayExpensesPkr.toLocaleString()}`}
            iconName="receipt"
            variant={todayExpensesPkr > 0 ? 'negative' : 'normal'}
          />
          <DashboardStatCard
            title="Gross Profit"
            value={`Rs. ${pnl.grossProfitPkr.toLocaleString()}`}
            iconName="dollar-sign"
            variant={pnl.grossProfitPkr >= 0 ? 'positive' : 'negative'}
          />
          <DashboardStatCard
            title="Net Profit"
            value={`Rs. ${pnl.netProfitPkr.toLocaleString()}`}
            iconName="wallet"
            variant={pnl.netProfitPkr >= 0 ? 'positive' : 'negative'}
            trend={`Margin: ${pnl.profitMarginPercent}%`}
          />
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 gap-4">
          <RecentTransactionsTable transactions={recentTransactions} />
        </div>
      </div>
    </DashboardLayout>
  );
}
