import { redirect } from 'next/navigation';
import { getKhataParties } from '@/lib/actions/khata-actions';
import { KhataTable } from '@/components/khata/khata-table';
import { TopHeader } from '@/components/layout/top-header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Purchase Khata | M-Shafiq Commission Shop',
  description: 'Supplier accounts, balances, payments made and history.',
};

export default async function PurchaseKhataPage({
  searchParams,
}: {
  searchParams: Promise<{ partyId?: string }>;
}) {
  const { partyId: partyIdParam } = await searchParams;
  const initialPartyId = partyIdParam ? Number(partyIdParam) : null;
  if (initialPartyId && Number.isFinite(initialPartyId) && initialPartyId > 0) {
    redirect(`/khata/party/${initialPartyId}`);
  }

  const { data: parties, error } = await getKhataParties({ partyType: 'suppliers' });

  return (
    <>
      <TopHeader
        title="Purchase Khata"
        subtitle="Supplier accounts — payables, money paid, and history"
      />
      <div className="mt-3 space-y-3">
        {error ? (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            Could not load khata: {error}. Run <code>20261015_khata_party_ledger.sql</code>.
          </div>
        ) : (
          <KhataTable parties={parties} initialFilter="suppliers" />
        )}
      </div>
    </>
  );
}
