import Link from 'next/link';
import { getKhataParty, getPartyLedger } from '@/lib/actions/khata-actions';
import { KhataPartyStatement } from '@/components/khata/khata-party-statement';
import { TopHeader } from '@/components/layout/top-header';

export const dynamic = 'force-dynamic';

export default async function KhataPartyPage({
  params,
  searchParams,
}: {
  params: Promise<{ partyId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { partyId: rawId } = await params;
  const { from = '', to = '' } = await searchParams;
  const partyId = Number(rawId);

  if (!Number.isFinite(partyId) || partyId <= 0) {
    return (
      <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
        Invalid party.
      </div>
    );
  }

  const partyRes = await getKhataParty(partyId);
  if (!partyRes.data) {
    return (
      <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
        {partyRes.error || 'Party not found.'}
      </div>
    );
  }

  const ledger = await getPartyLedger(partyId, { from: from || undefined, to: to || undefined });

  return (
    <>
      <div className="print:hidden">
        <TopHeader title="Party Khata" subtitle={partyRes.data.name} />
      </div>
      <div className="mt-3 print:mt-0 space-y-2">
        <Link href="/khata" className="print:hidden text-xs font-semibold text-blue-700 hover:underline">
          ← All parties
        </Link>
        {ledger.error ? (
          <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
            {ledger.error}
          </div>
        ) : (
          <KhataPartyStatement
            party={partyRes.data}
            entries={ledger.data}
            openingBalance={ledger.openingBalance}
            closingBalance={ledger.closingBalance}
            from={from}
            to={to}
          />
        )}
      </div>
    </>
  );
}
