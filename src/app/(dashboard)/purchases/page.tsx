'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PurchaseEntryForm } from '@/components/purchases/purchase-entry-form';
import { PurchaseDetailsTable } from '@/components/purchases/purchase-details-table';
import { History } from 'lucide-react';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';

export default function PurchasesPage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPurchasesData() {
      const [cropsRes, varietiesRes, suppliersRes, purchasesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
        supabase.from('parties').select('*').or('party_type.eq.supplier,party_type.eq.both').order('name', { ascending: true }),
        supabase.from('purchases').select('*, crops(name), parties(name)').order('created_at', { ascending: false }).limit(100),
      ]);

      const varieties: CropVariety[] = (varietiesRes.data as any) || [];
      const structuredCrops: Crop[] = ((cropsRes.data as any[]) || []).map((c) => ({
        ...c,
        varieties: varieties.filter((v) => v.crop_id === c.id),
      }));

      setCrops(structuredCrops);
      setSuppliers(suppliersRes.data || []);
      setPurchases(purchasesRes.data || []);
      setIsLoading(false);
    }

    loadPurchasesData();
  }, []);

  return (
    <>
      <TopHeader title="Crop Purchases" subtitle="Record crop purchases, calculate commission deductions, and incoming stock" />
      <div className="mt-4 space-y-4">
        <section className="space-y-3">
          <PurchaseEntryForm crops={crops} suppliers={suppliers} />
        </section>
        <section className="space-y-3 pt-3 border-t border-slate-200">
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
