'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export interface RecentTransactionItem {
  id: string | number;
  type: 'purchase' | 'sale' | 'expense';
  invoice_no?: string;
  party_name?: string;
  crop_name?: string;
  amount: number;
  weight_kg?: number;
  date: string;
}

interface RecentTransactionsTableProps {
  transactions: RecentTransactionItem[];
  isLoading?: boolean;
}

export function RecentTransactionsTable({ transactions, isLoading }: RecentTransactionsTableProps) {
  const columns: Column<RecentTransactionItem>[] = [
    {
      header: 'Type',
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-medium text-xs">
          {row.type === 'purchase' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              <ArrowDownLeft className="w-3 h-3 text-blue-600" /> Purchase
            </span>
          ) : row.type === 'sale' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Sale
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Expense
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Invoice / Details',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 block text-xs">{row.invoice_no || 'N/A'}</span>
          <span className="text-[11px] text-slate-500">{row.party_name || '-'}</span>
        </div>
      ),
    },
    {
      header: 'Crop',
      accessorKey: 'crop_name',
    },
    {
      header: 'Weight (kg)',
      align: 'right',
      cell: (row) => (row.weight_kg ? `${row.weight_kg.toLocaleString()} kg` : '-'),
    },
    {
      header: 'Amount (PKR)',
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-slate-900">
          Rs. {row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Date',
      align: 'right',
      cell: (row) => new Date(row.date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Activity</h2>
      </div>
      <ReusableDataTable columns={columns} data={transactions} isLoading={isLoading} emptyMessage="No recent transactions recorded today." />
    </div>
  );
}
