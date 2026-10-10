-- ============================================================
-- Commission Shop Management System
-- Run this in Supabase SQL Editor to set up:
-- 1. The new `expenses` table (not in original schema)
-- 2. RLS policies for all tables
-- ============================================================

-- Create the expenses table (not part of original 6 tables)
CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  purchase_id bigint REFERENCES public.purchases(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ── RLS: Enable on all tables ─────────────────────────────
ALTER TABLE public.crops           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses        ENABLE ROW LEVEL SECURITY;

-- ── RLS: Drop old/conflicting policies if they exist ─────
DROP POLICY IF EXISTS "Allow public access for crops"             ON public.crops;
DROP POLICY IF EXISTS "Allow public access for parties"           ON public.parties;
DROP POLICY IF EXISTS "Allow public access for purchases"         ON public.purchases;
DROP POLICY IF EXISTS "Allow public access for purchase_expenses" ON public.purchase_expenses;
DROP POLICY IF EXISTS "Allow public access for sales"             ON public.sales;
DROP POLICY IF EXISTS "Allow public access for stock_movements"   ON public.stock_movements;
DROP POLICY IF EXISTS "Allow public access for expenses"          ON public.expenses;

-- ── RLS: Create permissive policies (anon + authenticated) ─
-- This allows the shop management app to read and write all tables
-- using the publishable/anon key. Since this is a single-owner
-- business app, full access for both roles is appropriate.

-- crops
CREATE POLICY "shop_crops_all"
  ON public.crops FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- parties
CREATE POLICY "shop_parties_all"
  ON public.parties FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- purchases
CREATE POLICY "shop_purchases_all"
  ON public.purchases FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- purchase_expenses
CREATE POLICY "shop_purchase_expenses_all"
  ON public.purchase_expenses FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- sales
CREATE POLICY "shop_sales_all"
  ON public.sales FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- stock_movements
CREATE POLICY "shop_stock_movements_all"
  ON public.stock_movements FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- expenses
CREATE POLICY "shop_expenses_all"
  ON public.expenses FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ── Indexes for performance ───────────────────────────────
CREATE INDEX IF NOT EXISTS idx_purchases_crop_id     ON public.purchases(crop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at  ON public.purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_crop_id         ON public.sales(crop_id);
CREATE INDEX IF NOT EXISTS idx_sales_buyer_id        ON public.sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at      ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_crop  ON public.stock_movements(crop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date         ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category     ON public.expenses(category);
