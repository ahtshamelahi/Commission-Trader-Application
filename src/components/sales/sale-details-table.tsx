'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { Sale } from '@/types/sale-data-types';

interface SaleDetailsTableProps {
  sales: Sale[];
  isLoading?: boolean;
}

export function SaleDetailsTable({ sales, isLoading }: SaleDetailsTableProps) {
  const columns: Column<Sale>[] = [
    {
      header: 'Invoice #',
      cell: (row) => <span className="font-mono font-bold text-slate-900 text-xs">{row.invoice_no || `SALE-${row.id}`}</span>,
    },
    {
      header: 'Crop',
      cell: (row) => row.crops?.name || 'Crop',
    },
    {
      header: 'Buyer',
      cell: (row) => row.parties?.name || 'Walk-in Buyer',
    },
    {
      header: 'Physical Delivered (kg)',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-slate-900">
          {Number(row.physical_weight_kg).toLocaleString()} kg
        </span>
      ),
    },
    {
      header: 'Comm. (kg)',
      align: 'right',
      cell: (row) => `${Number(row.commission_weight_kg).toLocaleString()} kg`,
    },
    {
      header: 'Billable (kg)',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-blue-700">
          {Number(row.billable_weight_kg).toLocaleString()} kg
        </span>
      ),
    },
    {
      header: 'Rate / 40kg',
      align: 'right',
      cell: (row) => `Rs. ${Number(row.rate_per_40kg).toLocaleString()}`,
    },
    {
      header: 'Sale Amount',
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-emerald-800">
          Rs. {Number(row.sale_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Date',
      align: 'right',
      cell: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return <ReusableDataTable columns={columns} data={sales} isLoading={isLoading} emptyMessage="No sales records found." />;
}
