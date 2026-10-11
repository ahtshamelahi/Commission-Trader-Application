'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PartiesClientPage } from '@/components/parties/parties-client-page';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Party } from '@/types/party-data-types';
import { Crop } from '@/types/crop-data-types';

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [partiesRes, cropsRes] = await Promise.all([
        supabase.from('parties').select('*').order('name', { ascending: true }),
        supabase.from('crops').select('*').order('name', { ascending: true }),
      ]);
      setParties(partiesRes.data || []);
      setCrops(cropsRes.data || []);
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <>
      <TopHeader
        title="Parties & Crop Catalog"
      // subtitle="Manage your suppliers, buyers, and crop types for purchase and sale transactions"
      />
      <PartiesClientPage initialParties={parties} initialCrops={crops} isLoading={isLoading} />
    </>
  );
}
