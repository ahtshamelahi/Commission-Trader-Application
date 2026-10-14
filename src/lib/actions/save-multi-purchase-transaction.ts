'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import {
  performPurchaseCalculations,
} from '@/lib/calculations/purchase-amount-calculation';

export interface MultiPurchaseItem {
  crop_id: number;
  variety_id: number | null;
  variety_name?: string;
  crop_name?: string;
  bags: number;
  gross_weight_kg: number;
  commission_per_40kg: number;
  rate_per_40kg: number;
  bardana_per_bag_kg: number;
}

export interface MultiPurchaseInput {
  supplier_id: number;
  items: MultiPurchaseItem[];
  expenses: { expense_type: string; amount: number; is_income: boolean; notes: string }[];
  vehicle_number?: string;
  notes?: string;
}

export async function saveMultiPurchaseTransaction(input: MultiPurchaseInput) {
  if (!input.supplier_id) {
    return { success: false, message: 'Supplier is required.' };
  }

  if (!input.items.length) {
    return { success: false, message: 'At least one item is required.' };
  }

  const supabase = getSupabaseServerClient();
  const invoiceNo = `PUR-${Date.now().toString().slice(-8)}`;

  try {
    const insertedIds: number[] = [];

    let itemIndex = 1;
    for (const item of input.items) {
      const calc = performPurchaseCalculations(
        item.gross_weight_kg,
        item.commission_per_40kg,
        item.rate_per_40kg,
        item.bags || 0,
        item.bardana_per_bag_kg || 0
      );

      const itemInvoiceNo = input.items.length > 1 ? `${invoiceNo}-${itemIndex}` : invoiceNo;

      const { data: purData, error: purErr } = await supabase
        .from('purchases')
        .insert({
          invoice_no: itemInvoiceNo,
          crop_id: item.crop_id,
          variety_id: item.variety_id || null,
          supplier_id: input.supplier_id,
          bags: item.bags || 0,
          gross_weight_kg: item.gross_weight_kg,
          commission_per_40kg: item.commission_per_40kg,
          commission_weight_kg: calc.commissionWeightKg,
          bardana_per_bag_kg: item.bardana_per_bag_kg || 0,
          bardana_total_kg: calc.bardanaWeightKg,
          net_weight_kg: calc.netWeightKg,
          rate_per_40kg: item.rate_per_40kg,
          crop_amount: calc.cropAmountPkr,
          vehicle_number: input.vehicle_number || null,
          notes: input.notes || null,
        })
        .select('id')
        .single();

      if (purErr) return { success: false, message: purErr.message };

      const purchaseId = purData.id;
      insertedIds.push(purchaseId);

      // Stock movement per item — add GROSS weight to stock.
      // Commission is the shop's profit on weight; the physical stock received
      // is the full gross weight, not the net (payment) weight.
      await supabase.from('stock_movements').insert({
        crop_id: item.crop_id,
        purchase_id: purchaseId,
        movement_type: 'purchase',
        quantity_kg: item.gross_weight_kg,
        notes: `Purchase: ${item.crop_name || ''}${item.variety_name ? ' - ' + item.variety_name : ''}`,
      });

      itemIndex++;
    }

    // Shared expenses (linked to first purchase for reference)
    const validExpenses = input.expenses.filter((e) => Number(e.amount) > 0);
    if (validExpenses.length > 0) {
      const expRows = validExpenses.map((e) => ({
        expense_date: new Date().toISOString(),
        category: e.expense_type || 'General',
        amount: Number(e.amount),
        purchase_id: insertedIds[0],
        is_income: e.is_income || false,
        notes: e.notes || null,
      }));
      await supabase.from('expenses').insert(expRows);

      const purExpRows = validExpenses.map((e) => ({
        purchase_id: insertedIds[0],
        expense_type: e.expense_type || 'General',
        amount: Number(e.amount),
        is_income: e.is_income || false,
        notes: e.notes || null,
      }));
      await supabase.from('purchase_expenses').insert(purExpRows);
    }

    return { success: true, invoiceNo };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save purchase.';
    return { success: false, message };
  }
}