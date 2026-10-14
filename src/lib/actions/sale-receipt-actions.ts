'use server';

// lib/actions/sale-receipt-actions.ts
// Loads a receipt from SAVED database records (not from form values).
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export interface SaleReceiptItem {
  cropName: string;
  varietyName: string;
  bags: number;
  physicalWeightKg: number;
  commissionPer40kg: number;
  commissionWeightKg: number;
  bardanaPerBagKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  ratePer40kg: number;
  saleAmountPkr: number;
}

export interface SaleReceiptExpense {
  label: string;
  amount: number;
  isIncome: boolean; // true = added to the total, false = deducted
}

export interface SaleReceipt {
  invoiceId: number;
  invoiceNo: string;
  createdAt: string;
  buyerId: number;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  vehicleNumber: string;
  notes: string;
  items: SaleReceiptItem[];
  expenses: SaleReceiptExpense[];
  itemsTotal: number;
  adjustmentAmount: number;
  adjustmentIsIncome: boolean; // true = added to total, false = deducted
  adjustmentNotes: string;
  grandTotal: number;
  amountReceived: number;
  remaining: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function getSaleReceipt(
  invoiceId: number
): Promise<{ success: boolean; message?: string; receipt?: SaleReceipt }> {
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return { success: false, message: 'Invalid sale.' };
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('sale_invoices')
    .select(
      `id, invoice_no, buyer_id, items_total, adjustment_amount, adjustment_is_income,
       adjustment_notes, grand_total, vehicle_number, notes, created_at,
       parties(name, phone, address),
       sales(id, bags, physical_weight_kg, commission_per_40kg, commission_weight_kg,
             bardana_per_bag_kg, bardana_total_kg, billable_weight_kg, rate_per_40kg,
             sale_amount, crops(name), crop_varieties(name)),
       sale_payments(amount, payment_kind)`
    )
    .eq('id', invoiceId)
    .single();

  if (error || !data) {
    return { success: false, message: error?.message || 'Sale not found.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sales: any[] = [...(d.sales || [])].sort((a, b) => a.id - b.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialPayments: any[] = (d.sale_payments || []).filter((p: any) => p.payment_kind === 'initial');
  const amountReceived = round2(initialPayments.reduce((s, p) => s + num(p.amount), 0));
  const grandTotal = num(d.grand_total);

  // expenses saved for this sale (one row per entry)
  const saleIds: number[] = sales.map((x) => x.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let expenseRows: any[] = [];
  if (saleIds.length > 0) {
    const { data: ex } = await supabase
      .from('expenses')
      .select('id, category, amount, notes, is_income')
      .in('sale_id', saleIds)
      .in('category', ['Sale Expense', 'Sale Adjustment'])
      .order('id', { ascending: true });
    expenseRows = ex || [];
  }

  const receipt: SaleReceipt = {
    invoiceId: d.id,
    invoiceNo: d.invoice_no,
    createdAt: d.created_at,
    buyerId: d.buyer_id,
    buyerName: d.parties?.name ?? '—',
    buyerPhone: d.parties?.phone ?? '',
    buyerAddress: d.parties?.address ?? '',
    vehicleNumber: d.vehicle_number ?? '',
    notes: d.notes ?? '',
    items: sales.map((s) => ({
      cropName: s.crops?.name ?? '—',
      varietyName: s.crop_varieties?.name ?? '',
      bags: num(s.bags),
      physicalWeightKg: num(s.physical_weight_kg),
      commissionPer40kg: num(s.commission_per_40kg),
      commissionWeightKg: num(s.commission_weight_kg),
      bardanaPerBagKg: num(s.bardana_per_bag_kg),
      bardanaWeightKg: num(s.bardana_total_kg),
      billableWeightKg: num(s.billable_weight_kg),
      ratePer40kg: num(s.rate_per_40kg),
      saleAmountPkr: num(s.sale_amount),
    })),
    expenses: expenseRows.map((e) => ({
      label: e.notes || (e.is_income ? 'Added charge' : 'Expense'),
      amount: num(e.amount),
      isIncome: !!e.is_income,
    })),
    itemsTotal: num(d.items_total),
    adjustmentAmount: num(d.adjustment_amount),
    adjustmentIsIncome: !!d.adjustment_is_income,
    adjustmentNotes: d.adjustment_notes ?? '',
    grandTotal,
    amountReceived,
    remaining: round2(grandTotal - amountReceived),
  };

  return { success: true, receipt };
}