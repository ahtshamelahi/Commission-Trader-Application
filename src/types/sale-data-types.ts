import { Crop } from './crop-data-types';
import { Party } from './party-data-types';

export interface Sale {
  id: number;
  invoice_no: string;
  crop_id: number;
  variety_id: number | null;
  buyer_id: number | null;
  bags: number;
  physical_weight_kg: number;
  commission_per_40kg: number;
  commission_weight_kg: number;
  bardana_per_bag_kg: number;
  bardana_total_kg: number;
  billable_weight_kg: number;
  rate_per_40kg: number;
  sale_amount: number;
  vehicle_number: string | null;
  notes: string | null;
  document_total?: number | null;
  amount_received?: number | null;
  created_at: string;
  updated_at?: string | null;
  crops?: Crop;
  parties?: Party;
}

export interface NewSaleInput {
  crop_id: number;
  buyer_id: number | null;
  physical_weight_kg: number;
  bags?: number;
  bardana_per_bag_kg?: number;
  commission_per_40kg: number;
  rate_per_40kg: number;
  vehicle_number?: string;
  notes?: string;
}
