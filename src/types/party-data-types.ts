export type PartyType = 'supplier' | 'buyer' | 'both';

export interface Party {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  party_type: PartyType;
  created_at: string;
}

export interface PartyDetail extends Party {
  totalPurchasesAmount?: number;
  totalSalesAmount?: number;
  totalPurchasesCount?: number;
  totalSalesCount?: number;
}
