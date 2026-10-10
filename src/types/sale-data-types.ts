import { Crop } from './crop-data-types';
import { Party } from './party-data-types';

export interface Sale {
  id: number;
  invoice_no: string;
  crop_id: number;
  variety_id: number | null;
  buyer_id: number | null;
  physical_weight_kg: number;
  commission_per_40kg: number;
  commission_weight_kg: number;
  billable_weight_kg: number;
  rate_per_40kg: number;
  sale_amount: number;
  notes: string | null;
  created_at: string;
  crops?: Crop;
  parties?: Party;
}

export interface NewSaleInput {
  crop_id: number;
  buyer_id: number | null;
  physical_weight_kg: number;
  commission_per_40kg: number;
  rate_per_40kg: number;
  notes?: string;
}
