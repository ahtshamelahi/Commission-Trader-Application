'use client';

// app/(dashboard)/sales/new/page.tsx
// Mounts the new connected SaleEntryForm (Spec-B + payment methods + Khata integration)

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { SaleEntryForm, BuyerOption } from '@/components/sales/sale-entry-form';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { StockMovement } from '@/types/stock-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';

export default function NewSalePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading sale form…</div>}>
      <NewSalePageInner />
    </Suspense>
  );
}

function NewSalePageInner() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [cropsRes, varietiesRes, buyersRes, movementsRes, purchasesRes, salesRes, balancesRes] = await Promise.all([
      supabase.from('crops').select('*').order('name', { ascending: true }),
      supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
      supabase
        .from('parties')
        .select('*')
        .or('party_type.eq.buyer,party_type.eq.both')
        .order('name', { ascending: true }),
      supabase.from('stock_movements').select('*'),
      supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg, crop_amount'),
      supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
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
    setStockMovements(movementsRes.data || []);
    setPurchases((purchasesRes.data as any) || []);
    setSales((salesRes.data as any) || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <TopHeader
        title="New Crop Sale"
        subtitle="Connected calculation form — actual weight, bardana deduction, bags, buyer commission %, and Khata payment"
      />
      <div className="mt-4">
        {isLoading ? (
          <div className="p-6 bg-white border border-slate-200 rounded-xl text-sm text-slate-500 text-center">
            Loading sale form…
          </div>
        ) : (
          <SaleEntryForm
            crops={crops}
            buyers={buyers}
            stockMovements={stockMovements}
            purchases={purchases}
            sales={sales}
            onSuccess={loadData}
          />
        )}
      </div>
    </>
  );
}