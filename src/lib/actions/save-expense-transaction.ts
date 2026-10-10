'use server';

import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { NewExpenseInput } from '@/types/expense-data-types';

export async function saveExpenseTransaction(input: NewExpenseInput) {
  if (!input.category || input.category.trim() === '') {
    return { success: false, message: 'Expense category is required.' };
  }

  if (input.amount <= 0) {
    return { success: false, message: 'Expense amount must be greater than 0.' };
  }

  const supabase = getSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category: input.category.trim(),
        amount: input.amount,
        expense_date: input.expense_date || new Date().toISOString(),
        purchase_id: input.purchase_id || null,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save expense.';
    return { success: false, message };
  }
}
