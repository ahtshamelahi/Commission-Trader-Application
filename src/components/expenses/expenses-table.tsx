'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { Expense } from '@/types/expense-data-types';

export type ExpenseWithRelation = Expense & {
  purchases?: { invoice_no?: string; crops?: { name?: string } };
};

interface ExpensesTableProps {
  expenses: ExpenseWithRelation[];
  isLoading?: boolean;
}

export function ExpensesTable({ expenses, isLoading }: ExpensesTableProps) {
  const columns: Column<ExpenseWithRelation>[] = [
    { header: 'ID', accessorKey: 'id' },
    {
      header: 'Category',
      cell: (row) => <span className="font-semibold text-slate-900">{row.category}</span>,
    },
    {
      header: 'Amount (PKR)',
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-rose-600">
          Rs. {Number(row.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Linked Purchase',
      cell: (row) =>
        row.purchases?.invoice_no
          ? `${row.purchases.invoice_no} (${row.purchases.crops?.name || 'Crop'})`
          : 'General Expense',
    },
    { header: 'Notes / Description', cell: (row) => row.notes || '-' },
    {
      header: 'Date',
      align: 'right',
      cell: (row) => new Date(row.expense_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return <ReusableDataTable columns={columns} data={expenses} isLoading={isLoading} emptyMessage="No expense records found." />;
}
