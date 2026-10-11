import React, { Suspense } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { AllSalesView } from '@/components/sales/all-sales-view';
import { Sale } from '@/types/sale-data-types';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';

export const dynamic = 'force-dynamic';

async function SalesAllData() {
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

  return <AllSalesView sales={sales} crops={crops} buyers={buyers} />;
}

export default function AllSalesPage() {
  return (
    <>
      <TopHeader
        title="All Sales"
        subtitle="Filter by crop, buyer, or date"
      />
      <Suspense fallback={null}>
        <SalesAllData />
      </Suspense>
    </>
  );
}
