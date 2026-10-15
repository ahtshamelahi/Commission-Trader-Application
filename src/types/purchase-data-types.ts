import { Crop } from './crop-data-types';
import { Party } from './party-data-types';

export interface PurchaseExpenseItem {
  id?: number;
  expense_type: string;
  amount: number;
  notes?: string;
}

export interface Purchase {
  id: number;
  invoice_no: string;
  crop_id: number;
  variety_id: number | null;
  supplier_id: number | null;
  bags: number;
  gross_weight_kg: number;
  commission_per_40kg: number;
  commission_weight_kg: number;
  bardana_per_bag_kg: number;
  bardana_total_kg: number;
  net_weight_kg: number;
  rate_per_40kg: number;
  crop_amount: number;
  vehicle_number: string | null;
  notes: string | null;
  document_total?: number | null;
  amount_paid?: number | null;
  created_at: string;
  crops?: Crop;
  parties?: Party;
  purchase_expenses?: PurchaseExpenseItem[];
}

export interface NewPurchaseInput {
  crop_id: number;
  supplier_id: number | null;
  bags: number;
  gross_weight_kg: number;
  commission_per_40kg: number;
  bardana_per_bag_kg?: number;
  rate_per_40kg: number;
  vehicle_number?: string;
  notes?: string;
  expenses?: { expense_type: string; amount: number; notes?: string }[];
}
