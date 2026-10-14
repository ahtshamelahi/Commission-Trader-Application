'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { CropsClientPage } from '@/components/parties/crops-client-page';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';

export default function CropsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cropsRes, varietiesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
      ]);
      const varieties: CropVariety[] = varietiesRes.data || [];
      setCrops(
        ((cropsRes.data as Crop[]) || []).map((c) => ({
          ...c,
          varieties: varieties.filter((v) => v.crop_id === c.id),
        }))
      );
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <TopHeader title="Crops & Varieties" subtitle="Manage crop types and varieties for purchases and sales" />
      <CropsClientPage initialCrops={crops} isLoading={isLoading} />
    </>
  );
}
