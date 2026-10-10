import { StockMovement } from '@/types/stock-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { CropSummary } from '@/types/crop-data-types';

/**
 * Calculates net available stock quantity in kg from stock movements
 */
export function calculateAvailableStock(movements: Array<{ quantity_kg: number | string }>): number {
  const total = movements.reduce((acc, m) => acc + Number(m.quantity_kg), 0);
  return Number(total.toFixed(3));
}

/**
 * Calculates weighted average cost per kg for a specific crop.
 * Weighted Average Cost per kg = Total Purchased Value / Total Purchased Net Weight (kg)
 */
export function calculateWeightedAverageCostPerKg(purchases: Purchase[]): number {
  let totalValue = 0;
  let totalNetWeightKg = 0;

  for (const p of purchases) {
    totalValue += Number(p.crop_amount);
    totalNetWeightKg += Number(p.net_weight_kg);
  }

  if (totalNetWeightKg <= 0) return 0;
  return Number((totalValue / totalNetWeightKg).toFixed(4));
}

/**
 * Builds comprehensive crop stock summary for dashboard & stock ledger
 */
export function buildCropStockSummary(
  cropId: number,
  cropName: string,
  purchases: Purchase[],
  sales: Sale[],
  movements: StockMovement[]
): CropSummary {
  const cropPurchases = purchases.filter((p) => p.crop_id === cropId);
  const cropSales = sales.filter((s) => s.crop_id === cropId);
  const cropMovements = movements.filter((m) => m.crop_id === cropId);

  const totalPurchasedWeightKg = cropPurchases.reduce((acc, p) => acc + Number(p.net_weight_kg), 0);
  const totalSoldPhysicalWeightKg = cropSales.reduce((acc, s) => acc + Number(s.physical_weight_kg), 0);
  const totalPurchaseValuePkr = cropPurchases.reduce((acc, p) => acc + Number(p.crop_amount), 0);

  const currentAvailableStockKg = calculateAvailableStock(cropMovements);
  const averageCostPerKgPkr = calculateWeightedAverageCostPerKg(cropPurchases);
  const averageCostPer40KgPkr = Number((averageCostPerKgPkr * 40).toFixed(2));

  // Determine last transaction date
  const dates = cropMovements.map((m) => new Date(m.created_at).getTime()).filter((t) => !isNaN(t));
  const lastTransactionDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

  return {
    id: cropId,
    name: cropName,
    totalPurchasedWeightKg: Number(totalPurchasedWeightKg.toFixed(3)),
    totalSoldPhysicalWeightKg: Number(totalSoldPhysicalWeightKg.toFixed(3)),
    currentAvailableStockKg: Number(currentAvailableStockKg.toFixed(3)),
    totalPurchaseValuePkr: Number(totalPurchaseValuePkr.toFixed(2)),
    averageCostPerKgPkr,
    averageCostPer40KgPkr,
    lastTransactionDate,
  };
}
