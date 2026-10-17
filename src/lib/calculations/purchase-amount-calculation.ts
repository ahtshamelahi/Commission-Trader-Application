// lib/calculations/purchase-amount-calculation.ts

export interface PurchaseCalculationResult {
  /** kg deducted from supplier weight for settlement */
  deductionWeightKg: number;
  /** Bardana weight deducted from supplier weight for settlement */
  bardanaWeightKg: number;
  /** actual_weight - deduction_weight - bardana_weight; used for supplier payment */
  netPayableWeightKg: number;
  /** (netPayableWeightKg / 40) * pricePerUnit */
  cropPaymentPkr: number;
  /** numBags * pricePerBag */
  totalBagAmountPkr: number;
  /** cropPaymentPkr + kundaAmountPkr + totalBagAmountPkr */
  totalPurchaseAmountPkr: number;
  /** = actual_weight_kg (for inventory) */
  physicalStockToAddKg: number;
}

export interface PurchaseExpenseAmount {
  amount: number | string | null;
  is_income?: boolean | null;
}

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Prefer the stored bill total; otherwise derive it from the persisted components. */
export function calculateStoredPurchaseTotalPkr(
  cropAmountPkr: number | string | null | undefined,
  purchaseExpenses: readonly PurchaseExpenseAmount[] = [],
  documentTotalPkr?: number | string | null
): number {
  const documentTotal = Number(documentTotalPkr);
  if (documentTotalPkr != null && Number.isFinite(documentTotal) && documentTotal > 0) {
    return r2(documentTotal);
  }

  const cropAmount = Number(cropAmountPkr ?? 0);
  const netExpenses = purchaseExpenses.reduce((total, expense) => {
    const amount = Number(expense.amount ?? 0);
    return total + (Number.isFinite(amount) ? (expense.is_income ? -amount : amount) : 0);
  }, 0);

  return r2(Math.max(0, (Number.isFinite(cropAmount) ? cropAmount : 0) + netExpenses));
}

/**
 * Purchase calculation — spec section A:
 *
 * deduction_weight   = actual_weight × deduction_rate ÷ deduction_basis
 * bardana_weight     = actual_weight × bardana_rate ÷ bardana_basis
 * net_payable_weight = actual_weight − deduction_weight − bardana_weight
 * crop_payment       = (net_payable_weight ÷ 40) × price_per_40kg
 * total_bag_amount   = num_bags × price_per_bag
 * kunda              = flat amount (no multiplication)
 * total_purchase     = crop_payment + kunda + total_bag_amount
 * physical_stock     = actual_weight (inventory uses gross received)
 */
export function performPurchaseCalculations(
  actualWeightKg: number,
  deductionRateKgPer40: number,
  pricePerUnit40Kg: number,
  kundaAmountPkr: number = 0,
  numBags: number = 0,
  pricePerBagPkr: number = 0,
  deductionBasisKg: number = 40,
  bardanaRateKgPerBasis: number = 0,
  bardanaBasisKg: number = 40
): PurchaseCalculationResult {
  const aw = Math.max(0, actualWeightKg);
  const rate = Math.max(0, deductionRateKgPer40);
  const deductionBasis = Math.max(0, deductionBasisKg);
  const bardanaRate = Math.max(0, bardanaRateKgPerBasis);
  const bardanaBasis = Math.max(0, bardanaBasisKg);

  const deductionWeightKg =
    deductionBasis > 0 ? r3((aw * rate) / deductionBasis) : 0;
  const bardanaWeightKg =
    bardanaBasis > 0 ? r3((aw * bardanaRate) / bardanaBasis) : 0;
  const netPayableWeightKg = r3(
    Math.max(0, aw - deductionWeightKg - bardanaWeightKg)
  );
  const cropPaymentPkr =
    netPayableWeightKg > 0 && pricePerUnit40Kg > 0
      ? r2((netPayableWeightKg / 40) * pricePerUnit40Kg)
      : 0;
  const totalBagAmountPkr = r2(Math.max(0, numBags) * Math.max(0, pricePerBagPkr));
  const kunda = r2(Math.max(0, kundaAmountPkr));
  const totalPurchaseAmountPkr = r2(cropPaymentPkr + kunda + totalBagAmountPkr);

  return {
    deductionWeightKg,
    bardanaWeightKg,
    netPayableWeightKg,
    cropPaymentPkr,
    totalBagAmountPkr,
    totalPurchaseAmountPkr,
    physicalStockToAddKg: r3(aw),
  };
}

// ── Legacy shim so existing callers (save-multi-purchase-transaction) keep compiling ──
export interface PurchaseCalculationResult_Legacy {
  commissionWeightKg: number;
  bardanaWeightKg: number;
  netWeightKg: number;
  cropAmountPkr: number;
}

/** @deprecated  Use performPurchaseCalculations instead. */
export function performPurchaseCalculations_legacy(
  grossWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number,
  bags: number = 0,
  bardanaPerBagKg: number = 0
): PurchaseCalculationResult_Legacy {
  const commissionWeightKg = Number(((grossWeightKg * commissionPer40kg) / 40).toFixed(3));
  const bardanaWeightKg = Number((bags * bardanaPerBagKg).toFixed(3));
  const netWeightKg = Number(Math.max(0, grossWeightKg - commissionWeightKg - bardanaWeightKg).toFixed(3));
  const cropAmountPkr =
    netWeightKg > 0 && ratePer40kg > 0
      ? Number(((netWeightKg / 40) * ratePer40kg).toFixed(2))
      : 0;
  return { commissionWeightKg, bardanaWeightKg, netWeightKg, cropAmountPkr };
}
