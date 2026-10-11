import React from 'react';
import { DashboardLayout } from '@/app/dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { AllSalesView } from '@/components/sales/all-sales-view';
import { Sale } from '@/types/sale-data-types';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { connection } from 'next/server';

export default async function AllSalesPage() {
  const supabase = getSupabaseServerClient();

  const [salesRes, cropsRes, buyersRes] = await Promise.all([
    supabase
      .from('sales')
      .select('*, crops(name), parties(name, phone)')
      .order('created_at', { ascending: false }),
    supabase.from('crops').select('*').order('name', { ascending: true }),
    supabase
      .from('parties')
      .select('*')
      .or('party_type.eq.buyer,party_type.eq.both')
      .order('name', { ascending: true }),
  ]);

  const sales: Sale[] = salesRes.data || [];
  const crops: Crop[] = cropsRes.data || [];
  const buyers: Party[] = buyersRes.data || [];

  return (
    <DashboardLayout>
      <TopHeader
        title="All Sales"
        subtitle={`${sales.length} total sale record(s) — filter by crop, buyer, or date`}
      />
      <AllSalesView sales={sales} crops={crops} buyers={buyers} />
    </DashboardLayout>
  );
}
