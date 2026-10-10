/**
 * Calculates sale commission weight in kg.
 * Formula: physical_weight_kg * (commission_per_40kg / 40)
 */
export function calculateSaleCommissionWeight(
  physicalWeightKg: number,
  commissionPer40kg: number
): number {
  if (physicalWeightKg <= 0 || commissionPer40kg < 0) return 0;
  return Number(((physicalWeightKg * commissionPer40kg) / 40).toFixed(3));
}

/**
 * Calculates sale billable weight in kg.
 * Formula: physical_weight_kg - commission_weight_kg
 */
export function calculateSaleBillableWeight(
  physicalWeightKg: number,
  commissionWeightKg: number
): number {
  const billable = physicalWeightKg - commissionWeightKg;
  return Number(Math.max(0, billable).toFixed(3));
}

/**
 * Calculates total sale amount in PKR.
 * Formula: (billable_weight_kg / 40) * rate_per_40kg
 */
export function calculateSaleAmount(
  billableWeightKg: number,
  ratePer40kg: number
): number {
  if (billableWeightKg <= 0 || ratePer40kg <= 0) return 0;
  return Number(((billableWeightKg / 40) * ratePer40kg).toFixed(2));
}

export interface SaleCalculationResult {
  commissionWeightKg: number;
  billableWeightKg: number;
  saleAmountPkr: number;
}

export function performSaleCalculations(
  physicalWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number
): SaleCalculationResult {
  const commissionWeightKg = calculateSaleCommissionWeight(physicalWeightKg, commissionPer40kg);
  const billableWeightKg = calculateSaleBillableWeight(physicalWeightKg, commissionWeightKg);
  const saleAmountPkr = calculateSaleAmount(billableWeightKg, ratePer40kg);

  return {
    commissionWeightKg,
    billableWeightKg,
    saleAmountPkr,
  };
}
