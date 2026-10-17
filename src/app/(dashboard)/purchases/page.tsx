'use client';

// app/(dashboard)/purchases/page.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PurchaseEntryForm, SupplierOption } from '@/components/purchases/purchase-entry-form';
import { PurchaseDetailsTable } from '@/components/purchases/purchase-details-table';
import { History } from 'lucide-react';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Purchase } from '@/types/purchase-data-types';

export default function PurchasesPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [cropsRes, varietiesRes, suppliersRes, purchasesRes, balancesRes] = await Promise.all([
      supabase.from('crops').select('*').order('name', { ascending: true }),
      supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
      supabase.from('parties').select('*').or('party_type.eq.supplier,party_type.eq.both').order('name', { ascending: true }),
      supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }).limit(100),
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

    const structuredSuppliers: SupplierOption[] = ((suppliersRes.data as any[]) || []).map((s) => ({
      ...s,
      outstanding: balanceMap.has(s.id)
        ? balanceMap.get(s.id)!
        : s.balance !== undefined
          ? Number(s.balance)
          : null,
    }));

    setCrops(structuredCrops);
    setSuppliers(structuredSuppliers);
    setPurchases(purchasesRes.data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <>
      <TopHeader
        title="Crop Purchases"
        subtitle="Record crop purchases, calculate deduction weights, and update physical stock"
      />
      <div className="mt-4 space-y-6">
        <section>
          <PurchaseEntryForm
            crops={crops}
            suppliers={suppliers}
            onSuccess={loadData}
          />
        </section>

        <section className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Recent Purchase History</h2>
          </div>
          <PurchaseDetailsTable purchases={purchases} isLoading={isLoading} />
        </section>
      </div>
    </>
  );
}
