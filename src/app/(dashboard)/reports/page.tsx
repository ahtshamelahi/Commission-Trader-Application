'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { ReportsView } from '@/components/reports/reports-view';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { Expense } from '@/types/expense-data-types';
import { StockMovement } from '@/types/stock-data-types';

export default function ReportsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReportsData() {
      const [cropsRes, partiesRes, purchasesRes, salesRes, expensesRes, movementsRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('parties').select('*').order('name', { ascending: true }),
        supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
        supabase.from('sales').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
        supabase.from('stock_movements').select('*'),
      ]);

      setCrops(cropsRes.data || []);
      setParties(partiesRes.data || []);
      setPurchases(purchasesRes.data || []);
      setSales(salesRes.data || []);
      setExpenses(expensesRes.data || []);
      setMovements(movementsRes.data || []);
      setIsLoading(false);
    }

    loadReportsData();
  }, []);

  return (
    <>
      <TopHeader
        title="Financial & Business Reports"
        subtitle="Generate purchase, sales, stock, expense, and crop-wise P&L statements with print & CSV export"
      />
      <div className="mt-6">
        <ReportsView
          crops={crops}
          parties={parties}
          purchases={purchases}
          sales={sales}
          expenses={expenses}
          movements={movements}
          isLoading={isLoading}
        />
      </div>
    </>
  );
}
