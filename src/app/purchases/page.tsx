import React from 'react';
import { DashboardLayout } from '../dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { PurchaseEntryForm } from '@/components/purchases/purchase-entry-form';
import { PurchaseDetailsTable } from '@/components/purchases/purchase-details-table';
import { ShoppingCart, History } from 'lucide-react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';

import { connection } from 'next/server';

export default async function PurchasesPage() {
  await connection();
  const supabase = getSupabaseServerClient();

  const [cropsRes, varietiesRes, suppliersRes, purchasesRes] = await Promise.all([
    supabase.from('crops').select('*').order('name', { ascending: true }),
    supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
    supabase.from('parties').select('*').or('party_type.eq.supplier,party_type.eq.both').order('name', { ascending: true }),
    supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }),
  ]);

  const varieties: CropVariety[] = varietiesRes.data || [];
  const crops: Crop[] = (cropsRes.data || []).map((c) => ({
    ...c,
    varieties: varieties.filter((v) => v.crop_id === c.id),
  }));
  const suppliers: Party[] = suppliersRes.data || [];
  const purchases: Purchase[] = purchasesRes.data || [];

  return (
    <DashboardLayout>
      <TopHeader title="Crop Purchases" subtitle="Record crop purchases, calculate commission deductions, and incoming stock" />

      <div className="mt-4 space-y-4">
        {/* Entry Form */}
        <section className="space-y-3">
          {/* <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <ShoppingCart className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-800">New Purchase Transaction</h2>
          </div> */}
          <PurchaseEntryForm crops={crops} suppliers={suppliers} />
        </section>

        {/* History Table */}
        <section className="space-y-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Recent Purchase History</h2>
          </div>
          <PurchaseDetailsTable purchases={purchases} />
        </section>
      </div>
    </DashboardLayout>
  );
}
