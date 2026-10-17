// lib/calculations/sale-amount-calculation.ts

export interface SaleCalculationResult {
  /** user-entered or derived total bardana deduction in kg */
  bardanaDeductionKg: number;
  /** actualWeightSold - bardanaDeductionKg */
  netSaleWeightKg: number;
  /** (netSaleWeightKg / 40) * pricePerUnit */
  cropSaleAmountPkr: number;
  /** numBags * pricePerBag */
  totalBagRevenuePkr: number;
  /** cropSaleAmountPkr + totalBagRevenuePkr */
  baseSaleAmountPkr: number;
  /** baseSaleAmountPkr * commissionPct / 100 */
  commissionAmountPkr: number;
  /** baseSaleAmountPkr + commissionAmountPkr */
  finalAmountReceivablePkr: number;
  /** = actualWeightSold (inventory reduction) */
  physicalStockToRemoveKg: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

/**
 * Sale calculation — spec section B:
 *
 * bardana_deduction_kg     = user-entered total kg deduction
 * net_sale_weight          = actual_weight_sold − bardana_deduction
 * crop_sale_amount         = (net_sale_weight / 40) × price_per_40kg
 * total_bag_revenue        = num_bags × price_per_bag
 * base_sale_amount         = crop_sale_amount + total_bag_revenue
 * commission_amount        = base_sale_amount × commission_pct / 100
 * final_amount_receivable  = base_sale_amount + commission_amount
 * physical_stock_to_remove = actual_weight_sold
 */
export function performSaleCalculations(
  actualWeightSoldKg: number,
  bardanaDeductionKg: number,
  pricePerUnit40Kg: number,
  numBags: number = 0,
  pricePerBagPkr: number = 0,
  commissionPct: number = 0
): SaleCalculationResult {
  const aw = Math.max(0, actualWeightSoldKg);
  const bd = Math.max(0, bardanaDeductionKg);

  const netSaleWeightKg = r3(Math.max(0, aw - bd));
  const cropSaleAmountPkr =
    netSaleWeightKg > 0 && pricePerUnit40Kg > 0
      ? r2((netSaleWeightKg / 40) * pricePerUnit40Kg)
      : 0;
  const totalBagRevenuePkr = r2(Math.max(0, numBags) * Math.max(0, pricePerBagPkr));
  const baseSaleAmountPkr = r2(cropSaleAmountPkr + totalBagRevenuePkr);
  const pct = Math.max(0, commissionPct);
  const commissionAmountPkr = pct > 0 ? r2((baseSaleAmountPkr * pct) / 100) : 0;
  const finalAmountReceivablePkr = r2(baseSaleAmountPkr + commissionAmountPkr);

  return {
    bardanaDeductionKg: bd,
    netSaleWeightKg,
    cropSaleAmountPkr,
    totalBagRevenuePkr,
    baseSaleAmountPkr,
    commissionAmountPkr,
    finalAmountReceivablePkr,
    physicalStockToRemoveKg: r3(aw),
  };
}

// ── Legacy shim (old callers: pos-sale-form, save-multi-sale-transaction) ──────
export interface SaleCalculationResult_Legacy {
  commissionWeightKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  saleAmountPkr: number;
}

/** @deprecated  Use performSaleCalculations instead. */
export function performSaleCalculations_legacy(
  physicalWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number,
  bags: number = 0,
  bardanaPerBagKg: number = 0
): SaleCalculationResult_Legacy {
  const commissionWeightKg = Number(((physicalWeightKg * commissionPer40kg) / 40).toFixed(3));
  const bardanaWeightKg = Number((bags * bardanaPerBagKg).toFixed(3));
  const billableWeightKg = Number(Math.max(0, physicalWeightKg - commissionWeightKg - bardanaWeightKg).toFixed(3));
  const saleAmountPkr =
    billableWeightKg > 0 && ratePer40kg > 0
      ? Number(((billableWeightKg / 40) * ratePer40kg).toFixed(2))
      : 0;
  return { commissionWeightKg, bardanaWeightKg, billableWeightKg, saleAmountPkr };
}
