'use client';

// app/(dashboard)/sales/new/page.tsx   (adjust the path if your route differs)
import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PosSaleForm, type BuyerOption } from '@/components/sales/pos-sale-form';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Crop, CropVariety } from '@/types/crop-data-types';

export default function NewSalePage() {
  const [crops, setCrops] = useState<Crop[]>([]);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);

  // each section loads on its own, so the page and form open immediately
  const [cropsLoading, setCropsLoading] = useState(true);
  const [buyersLoading, setBuyersLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const addError = (msg: string) =>
      setLoadError((prev) => (prev ? `${prev} ${msg}` : msg));

    // crops + varieties
    (async () => {
      const [cropsRes, varietiesRes] = await Promise.all([
        supabase.from('crops').select('*').order('name', { ascending: true }),
        supabase.from('crop_varieties').select('*').order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      if (cropsRes.error || varietiesRes.error) addError('Could not load crops.');
      const varieties: CropVariety[] = (varietiesRes.data as any) || [];
      setCrops(
        ((cropsRes.data as any[]) || []).map((c) => ({
          ...c,
          varieties: varieties.filter((v) => v.crop_id === c.id),
        }))
      );
      setCropsLoading(false);
    })();

    // buyers (+ outstanding balance when the buyer_balances view exists)
    (async () => {
      const [buyersRes, balancesRes] = await Promise.all([
        supabase
          .from('parties')
          .select('*')
          .or('party_type.eq.buyer,party_type.eq.both')
          .order('name', { ascending: true }),
        supabase.from('buyer_balances').select('buyer_id, outstanding'),
      ]);
      if (cancelled) return;
      if (buyersRes.error) addError('Could not load buyers.');
      const balanceMap = new Map<number, number>();
      if (!balancesRes.error) {
        (balancesRes.data || []).forEach((r: any) => balanceMap.set(Number(r.buyer_id), Number(r.outstanding)));
      }
      setBuyers(
        ((buyersRes.data as any[]) || []).map((b) => ({
          ...b,
          outstanding: balancesRes.error ? null : balanceMap.get(b.id) ?? 0,
        }))
      );
      setBuyersLoading(false);
    })();

    // stock data (same queries as before)
    (async () => {
      const [purchasesRes, salesRes] = await Promise.all([
        supabase.from('purchases').select('crop_id, variety_id, gross_weight_kg'),
        supabase.from('sales').select('crop_id, variety_id, physical_weight_kg'),
      ]);
      if (cancelled) return;
      if (purchasesRes.error || salesRes.error) addError('Could not load stock figures.');
      setPurchases(purchasesRes.data || []);
      setSales(salesRes.data || []);
      setStockLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TopHeader
        title="New Sale"
        subtitle="Select buyer & crop → add items → choose payment → save sale"
      />
      <PosSaleForm
        crops={crops}
        buyers={buyers}
        purchases={purchases}
        sales={sales}
        cropsLoading={cropsLoading}
        buyersLoading={buyersLoading}
        stockLoading={stockLoading}
        loadError={loadError}
      />
    </>
  );
}