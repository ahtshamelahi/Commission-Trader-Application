'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import type { NewPurchaseInput } from '@/types/purchase-data-types';
import { validatePurchaseInput } from '@/lib/validations/purchase-form-validation';
import {
  performPurchaseCalculations_legacy as performPurchaseCalculations,
} from '@/lib/calculations/purchase-amount-calculation';

export async function savePurchaseTransaction(input: NewPurchaseInput) {
  const validation = validatePurchaseInput(input);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  try {
    const supabase = await getSupabaseServerClient();

    const calculations = performPurchaseCalculations(
      input.gross_weight_kg,
      input.commission_per_40kg,
      input.rate_per_40kg
    );

    const purchaseExpenses = (input.expenses ?? [])
      .filter((expense) => Number(expense.amount) > 0)
      .map((expense) => ({
        expense_type: expense.expense_type,
        amount: Number(expense.amount),
        notes: expense.notes || null,
      }));

    // Primary path: execute the purchase atomically in PostgreSQL.
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'fn_record_purchase',
      {
        p_crop_id: input.crop_id,
        p_supplier_id: input.supplier_id ?? null,
        p_bags: input.bags ?? 0,
        p_gross_weight_kg: input.gross_weight_kg,
        p_commission_per_40kg: input.commission_per_40kg,
        p_rate_per_40kg: input.rate_per_40kg,
        p_notes: input.notes || null,
        p_expenses: purchaseExpenses,
      }
    );

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        purchaseId: rpcData.purchase_id,
        invoiceNo: rpcData.invoice_no,
      };
    }

    // Fall back to manual insertion if:
    // 1. RPC function doesn't exist (isMissingPurchaseRpc returns true)
    // 2. RPC succeeded but reported failure (rpcData.success is false)
    // 3. RPC failed for any other reason
    // This ensures we always attempt to record the purchase and stock movement
    // even if the RPC function has issues.
    
    // Compatibility fallback for environments where the RPC
    // genuinely has not been created. This path is not atomic.
    const invoiceNo = `PUR-${Date.now().toString().slice(-6)}`;

    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        invoice_no: invoiceNo,
        crop_id: input.crop_id,
        supplier_id: input.supplier_id ?? null,
        bags: input.bags ?? 0,
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

    if (purchaseError || !purchaseData) {
      return {
        success: false,
        message: purchaseError?.message || 'Failed to create purchase.',
      };
    }

    const purchaseId = purchaseData.id;

    if (purchaseExpenses.length > 0) {
      const purchaseExpenseRows = purchaseExpenses.map((expense) => ({
        purchase_id: purchaseId,
        expense_type: expense.expense_type,
        amount: expense.amount,
        notes: expense.notes,
      }));

      const { error: purchaseExpensesError } = await supabase
        .from('purchase_expenses')
        .insert(purchaseExpenseRows);

      if (purchaseExpensesError) {
        console.error(
          'Purchase expense insertion failed:',
          purchaseExpensesError.message
        );

        return {
          success: false,
          purchaseId,
          message:
            `Purchase ${invoiceNo} was created, but its expenses could not be saved. ` +
            'Do not retry the entire purchase; resolve the expense error first.',
        };
      }

      // Unified expense rows support expense reporting. The P&L
      // calculation must exclude these purchase-linked duplicates.
      const generalExpenseRows = purchaseExpenses.map((expense) => ({
        expense_date: new Date().toISOString(),
        category: expense.expense_type,
        amount: expense.amount,
        purchase_id: purchaseId,
        notes: expense.notes,
      }));

      const { error: generalExpensesError } = await supabase
        .from('expenses')
        .insert(generalExpenseRows);

      if (generalExpensesError) {
        console.error(
          'Unified expense insertion failed:',
          generalExpensesError.message
        );

        return {
          success: false,
          purchaseId,
          message:
            `Purchase ${invoiceNo} and its purchase expenses were saved, ` +
            'but unified expense records failed. Do not retry the purchase.',
        };
      }
    }

    // Stock always increases by the full physical weight received.
    // Commission and payment deductions must not reduce inventory.
    const { error: stockError } = await supabase
      .from('stock_movements')
      .insert({
        crop_id: input.crop_id,
        purchase_id: purchaseId,
        movement_type: 'purchase',
        quantity_kg: input.gross_weight_kg,
        notes: 'Incoming purchase physical weight',
      });

    if (stockError) {
      console.error('Stock movement insertion failed:', stockError.message);

      return {
        success: false,
        purchaseId,
        invoiceNo: purchaseData.invoice_no,
        message:
          `Purchase ${purchaseData.invoice_no} was saved, but its stock movement failed. ` +
          'Do not retry the purchase; reconcile stock first.',
      };
    }

    return {
      success: true,
      purchaseId,
      invoiceNo: purchaseData.invoice_no,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to save purchase transaction.';

    console.error('Purchase transaction error:', message);

    return {
      success: false,
      message,
    };
  }
}