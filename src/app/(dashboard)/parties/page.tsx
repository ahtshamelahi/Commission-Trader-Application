'use client';

import React, { useEffect, useState } from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { PartiesClientPage } from '@/components/parties/parties-client-page';
import { supabase } from '@/lib/supabase/supabase-browser-client';
import { Party } from '@/types/party-data-types';
import { calculateStoredPurchaseTotalPkr } from '@/lib/calculations/purchase-amount-calculation';

export type PartyTradeTotals = Record<number, { salesTotal: number; purchaseTotal: number }>;

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [tradeTotals, setTradeTotals] = useState<PartyTradeTotals>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [partiesRes, salesRes, purchasesRes] = await Promise.all([
        supabase.from('parties').select('*').order('name', { ascending: true }),
        supabase.from('sales').select('buyer_id, sale_amount'),
        supabase
          .from('purchases')
          .select('supplier_id, crop_amount, purchase_expenses(amount, is_income)'),
      ]);
      setParties(partiesRes.data || []);
      const totals: PartyTradeTotals = {};
      for (const s of salesRes.data || []) {
        if (!s.buyer_id) continue;
        if (!totals[s.buyer_id]) totals[s.buyer_id] = { salesTotal: 0, purchaseTotal: 0 };
        totals[s.buyer_id].salesTotal += Number(s.sale_amount) || 0;
      }
      for (const p of purchasesRes.data || []) {
        if (!p.supplier_id) continue;
        if (!totals[p.supplier_id]) totals[p.supplier_id] = { salesTotal: 0, purchaseTotal: 0 };
        totals[p.supplier_id].purchaseTotal += calculateStoredPurchaseTotalPkr(
          p.crop_amount,
          p.purchase_expenses
        );
      }
      setTradeTotals(totals);
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <>
      <TopHeader title="Parties" subtitle="Customers, suppliers, and mixed-role trading parties" />
      <PartiesClientPage initialParties={parties} tradeTotals={tradeTotals} isLoading={isLoading} />
    </>
  );
}
