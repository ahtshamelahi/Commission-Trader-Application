import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculatePhysicalStockKg,
  calculateWeightedAverageCostPerKg,
  resolveAvailableStockKg,
} from './current-stock-calculation';
import {
  calculateStoredPurchaseTotalPkr,
  performPurchaseCalculations,
} from './purchase-amount-calculation';
import { performSaleCalculations } from './sale-amount-calculation';
import { calculateProfitAndLoss } from './profit-loss-calculation';

test('purchase example: 400 kg @ 3000/40 with 1.25 kg/40 deduction', () => {
  const r = performPurchaseCalculations(400, 1.25, 3000);
  assert.equal(r.deductionWeightKg, 12.5);
  assert.equal(r.netPayableWeightKg, 387.5);
  assert.equal(r.cropPaymentPkr, 29062.5);
  assert.equal(r.physicalStockToAddKg, 400);
});

test('purchase total adds net-weight price, flat kunda, and bag cost once', () => {
  const r = performPurchaseCalculations(400, 1.25, 3000, 100, 10, 25);
  assert.equal(r.cropPaymentPkr, 29062.5);
  assert.equal(r.totalBagAmountPkr, 250);
  assert.equal(r.totalPurchaseAmountPkr, 29412.5);
});

test('purchase deduction and bardana use independently selected weight bases', () => {
  const r = performPurchaseCalculations(500, 2, 4000, 0, 0, 0, 50, 3, 60);
  assert.equal(r.deductionWeightKg, 20);
  assert.equal(r.bardanaWeightKg, 25);
  assert.equal(r.netPayableWeightKg, 455);
  assert.equal(r.cropPaymentPkr, 45500);
});

test('stored purchase total prefers document_total over its expense breakdown', () => {
  assert.equal(
    calculateStoredPurchaseTotalPkr(
      29062.5,
      [
        { amount: 100, is_income: false },
        { amount: 250, is_income: false },
      ],
      29412.5
    ),
    29412.5
  );
});

test('stored purchase total falls back to crop amount plus net linked expenses', () => {
  assert.equal(
    calculateStoredPurchaseTotalPkr(29062.5, [
      { amount: 100, is_income: false },
      { amount: 250, is_income: false },
      { amount: 12.5, is_income: true },
    ]),
    29400
  );
});

test('zero document total falls back to existing purchase components', () => {
  assert.equal(
    calculateStoredPurchaseTotalPkr(
      29062.5,
      [{ amount: 100, is_income: false }],
      0
    ),
    29162.5
  );
});

test('sale example: 200 kg @ 3500/40 with 1 kg/40 bardana', () => {
  const bardana = (200 / 40) * 1;
  const r = performSaleCalculations(200, bardana, 3500);
  assert.equal(r.bardanaDeductionKg, 5);
  assert.equal(r.netSaleWeightKg, 195);
  assert.equal(r.cropSaleAmountPkr, 17062.5);
  assert.equal(r.physicalStockToRemoveKg, 200);
});

test('stock: buy 100 sell 40 leaves 60 physical', () => {
  assert.equal(
    calculatePhysicalStockKg({ purchasedGrossKg: 100, soldPhysicalKg: 40 }),
    60
  );
  assert.equal(
    resolveAvailableStockKg({
      purchases: [{ gross_weight_kg: 100 }],
      sales: [{ physical_weight_kg: 40 }],
      movements: [],
    }),
    60
  );
});

test('weighted avg cost uses physical kg, not net payable', () => {
  const avg = calculateWeightedAverageCostPerKg([
    {
      id: 1,
      invoice_no: 'P1',
      crop_id: 1,
      variety_id: null,
      supplier_id: 1,
      bags: 0,
      gross_weight_kg: 100,
      commission_per_40kg: 1.25,
      commission_weight_kg: 3.125,
      bardana_per_bag_kg: 0,
      bardana_total_kg: 0,
      net_weight_kg: 96.875,
      rate_per_40kg: 3000,
      crop_amount: 7500,
      vehicle_number: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]);
  assert.equal(avg, 75);
});

test('COGS example: buy 100 for 7500, sell 40 → COGS 3000, remaining value 4500', () => {
  const pnl = calculateProfitAndLoss(
    [
      {
        id: 1,
        invoice_no: 'S1',
        crop_id: 1,
        variety_id: null,
        buyer_id: 1,
        bags: 0,
        physical_weight_kg: 40,
        commission_per_40kg: 0,
        commission_weight_kg: 0,
        bardana_per_bag_kg: 0,
        bardana_total_kg: 0,
        billable_weight_kg: 39,
        rate_per_40kg: 3500,
        sale_amount: 20000,
        vehicle_number: null,
        notes: null,
        created_at: '2026-01-02T00:00:00Z',
      },
    ],
    [
      {
        id: 1,
        invoice_no: 'P1',
        crop_id: 1,
        variety_id: null,
        supplier_id: 1,
        bags: 0,
        gross_weight_kg: 100,
        commission_per_40kg: 1.25,
        commission_weight_kg: 3.125,
        bardana_per_bag_kg: 0,
        bardana_total_kg: 0,
        net_weight_kg: 96.875,
        rate_per_40kg: 3000,
        crop_amount: 7500,
        vehicle_number: null,
        notes: null,
        created_at: '2026-01-01T00:00:00Z',
        purchase_expenses: [],
      },
    ],
    []
  );
  assert.equal(pnl.totalCostOfGoodsSoldPkr, 3000);
  assert.equal(pnl.totalSaleRevenuePkr, 20000);
  assert.equal(pnl.grossProfitPkr, 17000);
});
