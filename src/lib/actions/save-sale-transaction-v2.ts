'use server';

// Matches live schema: sales has variety_id/bardana/bags but NOT always
// document_total/amount_received. stock_movements has NO variety_id.

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { resolveAvailableStockKg } from '@/lib/calculations/current-stock-calculation';
import { reconcileMissingStockMovements } from '@/lib/actions/reconcile-stock-movements';
import { randomUUID } from 'crypto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export interface SaleV2Input {
  sale_date: string;
  buyer_id: number | null;
  crop_id: number;
  variety_id: number | null;
  actual_weight_sold_kg: number;
  bardana_deduction_kg: number;
  price_per_40kg: number;
  num_bags: number;
  price_per_bag_pkr: number;
  commission_pct: number;
  payment_mode?: 'full' | 'partial' | 'none';
  amount_received?: number;
  notes?: string;
}

export interface SaveSaleV2Result {
  success: boolean;
  message?: string;
  invoiceNo?: string;
  saleId?: number;
  amountReceived?: number;
  remainingDue?: number;
}

export async function saveSaleTransactionV2(
  input: SaleV2Input
): Promise<SaveSaleV2Result> {
  if (!input.crop_id || input.crop_id <= 0)
    return { success: false, message: 'Please select a crop.' };
  if (!input.actual_weight_sold_kg || input.actual_weight_sold_kg <= 0)
    return { success: false, message: 'Actual weight sold must be greater than zero.' };
  if (input.bardana_deduction_kg < 0)
    return { success: false, message: 'Bardana deduction cannot be negative.' };
  if (input.bardana_deduction_kg >= input.actual_weight_sold_kg)
    return { success: false, message: 'Bardana deduction cannot exceed or equal actual weight sold.' };
  if (!input.price_per_40kg || input.price_per_40kg <= 0)
    return { success: false, message: 'Price per 40 kg must be greater than zero.' };
  if (input.num_bags < 0 || !Number.isInteger(input.num_bags))
    return { success: false, message: 'Number of bags must be a non-negative whole number.' };
  if (input.price_per_bag_pkr < 0)
    return { success: false, message: 'Price per bag cannot be negative.' };
  if (input.commission_pct < 0)
    return { success: false, message: 'Commission % cannot be negative.' };

  const supabase = await getSupabaseServerClient();

  let purQuery = supabase
    .from('purchases')
    .select('gross_weight_kg')
    .eq('crop_id', input.crop_id);
  let salQuery = supabase
    .from('sales')
    .select('physical_weight_kg')
    .eq('crop_id', input.crop_id);
  const stockQuery = supabase
    .from('stock_movements')
    .select('quantity_kg, movement_type')
    .eq('crop_id', input.crop_id);

  if (input.variety_id) {
    purQuery = purQuery.eq('variety_id', input.variety_id);
    salQuery = salQuery.eq('variety_id', input.variety_id);
  }

  const [movementsRes, purRes, salRes] = await Promise.all([
    stockQuery,
    purQuery,
    salQuery,
  ]);

  const availableStock = resolveAvailableStockKg({
    purchases: purRes.data || [],
    sales: salRes.data || [],
    movements: movementsRes.data || [],
  });

  if (input.actual_weight_sold_kg > availableStock) {
    return {
      success: false,
      message: `Sale weight (${input.actual_weight_sold_kg} kg) exceeds available stock (${availableStock} kg).`,
    };
  }

  const calc = performSaleCalculations(
    input.actual_weight_sold_kg,
    input.bardana_deduction_kg,
    input.price_per_40kg,
    input.num_bags,
    input.price_per_bag_pkr,
    input.commission_pct
  );

  const grandTotal = calc.finalAmountReceivablePkr;
  const paymentMode = input.payment_mode || 'none';
  let actualReceived = 0;
  if (paymentMode === 'full') actualReceived = grandTotal;
  else if (paymentMode === 'partial')
    actualReceived = Math.max(0, Math.min(grandTotal, r2(Number(input.amount_received) || 0)));
  const remainingDue = Math.max(0, r2(grandTotal - actualReceived));

  const invoiceNo = `SALE-${Date.now().toString().slice(-8)}`;

  try {
    const saleRow: Record<string, unknown> = {
      invoice_no: invoiceNo,
      crop_id: input.crop_id,
      buyer_id: input.buyer_id || null,
      variety_id: input.variety_id || null,
      physical_weight_kg: r3(input.actual_weight_sold_kg),
      commission_per_40kg: 0,
      commission_weight_kg: 0,
      bardana_per_bag_kg: 0,
      bardana_total_kg: r3(input.bardana_deduction_kg),
      billable_weight_kg: calc.netSaleWeightKg,
      rate_per_40kg: r2(input.price_per_40kg),
      sale_amount: calc.cropSaleAmountPkr,
      bags: input.num_bags,
      notes: input.notes || null,
    };

    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert(saleRow)
      .select('id')
      .single();

    if (saleErr || !saleData?.id) {
      return { success: false, message: saleErr?.message || 'Failed to save sale.' };
    }

    const saleId = saleData.id as number;

    let savedAmountReceivedOnSale = false;
    if (actualReceived > 0 || grandTotal > 0) {
      const { error: payColErr } = await supabase
        .from('sales')
        .update({ document_total: grandTotal, amount_received: actualReceived })
        .eq('id', saleId);
      savedAmountReceivedOnSale = !payColErr;
    }

    const { error: stockErr } = await supabase.from('stock_movements').insert({
      crop_id: input.crop_id,
      sale_id: saleId,
      movement_type: 'sale',
      quantity_kg: -calc.physicalStockToRemoveKg,
      notes: `Sale ${invoiceNo}`,
    });

    if (stockErr) {
      console.error('Stock movement insert error (sale):', stockErr.message);
      const healed = await reconcileMissingStockMovements();
      if (!(healed.success && healed.salesFixed > 0)) {
        return {
          success: false,
          saleId,
          invoiceNo,
          message:
            `Sale ${invoiceNo} was saved, but its stock movement failed: ${stockErr.message}. ` +
            'Do not retry; open the Stock page to auto-reconcile.',
        };
      }
    }

    const saleExpenseRows: Array<{
      sale_id: number;
      expense_type: string;
      amount: number;
      is_income: boolean;
      notes: string;
    }> = [];
    if (calc.totalBagRevenuePkr > 0) {
      saleExpenseRows.push({
        sale_id: saleId,
        expense_type: 'Bag Revenue',
        amount: calc.totalBagRevenuePkr,
        is_income: true,
        notes: `${input.num_bags} bags`,
      });
    }
    if (calc.commissionAmountPkr > 0) {
      saleExpenseRows.push({
        sale_id: saleId,
        expense_type: 'Buyer Commission',
        amount: r2(calc.commissionAmountPkr),
        is_income: true,
        notes: `${input.commission_pct}% commission`,
      });
    }
    if (saleExpenseRows.length > 0) {
      await supabase.from('sale_expenses').insert(saleExpenseRows);
    }

    if (actualReceived > 0 && !savedAmountReceivedOnSale && input.buyer_id) {
      await supabase.from('khata_payments').insert({
        party_id: input.buyer_id,
        direction: 'received',
        amount: actualReceived,
        paid_at: new Date().toISOString(),
        notes: `Paid at sale ${invoiceNo}`,
        request_id: randomUUID(),
      });
    }

    revalidatePath('/sales');
    revalidatePath('/sales/new');
    revalidatePath('/sales/all');
    revalidatePath('/stock');
    revalidatePath('/khata');
    revalidatePath('/khata/sales');

    return {
      success: true,
      invoiceNo,
      saleId,
      amountReceived: actualReceived,
      remainingDue,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save sale.';
    return { success: false, message };
  }
}
