-- ============================================================
-- Migration: Sale Expenses, Income/Subtract Expenses, Khata Support
-- Date: 2026-10-13
-- ============================================================

-- 1. Add sale_expenses table (mirrors purchase_expenses for sales)
CREATE TABLE IF NOT EXISTS public.sale_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id bigint NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  expense_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  is_income boolean NOT NULL DEFAULT false,  -- true = add to total, false = subtract
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Add is_income column to expenses table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'is_income'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN is_income boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Add sale_id column to expenses table (for sale-linked expenses)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'sale_id'
  ) THEN
    ALTER TABLE public.expenses ADD COLUMN sale_id bigint REFERENCES public.sales(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Add is_income to purchase_expenses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'purchase_expenses' AND column_name = 'is_income'
  ) THEN
    ALTER TABLE public.purchase_expenses ADD COLUMN is_income boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 5. Update default commission_per_40kg in purchases table from 1.25 to 1.5
ALTER TABLE public.purchases
  ALTER COLUMN commission_per_40kg SET DEFAULT 1.5;

-- 6. Update default commission_per_40kg in sales table from 1.0 to 1.5
ALTER TABLE public.sales
  ALTER COLUMN commission_per_40kg SET DEFAULT 1.5;

-- 7. Enable RLS on new table
ALTER TABLE public.sale_expenses ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policy for sale_expenses
DROP POLICY IF EXISTS "shop_sale_expenses_all" ON public.sale_expenses;
CREATE POLICY "shop_sale_expenses_all"
  ON public.sale_expenses FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- 9. Indexes for sale_expenses
CREATE INDEX IF NOT EXISTS idx_sale_expenses_sale_id ON public.sale_expenses(sale_id);
CREATE INDEX IF NOT EXISTS idx_expenses_sale_id ON public.expenses(sale_id);

-- 10. Update fn_record_sale to accept expenses
CREATE OR REPLACE FUNCTION public.fn_record_sale(
  p_crop_id bigint,
  p_buyer_id bigint,
  p_physical_weight_kg numeric,
  p_commission_per_40kg numeric,
  p_rate_per_40kg numeric,
  p_notes text,
  p_expenses jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_available_stock numeric;
  v_comm_weight numeric;
  v_billable_weight numeric;
  v_sale_amount numeric;
  v_sale_id bigint;
  v_invoice_no text;
  v_exp RECORD;
BEGIN
  -- 1. Calculate Available Stock with ROW LOCK to prevent concurrent stock depletion
  PERFORM id FROM public.crops WHERE id = p_crop_id FOR UPDATE;
  
  SELECT COALESCE(SUM(quantity_kg), 0) INTO v_available_stock
  FROM public.stock_movements
  WHERE crop_id = p_crop_id;

  IF v_available_stock < p_physical_weight_kg THEN
    RAISE EXCEPTION 'Insufficient stock. Available: % kg, Requested: % kg', v_available_stock, p_physical_weight_kg;
  END IF;

  -- 2. Calculations
  v_comm_weight := ROUND((p_physical_weight_kg * (p_commission_per_40kg / 40.0)), 3);
  v_billable_weight := p_physical_weight_kg - v_comm_weight;
  IF v_billable_weight < 0 THEN
    RAISE EXCEPTION 'Commission weight cannot exceed physical weight';
  END IF;
  
  v_sale_amount := ROUND(((v_billable_weight / 40.0) * p_rate_per_40kg), 2);
  
  v_invoice_no := 'SALE-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || floor(random()*1000)::text;

  -- 3. Insert Sale Record
  INSERT INTO public.sales (
    invoice_no, crop_id, buyer_id, physical_weight_kg,
    commission_per_40kg, commission_weight_kg, billable_weight_kg,
    rate_per_40kg, sale_amount, notes
  ) VALUES (
    v_invoice_no, p_crop_id, p_buyer_id, p_physical_weight_kg,
    p_commission_per_40kg, v_comm_weight, v_billable_weight,
    p_rate_per_40kg, v_sale_amount, p_notes
  ) RETURNING id INTO v_sale_id;

  -- 4. Deduct Physical Stock (-physical_weight_kg)
  INSERT INTO public.stock_movements (crop_id, sale_id, movement_type, quantity_kg, notes)
  VALUES (p_crop_id, v_sale_id, 'sale', -p_physical_weight_kg, 'Physical delivery to buyer');

  -- 5. Insert Associated Sale Expenses if any
  FOR v_exp IN SELECT * FROM jsonb_to_recordset(p_expenses) AS x(expense_type text, amount numeric, is_income boolean, notes text)
  LOOP
    IF v_exp.amount > 0 THEN
      INSERT INTO public.sale_expenses (sale_id, expense_type, amount, is_income, notes)
      VALUES (v_sale_id, v_exp.expense_type, v_exp.amount, COALESCE(v_exp.is_income, false), v_exp.notes);
      
      -- Also record into unified expenses log for reporting
      INSERT INTO public.expenses (expense_date, category, amount, sale_id, is_income, notes)
      VALUES (now(), v_exp.expense_type, v_exp.amount, v_sale_id, COALESCE(v_exp.is_income, false), v_exp.notes);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'billable_weight_kg', v_billable_weight,
    'sale_amount', v_sale_amount
  );
END;
$$;

-- 11. Update fn_record_purchase to handle is_income flag
CREATE OR REPLACE FUNCTION public.fn_record_purchase(
  p_crop_id bigint,
  p_supplier_id bigint,
  p_bags numeric,
  p_gross_weight_kg numeric,
  p_commission_per_40kg numeric,
  p_rate_per_40kg numeric,
  p_notes text,
  p_expenses jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_comm_weight numeric;
  v_net_weight numeric;
  v_crop_amount numeric;
  v_purchase_id bigint;
  v_invoice_no text;
  v_exp RECORD;
BEGIN
  -- Perform calculations on server
  v_comm_weight := ROUND((p_gross_weight_kg * (p_commission_per_40kg / 40.0)), 3);
  v_net_weight := p_gross_weight_kg - v_comm_weight;
  IF v_net_weight < 0 THEN
    RAISE EXCEPTION 'Commission weight cannot exceed gross weight';
  END IF;
  
  v_crop_amount := ROUND(((v_net_weight / 40.0) * p_rate_per_40kg), 2);
  
  -- Generate Purchase Invoice No (e.g., PUR-YYYYMMDD-ID)
  v_invoice_no := 'PUR-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || floor(random()*1000)::text;

  -- 1. Insert Purchase Record
  INSERT INTO public.purchases (
    invoice_no, crop_id, supplier_id, bags, gross_weight_kg,
    commission_per_40kg, commission_weight_kg, net_weight_kg,
    rate_per_40kg, crop_amount, notes
  ) VALUES (
    v_invoice_no, p_crop_id, p_supplier_id, p_bags, p_gross_weight_kg,
    p_commission_per_40kg, v_comm_weight, v_net_weight,
    p_rate_per_40kg, v_crop_amount, p_notes
  ) RETURNING id INTO v_purchase_id;

  -- 2. Insert Associated Expenses if any
  FOR v_exp IN SELECT * FROM jsonb_to_recordset(p_expenses) AS x(expense_type text, amount numeric, is_income boolean, notes text)
  LOOP
    IF v_exp.amount > 0 THEN
      INSERT INTO public.purchase_expenses (purchase_id, expense_type, amount, is_income, notes)
      VALUES (v_purchase_id, v_exp.expense_type, v_exp.amount, COALESCE(v_exp.is_income, false), v_exp.notes);
      
      -- Also record into unified expenses log for reporting
      INSERT INTO public.expenses (expense_date, category, amount, purchase_id, is_income, notes)
      VALUES (now(), v_exp.expense_type, v_exp.amount, v_purchase_id, COALESCE(v_exp.is_income, false), v_exp.notes);
    END IF;
  END LOOP;

  -- 3. Add Incoming Stock Movement (+gross_weight_kg)
  INSERT INTO public.stock_movements (crop_id, purchase_id, movement_type, quantity_kg, notes)
  VALUES (p_crop_id, v_purchase_id, 'purchase', p_gross_weight_kg, 'Incoming purchase gross weight');

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'invoice_no', v_invoice_no,
    'net_weight_kg', v_net_weight,
    'crop_amount', v_crop_amount
  );
END;
$$;
