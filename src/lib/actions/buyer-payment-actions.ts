'use server';

// lib/actions/buyer-payment-actions.ts
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';

export interface RecordBuyerPaymentInput {
  buyer_id: number;
  amount: number;
  /** unique per click attempt; a repeated id is ignored by the database */
  request_id: string;
  notes?: string;
}

export async function recordBuyerPayment(input: RecordBuyerPaymentInput) {
  if (!Number.isInteger(input.buyer_id) || input.buyer_id <= 0) {
    return { success: false, message: 'Invalid buyer.' };
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { success: false, message: 'Payment amount must be greater than zero.' };
  }
  if (!input.request_id) {
    return { success: false, message: 'Invalid request. Please try again.' };
  }

  const supabase = getSupabaseServerClient();

  try {
    const { data, error } = await supabase.rpc('record_buyer_payment', {
      p_buyer_id: input.buyer_id,
      p_amount: input.amount,
      p_request_id: input.request_id,
      p_notes: input.notes || null,
    });

    if (error) return { success: false, message: error.message };

    const r = data as { payment_id: number; outstanding_after?: number; duplicate?: boolean };
    return {
      success: true,
      paymentId: r.payment_id,
      outstandingAfter: r.outstanding_after,
      duplicate: !!r.duplicate,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record payment.';
    return { success: false, message };
  }
}