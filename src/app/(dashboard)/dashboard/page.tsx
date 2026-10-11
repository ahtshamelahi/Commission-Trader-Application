'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { DashboardStatCard } from '@/components/dashboard/dashboard-stat-card';
import { RecentTransactionsTable, RecentTransactionItem } from '@/components/dashboard/recent-transactions-table';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { calculateProfitAndLoss, ProfitLossSummary } from '@/lib/calculations/profit-loss-calculation';

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    todayPurchasesPkr: 0,
    todaySalesPkr: 0,
    todayExpensesPkr: 0,
    todayPurchaseCount: 0,
    todaySaleCount: 0,
  });
  const [pnl, setPnl] = useState<ProfitLossSummary>({
    totalSaleRevenuePkr: 0,
    totalCostOfGoodsSoldPkr: 0,
    grossProfitPkr: 0,
    totalOperatingExpensesPkr: 0,
    netProfitPkr: 0,
    profitMarginPercent: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransactionItem[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayIso = todayStart.toISOString();

      const [
        todayPurchasesRes,
        todaySalesRes,
        todayExpensesRes,
        recentPurchasesRes,
        recentSalesRes,
        allPurchasesPnlRes,
        allSalesPnlRes,
        allExpensesPnlRes,
      ] = await Promise.all([
        supabase.from('purchases').select('crop_amount').gte('created_at', todayIso),
        supabase.from('sales').select('sale_amount').gte('created_at', todayIso),
        supabase.from('expenses').select('amount').gte('created_at', todayIso),
        supabase
          .from('purchases')
          .select('id, invoice_no, crop_amount, net_weight_kg, created_at, crops(name), parties(name)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('sales')
          .select('id, invoice_no, sale_amount, physical_weight_kg, created_at, crops(name), parties(name)')
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('purchases').select('crop_id, net_weight_kg, crop_amount'),
        supabase.from('sales').select('crop_id, physical_weight_kg, sale_amount'),
        supabase.from('expenses').select('amount'),
      ]);

      const todayPurchasesPkr = (todayPurchasesRes.data || []).reduce((acc: number, p: any) => acc + Number(p.crop_amount), 0);
      const todaySalesPkr = (todaySalesRes.data || []).reduce((acc: number, s: any) => acc + Number(s.sale_amount), 0);
      const todayExpensesPkr = (todayExpensesRes.data || []).reduce((acc: number, e: any) => acc + Number(e.amount), 0);

      const calculatedPnl = calculateProfitAndLoss(
        (allSalesPnlRes.data as any) || [],
        (allPurchasesPnlRes.data as any) || [],
        (allExpensesPnlRes.data as any) || []
      );

      const recentPurchases: RecentTransactionItem[] = ((recentPurchasesRes.data as any[]) || []).map((p: any) => ({
        id: `pur-${p.id}`,
        type: 'purchase',
        invoice_no: p.invoice_no,
        party_name: p.parties?.name || 'Supplier',
        crop_name: p.crops?.name || 'Crop',
        amount: Number(p.crop_amount),
        weight_kg: Number(p.net_weight_kg),
        date: p.created_at,
      }));

      const recentSales: RecentTransactionItem[] = ((recentSalesRes.data as any[]) || []).map((s: any) => ({
        id: `sale-${s.id}`,
        type: 'sale',
        invoice_no: s.invoice_no,
        party_name: s.parties?.name || 'Buyer',
        crop_name: s.crops?.name || 'Crop',
        amount: Number(s.sale_amount),
        weight_kg: Number(s.physical_weight_kg),
        date: s.created_at,
      }));

      const combined = [...recentPurchases, ...recentSales]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8);

      setStats({
        todayPurchasesPkr,
        todaySalesPkr,
        todayExpensesPkr,
        todayPurchaseCount: todayPurchasesRes.data?.length ?? 0,
        todaySaleCount: todaySalesRes.data?.length ?? 0,
      });
      setPnl(calculatedPnl);
      setRecentTransactions(combined);
      setIsLoading(false);
    }

    loadDashboardData();
  }, []);

  return (
    <>
      <TopHeader title="Shop Dashboard" subtitle="Real-time financial and crop inventory management" />
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          <DashboardStatCard
            title="Today Purchases"
            value={`Rs. ${stats.todayPurchasesPkr.toLocaleString()}`}
            iconName="shopping-cart"
            trend={`${stats.todayPurchaseCount} invoice(s)`}
            isLoading={isLoading}
          />
          <DashboardStatCard
            title="Today Sales"
            value={`Rs. ${stats.todaySalesPkr.toLocaleString()}`}
            iconName="trending-up"
            variant="positive"
            trend={`${stats.todaySaleCount} invoice(s)`}
            isLoading={isLoading}
          />
          <DashboardStatCard
            title="Today Expenses"
            value={`Rs. ${stats.todayExpensesPkr.toLocaleString()}`}
            iconName="receipt"
            variant={stats.todayExpensesPkr > 0 ? 'negative' : 'normal'}
            isLoading={isLoading}
          />
          <DashboardStatCard
            title="Gross Profit"
            value={`Rs. ${pnl.grossProfitPkr.toLocaleString()}`}
            iconName="dollar-sign"
            variant={pnl.grossProfitPkr >= 0 ? 'positive' : 'negative'}
            isLoading={isLoading}
          />
          <DashboardStatCard
            title="Net Profit"
            value={`Rs. ${pnl.netProfitPkr.toLocaleString()}`}
            iconName="wallet"
            variant={pnl.netProfitPkr >= 0 ? 'positive' : 'negative'}
            trend={`Margin: ${pnl.profitMarginPercent}%`}
            isLoading={isLoading}
          />
        </div>
        <div className="grid grid-cols-1 gap-4">
          <RecentTransactionsTable transactions={recentTransactions} isLoading={isLoading} />
        </div>
      </div>
    </>
  );
}
