// types/khata-types.ts

export interface KhataParty {
  party_id: number;
  name: string;
  phone: string | null;
  address: string | null;
  party_type: string | null;
  /** > 0 → party owes you (You'll get). < 0 → you owe the party (You'll give). */
  balance: number;
  last_activity: string | null;
}

export interface LedgerEntry {
  key: string;
  entry_type: string;
  entry_date: string;
  reference: string | null;
  description: string;
  /** Increases what the party owes you */
  debit: number;
  /** Decreases what the party owes you (or increases what you owe) */
  credit: number;
  /** Running balance after this entry (same sign rule as KhataParty.balance) */
  balance: number;
  /** Signed change this entry made to the balance (debit positive, credit negative) */
  delta?: number;
  /** Which table the entry came from, e.g. 'sales', 'purchases', 'khata_payments' */
  source_table?: string;
  source_id?: number;
  /** Set only for manual payments (khata_payments rows) */
  khata_payment_id?: number | null;
  /** True when the entry is a manual payment that can be corrected or voided */
  editable?: boolean;
}

export interface RecordPaymentInput {
  party_id: number;
  direction: 'received' | 'paid';
  amount: number;
  paid_at?: string; // ISO string
  notes?: string;
  request_id: string;
}

/** Used by correctKhataPayment: edit a manual payment, or void it (kept in history). */
export interface CorrectPaymentInput {
  payment_id: number;
  /** true = void the entry (it stays in history, marked voided) */
  void?: boolean;
  amount?: number;
  paid_at?: string; // ISO string
  notes?: string;
}

const normalize = (partyType: string | null | undefined) => (partyType || '').toLowerCase().trim();

/** A buyer, or a party that is both buyer and supplier. */
export function isBuyer(partyType: string | null | undefined): boolean {
  const t = normalize(partyType);
  return t.startsWith('buy') || t === 'both';
}

/** A supplier, or a party that is both buyer and supplier. */
export function isSupplier(partyType: string | null | undefined): boolean {
  const t = normalize(partyType);
  return t.startsWith('supp') || t === 'both';
}

/** Text shown in the "Party type" column. */
export function partyTypeLabel(partyType: string | null | undefined): string {
  const t = normalize(partyType);
  if (t === 'both') return 'Buyer & Supplier';
  if (t.startsWith('buy')) return 'Buyer';
  if (t.startsWith('supp')) return 'Supplier';
  return '—';
}