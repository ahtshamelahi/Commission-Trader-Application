'use client';

import React from 'react';
import { ReusableDataTable, Column } from '@/components/ui/reusable-data-table';
import { Party } from '@/types/party-data-types';

interface PartiesTableProps {
  parties: Party[];
  isLoading?: boolean;
}

export function PartiesTable({ parties, isLoading }: PartiesTableProps) {
  const partyColumns: Column<Party>[] = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Phone', cell: (row) => row.phone || '-' },
    { header: 'Address', cell: (row) => row.address || '-' },
    {
      header: 'Role',
      cell: (row) => (
        <span
          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase ${
            row.party_type === 'supplier'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : row.party_type === 'buyer'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-purple-50 text-purple-700 border border-purple-200'
          }`}
        >
          {row.party_type}
        </span>
      ),
    },
    {
      header: 'Added Date',
      align: 'right',
      cell: (row) => new Date(row.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' }),
    },
  ];

  return <ReusableDataTable columns={partyColumns} data={parties} isLoading={isLoading} emptyMessage="No parties registered yet." />;
}
