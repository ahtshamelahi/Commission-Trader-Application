
import type { Purchase } from '@/types/purchase-data-types';
import type { Sale } from '@/types/sale-data-types';
import type { Expense } from '@/types/expense-data-types';
import { calculateStoredPurchaseTotalPkr } from './purchase-amount-calculation';

interface PurchaseExpenseDetail {
  amount: number | string;
  is_income?: boolean | null;
}

interface PurchaseForProfitLoss extends Omit<Purchase, 'purchase_expenses'> {
  purchase_expenses?: PurchaseExpenseDetail[] | null;
}

interface SaleForProfitLoss extends Sale {
  created_at: string;
  document_total?: number | null;
}

interface ExpenseForProfitLoss extends Omit<Expense, 'purchase_id'> {
  purchase_id?: number | null;
  sale_id?: number | null;
  is_income?: boolean | null;
}

export interface ProfitLossSummary {
  totalSaleRevenuePkr: number;
  totalCostOfGoodsSoldPkr: number;
  grossProfitPkr: number;
  totalOperatingExpensesPkr: number;
  netProfitPkr: number;
  profitMarginPercent: number;
}

interface InventoryState {
  quantityKg: number;
  valuePkr: number;
}

type TransactionEvent =
  | {
    type: 'purchase';
    date: number;
    id: number;
    purchase: PurchaseForProfitLoss;
  }
  | {
    type: 'sale';
    date: number;
    id: number;
    sale: SaleForProfitLoss;
  };

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function getPurchaseInventoryCost(
  purchase: PurchaseForProfitLoss
): number {
  return calculateStoredPurchaseTotalPkr(
    purchase.crop_amount,
    purchase.purchase_expenses ?? [],
    purchase.document_total
  );
}

function getSaleRecognizedRevenue(sale: SaleForProfitLoss): number {
  const documentTotal = toNumber(sale.document_total);
  if (documentTotal > 0) {
    return documentTotal;
  }
  return toNumber(sale.sale_amount);
}

export function calculateProfitAndLoss(
  sales: SaleForProfitLoss[],
  purchases: PurchaseForProfitLoss[],
  expenses: ExpenseForProfitLoss[]
): ProfitLossSummary {
  let totalSaleRevenuePkr = 0;
  let totalCostOfGoodsSoldPkr = 0;

  const inventoryByCrop = new Map<number, InventoryState>();

  const events: TransactionEvent[] = [
    ...purchases.map((purchase) => ({
      type: 'purchase' as const,
      date: new Date(purchase.created_at).getTime(),
      id: purchase.id,
      purchase,
    })),
    ...sales.map((sale) => ({
      type: 'sale' as const,
      date: new Date(sale.created_at).getTime(),
      id: sale.id,
      sale,
    })),
  ];

  // Process transactions in chronological order.
  // Purchases come first when timestamps are identical.
  events.sort((a, b) => {
    const dateDifference = a.date - b.date;

    if (dateDifference !== 0) {
      return dateDifference;
    }

    if (a.type !== b.type) {
      return a.type === 'purchase' ? -1 : 1;
    }

    return a.id - b.id;
  });

  for (const event of events) {
    if (!Number.isFinite(event.date)) {
      continue;
    }

    if (event.type === 'purchase') {
      const purchase = event.purchase;
      const quantityKg = Math.max(
        0,
        toNumber(purchase.gross_weight_kg)
      );

      if (quantityKg <= 0) {
        continue;
      }

      const purchaseValuePkr = getPurchaseInventoryCost(purchase);

      const inventory = inventoryByCrop.get(purchase.crop_id) ?? {
        quantityKg: 0,
        valuePkr: 0,
      };

      inventory.quantityKg += quantityKg;
      inventory.valuePkr += purchaseValuePkr;

      inventoryByCrop.set(purchase.crop_id, inventory);
      continue;
    }

    const sale = event.sale;
    const soldQuantityKg = Math.max(
      0,
      toNumber(sale.physical_weight_kg)
    );

    totalSaleRevenuePkr += getSaleRecognizedRevenue(sale);

    if (soldQuantityKg <= 0) {
      continue;
    }

    const inventory = inventoryByCrop.get(sale.crop_id);

    if (!inventory || inventory.quantityKg <= 0) {
      // No available inventory cost can be established.
      // Investigate missing or inconsistent historical stock.
      continue;
    }

    const averageCostPerKg =
      inventory.valuePkr / inventory.quantityKg;

    const costOfSalePkr = soldQuantityKg * averageCostPerKg;

    totalCostOfGoodsSoldPkr += costOfSalePkr;

    // Do not allow negative inventory balances to distort
    // the average cost of later purchases.
    inventory.quantityKg = Math.max(
      0,
      inventory.quantityKg - soldQuantityKg
    );

    inventory.valuePkr = Math.max(
      0,
      inventory.valuePkr - costOfSalePkr
    );

    inventoryByCrop.set(sale.crop_id, inventory);
  }

  let totalOperatingExpensesPkr = 0;

  for (const expense of expenses) {
    const amount = toNumber(expense.amount);

    // Purchase expenses are included in inventory cost above.
    // Do not count their duplicate unified expense rows again.
    if (expense.purchase_id != null) {
      continue;
    }

    // Sale-linked income is already in document_total when present.
    // Only add when revenue fell back to sale_amount alone.
    if (expense.is_income === true && expense.sale_id != null) {
      const linkedSale = sales.find((s) => s.id === expense.sale_id);
      if (linkedSale && toNumber(linkedSale.document_total) > 0) {
        continue;
      }
      totalSaleRevenuePkr += amount;
      continue;
    }

    // Other income rows are not operating expenses.
    if (expense.is_income === true) {
      continue;
    }

    totalOperatingExpensesPkr += amount;
  }

  const grossProfitPkr =
    totalSaleRevenuePkr - totalCostOfGoodsSoldPkr;

  const netProfitPkr =
    grossProfitPkr - totalOperatingExpensesPkr;

  const profitMarginPercent =
    totalSaleRevenuePkr > 0
      ? (netProfitPkr / totalSaleRevenuePkr) * 100
      : 0;

  return {
    totalSaleRevenuePkr: roundMoney(totalSaleRevenuePkr),
    totalCostOfGoodsSoldPkr: roundMoney(totalCostOfGoodsSoldPkr),
    grossProfitPkr: roundMoney(grossProfitPkr),
    totalOperatingExpensesPkr: roundMoney(totalOperatingExpensesPkr),
    netProfitPkr: roundMoney(netProfitPkr),
    profitMarginPercent: roundMoney(profitMarginPercent),
  };
}
