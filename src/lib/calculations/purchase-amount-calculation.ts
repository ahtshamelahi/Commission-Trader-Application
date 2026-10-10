/**
 * Calculates purchase commission weight in kg.
 * Formula: gross_weight_kg * (commission_per_40kg / 40)
 */
export function calculatePurchaseCommissionWeight(
  grossWeightKg: number,
  commissionPer40kg: number
): number {
  if (grossWeightKg <= 0 || commissionPer40kg < 0) return 0;
  return Number(((grossWeightKg * commissionPer40kg) / 40).toFixed(3));
}

/**
 * Calculates purchase net weight in kg.
 * Formula: gross_weight_kg - commission_weight_kg
 */
export function calculatePurchaseNetWeight(
  grossWeightKg: number,
  commissionWeightKg: number
): number {
  const net = grossWeightKg - commissionWeightKg;
  return Number(Math.max(0, net).toFixed(3));
}

/**
 * Calculates total purchase crop amount in PKR.
 * Formula: (net_weight_kg / 40) * rate_per_40kg
 */
export function calculatePurchaseCropAmount(
  netWeightKg: number,
  ratePer40kg: number
): number {
  if (netWeightKg <= 0 || ratePer40kg <= 0) return 0;
  return Number(((netWeightKg / 40) * ratePer40kg).toFixed(2));
}

export interface PurchaseCalculationResult {
  commissionWeightKg: number;
  netWeightKg: number;
  cropAmountPkr: number;
}

export function performPurchaseCalculations(
  grossWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number
): PurchaseCalculationResult {
  const commissionWeightKg = calculatePurchaseCommissionWeight(grossWeightKg, commissionPer40kg);
  const netWeightKg = calculatePurchaseNetWeight(grossWeightKg, commissionWeightKg);
  const cropAmountPkr = calculatePurchaseCropAmount(netWeightKg, ratePer40kg);

  return {
    commissionWeightKg,
    netWeightKg,
    cropAmountPkr,
  };
}
