/** Money rounded to paisa (2 decimal places). */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type BalanceStatus = 'settled' | 'receivable' | 'payable';

/** Positive = you'll get (receivable). Negative = you'll give (payable). */
export function balanceStatus(balance: number): BalanceStatus {
  const b = roundMoney(balance);
  if (Math.abs(b) < 0.005) return 'settled';
  return b > 0 ? 'receivable' : 'payable';
}

export function balanceLabel(balance: number): string {
  const status = balanceStatus(balance);
  if (status === 'settled') return 'Settled';
  if (status === 'receivable') return 'Receivable';
  return 'Payable';
}

export interface LedgerDelta {
  entry_date: string;
  delta: number;
  source_table?: string;
  source_id?: number;
  /** Optional explicit rank. Bills (sale/purchase) sort before payments on the same timestamp. */
  sort_rank?: number;
  entry_type?: string;
}

/** Bills first (0), then receipts/payments (1). Used when the ledger view has no sort_rank column. */
export function ledgerSortRank(entry: Pick<LedgerDelta, 'sort_rank' | 'entry_type'>): number {
  if (entry.sort_rank != null && Number.isFinite(entry.sort_rank)) {
    return Number(entry.sort_rank);
  }
  const t = entry.entry_type ?? '';
  if (t === 'sale' || t === 'purchase') return 0;
  if (t === 'payment_in' || t === 'payment_out') return 1;
  return 0;
}

export type RunningLedgerRow<T extends LedgerDelta = LedgerDelta> = T & {
  balance: number;
};

export function compareLedgerOrder(a: LedgerDelta, b: LedgerDelta): number {
  const ta = new Date(a.entry_date).getTime();
  const tb = new Date(b.entry_date).getTime();
  if (ta !== tb) return ta - tb;
  const ra = ledgerSortRank(a);
  const rb = ledgerSortRank(b);
  if (ra !== rb) return ra - rb;
  return (a.source_id ?? 0) - (b.source_id ?? 0);
}

/** Oldest-first running balance. Does not mutate the input list. */
export function withRunningBalance<T extends LedgerDelta>(entries: T[]): RunningLedgerRow<T>[] {
  const sorted = [...entries].sort(compareLedgerOrder);
  let running = 0;
  return sorted.map((e) => {
    running = roundMoney(running + (Number(e.delta) || 0));
    return { ...e, balance: running };
  });
}

export interface StatementSlice<T extends RunningLedgerRow> {
  openingBalance: number;
  rows: T[];
  closingBalance: number;
}

function dateKey(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

/**
 * Party statement for a date window.
 * Running balance always starts from the first ledger event (never double-counts).
 * Opening = balance just before the first in-range row.
 */
export function statementForRange<T extends LedgerDelta>(
  entries: T[],
  fromDate?: string | null,
  toDate?: string | null
): StatementSlice<RunningLedgerRow<T>> {
  const all = withRunningBalance(entries);
  const from = fromDate?.trim() || '';
  const to = toDate?.trim() || '';

  if (!from && !to) {
    const closing = all.length ? all[all.length - 1].balance : 0;
    return { openingBalance: 0, rows: all, closingBalance: closing };
  }

  const inRange = all.filter((e) => {
    const key = dateKey(e.entry_date);
    if (from && key < from) return false;
    if (to && key > to) return false;
    return true;
  });

  let opening = 0;
  if (inRange.length > 0) {
    opening = roundMoney(inRange[0].balance - (Number(inRange[0].delta) || 0));
  } else if (from) {
    const before = all.filter((e) => dateKey(e.entry_date) < from);
    opening = before.length ? before[before.length - 1].balance : 0;
  }

  const closing = inRange.length ? inRange[inRange.length - 1].balance : opening;
  return { openingBalance: opening, rows: inRange, closingBalance: closing };
}

/**
 * Net party balance from independent streams without double-counting:
 * sale bills − amounts received on those sales − manual receipts
 * − purchase bills + amounts paid on those purchases + manual payouts.
 */
export function netPartyBalance(input: {
  saleBills: number;
  saleReceipts: number;
  purchaseBills: number;
  purchasePayments: number;
  manualReceived: number;
  manualPaid: number;
}): number {
  return roundMoney(
    input.saleBills -
      input.saleReceipts -
      input.purchaseBills +
      input.purchasePayments -
      input.manualReceived +
      input.manualPaid
  );
}
