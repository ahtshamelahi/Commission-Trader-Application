'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { NewSaleInput } from '@/types/sale-data-types';
import { validateSaleInput } from '@/lib/validations/sale-form-validation';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { calculateAvailableStock } from '@/lib/calculations/current-stock-calculation';

export async function saveSaleTransaction(input: NewSaleInput) {
  const supabase = getSupabaseServerClient();

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
    input.rate_per_40kg
  );

  try {
    // Attempt atomic RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('fn_record_sale', {
      p_crop_id: input.crop_id,
      p_buyer_id: input.buyer_id || null,
      p_physical_weight_kg: input.physical_weight_kg,
      p_commission_per_40kg: input.commission_per_40kg,
      p_rate_per_40kg: input.rate_per_40kg,
      p_notes: input.notes || null,
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
        commission_per_40kg: input.commission_per_40kg,
        commission_weight_kg: calculations.commissionWeightKg,
        billable_weight_kg: calculations.billableWeightKg,
        rate_per_40kg: input.rate_per_40kg,
        sale_amount: calculations.saleAmountPkr,
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
