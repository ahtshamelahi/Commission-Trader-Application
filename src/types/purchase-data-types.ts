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
  net_weight_kg: number;
  rate_per_40kg: number;
  crop_amount: number;
  notes: string | null;
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
  rate_per_40kg: number;
  notes?: string;
  expenses?: { expense_type: string; amount: number; notes?: string }[];
}
