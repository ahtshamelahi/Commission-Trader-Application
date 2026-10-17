'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { CropsClientPage } from '@/components/parties/crops-client-page';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';

export default function CropsPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [cropStock, setCropStock] = useState<Record<number, number>>({});
  const [varietyStock, setVarietyStock] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cropsRes, varietiesRes, movementsRes, purchasesRes, salesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
        supabase.from('stock_movements').select('crop_id, quantity_kg'),
        supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg'),
        supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
      ]);
      const varieties: CropVariety[] = varietiesRes.data || [];
      setCrops(
        ((cropsRes.data as Crop[]) || []).map((c) => ({
          ...c,
          varieties: varieties.filter((v) => v.crop_id === c.id),
        }))
      );

      // Same physical formula everywhere: gross purchases − physical sales (+ adjustments)
      const purchases = (purchasesRes.data || []) as {
        crop_id: number;
        variety_id: number | null;
        gross_weight_kg: number;
      }[];
      const sales = (salesRes.data || []) as {
        crop_id: number;
        variety_id: number | null;
        physical_weight_kg: number;
      }[];
      const movements = (movementsRes.data || []) as {
        crop_id: number;
        quantity_kg: number;
        movement_type?: string;
      }[];

      const cStock: Record<number, number> = {};
      const cropIds = new Set<number>([
        ...purchases.map((p) => p.crop_id),
        ...sales.map((s) => s.crop_id),
        ...movements.map((m) => m.crop_id),
      ]);
      for (const cropId of cropIds) {
        const purchased = purchases
          .filter((p) => p.crop_id === cropId)
          .reduce((s, p) => s + Number(p.gross_weight_kg || 0), 0);
        const sold = sales
          .filter((s) => s.crop_id === cropId)
          .reduce((s, row) => s + Number(row.physical_weight_kg || 0), 0);
        const adj = movements
          .filter((m) => m.crop_id === cropId && m.movement_type === 'adjustment')
          .reduce((s, m) => s + Number(m.quantity_kg || 0), 0);
        const hasLedger =
          purchases.some((p) => p.crop_id === cropId) ||
          sales.some((s) => s.crop_id === cropId);
        cStock[cropId] = hasLedger
          ? Math.max(0, Number((purchased - sold + adj).toFixed(3)))
          : Math.max(
              0,
              Number(
                movements
                  .filter((m) => m.crop_id === cropId)
                  .reduce((s, m) => s + Number(m.quantity_kg || 0), 0)
                  .toFixed(3)
              )
            );
      }

      const vStock: Record<number, number> = {};
      purchases.forEach((p) => {
        if (p.variety_id) {
          vStock[p.variety_id] =
            (vStock[p.variety_id] || 0) + Number(p.gross_weight_kg || 0);
        }
      });
      sales.forEach((s) => {
        if (s.variety_id) {
          vStock[s.variety_id] =
            (vStock[s.variety_id] || 0) - Number(s.physical_weight_kg || 0);
        }
      });
      setCropStock(cStock);
      setVarietyStock(vStock);
      setIsLoading(false);
    }
    load();
  }, []);

  return (
    <>
      <TopHeader title="Crops & Varieties" subtitle="Manage crop types and varieties for purchases and sales" />
      <CropsClientPage initialCrops={crops} cropStock={cropStock} varietyStock={varietyStock} isLoading={isLoading} />
    </>
  );
}
