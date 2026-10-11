import React, { Suspense } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { DashboardStatCard } from '@/components/dashboard/dashboard-stat-card';
import { RecentTransactionsTable, RecentTransactionItem } from '@/components/dashboard/recent-transactions-table';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { calculateProfitAndLoss } from '@/lib/calculations/profit-loss-calculation';


export const dynamic = 'force-dynamic';

// ─── Data-fetching component (runs async, streams in after shell) ────────────
async function DashboardData() {
  const supabase = getSupabaseServerClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Parallel: today-only rows for daily totals + limited recent rows for the activity list
  // + all-time lightweight rows for P&L (only the numeric columns needed)
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
    // Today totals — small result sets
    supabase.from('purchases').select('crop_amount').gte('created_at', todayIso),
    supabase.from('sales').select('sale_amount').gte('created_at', todayIso),
    supabase.from('expenses').select('amount').gte('created_at', todayIso),
    // Recent activity list — limit to 10 newest per type
    supabase.from('purchases').select('id, invoice_no, crop_amount, net_weight_kg, created_at, crops(name), parties(name)').order('created_at', { ascending: false }).limit(10),
    supabase.from('sales').select('id, invoice_no, sale_amount, physical_weight_kg, created_at, crops(name), parties(name)').order('created_at', { ascending: false }).limit(10),
    // P&L — only the columns the calculation functions actually read
    supabase.from('purchases').select('crop_id, net_weight_kg, crop_amount'),
    supabase.from('sales').select('crop_id, physical_weight_kg, sale_amount'),
    supabase.from('expenses').select('amount'),
  ]);

  const todayPurchasesPkr = (todayPurchasesRes.data || []).reduce((acc, p) => acc + Number(p.crop_amount), 0);
  const todaySalesPkr = (todaySalesRes.data || []).reduce((acc, s) => acc + Number(s.sale_amount), 0);
  const todayExpensesPkr = (todayExpensesRes.data || []).reduce((acc, e) => acc + Number(e.amount), 0);

  const pnl = calculateProfitAndLoss(
    (allSalesPnlRes.data as any) || [],
    (allPurchasesPnlRes.data as any) || [],
    (allExpensesPnlRes.data as any) || []
  );

  const todayPurchaseCount = todayPurchasesRes.data?.length ?? 0;
  const todaySaleCount = todaySalesRes.data?.length ?? 0;

  const recentPurchases: RecentTransactionItem[] = ((recentPurchasesRes.data as any[]) || []).map((p) => ({
    id: `pur-${p.id}`,
    type: 'purchase',
    invoice_no: p.invoice_no,
    party_name: (p.parties as any)?.name || 'Supplier',
    crop_name: (p.crops as any)?.name || 'Crop',
    amount: Number(p.crop_amount),
    weight_kg: Number(p.net_weight_kg),
    date: p.created_at,
  }));

  const recentSales: RecentTransactionItem[] = ((recentSalesRes.data as any[]) || []).map((s) => ({
    id: `sale-${s.id}`,
    type: 'sale',
    invoice_no: s.invoice_no,
    party_name: (s.parties as any)?.name || 'Buyer',
    crop_name: (s.crops as any)?.name || 'Crop',
    amount: Number(s.sale_amount),
    weight_kg: Number(s.physical_weight_kg),
    date: s.created_at,
  }));

  const recentTransactions = [...recentPurchases, ...recentSales]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
        <DashboardStatCard
          title="Today Purchases"
          value={`Rs. ${todayPurchasesPkr.toLocaleString()}`}
          iconName="shopping-cart"
          trend={`${todayPurchaseCount} invoice(s)`}
        />
        <DashboardStatCard
          title="Today Sales"
          value={`Rs. ${todaySalesPkr.toLocaleString()}`}
          iconName="trending-up"
          variant="positive"
          trend={`${todaySaleCount} invoice(s)`}
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
      <div className="grid grid-cols-1 gap-4">
        <RecentTransactionsTable transactions={recentTransactions} />
      </div>
    </div>
  );
}

// ─── Page shell — renders instantly, no awaits ───────────────────────────────
export default function DashboardPage() {
  return (
    <>
      <TopHeader title="Shop Dashboard" subtitle="Real-time financial and crop inventory management" />
      <Suspense fallback={null}>
        <DashboardData />
      </Suspense>
    </>
  );
}
