'use server';

import { recordKhataPayment } from '@/lib/actions/khata-actions';

/** Kept for older callers. New UI uses recordKhataPayment (any party, receive or pay). */
export async function recordPayment(input: {
  partyId: number;
  type: 'sales' | 'purchases';
  amount: number;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await recordKhataPayment({
    party_id: input.partyId,
    direction: input.type === 'sales' ? 'received' : 'paid',
    amount: input.amount,
    notes: input.note,
    request_id: crypto.randomUUID(),
  });
  return res.success ? { ok: true } : { ok: false, error: res.message };
}
