export interface Crop {
  id: number;
  name: string;
  created_at: string;
  varieties?: CropVariety[];
}

export interface CropVariety {
  id: number;
  crop_id: number;
  name: string;
  created_at: string;
}

export interface CropSummary {
  id: number;
  name: string;
  totalPurchasedWeightKg: number;
  totalSoldPhysicalWeightKg: number;
  currentAvailableStockKg: number;
  totalPurchaseValuePkr: number;
  averageCostPerKgPkr: number;
  averageCostPer40KgPkr: number;
  lastTransactionDate: string | null;
}
