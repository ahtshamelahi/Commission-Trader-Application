import { Crop } from './crop-data-types';

export type MovementType = 'purchase' | 'sale' | 'adjustment';

export interface StockMovement {
  id: number;
  crop_id: number;
  purchase_id: number | null;
  sale_id: number | null;
  movement_type: MovementType;
  quantity_kg: number;
  notes: string | null;
  created_at: string;
  crops?: Crop;
}
