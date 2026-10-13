'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { calculateAvailableStock } from '@/lib/calculations/current-stock-calculation';

export interface MultiSaleItem {
  crop_id: number;
  variety_id: number | null;
  variety_name?: string;
  crop_name?: string;
  bags: number;
  physical_weight_kg: number;
  commission_per_40kg: number;
  bardana_per_bag_kg: number;
  rate_per_40kg: number;
}

export interface MultiSaleInput {
  buyer_id: number | null;
  items: MultiSaleItem[];
  expense_amount: number;
  expense_notes?: string;
  vehicle_number?: string;
  notes?: string;
}

export async function saveMultiSaleTransaction(input: MultiSaleInput) {
  if (!input.items.length) {
    return { success: false, message: 'At least one item is required.' };
  }

  const supabase = getSupabaseServerClient();

  // Validate stock for each item
  for (const item of input.items) {
    let purQuery = supabase.from('purchases').select('gross_weight_kg').eq('crop_id', item.crop_id);
    if (item.variety_id) purQuery = purQuery.eq('variety_id', item.variety_id);
    else purQuery = purQuery.is('variety_id', null);

    let saleQuery = supabase.from('sales').select('physical_weight_kg').eq('crop_id', item.crop_id);
    if (item.variety_id) saleQuery = saleQuery.eq('variety_id', item.variety_id);
    else saleQuery = saleQuery.is('variety_id', null);

    const [purRes, saleRes] = await Promise.all([purQuery, saleQuery]);

    // Stock = gross weight purchased (full physical stock) minus physical weight sold
    const totalPur = (purRes.data || []).reduce((acc, p) => acc + Number(p.gross_weight_kg), 0);
    const totalSale = (saleRes.data || []).reduce((acc, s) => acc + Number(s.physical_weight_kg), 0);
    const availableKg = totalPur - totalSale;

    if (item.physical_weight_kg > availableKg) {
      return {
        success: false,
        message: `Insufficient stock for ${item.crop_name || 'crop'}${item.variety_name ? ' (' + item.variety_name + ')' : ''}: needed ${item.physical_weight_kg} kg, available ${availableKg} kg.`,
      };
    }
  }

  const invoiceNo = `SALE-${Date.now().toString().slice(-8)}`;

  try {
    const insertedIds: number[] = [];

    let itemIndex = 1;
    for (const item of input.items) {
      const calc = performSaleCalculations(
        item.physical_weight_kg,
        item.commission_per_40kg,
        item.rate_per_40kg,
        item.bags || 0,
        item.bardana_per_bag_kg || 0
      );

      const itemInvoiceNo = input.items.length > 1 ? `${invoiceNo}-${itemIndex}` : invoiceNo;

      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert({
          invoice_no: itemInvoiceNo,
          crop_id: item.crop_id,
          variety_id: item.variety_id || null,
          buyer_id: input.buyer_id || null,
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
        })
        .select('id')
        .single();

      if (saleErr) return { success: false, message: saleErr.message };

      const saleId = saleData.id;
      insertedIds.push(saleId);

      // Stock movement per item
      await supabase.from('stock_movements').insert({
        crop_id: item.crop_id,
        sale_id: saleId,
        movement_type: 'sale',
        quantity_kg: -item.physical_weight_kg,
        notes: `Sale: ${item.crop_name || ''}${item.variety_name ? ' - ' + item.variety_name : ''}`,
      });
      
      itemIndex++;
    }

    // Shared expense (once for whole invoice)
    if (Number(input.expense_amount) > 0) {
      await supabase.from('expenses').insert({
        expense_date: new Date().toISOString(),
        category: 'Sale Expense',
        amount: Number(input.expense_amount),
        notes: input.expense_notes || `Sale invoice ${invoiceNo}`,
      });
    }

    return { success: true, invoiceNo };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save sale.';
    return { success: false, message };
  }
}
