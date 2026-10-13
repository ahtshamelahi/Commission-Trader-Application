import React from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { KhataPartyList } from '@/components/khata/khata-party-list';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export const metadata = {
  title: 'Sales Khata | M-Shafiq Commission Shop',
  description: 'View all buyer accounts, transaction history and receipts.',
};

export default async function SalesKhataPage() {
  const supabase = getSupabaseServerClient();

  // Fetch all sales with buyer and crop info
  const { data: salesData } = await supabase
    .from('sales')
    .select('id, invoice_no, created_at, buyer_id, sale_amount, physical_weight_kg, notes, crops(name)')
    .order('created_at', { ascending: false });

  // Fetch all buyers
  const { data: buyersData } = await supabase
    .from('parties')
    .select('id, name, phone, address')
    .or('party_type.eq.buyer,party_type.eq.both')
    .order('name', { ascending: true });

  const buyers = buyersData || [];
  const sales = salesData || [];

  // Group sales by buyer
  const partiesWithTx = buyers.map((buyer) => {
    const buyerSales = sales
      .filter((s: any) => s.buyer_id === buyer.id)
      .map((s: any) => ({
        id: s.id,
        invoice_no: s.invoice_no,
        created_at: s.created_at,
        amount: s.sale_amount || 0,
        crop_name: s.crops?.name || '—',
        notes: s.notes,
        physical_weight_kg: s.physical_weight_kg,
      }));

    const totalAmount = buyerSales.reduce((sum: number, s: any) => sum + s.amount, 0);

    return {
      id: buyer.id,
      name: buyer.name,
      phone: buyer.phone,
      address: buyer.address,
      transactions: buyerSales,
      totalAmount,
      txCount: buyerSales.length,
    };
  });

  // Also include buyers who appear in sales but aren't in parties list
  const unknownBuyerSales = sales.filter((s: any) => !s.buyer_id);
  if (unknownBuyerSales.length > 0) {
    partiesWithTx.push({
      id: -1,
      name: 'Walk-in / Unknown',
      phone: null,
      address: null,
      transactions: unknownBuyerSales.map((s: any) => ({
        id: s.id,
        invoice_no: s.invoice_no,
        created_at: s.created_at,
        amount: s.sale_amount || 0,
        crop_name: s.crops?.name || '—',
        notes: s.notes,
        physical_weight_kg: s.physical_weight_kg,
      })),
      totalAmount: unknownBuyerSales.reduce((sum: number, s: any) => sum + (s.sale_amount || 0), 0),
      txCount: unknownBuyerSales.length,
    });
  }

  // Sort by total amount descending
  partiesWithTx.sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <>
      <TopHeader
        title="Sales Khata"
        subtitle="Buyer accounts — view transaction history and receipts for each buyer"
      />
      <div className="mt-4 h-[calc(100vh-140px)]">
        <KhataPartyList
          parties={partiesWithTx}
          type="sales"
          title="All Buyers"
          colorScheme="emerald"
        />
      </div>
    </>
  );
}
