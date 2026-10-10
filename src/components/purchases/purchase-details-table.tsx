'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { Purchase } from '@/types/purchase-data-types';

interface PurchaseDetailsTableProps {
  purchases: Purchase[];
  isLoading?: boolean;
}

export function PurchaseDetailsTable({ purchases, isLoading }: PurchaseDetailsTableProps) {
  const columns: Column<Purchase>[] = [
    {
      header: 'Invoice #',
      cell: (row) => <span className="font-mono font-bold text-slate-900 text-xs">{row.invoice_no || `PUR-${row.id}`}</span>,
    },
    {
      header: 'Crop',
      cell: (row) => row.crops?.name || 'Crop',
    },
    {
      header: 'Supplier',
      cell: (row) => row.parties?.name || 'Walk-in Farmer',
    },
    {
      header: 'Bags',
      align: 'center',
      cell: (row) => row.bags || 0,
    },
    {
      header: 'Gross (kg)',
      align: 'right',
      cell: (row) => `${Number(row.gross_weight_kg).toLocaleString()} kg`,
    },
    {
      header: 'Comm. (kg)',
      align: 'right',
      cell: (row) => `${Number(row.commission_weight_kg).toLocaleString()} kg`,
    },
    {
      header: 'Net Stock (kg)',
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-emerald-700">
          {Number(row.net_weight_kg).toLocaleString()} kg
        </span>
      ),
    },
    {
      header: 'Rate / 40kg',
      align: 'right',
      cell: (row) => `Rs. ${Number(row.rate_per_40kg).toLocaleString()}`,
    },
    {
      header: 'Crop Amount',
      align: 'right',
      cell: (row) => (
        <span className="font-bold text-slate-900">
          Rs. {Number(row.crop_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      header: 'Date',
      align: 'right',
      cell: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return <ReusableDataTable columns={columns} data={purchases} isLoading={isLoading} emptyMessage="No purchase records found." />;
}
