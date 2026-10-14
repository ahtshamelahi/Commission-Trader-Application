export type KhataPartyType = 'supplier' | 'buyer' | 'both' | string | null;

export interface KhataParty {
  party_id: number;
  name: string;
  phone: string | null;
  address: string | null;
  party_type: KhataPartyType;
  balance: number;
  last_activity: string | null;
}

export interface LedgerEntry {
  key: string;
  entry_type: string;
  entry_date: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  delta: number;
  source_table: string;
  source_id: number;
  khata_payment_id: number | null;
  editable: boolean;
}

export interface RecordPaymentInput {
  party_id: number;
  direction: 'received' | 'paid';
  amount: number;
  paid_at?: string;
  notes?: string;
  request_id: string;
}

export interface CorrectPaymentInput {
  payment_id: number;
  amount?: number;
  paid_at?: string;
  notes?: string | null;
  void?: boolean;
}

export function isBuyer(partyType: KhataPartyType): boolean {
  return partyType === 'buyer' || partyType === 'both';
}

export function isSupplier(partyType: KhataPartyType): boolean {
  return partyType === 'supplier' || partyType === 'both';
}

export function partyTypeLabel(partyType: KhataPartyType): string {
  if (partyType === 'buyer') return 'Buyer';
  if (partyType === 'supplier') return 'Supplier';
  if (partyType === 'both') return 'Both';
  return 'Party';
}
