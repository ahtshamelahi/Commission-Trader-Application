-- Add vehicle_number to sales and purchases tables
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS vehicle_number text DEFAULT NULL;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS vehicle_number text DEFAULT NULL;

-- Add index for vehicle number lookup
CREATE INDEX IF NOT EXISTS idx_sales_vehicle_number     ON public.sales(vehicle_number)     WHERE vehicle_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_vehicle_number ON public.purchases(vehicle_number) WHERE vehicle_number IS NOT NULL;

