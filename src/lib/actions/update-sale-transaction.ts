'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { performSaleCalculations_legacy as performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { resolveAvailableStockKg } from '@/lib/calculations/current-stock-calculation';
import type { MultiSaleItem, SaleExpenseInput } from '@/lib/actions/save-multi-sale-transaction';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface SaleEditData {
  saleId: number;
  invoiceNo: string;
  buyerId: number;
  vehicleNumber: string;
  notes: string;
  amountReceived: number;
  item: MultiSaleItem;
  expenses: SaleExpenseInput[];
}

export async function loadSaleForEdit(
  saleId: number
): Promise<{ success: boolean; message?: string; data?: SaleEditData }> {
  if (!Number.isInteger(saleId) || saleId <= 0) {
    return { success: false, message: 'Invalid sale.' };
  }
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('sales')
    .select(
      `id, invoice_no, crop_id, variety_id, buyer_id, bags, physical_weight_kg,
       commission_per_40kg, bardana_per_bag_kg, rate_per_40kg, vehicle_number, notes,
       amount_received, crops(name), crop_varieties(name)`
    )
    .eq('id', saleId)
    .maybeSingle();

  if (error || !data) return { success: false, message: error?.message || 'Sale not found.' };

  const { data: expRows } = await supabase
    .from('sale_expenses')
    .select('amount, is_income, notes')
    .eq('sale_id', saleId)
    .order('id', { ascending: true });

  const expenses: SaleExpenseInput[] = (expRows || []).map((e) => ({
    amount: Number(e.amount) || 0,
    is_income: !!e.is_income,
    notes: (e.notes as string) || '',
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = data as any;
  return {
    success: true,
    data: {
      saleId: Number(row.id),
      invoiceNo: row.invoice_no || `SALE-${row.id}`,
      buyerId: Number(row.buyer_id) || 0,
      vehicleNumber: row.vehicle_number || '',
      notes: row.notes || '',
      amountReceived: Number(row.amount_received) || 0,
      item: {
        crop_id: Number(row.crop_id),
        variety_id: row.variety_id == null ? null : Number(row.variety_id),
        crop_name: row.crops?.name || '',
        variety_name: row.crop_varieties?.name || '',
        bags: Number(row.bags) || 0,
        physical_weight_kg: Number(row.physical_weight_kg) || 0,
        commission_per_40kg: Number(row.commission_per_40kg) || 0,
        bardana_per_bag_kg: Number(row.bardana_per_bag_kg) || 0,
        rate_per_40kg: Number(row.rate_per_40kg) || 0,
      },
      expenses,
    },
  };
}

export async function updateSaleTransaction(input: {
  saleId: number;
  buyer_id: number;
  item: MultiSaleItem;
  expenses: SaleExpenseInput[];
  vehicle_number?: string;
  notes?: string;
  amount_received: number;
}): Promise<{ success: boolean; message?: string; invoiceNo?: string }> {
  const { saleId, item } = input;
  if (!Number.isInteger(saleId) || saleId <= 0) return { success: false, message: 'Invalid sale.' };
  if (!Number.isInteger(input.buyer_id) || input.buyer_id <= 0) {
    return { success: false, message: 'Please select a buyer.' };
  }
  if (!item?.crop_id || !(item.physical_weight_kg > 0) || !(item.rate_per_40kg > 0)) {
    return { success: false, message: 'Item values are invalid.' };
  }
  if (!Number.isFinite(input.amount_received) || input.amount_received < 0) {
    return { success: false, message: 'Amount received cannot be negative.' };
  }

  const calc = performSaleCalculations(
    item.physical_weight_kg,
    item.commission_per_40kg,
    item.rate_per_40kg,
    item.bags || 0,
    item.bardana_per_bag_kg || 0
  );

  const supabase = await getSupabaseServerClient();

  const { data: existing, error: loadErr } = await supabase
    .from('sales')
    .select('id, invoice_no, crop_id, physical_weight_kg')
    .eq('id', saleId)
    .maybeSingle();

  if (loadErr || !existing) return { success: false, message: loadErr?.message || 'Sale not found.' };

  const [movementsRes, purchasesRes, salesRes] = await Promise.all([
    supabase
      .from('stock_movements')
      .select('quantity_kg, movement_type')
      .eq('crop_id', item.crop_id),
    supabase.from('purchases').select('gross_weight_kg').eq('crop_id', item.crop_id),
    supabase.from('sales').select('id, physical_weight_kg').eq('crop_id', item.crop_id),
  ]);

  const otherSales = (salesRes.data || []).filter((s) => Number(s.id) !== saleId);
  const available = resolveAvailableStockKg({
    purchases: purchasesRes.data || [],
    sales: otherSales,
    movements: movementsRes.data || [],
  });
  if (item.physical_weight_kg > available + 0.0005) {
    return { success: false, message: 'Not enough stock for this crop.' };
  }

  const expNet = (input.expenses || []).reduce(
    (s, e) => s + (e.amount > 0 ? (e.is_income ? e.amount : -e.amount) : 0),
    0
  );
  const documentTotal = round2(calc.saleAmountPkr + expNet);
  const amountReceived = round2(input.amount_received);

  const { error: updErr } = await supabase
    .from('sales')
    .update({
      crop_id: item.crop_id,
      variety_id: item.variety_id || null,
      buyer_id: input.buyer_id,
      bags: item.bags || 0,
      physical_weight_kg: item.physical_weight_kg,
      commission_per_40kg: item.commission_per_40kg,
      commission_weight_kg: calc.commissionWeightKg,
      bardana_per_bag_kg: item.bardana_per_bag_kg || 0,
      bardana_total_kg: calc.bardanaWeightKg,
      billable_weight_kg: calc.billableWeightKg,
      rate_per_40kg: item.rate_per_40kg,
      sale_amount: calc.saleAmountPkr,
      vehicle_number: input.vehicle_number || null,
      notes: input.notes || null,
      document_total: documentTotal,
      amount_received: amountReceived,
      updated_at: new Date().toISOString(),
    })
    .eq('id', saleId);

  if (updErr) return { success: false, message: updErr.message };

  await supabase.from('stock_movements').delete().eq('sale_id', saleId);
  await supabase.from('stock_movements').insert({
    crop_id: item.crop_id,
    sale_id: saleId,
    movement_type: 'sale',
    quantity_kg: -item.physical_weight_kg,
    notes: 'Physical delivery to buyer',
  });

  await supabase.from('sale_expenses').delete().eq('sale_id', saleId);
  await supabase.from('expenses').delete().eq('sale_id', saleId).in('category', ['Sale Expense', 'Sale Adjustment', 'General']);

  const validExpenses = (input.expenses || []).filter((e) => e.amount > 0);
  if (validExpenses.length > 0) {
    await supabase.from('sale_expenses').insert(
      validExpenses.map((e) => ({
        sale_id: saleId,
        expense_type: e.is_income ? 'Sale Adjustment' : 'Sale Expense',
        amount: e.amount,
        is_income: e.is_income,
        notes: (e.notes || '').trim() || null,
      }))
    );
    await supabase.from('expenses').insert(
      validExpenses.map((e) => ({
        expense_date: new Date().toISOString(),
        category: e.is_income ? 'Sale Adjustment' : 'Sale Expense',
        amount: e.amount,
        sale_id: saleId,
        is_income: e.is_income,
        notes: (e.notes || '').trim() || null,
      }))
    );
  }

  revalidatePath('/sales/all');
  revalidatePath('/sales/new');
  revalidatePath('/khata');
  revalidatePath('/stock');

  return { success: true, invoiceNo: existing.invoice_no || `SALE-${saleId}` };
}
