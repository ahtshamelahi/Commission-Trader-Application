-- ================================================================
-- Migration: Crop Varieties + variety_id columns on sales/purchases
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Crop Varieties (types within a category)
CREATE TABLE IF NOT EXISTS public.crop_varieties (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crop_id  bigint NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  name     text   NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(crop_id, name)
);

-- RLS
ALTER TABLE public.crop_varieties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop_crop_varieties_all" ON public.crop_varieties;
CREATE POLICY "shop_crop_varieties_all"
  ON public.crop_varieties FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 2. Add variety_id to purchases (nullable — backward compatible)
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS variety_id bigint REFERENCES public.crop_varieties(id) ON DELETE SET NULL;

-- 3. Add variety_id to sales (nullable — backward compatible)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS variety_id bigint REFERENCES public.crop_varieties(id) ON DELETE SET NULL;

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_crop_varieties_crop_id ON public.crop_varieties(crop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_variety_id   ON public.purchases(variety_id);
CREATE INDEX IF NOT EXISTS idx_sales_variety_id       ON public.sales(variety_id);

