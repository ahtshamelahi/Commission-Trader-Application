'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { AllSalesView } from '@/components/sales/all-sales-view';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Sale } from '@/types/sale-data-types';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';

export default function AllSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [buyers, setBuyers] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
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

      setSales(salesRes.data || []);
      setCrops(cropsRes.data || []);
      setBuyers(buyersRes.data || []);
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <>
      <TopHeader
        title="All Sales"
        subtitle="Filter by crop, buyer, or date"
      />
      <AllSalesView sales={sales} crops={crops} buyers={buyers} isLoading={isLoading} />
    </>
  );
}
