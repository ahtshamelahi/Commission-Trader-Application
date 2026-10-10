export interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  purchase_id: number | null;
  notes: string | null;
  created_at: string;
}

export interface NewExpenseInput {
  category: string;
  amount: number;
  expense_date?: string;
  purchase_id?: number | null;
  notes?: string;
}
