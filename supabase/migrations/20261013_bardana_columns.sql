-- Add bardana columns to purchases and sales tables
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS bardana_per_bag_kg numeric NOT NULL DEFAULT 0 CHECK (bardana_per_bag_kg >= 0),
  ADD COLUMN IF NOT EXISTS bardana_total_kg   numeric NOT NULL DEFAULT 0 CHECK (bardana_total_kg >= 0);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS bags               numeric NOT NULL DEFAULT 0 CHECK (bags >= 0),
  ADD COLUMN IF NOT EXISTS bardana_per_bag_kg numeric NOT NULL DEFAULT 0 CHECK (bardana_per_bag_kg >= 0),
  ADD COLUMN IF NOT EXISTS bardana_total_kg   numeric NOT NULL DEFAULT 0 CHECK (bardana_total_kg >= 0);
