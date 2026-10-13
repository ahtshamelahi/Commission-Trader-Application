export interface PurchaseCalculationResult {
  commissionWeightKg: number;
  bardanaWeightKg: number;
  netWeightKg: number;
  cropAmountPkr: number;
}

/**
 * Purchase calculation:
 * 1. commission_weight = gross * (commission_per_40kg / 40)
 * 2. bardana_weight    = bags * bardana_per_bag
 * 3. net_weight        = gross - commission_weight - bardana_weight
 * 4. crop_amount       = (net_weight / 40) * rate_per_40kg
 */
export function performPurchaseCalculations(
  grossWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number,
  bags: number = 0,
  bardanaPerBagKg: number = 0
): PurchaseCalculationResult {
  const commissionWeightKg = Number(((grossWeightKg * commissionPer40kg) / 40).toFixed(3));
  const bardanaWeightKg = Number((bags * bardanaPerBagKg).toFixed(3));
  const netWeightKg = Number(Math.max(0, grossWeightKg - commissionWeightKg - bardanaWeightKg).toFixed(3));
  const cropAmountPkr =
    netWeightKg > 0 && ratePer40kg > 0
      ? Number(((netWeightKg / 40) * ratePer40kg).toFixed(2))
      : 0;
  return { commissionWeightKg, bardanaWeightKg, netWeightKg, cropAmountPkr };
}
