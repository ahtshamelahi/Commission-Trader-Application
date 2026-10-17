'use client';

import React, { useState } from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { CropSummary } from '@/types/crop-data-types';
import { Search, AlertTriangle } from 'lucide-react';

interface CurrentStockTableProps {
  summaries: CropSummary[];
  isLoading?: boolean;
}

export function CurrentStockTable({ summaries, isLoading }: CurrentStockTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = summaries.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<CropSummary>[] = [
    {
      header: 'Crop Name',
      cell: (row) => <span className="font-bold text-slate-900 text-sm">{row.name}</span>,
    },
    {
      header: 'Total Purchased Physical (kg)',
      align: 'right',
      cell: (row) => `${row.totalPurchasedWeightKg.toLocaleString()} kg`,
    },
    {
      header: 'Total Sold Physical (kg)',
      align: 'right',
      cell: (row) => `${row.totalSoldPhysicalWeightKg.toLocaleString()} kg`,
    },
    {
      header: 'Current Available Stock (kg)',
      align: 'right',
      cell: (row) => {
        const isLow = row.currentAvailableStockKg <= 0;
        return (
          <div className="flex items-center justify-end gap-1.5 font-bold">
            {isLow && <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span className={isLow ? 'text-rose-600' : 'text-emerald-700'}>
              {row.currentAvailableStockKg.toLocaleString()} kg
            </span>
          </div>
        );
      },
    },
    {
      header: 'Total Purchase Value',
      align: 'right',
      cell: (row) => `Rs. ${row.totalPurchaseValuePkr.toLocaleString()}`,
    },
    {
      header: 'Avg Cost / Maund (40kg)',
      align: 'right',
      cell: (row) => (
        <span className="font-mono text-slate-700">
          Rs. {row.averageCostPer40KgPkr.toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Avg Cost / kg',
      align: 'right',
      cell: (row) => `Rs. ${row.averageCostPerKgPkr.toLocaleString()}`,
    },
    {
      header: 'Last Activity',
      align: 'right',
      cell: (row) =>
        row.lastTransactionDate
          ? new Date(row.lastTransactionDate).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })
          : 'No activity',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 border border-slate-200 rounded-md shadow-2xs">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search crop by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{filteredData.length}</span> crop category(s)
        </div>
      </div>

      <ReusableDataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        emptyMessage="No crop inventory data found."
      />
    </div>
  );
}
