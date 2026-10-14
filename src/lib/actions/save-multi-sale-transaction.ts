'use server';

// lib/actions/save-multi-sale-transaction.ts
import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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

export interface SaleExpenseInput {
  /** always positive; is_income decides: true = ADDED to the sale total, false = DEDUCTED */
  amount: number;
  is_income: boolean;
  notes?: string;
}

export interface MultiSaleInput {
  /** unique per save attempt; the database ignores a repeated id (double click / retry) */
  request_id: string;
  buyer_id: number;
  items: MultiSaleItem[];
  /** zero or more expenses; the sale total = items total + added - deducted */
  expenses: SaleExpenseInput[];
  vehicle_number?: string;
  notes?: string;
  amount_received: number;
}

export interface SaveSaleResult {
  success: boolean;
  message?: string;
  invoiceId?: number;
  invoiceNo?: string;
  duplicate?: boolean;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is number => isNum(v) && Number.isInteger(v) && v > 0;

export async function saveMultiSaleTransaction(input: MultiSaleInput): Promise<SaveSaleResult> {
  // ---- basic validation (the database validates again) ----
  if (!input.request_id || typeof input.request_id !== 'string') {
    return { success: false, message: 'Invalid request. Please try again.' };
  }
  if (!isId(input.buyer_id)) {
    return { success: false, message: 'Please select a buyer before saving the sale.' };
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, message: 'At least one item is required.' };
  }
  if (!isNum(input.amount_received) || input.amount_received < 0) {
    return { success: false, message: 'Amount received cannot be negative.' };
  }
  if (!Array.isArray(input.expenses) || input.expenses.length > 50) {
    return { success: false, message: 'Invalid expenses.' };
  }
  for (const e of input.expenses) {
    if (!isNum(e.amount) || e.amount <= 0 || typeof e.is_income !== 'boolean') {
      return { success: false, message: 'Each expense must have an amount greater than zero.' };
    }
  }

  for (const item of input.items) {
    if (
      !isId(item.crop_id) ||
      !(item.variety_id === null || isId(item.variety_id)) ||
      !isNum(item.physical_weight_kg) || item.physical_weight_kg <= 0 ||
      !isNum(item.rate_per_40kg) || item.rate_per_40kg <= 0 ||
      !isNum(item.commission_per_40kg) || item.commission_per_40kg < 0 ||
      !isNum(item.bags) || item.bags < 0 ||
      !isNum(item.bardana_per_bag_kg) || item.bardana_per_bag_kg < 0
    ) {
      return { success: false, message: 'One of the items has invalid values.' };
    }
  }

  // ---- calculations: ONE source of truth (performSaleCalculations) ----
  const items = input.items.map((item) => {
    const calc = performSaleCalculations(
      item.physical_weight_kg,
      item.commission_per_40kg,
      item.rate_per_40kg,
      item.bags || 0,
      item.bardana_per_bag_kg || 0
    );
    return {
      crop_id: item.crop_id,
      variety_id: item.variety_id,
      crop_name: item.crop_name || '',
      variety_name: item.variety_name || '',
      bags: item.bags || 0,
      physical_weight_kg: item.physical_weight_kg,
      commission_per_40kg: item.commission_per_40kg,
      commission_weight_kg: calc.commissionWeightKg,
      bardana_per_bag_kg: item.bardana_per_bag_kg || 0,
      bardana_total_kg: calc.bardanaWeightKg,
      billable_weight_kg: calc.billableWeightKg,
      rate_per_40kg: item.rate_per_40kg,
      sale_amount: calc.saleAmountPkr,
    };
  });

  const supabase = await getSupabaseServerClient();

  try {
    // one database transaction: invoice + items + stock + adjustment + initial payment
    const { data, error } = await supabase.rpc('create_sale_invoice', {
      p: {
        request_id: input.request_id,
        buyer_id: input.buyer_id,
        items,
        expenses: input.expenses.map((e) => ({
          amount: e.amount,
          is_income: e.is_income,
          notes: (e.notes || '').trim(),
        })),
        vehicle_number: input.vehicle_number || '',
        notes: input.notes || '',
        amount_received: input.amount_received,
      },
    });

    if (error) return { success: false, message: error.message };

    const r = data as { invoice_id: number; invoice_no: string; duplicate?: boolean };

    // Khata snapshot on the first sales row: grand total + amount received.
    // Ledger reads these columns so invoice payments are not also written to khata_payments.
    const itemsTotal = items.reduce((s, i) => s + i.sale_amount, 0);
    const adj = input.expenses.reduce((s, e) => s + (e.is_income ? e.amount : -e.amount), 0);
    const documentTotal = round2(itemsTotal + adj);
    if (r.invoice_no && !r.duplicate) {
      const { data: first } = await supabase
        .from('sales')
        .select('id')
        .eq('invoice_no', r.invoice_no)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (first?.id) {
        await supabase
          .from('sales')
          .update({ document_total: documentTotal, amount_received: input.amount_received })
          .eq('id', first.id);
      }
    }

    revalidatePath('/khata');
    revalidatePath('/khata/sales');
    return {
      success: true,
      invoiceId: r.invoice_id,
      invoiceNo: r.invoice_no,
      duplicate: !!r.duplicate,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save sale.';
    return { success: false, message };
  }
}