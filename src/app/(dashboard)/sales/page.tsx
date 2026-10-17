'use client';

// app/(dashboard)/sales/page.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { SaleEntryForm, BuyerOption } from '@/components/sales/sale-entry-form';
import { SaleDetailsTable } from '@/components/sales/sale-details-table';
import { History } from 'lucide-react';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { StockMovement } from '@/types/stock-data-types';

export default function SalesPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [cropsRes, varietiesRes, buyersRes, salesRes, purchasesRes, movementsRes, balancesRes] = await Promise.all([
      supabase.from('crops').select('*').order('name', { ascending: true }),
      supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
      supabase.from('parties').select('*').or('party_type.eq.buyer,party_type.eq.both').order('name', { ascending: true }),
      supabase.from('sales').select('*, crops(name), parties(name)').order('created_at', { ascending: false }).limit(100),
      supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg, crop_amount'),
      supabase.from('stock_movements').select('*'),
      supabase.from('party_balances').select('party_id, balance'),
    ]);

    const balanceMap = new Map<number, number>();
    if (!balancesRes.error && Array.isArray(balancesRes.data)) {
      balancesRes.data.forEach((r: any) => balanceMap.set(Number(r.party_id), Number(r.balance)));
    }

    const varieties: CropVariety[] = (varietiesRes.data as any) || [];
    const structuredCrops: Crop[] = ((cropsRes.data as any[]) || []).map((c) => ({
      ...c,
      varieties: varieties.filter((v) => v.crop_id === c.id),
    }));

    const structuredBuyers: BuyerOption[] = ((buyersRes.data as any[]) || []).map((b) => ({
      ...b,
      outstanding: balanceMap.has(b.id)
        ? balanceMap.get(b.id)!
        : b.balance !== undefined
        ? Number(b.balance)
        : null,
    }));

    setCrops(structuredCrops);
    setBuyers(structuredBuyers);
    setSales(salesRes.data || []);
    setPurchases((purchasesRes.data as any) || []);
    setStockMovements(movementsRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <>
      <TopHeader
        title="Crop Sales"
        subtitle="Record crop sales, calculate net sale weight (bardana deduction), and deduct physical stock"
      />
      <div className="mt-4 space-y-6">
        <section>
          <SaleEntryForm
            crops={crops}
            buyers={buyers}
            stockMovements={stockMovements}
            purchases={purchases}
            sales={sales}
            onSuccess={loadData}
          />
        </section>

        <section className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Recent Sales History</h2>
          </div>
          <SaleDetailsTable sales={sales} isLoading={isLoading} />
        </section>
      </div>
    </>
  );
}
