'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { NewPurchaseInput } from '@/types/purchase-data-types';
import { validatePurchaseInput } from '@/lib/validations/purchase-form-validation';
import { performPurchaseCalculations } from '@/lib/calculations/purchase-amount-calculation';

export async function savePurchaseTransaction(input: NewPurchaseInput) {
  const validation = validatePurchaseInput(input);
  if (!validation.isValid) {
    return { success: false, errors: validation.errors };
  }

  const supabase = getSupabaseServerClient();
  const calculations = performPurchaseCalculations(
    input.gross_weight_kg,
    input.commission_per_40kg,
    input.rate_per_40kg
  );

  try {
    // Attempt database atomic stored procedure RPC call
    const { data: rpcData, error: rpcError } = await supabase.rpc('fn_record_purchase', {
      p_crop_id: input.crop_id,
      p_supplier_id: input.supplier_id || null,
      p_bags: input.bags || 0,
      p_gross_weight_kg: input.gross_weight_kg,
      p_commission_per_40kg: input.commission_per_40kg,
      p_rate_per_40kg: input.rate_per_40kg,
      p_notes: input.notes || null,
      p_expenses: input.expenses || [],
    });

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        purchaseId: rpcData.purchase_id,
        invoiceNo: rpcData.invoice_no,
      };
    }

    // Fallback if RPC function not created in DB environment yet
    const invoiceNo = `PUR-${Date.now().toString().slice(-6)}`;

    // 1. Insert Purchase
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        invoice_no: invoiceNo,
        crop_id: input.crop_id,
        supplier_id: input.supplier_id || null,
        bags: input.bags || 0,
        gross_weight_kg: input.gross_weight_kg,
        commission_per_40kg: input.commission_per_40kg,
        commission_weight_kg: calculations.commissionWeightKg,
        net_weight_kg: calculations.netWeightKg,
        rate_per_40kg: input.rate_per_40kg,
        crop_amount: calculations.cropAmountPkr,
        notes: input.notes || null,
      })
      .select('id, invoice_no')
      .single();

    if (purchaseError) {
      return { success: false, message: purchaseError.message };
    }

    const purchaseId = purchaseData.id;

    // 2. Insert Expenses if any
    if (input.expenses && input.expenses.length > 0) {
      const expRows = input.expenses
        .filter((e) => e.amount > 0)
        .map((e) => ({
          purchase_id: purchaseId,
          expense_type: e.expense_type,
          amount: e.amount,
          notes: e.notes || null,
        }));

      if (expRows.length > 0) {
        await supabase.from('purchase_expenses').insert(expRows);

        // Also record in general expenses
        const genExpRows = expRows.map((e) => ({
          expense_date: new Date().toISOString(),
          category: e.expense_type,
          amount: e.amount,
          purchase_id: purchaseId,
          notes: e.notes || null,
        }));
        await supabase.from('expenses').insert(genExpRows);
      }
    }

    // 3. Add Stock Movement (+netWeightKg)
    const { error: stockError } = await supabase.from('stock_movements').insert({
      crop_id: input.crop_id,
      purchase_id: purchaseId,
      movement_type: 'purchase',
      quantity_kg: calculations.netWeightKg,
      notes: 'Incoming purchase net weight',
    });

    if (stockError) {
      console.error('Stock movement record error:', stockError.message);
    }

    return {
      success: true,
      purchaseId,
      invoiceNo: purchaseData.invoice_no,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save purchase transaction.';
    return { success: false, message };
  }
}
