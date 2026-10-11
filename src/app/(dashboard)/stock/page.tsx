'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { StockStatsCards } from '@/components/stock/stock-stats-cards';
import { StockMovementsTable } from '@/components/stock/stock-movements-table';
import { History, LayoutGrid } from 'lucide-react';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { StockMovement } from '@/types/stock-data-types';

export default function StockPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [varieties, setVarieties] = useState<CropVariety[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStockData() {
      const [cropsRes, varietiesRes, purchasesRes, salesRes, movementsRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
        supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg, crop_amount'),
        supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
        supabase.from('stock_movements').select('*, crops(name)').order('created_at', { ascending: false }).limit(100),
      ]);

      setCrops(cropsRes.data || []);
      setVarieties(varietiesRes.data || []);
      setPurchases((purchasesRes.data as any) || []);
      setSales((salesRes.data as any) || []);
      setMovements(movementsRes.data || []);
      setIsLoading(false);
    }

    loadStockData();
  }, []);

  return (
    <>
      <TopHeader title="Current Physical Stock" subtitle="Live stock inventory by crop and variety, weighted-average costing, and audit ledger" />
      <div className="mt-4 space-y-4">
        {/* Crop Stock Stats Cards */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <LayoutGrid className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-800">Inventory by Type & Category</h2>
          </div>
          <StockStatsCards crops={crops} varieties={varieties} purchases={purchases} sales={sales} isLoading={isLoading} />
        </section>

        {/* Stock Ledger History */}
        <section className="space-y-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Stock Movements Audit Ledger</h2>
          </div>
          <StockMovementsTable movements={movements} isLoading={isLoading} />
        </section>
      </div>
    </>
  );
}
