import { redirect } from 'next/navigation';
import { getKhataParties } from '@/lib/actions/khata-actions';
import { KhataTable } from '@/components/khata/khata-table';
import { TopHeader } from '@/components/layout/top-header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sales Khata | M-Shafiq Commission Shop',
  description: 'Buyer accounts, balances, payments received and history.',
};

export default async function SalesKhataPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string }>;
}) {
  const { partyId: partyIdParam } = await searchParams;
  const initialPartyId = partyIdParam ? Number(partyIdParam) : null;
  if (initialPartyId && Number.isFinite(initialPartyId) && initialPartyId > 0) {
    redirect(`/khata/party/${initialPartyId}`);
  }

  const { data: parties, error } = await getKhataParties({ partyType: 'buyers' });

  return (
    <>
      <TopHeader title="Sales Khata" subtitle="Buyer accounts — receivables, money received, and history" />
      <div className="mt-3 space-y-3">
        {error ? (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            Could not load khata: {error}. Run <code>20261015_khata_party_ledger.sql</code>.
          </div>
        ) : (
          <KhataTable parties={parties} initialFilter="buyers" />
        )}
      </div>
    </>
  );
}
