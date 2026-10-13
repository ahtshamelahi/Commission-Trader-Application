export interface SaleCalculationResult {
  commissionWeightKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  saleAmountPkr: number;
}

/**
 * Sale calculation:
 * 1. commission_weight = physical * (commission_per_40kg / 40)
 * 2. bardana_weight    = bags * bardana_per_bag
 * 3. billable_weight   = physical - commission_weight - bardana_weight
 * 4. sale_amount       = (billable_weight / 40) * rate_per_40kg
 */
export function performSaleCalculations(
  physicalWeightKg: number,
  commissionPer40kg: number,
  ratePer40kg: number,
  bags: number = 0,
  bardanaPerBagKg: number = 0
): SaleCalculationResult {
  const commissionWeightKg = Number(((physicalWeightKg * commissionPer40kg) / 40).toFixed(3));
  const bardanaWeightKg = Number((bags * bardanaPerBagKg).toFixed(3));
  const billableWeightKg = Number(Math.max(0, physicalWeightKg - commissionWeightKg - bardanaWeightKg).toFixed(3));
  const saleAmountPkr =
    billableWeightKg > 0 && ratePer40kg > 0
      ? Number(((billableWeightKg / 40) * ratePer40kg).toFixed(2))
      : 0;
  return { commissionWeightKg, bardanaWeightKg, billableWeightKg, saleAmountPkr };
}
