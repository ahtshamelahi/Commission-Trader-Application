import { Sale } from '@/types/sale-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Expense } from '@/types/expense-data-types';
import { calculateWeightedAverageCostPerKg } from './current-stock-calculation';

export interface ProfitLossSummary {
  totalSaleRevenuePkr: number;
  totalCostOfGoodsSoldPkr: number;
  grossProfitPkr: number;
  totalOperatingExpensesPkr: number;
  netProfitPkr: number;
  profitMarginPercent: number;
}

/**
 * Calculates Profit & Loss for a given set of sales, purchases, and expenses.
 * Uses weighted-average costing: Cost of Goods Sold = Physical Sold Weight (kg) * Average Purchase Cost per kg.
 */
export function calculateProfitAndLoss(
  sales: Sale[],
  purchases: Purchase[],
  expenses: Expense[]
): ProfitLossSummary {
  const totalSaleRevenuePkr = sales.reduce((acc, s) => acc + Number(s.sale_amount), 0);

  // Group purchases by crop to determine average cost per kg for each crop
  const purchasesByCrop = new Map<number, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByCrop.get(p.crop_id) || [];
    list.push(p);
    purchasesByCrop.set(p.crop_id, list);
  }

  // Calculate COGS using physical sold weight * weighted average purchase cost for that crop
  let totalCostOfGoodsSoldPkr = 0;
  for (const s of sales) {
    const cropPurchases = purchasesByCrop.get(s.crop_id) || [];
    const avgCostPerKg = calculateWeightedAverageCostPerKg(cropPurchases);
    const saleCogs = Number(s.physical_weight_kg) * avgCostPerKg;
    totalCostOfGoodsSoldPkr += saleCogs;
  }

  const grossProfitPkr = totalSaleRevenuePkr - totalCostOfGoodsSoldPkr;
  const totalOperatingExpensesPkr = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const netProfitPkr = grossProfitPkr - totalOperatingExpensesPkr;

  const profitMarginPercent = totalSaleRevenuePkr > 0
    ? (netProfitPkr / totalSaleRevenuePkr) * 100
    : 0;

  return {
    totalSaleRevenuePkr: Number(totalSaleRevenuePkr.toFixed(2)),
    totalCostOfGoodsSoldPkr: Number(totalCostOfGoodsSoldPkr.toFixed(2)),
    grossProfitPkr: Number(grossProfitPkr.toFixed(2)),
    totalOperatingExpensesPkr: Number(totalOperatingExpensesPkr.toFixed(2)),
    netProfitPkr: Number(netProfitPkr.toFixed(2)),
    profitMarginPercent: Number(profitMarginPercent.toFixed(2)),
  };
}
