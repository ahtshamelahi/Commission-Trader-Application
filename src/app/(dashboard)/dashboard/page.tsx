
'use client';

import React, { useEffect, useState } from 'react';

import { TopHeader } from '@/components/layout/top-header';
import { DashboardStatCard } from '@/components/dashboard/dashboard-stat-card';
import {
  RecentTransactionsTable,
  RecentTransactionItem,
} from '@/components/dashboard/recent-transactions-table';

import { supabase } from '@/lib/supabase/supabase-browser-client';
import {
  calculateProfitAndLoss,
  ProfitLossSummary,
} from '@/lib/calculations/profit-loss-calculation';
import { calculateStoredPurchaseTotalPkr } from '@/lib/calculations/purchase-amount-calculation';

interface DashboardStats {
  todayPurchasesPkr: number;
  todaySalesPkr: number;
  todayExpensesPkr: number;
  todayPurchaseCount: number;
  todaySaleCount: number;
}

const initialStats: DashboardStats = {
  todayPurchasesPkr: 0,
  todaySalesPkr: 0,
  todayExpensesPkr: 0,
  todayPurchaseCount: 0,
  todaySaleCount: 0,
};

const initialPnl: ProfitLossSummary = {
  totalSaleRevenuePkr: 0,
  totalCostOfGoodsSoldPkr: 0,
  grossProfitPkr: 0,
  totalOperatingExpensesPkr: 0,
  netProfitPkr: 0,
  profitMarginPercent: 0,
};

const formatPkr = (amount: number) =>
  `Rs. ${amount.toLocaleString('en-PK', {
    maximumFractionDigits: 2,
  })}`;

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [pnl, setPnl] = useState<ProfitLossSummary>(initialPnl);
  const [recentTransactions, setRecentTransactions] = useState<
    RecentTransactionItem[]
  >([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        // Start of today's date in the browser's local timezone.
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
          // Today's purchase totals and invoice count.
          supabase
            .from('purchases')
            .select('crop_amount, purchase_expenses(amount, is_income)')
            .gte('created_at', todayIso),

          // Today's sale totals and invoice count.
          supabase
            .from('sales')
            .select('sale_amount')
            .gte('created_at', todayIso),

          // Today's recorded expenses.
          supabase
            .from('expenses')
            .select('amount')
            .gte('created_at', todayIso),

          // Recent purchases: display actual physical weight.
          supabase
            .from('purchases')
            .select(`
              id,
              invoice_no,
              crop_amount,
              purchase_expenses(amount, is_income),
              gross_weight_kg,
              created_at,
              crops(name),
              parties(name)
            `)
            .order('created_at', { ascending: false })
            .limit(5),

          // Recent sales.
          supabase
            .from('sales')
            .select(`
              id,
              invoice_no,
              sale_amount,
              physical_weight_kg,
              created_at,
              crops(name),
              parties(name)
            `)
            .order('created_at', { ascending: false })
            .limit(5),

          // Complete purchase history for chronological inventory costing.
          // Note: document_total may not exist until migration 20261014 is applied;
          // P&L falls back to crop_amount + purchase_expenses.
          supabase
            .from('purchases')
            .select(`
              id,
              crop_id,
              gross_weight_kg,
              crop_amount,
              created_at,
              purchase_expenses(amount, is_income)
            `)
            .order('created_at', { ascending: true }),

          // Complete sales history.
          // sale_amount + sale-linked income expenses cover revenue without document_total.
          supabase
            .from('sales')
            .select(`
              id,
              crop_id,
              physical_weight_kg,
              sale_amount,
              created_at
            `)
            .order('created_at', { ascending: true }),

          // Expense relationships prevent purchase-cost double counting.
          supabase
            .from('expenses')
            .select('amount, purchase_id, sale_id, is_income'),
        ]);

        // Do not silently display zero profit if a query failed.
        const queryResults = [
          todayPurchasesRes,
          todaySalesRes,
          todayExpensesRes,
          recentPurchasesRes,
          recentSalesRes,
          allPurchasesPnlRes,
          allSalesPnlRes,
          allExpensesPnlRes,
        ];

        const failedQuery = queryResults.find((result) => result.error);

        if (failedQuery?.error) {
          throw new Error(failedQuery.error.message);
        }

        if (cancelled) return;

        const todayPurchases = todayPurchasesRes.data ?? [];
        const todaySales = todaySalesRes.data ?? [];
        const todayExpenses = todayExpensesRes.data ?? [];

        const todayPurchasesPkr = todayPurchases.reduce(
          (total, purchase) =>
            total +
            calculateStoredPurchaseTotalPkr(
              purchase.crop_amount,
              purchase.purchase_expenses
            ),
          0
        );

        const todaySalesPkr = todaySales.reduce(
          (total, sale) => total + Number(sale.sale_amount ?? 0),
          0
        );

        const todayExpensesPkr = todayExpenses.reduce(
          (total, expense) => total + Number(expense.amount ?? 0),
          0
        );

        const calculatedPnl = calculateProfitAndLoss(
          (allSalesPnlRes.data ?? []) as Parameters<
            typeof calculateProfitAndLoss
          >[0],
          (allPurchasesPnlRes.data ?? []) as Parameters<
            typeof calculateProfitAndLoss
          >[1],
          (allExpensesPnlRes.data ?? []) as Parameters<
            typeof calculateProfitAndLoss
          >[2]
        );

        const recentPurchases: RecentTransactionItem[] = (
          recentPurchasesRes.data ?? []
        ).map((purchase) => ({
          id: `pur-${purchase.id}`,
          type: 'purchase',
          invoice_no: purchase.invoice_no,
          party_name: purchase.parties?.[0]?.name ?? 'Supplier',
          crop_name: purchase.crops?.[0]?.name ?? 'Crop',
          amount: calculateStoredPurchaseTotalPkr(
            purchase.crop_amount,
            purchase.purchase_expenses
          ),
          weight_kg: Number(purchase.gross_weight_kg ?? 0),
          date: purchase.created_at,
        }));

        const recentSales: RecentTransactionItem[] = (
          recentSalesRes.data ?? []
        ).map((sale) => ({
          id: `sale-${sale.id}`,
          type: 'sale',
          invoice_no: sale.invoice_no,
          party_name: sale.parties?.[0]?.name ?? 'Buyer',
          crop_name: sale.crops?.[0]?.name ?? 'Crop',
          amount: Number(sale.sale_amount ?? 0),
          weight_kg: Number(sale.physical_weight_kg ?? 0),
          date: sale.created_at,
        }));

        const combined = [...recentPurchases, ...recentSales]
          .sort(
            (a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
          .slice(0, 8);

        setStats({
          todayPurchasesPkr,
          todaySalesPkr,
          todayExpensesPkr,
          todayPurchaseCount: todayPurchases.length,
          todaySaleCount: todaySales.length,
        });

        setPnl(calculatedPnl);
        setRecentTransactions(combined);
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to load dashboard:', error);

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load dashboard data.'
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopHeader
        title="Shop Dashboard"
        subtitle="Real-time financial and crop inventory management"
      />

      <div className="mt-4 space-y-4">
        {loadError && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Failed to load dashboard data: {loadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          <DashboardStatCard
            title="Today Purchases"
            value={formatPkr(stats.todayPurchasesPkr)}
            iconName="shopping-cart"
            trend={`${stats.todayPurchaseCount} invoice(s)`}
            isLoading={isLoading}
          />

          <DashboardStatCard
            title="Today Sales"
            value={formatPkr(stats.todaySalesPkr)}
            iconName="trending-up"
            variant="positive"
            trend={`${stats.todaySaleCount} invoice(s)`}
            isLoading={isLoading}
          />

          <DashboardStatCard
            title="Today Expenses"
            value={formatPkr(stats.todayExpensesPkr)}
            iconName="receipt"
            variant={
              stats.todayExpensesPkr > 0 ? 'negative' : 'normal'
            }
            isLoading={isLoading}
          />

          <DashboardStatCard
            title="Gross Profit"
            value={formatPkr(pnl.grossProfitPkr)}
            iconName="dollar-sign"
            variant={
              pnl.grossProfitPkr >= 0 ? 'positive' : 'negative'
            }
            isLoading={isLoading}
          />

          <DashboardStatCard
            title="Net Profit"
            value={formatPkr(pnl.netProfitPkr)}
            iconName="wallet"
            variant={
              pnl.netProfitPkr >= 0 ? 'positive' : 'negative'
            }
            trend={`Margin: ${pnl.profitMarginPercent}%`}
            isLoading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <RecentTransactionsTable
            transactions={recentTransactions}
            isLoading={isLoading}
          />
        </div>
      </div>
    </>
  );
}
