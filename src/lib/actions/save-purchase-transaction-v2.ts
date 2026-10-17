'use server';

// Matches live schema: purchases has variety_id/bardana but NOT always
 // document_total/amount_paid. stock_movements has NO variety_id.

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { performPurchaseCalculations } from '@/lib/calculations/purchase-amount-calculation';
import { reconcileMissingStockMovements } from '@/lib/actions/reconcile-stock-movements';
import { randomUUID } from 'crypto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export interface PurchaseV2Input {
  purchase_date: string;
  supplier_id: number;
  crop_id: number;
  variety_id: number | null;
  actual_weight_kg: number;
  deduction_rate: number;
  deduction_basis_kg: number;
  bardana_rate: number;
  bardana_basis_kg: number;
  price_per_40kg: number;
  kunda_amount_pkr: number;
  num_bags: number;
  price_per_bag_pkr: number;
  payment_mode?: 'full' | 'partial' | 'none';
  amount_paid?: number;
  notes?: string;
}

export interface SavePurchaseV2Result {
  success: boolean;
  message?: string;
  invoiceNo?: string;
  purchaseId?: number;
  amountPaid?: number;
  remainingDue?: number;
}

export async function savePurchaseTransactionV2(
  input: PurchaseV2Input
): Promise<SavePurchaseV2Result> {
  if (!input.supplier_id || input.supplier_id <= 0)
    return { success: false, message: 'Please select a supplier.' };
  if (!input.crop_id || input.crop_id <= 0)
    return { success: false, message: 'Please select a crop.' };
  if (!input.actual_weight_kg || input.actual_weight_kg <= 0)
    return { success: false, message: 'Actual weight must be greater than zero.' };
  if (input.deduction_rate < 0)
    return { success: false, message: 'Deduction rate cannot be negative.' };
  if (!Number.isFinite(input.deduction_basis_kg) || input.deduction_basis_kg <= 0)
    return { success: false, message: 'Deduction basis must be greater than zero.' };
  if (!Number.isFinite(input.bardana_rate) || input.bardana_rate < 0)
    return { success: false, message: 'Bardana rate cannot be negative.' };
  if (!Number.isFinite(input.bardana_basis_kg) || input.bardana_basis_kg <= 0)
    return { success: false, message: 'Bardana basis must be greater than zero.' };
  if (!input.price_per_40kg || input.price_per_40kg <= 0)
    return { success: false, message: 'Price per 40 kg must be greater than zero.' };
  if (input.kunda_amount_pkr < 0)
    return { success: false, message: 'Kunda amount cannot be negative.' };
  if (input.num_bags < 0 || !Number.isInteger(input.num_bags))
    return { success: false, message: 'Number of bags must be a non-negative whole number.' };
  if (input.price_per_bag_pkr < 0)
    return { success: false, message: 'Price per bag cannot be negative.' };

  const calc = performPurchaseCalculations(
    input.actual_weight_kg,
    input.deduction_rate,
    input.price_per_40kg,
    input.kunda_amount_pkr,
    input.num_bags,
    input.price_per_bag_pkr,
    input.deduction_basis_kg,
    input.bardana_rate,
    input.bardana_basis_kg
  );

  const grandTotal = calc.totalPurchaseAmountPkr;
  const paymentMode = input.payment_mode || 'none';
  let actualPaid = 0;
  if (paymentMode === 'full') actualPaid = grandTotal;
  else if (paymentMode === 'partial')
    actualPaid = Math.max(0, Math.min(grandTotal, r2(Number(input.amount_paid) || 0)));
  const remainingDue = Math.max(0, r2(grandTotal - actualPaid));

  const supabase = await getSupabaseServerClient();
  const invoiceNo = `PUR-${Date.now().toString().slice(-8)}`;

  try {
    // Insert only columns that exist on the live purchases table.
    const purchaseRow: Record<string, unknown> = {
      invoice_no: invoiceNo,
      crop_id: input.crop_id,
      supplier_id: input.supplier_id,
      variety_id: input.variety_id || null,
      gross_weight_kg: r3(input.actual_weight_kg),
      commission_per_40kg: r3(
        (input.deduction_rate * 40) / input.deduction_basis_kg
      ),
      commission_weight_kg: calc.deductionWeightKg,
      bardana_per_bag_kg: 0,
      bardana_total_kg: calc.bardanaWeightKg,
      net_weight_kg: calc.netPayableWeightKg,
      rate_per_40kg: r2(input.price_per_40kg),
      crop_amount: calc.cropPaymentPkr,
      bags: input.num_bags,
      notes: input.notes || null,
    };

    const { data: purData, error: purErr } = await supabase
      .from('purchases')
      .insert(purchaseRow)
      .select('id')
      .single();

    if (purErr || !purData?.id) {
      return { success: false, message: purErr?.message || 'Failed to save purchase.' };
    }

    const purchaseId = purData.id as number;

    // Optional payment columns (added by migration 20261016). Ignore if missing.
    let savedAmountPaidOnPurchase = false;
    if (actualPaid > 0 || grandTotal > 0) {
      const { error: payColErr } = await supabase
        .from('purchases')
        .update({ document_total: grandTotal, amount_paid: actualPaid })
        .eq('id', purchaseId);
      savedAmountPaidOnPurchase = !payColErr;
    }

    // stock_movements: crop_id, purchase_id, movement_type, quantity_kg, notes only
    const { error: stockErr } = await supabase.from('stock_movements').insert({
      crop_id: input.crop_id,
      purchase_id: purchaseId,
      movement_type: 'purchase',
      quantity_kg: calc.physicalStockToAddKg,
      notes: `Purchase ${invoiceNo}`,
    });

    if (stockErr) {
      console.error('Stock movement insert error:', stockErr.message);
      const healed = await reconcileMissingStockMovements();
      if (!(healed.success && healed.purchasesFixed > 0)) {
        return {
          success: false,
          purchaseId,
          invoiceNo,
          message:
            `Purchase ${invoiceNo} was saved, but its stock movement failed: ${stockErr.message}. ` +
            'Do not retry; open the Stock page to auto-reconcile.',
        };
      }
    }

    const purchaseExpenseRows: Array<{
      purchase_id: number;
      expense_type: string;
      amount: number;
      is_income: boolean;
      notes: string;
    }> = [];
    if (input.kunda_amount_pkr > 0) {
      purchaseExpenseRows.push({
        purchase_id: purchaseId,
        expense_type: 'Kunda',
        amount: r2(input.kunda_amount_pkr),
        is_income: true,
        notes: 'Kunda deduction',
      });
    }
    if (calc.totalBagAmountPkr > 0) {
      purchaseExpenseRows.push({
        purchase_id: purchaseId,
        expense_type: 'Bags',
        amount: calc.totalBagAmountPkr,
        is_income: false,
        notes: `${input.num_bags} bags`,
      });
    }
    if (purchaseExpenseRows.length > 0) {
      const { error: purchaseExpensesError } = await supabase
        .from('purchase_expenses')
        .insert(purchaseExpenseRows);

      if (purchaseExpensesError) {
        console.error(
          'Purchase cost component insertion failed:',
          purchaseExpensesError.message
        );
        return {
          success: false,
          purchaseId,
          invoiceNo,
          message:
            `Purchase ${invoiceNo} was saved, but Kunda/bag costs could not be recorded. ` +
            'Do not retry the purchase; resolve the cost-record error first.',
        };
      }
    }

    // If amount_paid column missing, record payment in khata_payments.
    if (actualPaid > 0 && !savedAmountPaidOnPurchase) {
      const { error: paymentError } = await supabase.from('khata_payments').insert({
        party_id: input.supplier_id,
        direction: 'paid',
        amount: actualPaid,
        paid_at: new Date().toISOString(),
        notes: `Paid at purchase ${invoiceNo}`,
        request_id: randomUUID(),
      });

      if (paymentError) {
        console.error('Purchase payment insertion failed:', paymentError.message);
        return {
          success: false,
          purchaseId,
          invoiceNo,
          message:
            `Purchase ${invoiceNo} was saved, but its payment could not be recorded: ` +
            `${paymentError.message}. Do not retry the purchase.`,
        };
      }
    }

    revalidatePath('/purchases');
    revalidatePath('/stock');
    revalidatePath('/khata');
    revalidatePath('/khata/purchases');

    return {
      success: true,
      invoiceNo,
      purchaseId,
      amountPaid: actualPaid,
      remainingDue,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save purchase.';
    return { success: false, message };
  }
}
