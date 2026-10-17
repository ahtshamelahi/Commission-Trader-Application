'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { NewSaleInput } from '@/types/sale-data-types';
import { validateSaleInput } from '@/lib/validations/sale-form-validation';
import { performSaleCalculations_legacy as performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { calculateAvailableStock } from '@/lib/calculations/current-stock-calculation';

export interface SaleExpenseInput {
  expense_type: string;
  amount: number;
  is_income: boolean;
  notes: string;
}

export interface NewSaleWithExpensesInput extends NewSaleInput {
  bags?: number;
  bardana_per_bag_kg?: number;
  vehicle_number?: string;
  expenses?: SaleExpenseInput[];
}

export async function saveSaleTransaction(input: NewSaleWithExpensesInput) {
  const supabase = await getSupabaseServerClient();

  // 1. Fetch current available stock for validation
  const { data: movements, error: moveError } = await supabase
    .from('stock_movements')
    .select('quantity_kg')
    .eq('crop_id', input.crop_id);

  if (moveError) {
    return { success: false, message: 'Failed to verify current stock levels.' };
  }

  const availableStockKg = calculateAvailableStock(movements || []);
  const validation = validateSaleInput(input, availableStockKg);

  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  const calculations = performSaleCalculations(
    input.physical_weight_kg,
    input.commission_per_40kg,
    input.rate_per_40kg,
    input.bags || 0,
    input.bardana_per_bag_kg || 0
  );

  const validExpenses = (input.expenses || []).filter((e) => Number(e.amount) > 0);

  try {
    // Attempt atomic RPC function with expenses support
    const { data: rpcData, error: rpcError } = await supabase.rpc('fn_record_sale', {
      p_crop_id: input.crop_id,
      p_buyer_id: input.buyer_id || null,
      p_physical_weight_kg: input.physical_weight_kg,
      p_commission_per_40kg: input.commission_per_40kg,
      p_rate_per_40kg: input.rate_per_40kg,
      p_notes: input.notes || null,
      p_expenses: validExpenses.length > 0 ? validExpenses : [],
    });

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        saleId: rpcData.sale_id,
        invoiceNo: rpcData.invoice_no,
      };
    }

    // Fallback if RPC function not created in DB environment yet
    const invoiceNo = `SALE-${Date.now().toString().slice(-6)}`;

    // 1. Insert Sale Record
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        invoice_no: invoiceNo,
        crop_id: input.crop_id,
        buyer_id: input.buyer_id || null,
        physical_weight_kg: input.physical_weight_kg,
        bags: input.bags || 0,
        commission_per_40kg: input.commission_per_40kg,
        commission_weight_kg: calculations.commissionWeightKg,
        bardana_per_bag_kg: input.bardana_per_bag_kg || 0,
        bardana_total_kg: calculations.bardanaWeightKg,
        billable_weight_kg: calculations.billableWeightKg,
        rate_per_40kg: input.rate_per_40kg,
        sale_amount: calculations.saleAmountPkr,
        vehicle_number: input.vehicle_number || null,
        notes: input.notes || null,
      })
      .select('id, invoice_no')
      .single();

    if (saleError) {
      return { success: false, message: saleError.message };
    }

    const saleId = saleData.id;

     // 2. Reduce Physical Stock (-physical_weight_kg)
     const { error: stockError } = await supabase.from('stock_movements').insert({
       crop_id: input.crop_id,
       sale_id: saleId,
       movement_type: 'sale',
       quantity_kg: -input.physical_weight_kg,
       notes: 'Physical delivery to buyer',
     });

     if (stockError) {
       console.error('Stock movement error during sale:', stockError.message);
       return {
         success: false,
         saleId,
         invoiceNo: saleData.invoice_no,
         message:
           `Sale ${saleData.invoice_no} was saved, but its stock movement failed. ` +
           'Do not retry the sale; reconcile stock first.',
       };
     }

    // 3. Insert Sale Expenses
    if (validExpenses.length > 0) {
      const saleExpRows = validExpenses.map((e) => ({
        sale_id: saleId,
        expense_type: e.expense_type || 'General',
        amount: Number(e.amount),
        is_income: e.is_income || false,
        notes: e.notes || null,
      }));
      await supabase.from('sale_expenses').insert(saleExpRows);

      const expRows = validExpenses.map((e) => ({
        expense_date: new Date().toISOString(),
        category: e.expense_type || 'General',
        amount: Number(e.amount),
        sale_id: saleId,
        is_income: e.is_income || false,
        notes: e.notes || null,
      }));
      await supabase.from('expenses').insert(expRows);
    }

    return {
      success: true,
      saleId,
      invoiceNo: saleData.invoice_no,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save sale transaction.';
    return { success: false, message };
  }
}
