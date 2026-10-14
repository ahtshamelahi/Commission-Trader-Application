'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { ledgerSortRank, statementForRange } from '@/lib/khata/ledger-balance';
import type {
  CorrectPaymentInput,
  KhataParty,
  LedgerEntry,
  RecordPaymentInput,
} from '@/types/khata-types';

function revalidateKhata() {
  revalidatePath('/khata');
  revalidatePath('/khata/sales');
  revalidatePath('/khata/purchases');
  revalidatePath('/dashboard');
}

export async function getKhataParties(filter?: {
  partyType?: 'all' | 'buyers' | 'suppliers';
}): Promise<{ data: KhataParty[]; error?: string }> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('party_balances')
    .select('party_id, name, phone, address, party_type, balance, last_activity')
    .order('name', { ascending: true });

  if (error) return { data: [], error: error.message };

  let rows: KhataParty[] = (data ?? []).map((r) => ({
    party_id: Number(r.party_id),
    name: r.name,
    phone: r.phone ?? null,
    address: r.address ?? null,
    party_type: r.party_type ?? null,
    balance: Number(r.balance) || 0,
    last_activity: r.last_activity ?? null,
  }));

  const kind = filter?.partyType ?? 'all';

  if (kind === 'buyers') {
    rows = rows.filter(
      (p) => p.party_type === 'buyer' || p.party_type === 'both'
    );
  } else if (kind === 'suppliers') {
    rows = rows.filter(
      (p) => p.party_type === 'supplier' || p.party_type === 'both'
    );
  }

  return { data: rows };
}

export async function getKhataParty(
  partyId: number
): Promise<{ data: KhataParty | null; error?: string }> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('party_balances')
    .select('party_id, name, phone, address, party_type, balance, last_activity')
    .eq('party_id', partyId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: 'Party not found.' };

  return {
    data: {
      party_id: Number(data.party_id),
      name: data.name,
      phone: data.phone ?? null,
      address: data.address ?? null,
      party_type: data.party_type ?? null,
      balance: Number(data.balance) || 0,
      last_activity: data.last_activity ?? null,
    },
  };
}

export async function getPartyLedger(
  partyId: number,
  opts?: { from?: string; to?: string }
): Promise<{
  data: LedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  error?: string;
}> {
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('party_ledger')
    .select(
      'entry_type, party_id, entry_date, reference, description, delta, source_table, source_id'
    )
    .eq('party_id', partyId)
    .order('entry_date', { ascending: true })
    .order('source_id', { ascending: true });

  if (error) {
    return {
      data: [],
      openingBalance: 0,
      closingBalance: 0,
      error: error.message,
    };
  }

  const raw = (data ?? []).map((r) => ({
    entry_type: String(r.entry_type),
    entry_date: r.entry_date as string,
    reference: (r.reference as string | null) ?? null,
    description: String(r.description ?? ''),
    delta: Number(r.delta) || 0,
    source_table: String(r.source_table),
    source_id: Number(r.source_id),
    sort_rank: ledgerSortRank({
      entry_type: String(r.entry_type),
    }),
    khata_payment_id:
      r.source_table === 'khata_payments' ? Number(r.source_id) : null,
  }));

  const slice = statementForRange(raw, opts?.from, opts?.to);

  const entries: LedgerEntry[] = slice.rows.map((r) => {
    const delta = r.delta;

    return {
      key: `${r.source_table}-${r.source_id}-${r.entry_type}-${r.entry_date}`,
      entry_type: r.entry_type,
      entry_date: r.entry_date,
      reference: r.reference,
      description: r.description,
      debit: delta > 0 ? delta : 0,
      credit: delta < 0 ? -delta : 0,
      balance: r.balance,
      delta,
      source_table: r.source_table,
      source_id: r.source_id,
      khata_payment_id: r.khata_payment_id,
      editable:
        r.source_table === 'khata_payments' &&
        r.khata_payment_id != null,
    };
  });

  return {
    data: entries,
    openingBalance: slice.openingBalance,
    closingBalance: slice.closingBalance,
  };
}

export async function recordKhataPayment(
  input: RecordPaymentInput
): Promise<{ success: boolean; message: string }> {
  const amount = Math.round(Number(input.amount) * 100) / 100;

  if (!input.party_id) {
    return { success: false, message: 'Party is required.' };
  }

  if (input.direction !== 'received' && input.direction !== 'paid') {
    return { success: false, message: 'Invalid payment type.' };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: 'Enter an amount greater than 0.' };
  }

  if (!input.request_id) {
    return { success: false, message: 'Missing request id.' };
  }

  let paidAt = new Date();

  if (input.paid_at) {
    const parsed = new Date(input.paid_at);

    if (Number.isNaN(parsed.getTime())) {
      return { success: false, message: 'Invalid date.' };
    }

    paidAt = parsed;
  }

  const supabase = await getSupabaseServerClient();

  const { data: party, error: partyErr } = await supabase
    .from('parties')
    .select('id')
    .eq('id', input.party_id)
    .maybeSingle();

  if (partyErr) {
    return { success: false, message: partyErr.message };
  }

  if (!party) {
    return { success: false, message: 'Party not found.' };
  }

  const { error } = await supabase.from('khata_payments').insert({
    party_id: input.party_id,
    direction: input.direction,
    amount,
    paid_at: paidAt.toISOString(),
    notes: input.notes?.trim() || null,
    request_id: input.request_id,
  });

  if (error) {
    if (error.code === '23505') {
      return { success: true, message: 'Payment already saved.' };
    }

    return { success: false, message: error.message };
  }

  revalidateKhata();
  revalidatePath(`/khata/party/${input.party_id}`);

  return { success: true, message: 'Payment saved.' };
}

export async function correctKhataPayment(
  input: CorrectPaymentInput
): Promise<{ success: boolean; message: string }> {
  if (!input.payment_id) {
    return { success: false, message: 'Payment is required.' };
  }

  const supabase = await getSupabaseServerClient();

  const { data: existing, error: loadErr } = await supabase
    .from('khata_payments')
    .select('id, party_id, voided_at')
    .eq('id', input.payment_id)
    .maybeSingle();

  if (loadErr) {
    return { success: false, message: loadErr.message };
  }

  if (!existing) {
    return { success: false, message: 'Payment not found.' };
  }

  if (existing.voided_at) {
    return { success: false, message: 'This entry is already voided.' };
  }

  if (input.void) {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('khata_payments')
      .update({
        voided_at: now,
        updated_at: now,
      })
      .eq('id', input.payment_id);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidateKhata();
    revalidatePath(`/khata/party/${existing.party_id}`);

    return { success: true, message: 'Entry voided.' };
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.amount != null) {
    const amount = Math.round(Number(input.amount) * 100) / 100;

    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Enter an amount greater than 0.' };
    }

    patch.amount = amount;
  }

  if (input.paid_at) {
    const parsed = new Date(input.paid_at);

    if (Number.isNaN(parsed.getTime())) {
      return { success: false, message: 'Invalid date.' };
    }

    patch.paid_at = parsed.toISOString();
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  const { error } = await supabase
    .from('khata_payments')
    .update(patch)
    .eq('id', input.payment_id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateKhata();
  revalidatePath(`/khata/party/${existing.party_id}`);

  return { success: true, message: 'Entry updated.' };
}