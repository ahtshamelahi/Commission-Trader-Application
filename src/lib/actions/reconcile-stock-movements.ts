'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/**
 * Backfill stock_movements for purchases/sales that were saved without a
 * matching movement (e.g. insert failed because of a non-existent column).
 * Safe to run repeatedly — skips rows that already have a movement.
 */
export async function reconcileMissingStockMovements(): Promise<{
  success: boolean;
  purchasesFixed: number;
  salesFixed: number;
  message?: string;
}> {
  const supabase = await getSupabaseServerClient();

  try {
    const [purchasesRes, salesRes, movementsRes] = await Promise.all([
      supabase.from('purchases').select('id, invoice_no, crop_id, gross_weight_kg'),
      supabase.from('sales').select('id, invoice_no, crop_id, physical_weight_kg'),
      supabase.from('stock_movements').select('purchase_id, sale_id'),
    ]);

    if (purchasesRes.error) {
      return {
        success: false,
        purchasesFixed: 0,
        salesFixed: 0,
        message: purchasesRes.error.message,
      };
    }
    if (salesRes.error) {
      return {
        success: false,
        purchasesFixed: 0,
        salesFixed: 0,
        message: salesRes.error.message,
      };
    }

    const linkedPurchaseIds = new Set(
      (movementsRes.data || [])
        .map((m) => m.purchase_id)
        .filter((id): id is number => id != null)
    );
    const linkedSaleIds = new Set(
      (movementsRes.data || [])
        .map((m) => m.sale_id)
        .filter((id): id is number => id != null)
    );

    const missingPurchases = (purchasesRes.data || []).filter(
      (p) =>
        !linkedPurchaseIds.has(p.id) &&
        Number(p.gross_weight_kg) > 0 &&
        p.crop_id
    );
    const missingSales = (salesRes.data || []).filter(
      (s) =>
        !linkedSaleIds.has(s.id) &&
        Number(s.physical_weight_kg) > 0 &&
        s.crop_id
    );

    let purchasesFixed = 0;
    let salesFixed = 0;

    if (missingPurchases.length > 0) {
      const rows = missingPurchases.map((p) => ({
        crop_id: p.crop_id,
        purchase_id: p.id,
        movement_type: 'purchase' as const,
        quantity_kg: r3(Number(p.gross_weight_kg)),
        notes: `Reconciled purchase ${p.invoice_no || p.id}`,
      }));
      const { error } = await supabase.from('stock_movements').insert(rows);
      if (error) {
        return {
          success: false,
          purchasesFixed: 0,
          salesFixed: 0,
          message: error.message,
        };
      }
      purchasesFixed = rows.length;
    }

    if (missingSales.length > 0) {
      const rows = missingSales.map((s) => ({
        crop_id: s.crop_id,
        sale_id: s.id,
        movement_type: 'sale' as const,
        quantity_kg: -r3(Number(s.physical_weight_kg)),
        notes: `Reconciled sale ${s.invoice_no || s.id}`,
      }));
      const { error } = await supabase.from('stock_movements').insert(rows);
      if (error) {
        return {
          success: false,
          purchasesFixed,
          salesFixed: 0,
          message: error.message,
        };
      }
      salesFixed = rows.length;
    }

    if (purchasesFixed > 0 || salesFixed > 0) {
      revalidatePath('/stock');
      revalidatePath('/purchases');
      revalidatePath('/sales');
      revalidatePath('/dashboard');
    }

    return { success: true, purchasesFixed, salesFixed };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reconcile failed.';
    return { success: false, purchasesFixed: 0, salesFixed: 0, message };
  }
}
