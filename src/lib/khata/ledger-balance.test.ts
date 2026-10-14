import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  balanceStatus,
  ledgerSortRank,
  netPartyBalance,
  roundMoney,
  statementForRange,
  withRunningBalance,
} from './ledger-balance';

test('roundMoney rounds to paisa', () => {
  assert.equal(roundMoney(10.005), 10.01);
  assert.equal(roundMoney(1.004), 1);
});

test('running balance: sale, partial receipt, remaining receivable', () => {
  const rows = withRunningBalance([
    { entry_date: '2026-10-01T08:00:00Z', delta: 50000, sort_rank: 0, source_id: 1 },
    { entry_date: '2026-10-01T08:00:00Z', delta: -20000, sort_rank: 1, source_id: 1 },
  ]);
  assert.equal(rows[0].balance, 50000);
  assert.equal(rows[1].balance, 30000);
  assert.equal(balanceStatus(rows[1].balance), 'receivable');
});

test('running balance: purchase, payment, remaining payable', () => {
  const rows = withRunningBalance([
    { entry_date: '2026-10-02T08:00:00Z', delta: -100000, sort_rank: 0, source_id: 2 },
    { entry_date: '2026-10-03T08:00:00Z', delta: 40000, sort_rank: 1, source_id: 3 },
  ]);
  assert.equal(rows[1].balance, -60000);
  assert.equal(balanceStatus(rows[1].balance), 'payable');
});

test('advance receipt flips the party to payable (you owe the buyer)', () => {
  const rows = withRunningBalance([
    { entry_date: '2026-10-04T08:00:00Z', delta: 10000, sort_rank: 0, source_id: 1 },
    { entry_date: '2026-10-04T09:00:00Z', delta: -15000, sort_rank: 1, source_id: 2 },
  ]);
  assert.equal(rows[1].balance, -5000);
  assert.equal(balanceStatus(rows[1].balance), 'payable');
});

test('does not double-count invoice receipt vs manual receipt of the same cash', () => {
  // Invoice already recorded 10,000 received. Manual entry must not add it again.
  const balance = netPartyBalance({
    saleBills: 25000,
    saleReceipts: 10000,
    purchaseBills: 0,
    purchasePayments: 0,
    manualReceived: 0,
    manualPaid: 0,
  });
  assert.equal(balance, 15000);

  const duplicated = netPartyBalance({
    saleBills: 25000,
    saleReceipts: 10000,
    purchaseBills: 0,
    purchasePayments: 0,
    manualReceived: 10000,
    manualPaid: 0,
  });
  assert.notEqual(duplicated, 15000);
});

test('statement window uses opening balance, not a reset', () => {
  const entries = [
    { entry_date: '2026-10-01T08:00:00+05:00', delta: 40000, source_id: 1, sort_rank: 0 },
    { entry_date: '2026-10-10T08:00:00+05:00', delta: -10000, source_id: 2, sort_rank: 1 },
    { entry_date: '2026-10-20T08:00:00+05:00', delta: -5000, source_id: 3, sort_rank: 1 },
  ];
  const slice = statementForRange(entries, '2026-10-10', '2026-10-31');
  assert.equal(slice.openingBalance, 40000);
  assert.equal(slice.rows.length, 2);
  assert.equal(slice.rows[0].balance, 30000);
  assert.equal(slice.closingBalance, 25000);
});

test('same-date sale and receipt order by entry_type when sort_rank is absent', () => {
  assert.equal(ledgerSortRank({ entry_type: 'sale' }), 0);
  assert.equal(ledgerSortRank({ entry_type: 'purchase' }), 0);
  assert.equal(ledgerSortRank({ entry_type: 'payment_in' }), 1);
  assert.equal(ledgerSortRank({ entry_type: 'payment_out' }), 1);
  assert.equal(ledgerSortRank({ sort_rank: 3, entry_type: 'sale' }), 3);

  const rows = withRunningBalance([
    { entry_date: '2026-10-01T08:00:00Z', delta: -20000, entry_type: 'payment_in', source_id: 1 },
    { entry_date: '2026-10-01T08:00:00Z', delta: 50000, entry_type: 'sale', source_id: 1 },
  ]);
  assert.equal(rows[0].entry_type, 'sale');
  assert.equal(rows[0].balance, 50000);
  assert.equal(rows[1].entry_type, 'payment_in');
  assert.equal(rows[1].balance, 30000);
});

test('settled when bills and payments match', () => {
  const b = netPartyBalance({
    saleBills: 0,
    saleReceipts: 0,
    purchaseBills: 80000,
    purchasePayments: 50000,
    manualReceived: 0,
    manualPaid: 30000,
  });
  assert.equal(b, 0);
  assert.equal(balanceStatus(b), 'settled');
});
