'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PosSaleForm } from '@/components/sales/pos-sale-form';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';

export default function NewSalePage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  useEffect(() => {
    async function loadSaleFormData() {
      const [cropsRes, varietiesRes, buyersRes, purchasesRes, salesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
        supabase.from('parties').select('*').or('party_type.eq.buyer,party_type.eq.both').order('name', { ascending: true }),
        supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg'),
        supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
      ]);

      const varieties: CropVariety[] = (varietiesRes.data as any) || [];
      const structuredCrops: Crop[] = ((cropsRes.data as any[]) || []).map((c) => ({
        ...c,
        varieties: varieties.filter((v) => v.crop_id === c.id),
      }));

      setCrops(structuredCrops);
      setBuyers(buyersRes.data || []);
      setPurchases(purchasesRes.data || []);
      setSales(salesRes.data || []);
    }

    loadSaleFormData();
  }, []);

  return (
    <>
      <TopHeader
        title="New Sale"
        subtitle="Select crop category & variety → add items to cart → finalize invoice"
      />
      <PosSaleForm crops={crops} buyers={buyers} purchases={purchases} sales={sales} />
    </>
  );
}
