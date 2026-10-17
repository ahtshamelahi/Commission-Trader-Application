import { StockMovement } from '@/types/stock-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { CropSummary } from '@/types/crop-data-types';

const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

function toKg(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sum signed movement quantities (purchase +, sale −, adjustment ±).
 */
export function calculateAvailableStock(
  movements: Array<{ quantity_kg: number | string }>
): number {
  const total = movements.reduce((acc, m) => acc + toKg(m.quantity_kg), 0);
  return r3(total);
}

/**
 * Physical stock from transactions:
 * Available = Purchased (gross) − Sold (physical) + Adjustments
 *
 * Billing deductions (net/chargeable weight) must never change inventory.
 */
export function calculatePhysicalStockKg(input: {
  purchasedGrossKg: number;
  soldPhysicalKg: number;
  adjustmentKg?: number;
}): number {
  return r3(
    toKg(input.purchasedGrossKg) -
      toKg(input.soldPhysicalKg) +
      toKg(input.adjustmentKg ?? 0)
  );
}

export function sumPurchasedGrossKg(
  purchases: Array<{ gross_weight_kg?: number | string | null }>
): number {
  return r3(purchases.reduce((acc, p) => acc + toKg(p.gross_weight_kg), 0));
}

export function sumSoldPhysicalKg(
  sales: Array<{ physical_weight_kg?: number | string | null }>
): number {
  return r3(sales.reduce((acc, s) => acc + toKg(s.physical_weight_kg), 0));
}

export function sumAdjustmentKg(
  movements: Array<{ movement_type?: string; quantity_kg?: number | string | null }>
): number {
  return r3(
    movements
      .filter((m) => m.movement_type === 'adjustment')
      .reduce((acc, m) => acc + toKg(m.quantity_kg), 0)
  );
}

/**
 * Authoritative available stock for UI + sale validation.
 * Prefer purchase/sale physical ledger (+ adjustments). Fall back to movement
 * sum only when no purchase/sale rows exist for the crop filter.
 */
export function resolveAvailableStockKg(input: {
  purchases: Array<{ gross_weight_kg?: number | string | null }>;
  sales: Array<{ physical_weight_kg?: number | string | null }>;
  movements?: Array<{
    quantity_kg?: number | string | null;
    movement_type?: string;
  }>;
}): number {
  const purchased = sumPurchasedGrossKg(input.purchases);
  const sold = sumSoldPhysicalKg(input.sales);
  const hasLedger = input.purchases.length > 0 || input.sales.length > 0;

  if (hasLedger) {
    const adjustmentKg = sumAdjustmentKg(input.movements ?? []);
    return Math.max(
      0,
      calculatePhysicalStockKg({
        purchasedGrossKg: purchased,
        soldPhysicalKg: sold,
        adjustmentKg,
      })
    );
  }

  return Math.max(0, calculateAvailableStock(input.movements ?? []));
}

/**
 * Inventory cost per physical kg (weighted average).
 * Cost basis = purchase crop amounts over gross (physical) weight received.
 */
export function calculateWeightedAverageCostPerKg(purchases: Purchase[]): number {
  let totalValue = 0;
  let totalPhysicalKg = 0;

  for (const p of purchases) {
    totalValue += toKg(p.crop_amount);
    totalPhysicalKg += toKg(p.gross_weight_kg);
  }

  if (totalPhysicalKg <= 0) return 0;
  return r4(totalValue / totalPhysicalKg);
}

/**
 * Crop stock summary for dashboards / ledgers.
 * Purchased & available stock always use physical (gross) quantities.
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

  const totalPurchasedWeightKg = sumPurchasedGrossKg(cropPurchases);
  const totalSoldPhysicalWeightKg = sumSoldPhysicalKg(cropSales);
  const totalPurchaseValuePkr = cropPurchases.reduce(
    (acc, p) => acc + toKg(p.crop_amount),
    0
  );

  const currentAvailableStockKg = resolveAvailableStockKg({
    purchases: cropPurchases,
    sales: cropSales,
    movements: cropMovements,
  });

  const averageCostPerKgPkr = calculateWeightedAverageCostPerKg(cropPurchases);
  const averageCostPer40KgPkr = Number((averageCostPerKgPkr * 40).toFixed(2));

  const dates = cropMovements
    .map((m) => new Date(m.created_at).getTime())
    .filter((t) => !isNaN(t));
  const lastTransactionDate =
    dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null;

  return {
    id: cropId,
    name: cropName,
    totalPurchasedWeightKg: r3(totalPurchasedWeightKg),
    totalSoldPhysicalWeightKg: r3(totalSoldPhysicalWeightKg),
    currentAvailableStockKg: r3(currentAvailableStockKg),
    totalPurchaseValuePkr: Number(totalPurchaseValuePkr.toFixed(2)),
    averageCostPerKgPkr,
    averageCostPer40KgPkr,
    lastTransactionDate,
  };
}
