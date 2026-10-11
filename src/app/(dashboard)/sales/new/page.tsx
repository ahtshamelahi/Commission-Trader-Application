import React, { Suspense } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { PosSaleForm } from '@/components/sales/pos-sale-form';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
export const dynamic = 'force-dynamic';

async function SaleFormData() {
  const supabase = getSupabaseServerClient();

  const [cropsRes, varietiesRes, buyersRes, purchasesRes, salesRes] = await Promise.all([
    supabase.from('crops').select('*').order('name', { ascending: true }),
    supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
    supabase.from('parties').select('*').or('party_type.eq.buyer,party_type.eq.both').order('name', { ascending: true }),
    supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg'),
    supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
  ]);

  const varieties: CropVariety[] = (varietiesRes.data as any) || [];
  const crops: Crop[] = ((cropsRes.data as any[]) || []).map((c) => ({
    ...c,
    varieties: varieties.filter((v) => v.crop_id === c.id),
  }));
  const buyers: Party[] = buyersRes.data || [];
  const purchases = purchasesRes.data || [];
  const sales = salesRes.data || [];

  return <PosSaleForm crops={crops} buyers={buyers} purchases={purchases as any} sales={sales as any} />;
}

export default function NewSalePage() {
  return (
    <>
      <TopHeader
        title="New Sale"
        subtitle="Select crop category & variety → add items to cart → finalize invoice"
      />
      <Suspense fallback={null}>
        <SaleFormData />
      </Suspense>
    </>
  );
}
