-- Add bags column to sales table
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS bags numeric NOT NULL DEFAULT 0 CHECK (bags >= 0);
