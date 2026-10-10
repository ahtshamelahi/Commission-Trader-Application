'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { Crop } from '@/types/crop-data-types';

interface CropsTableProps {
  crops: Crop[];
  isLoading?: boolean;
}

export function CropsTable({ crops, isLoading }: CropsTableProps) {
  const cropColumns: Column<Crop>[] = [
    { header: 'Crop ID', accessorKey: 'id' },
    { header: 'Crop Name', accessorKey: 'name' },
    {
      header: 'Created Date',
      align: 'right',
      cell: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return <ReusableDataTable columns={cropColumns} data={crops} isLoading={isLoading} emptyMessage="No crops registered yet." />;
}
