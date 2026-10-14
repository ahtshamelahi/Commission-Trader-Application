import { getKhataParties } from '@/lib/actions/khata-actions';
import { KhataTable } from '@/components/khata/khata-table';
import { TopHeader } from '@/components/layout/top-header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Khata | M-Shafiq Commission Shop',
  description: 'Buyer and supplier accounts, balances, and payments.',
};

export default async function KhataPage() {
  const { data: parties, error } = await getKhataParties();

  return (
    <>
      <TopHeader title="Khata" subtitle="Buyers and suppliers — outstanding balances and history" />
      <div className="mt-3 space-y-3">
        {error ? (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            Could not load khata: {error}. Run the latest Supabase migration{' '}
            <code>20261015_khata_party_ledger.sql</code>.
          </div>
        ) : (
          <KhataTable parties={parties} />
        )}
      </div>
    </>
  );
}
