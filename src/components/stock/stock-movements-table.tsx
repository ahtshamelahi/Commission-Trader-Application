'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { StockMovement } from '@/types/stock-data-types';
import { ArrowDownLeft, ArrowUpRight, ShieldAlert } from 'lucide-react';

interface StockMovementsTableProps {
  movements: StockMovement[];
  isLoading?: boolean;
}

export function StockMovementsTable({ movements, isLoading }: StockMovementsTableProps) {
  const movementColumns: Column<StockMovement>[] = [
    { header: 'ID', accessorKey: 'id' },
    { header: 'Crop', cell: (row) => row.crops?.name || 'Crop' },
    {
      header: 'Movement Type',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {row.movement_type === 'purchase' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
              <ArrowDownLeft className="w-3 h-3 text-blue-600" /> Incoming Purchase
            </span>
          ) : row.movement_type === 'sale' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
              <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Outgoing Sale
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
              <ShieldAlert className="w-3 h-3 text-amber-600" /> Adjustment
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Quantity (kg)',
      align: 'right',
      cell: (row) => (
        <span
          className={`font-bold ${
            Number(row.quantity_kg) > 0 ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {Number(row.quantity_kg) > 0 ? `+${Number(row.quantity_kg).toLocaleString()}` : `${Number(row.quantity_kg).toLocaleString()}`} kg
        </span>
      ),
    },
    { header: 'Notes / Source', cell: (row) => row.notes || '-' },
    {
      header: 'Date & Time',
      align: 'right',
      cell: (row) => new Date(row.created_at).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return (
    <ReusableDataTable
      columns={movementColumns}
      data={movements}
      isLoading={isLoading}
      emptyMessage="No stock movements recorded."
    />
  );
}
