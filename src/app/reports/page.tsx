import React from 'react';
import { DashboardLayout } from '../dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { calculateProfitAndLoss } from '@/lib/calculations/profit-loss-calculation';
import { buildCropStockSummary } from '@/lib/calculations/current-stock-calculation';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { Expense } from '@/types/expense-data-types';
import { StockMovement } from '@/types/stock-data-types';
import { ReportsView } from '@/components/reports/reports-view';

import { connection } from 'next/server';

export default async function ReportsPage() {
  const supabase = getSupabaseServerClient();

  const [cropsRes, partiesRes, purchasesRes, salesRes, expensesRes, movementsRes] = await Promise.all([
    supabase.from('crops').select('*').order('name', { ascending: true }),
    supabase.from('parties').select('*').order('name', { ascending: true }),
    supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
    supabase.from('sales').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('stock_movements').select('*'),
  ]);

  const crops: Crop[] = cropsRes.data || [];
  const parties: Party[] = partiesRes.data || [];
  const purchases: Purchase[] = purchasesRes.data || [];
  const sales: Sale[] = salesRes.data || [];
  const expenses: Expense[] = expensesRes.data || [];
  const movements: StockMovement[] = movementsRes.data || [];

  return (
    <DashboardLayout>
      <TopHeader title="Financial & Business Reports" subtitle="Generate purchase, sales, stock, expense, and crop-wise P&L statements with print & CSV export" />

      <div className="mt-6">
        <ReportsView
          crops={crops}
          parties={parties}
          purchases={purchases}
          sales={sales}
          expenses={expenses}
          movements={movements}
        />
      </div>
    </DashboardLayout>
  );
}
