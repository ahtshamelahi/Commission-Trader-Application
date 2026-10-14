import React from 'react';
import { TopHeader } from '@/components/layout/top-header';
import { KhataPartyList } from '@/components/khata/khata-party-list';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export const metadata = {
  title: 'Purchase Khata | M-Shafiq Commission Shop',
  description: 'View all supplier accounts, transaction history and receipts.',
};

export default async function PurchaseKhataPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string }>;
}) {
  const { partyId: partyIdParam } = await searchParams;
  const initialPartyId = partyIdParam ? Number(partyIdParam) : null;
  const supabase = getSupabaseServerClient();

  // Fetch all purchases with supplier and crop info
  const { data: purchasesData } = await supabase
    .from('purchases')
    .select('id, invoice_no, created_at, supplier_id, crop_amount, gross_weight_kg, bags, notes, crops(name)')
    .order('created_at', { ascending: false });

  // Fetch all suppliers
  const { data: suppliersData } = await supabase
    .from('parties')
    .select('id, name, phone, address')
    .or('party_type.eq.supplier,party_type.eq.both')
    .order('name', { ascending: true });

  const suppliers = suppliersData || [];
  const purchases = purchasesData || [];

  // Group purchases by supplier
  const partiesWithTx = suppliers.map((supplier) => {
    const supplierPurchases = purchases
      .filter((p: any) => p.supplier_id === supplier.id)
      .map((p: any) => ({
        id: p.id,
        invoice_no: p.invoice_no,
        created_at: p.created_at,
        amount: p.crop_amount || 0,
        crop_name: p.crops?.name || '—',
        notes: p.notes,
        gross_weight_kg: p.gross_weight_kg,
        bags: p.bags,
      }));

    const totalAmount = supplierPurchases.reduce((sum: number, p: any) => sum + p.amount, 0);

    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      transactions: supplierPurchases,
      totalAmount,
      txCount: supplierPurchases.length,
    };
  });

  // Also include purchases with no supplier linked
  const unknownSupplierPurchases = purchases.filter((p: any) => !p.supplier_id);
  if (unknownSupplierPurchases.length > 0) {
    partiesWithTx.push({
      id: -1,
      name: 'Unknown / Direct',
      phone: null,
      address: null,
      transactions: unknownSupplierPurchases.map((p: any) => ({
        id: p.id,
        invoice_no: p.invoice_no,
        created_at: p.created_at,
        amount: p.crop_amount || 0,
        crop_name: p.crops?.name || '—',
        notes: p.notes,
        gross_weight_kg: p.gross_weight_kg,
        bags: p.bags,
      })),
      totalAmount: unknownSupplierPurchases.reduce((sum: number, p: any) => sum + (p.crop_amount || 0), 0),
      txCount: unknownSupplierPurchases.length,
    });
  }

  // Sort by total amount descending
  partiesWithTx.sort((a, b) => b.totalAmount - a.totalAmount);

  return (
    <>
      <TopHeader
        title="Purchase Khata"
        subtitle="Supplier accounts — view transaction history and receipts for each supplier"
      />
      <div className="mt-4 h-[calc(100vh-140px)]">
        <KhataPartyList
          parties={partiesWithTx}
          type="purchases"
          title="All Suppliers"
          colorScheme="blue"
          initialPartyId={initialPartyId && !Number.isNaN(initialPartyId) ? initialPartyId : null}
        />
      </div>
    </>
  );
}
