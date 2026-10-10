import React from 'react';
import { DashboardLayout } from '../dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { SaleEntryForm } from '@/components/sales/sale-entry-form';
import { SaleDetailsTable } from '@/components/sales/sale-details-table';
import { TrendingUp, History } from 'lucide-react';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Sale } from '@/types/sale-data-types';
import { StockMovement } from '@/types/stock-data-types';

import { connection } from 'next/server';

export default async function SalesPage() {
  await connection();
  const supabase = getSupabaseServerClient();

  const [cropsRes, buyersRes, salesRes, movementsRes] = await Promise.all([
    supabase.from('crops').select('*').order('name', { ascending: true }),
    supabase.from('parties').select('*').or('party_type.eq.buyer,party_type.eq.both').order('name', { ascending: true }),
    supabase.from('sales').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
    supabase.from('stock_movements').select('*'),
  ]);

  const crops: Crop[] = cropsRes.data || [];
  const buyers: Party[] = buyersRes.data || [];
  const sales: Sale[] = salesRes.data || [];
  const stockMovements: StockMovement[] = movementsRes.data || [];

  return (
    <DashboardLayout>
      <TopHeader title="Crop Sales" subtitle="Record crop sales, calculate billable weight, and deduct physical stock" />

      <div className="mt-6 space-y-8">
        {/* Entry Form */}
        <section className="space-y-2">
          {/* <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            {/* <TrendingUp className="w-5 h-5 text-emerald-700" /> */}
          {/* <h2 className="text-base font-bold text-slate-800">New Sale Transaction</h2> */}
          {/* </div> */}
          <SaleEntryForm crops={crops} buyers={buyers} stockMovements={stockMovements} />
        </section>

        {/* History Table */}
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Recent Sales History</h2>
          </div>
          <SaleDetailsTable sales={sales} />
        </section>
      </div>
    </DashboardLayout>
  );
}
