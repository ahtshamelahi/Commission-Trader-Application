import React from 'react';
import { DashboardLayout } from '../dashboard/dashboard-layout';
import { TopHeader } from '@/components/layout/top-header';
import { getSupabaseServerClient } from '@/lib/supabase/supabase-server-client';
import { ExpenseEntryForm } from '@/components/expenses/expense-entry-form';
import { ExpensesTable, ExpenseWithRelation } from '@/components/expenses/expenses-table';
import { Purchase } from '@/types/purchase-data-types';
import { Receipt, History, Wallet } from 'lucide-react';
import { connection } from 'next/server';

export default async function ExpensesPage() {
  await connection();
  const supabase = getSupabaseServerClient();

  const [expensesRes, purchasesRes] = await Promise.all([
    supabase.from('expenses').select('*, purchases(invoice_no, crops(name))').order('expense_date', { ascending: false }),
    supabase.from('purchases').select('*, crops(name)').order('created_at', { ascending: false }),
  ]);

  const expenses: ExpenseWithRelation[] = expensesRes.data || [];
  const purchases: Purchase[] = purchasesRes.data || [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayExpenses = expenses.filter((e) => new Date(e.expense_date) >= todayStart);
  const totalTodayPkr = todayExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalAllTimePkr = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <DashboardLayout>
      <TopHeader title="Business Expenses" subtitle="Track freight, fuel, labour, loading, and general shop operational costs" />

      <div className="mt-4 space-y-4">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="p-2 sm:p-3 bg-white border border-slate-200 rounded-sm flex flex-col justify-center shadow-2xs">
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">Today's Expenses</p>
              <h3 className="text-sm sm:text-lg font-bold tracking-tight text-rose-600">Rs. {totalTodayPkr.toLocaleString()}</h3>
            </div>
            <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-0.5">{todayExpenses.length} entry(s)</span>
          </div>

          <div className="p-2 sm:p-3 bg-white border border-slate-200 rounded-sm flex flex-col justify-center shadow-2xs">
            <div>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">Overall Expenses</p>
              <h3 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900">Rs. {totalAllTimePkr.toLocaleString()}</h3>
            </div>
            <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 mt-0.5">{expenses.length} entry(s)</span>
          </div>
        </div>

        {/* Expense Form */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <Receipt className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-slate-800">New Expense Entry</h2>
          </div>
          <ExpenseEntryForm purchases={purchases} />
        </section>

        {/* Expense History */}
        <section className="space-y-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <History className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-800">Expense Audit History</h2>
          </div>
          <ExpensesTable expenses={expenses} />
        </section>
      </div>
    </DashboardLayout>
  );
}
