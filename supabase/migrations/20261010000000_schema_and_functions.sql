-- Commission Shop Management System Database Schema & Functions Migration

-- 1. Crops Table
CREATE TABLE IF NOT EXISTS public.crops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Parties Table (Suppliers & Buyers)
CREATE TABLE IF NOT EXISTS public.parties (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  party_type text NOT NULL CHECK (party_type IN ('supplier', 'buyer', 'both')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Purchases Table
CREATE TABLE IF NOT EXISTS public.purchases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no text UNIQUE,
  crop_id bigint NOT NULL REFERENCES public.crops(id),
  supplier_id bigint REFERENCES public.parties(id),
  bags numeric NOT NULL DEFAULT 0 CHECK (bags >= 0),
  gross_weight_kg numeric NOT NULL CHECK (gross_weight_kg > 0),
  commission_per_40kg numeric NOT NULL DEFAULT 1.25 CHECK (commission_per_40kg >= 0),
  commission_weight_kg numeric NOT NULL DEFAULT 0 CHECK (commission_weight_kg >= 0),
  net_weight_kg numeric NOT NULL CHECK (net_weight_kg >= 0),
  rate_per_40kg numeric NOT NULL CHECK (rate_per_40kg >= 0),
  crop_amount numeric NOT NULL CHECK (crop_amount >= 0),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Purchase Expenses Table
CREATE TABLE IF NOT EXISTS public.purchase_expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  purchase_id bigint NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  expense_type text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 5. Sales Table
CREATE TABLE IF NOT EXISTS public.sales (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_no text UNIQUE,
  crop_id bigint NOT NULL REFERENCES public.crops(id),
  buyer_id bigint REFERENCES public.parties(id),
  physical_weight_kg numeric NOT NULL CHECK (physical_weight_kg > 0),
  commission_per_40kg numeric NOT NULL DEFAULT 1.0 CHECK (commission_per_40kg >= 0),
  commission_weight_kg numeric NOT NULL DEFAULT 0 CHECK (commission_weight_kg >= 0),
  billable_weight_kg numeric NOT NULL CHECK (billable_weight_kg >= 0),
  rate_per_40kg numeric NOT NULL CHECK (rate_per_40kg >= 0),
  sale_amount numeric NOT NULL CHECK (sale_amount >= 0),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 6. Stock Movements Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crop_id bigint NOT NULL REFERENCES public.crops(id),
  purchase_id bigint REFERENCES public.purchases(id) ON DELETE CASCADE,
  sale_id bigint REFERENCES public.sales(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment')),
  quantity_kg numeric NOT NULL CHECK (quantity_kg <> 0),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7. General & Business Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  expense_date timestamp with time zone NOT NULL DEFAULT now(),
  category text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  purchase_id bigint REFERENCES public.purchases(id) ON DELETE SET NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- INDEXES for Performance
CREATE INDEX IF NOT EXISTS idx_purchases_crop_id ON public.purchases(crop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_crop_id ON public.sales(crop_id);
CREATE INDEX IF NOT EXISTS idx_sales_buyer_id ON public.sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_crop_id ON public.stock_movements(crop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category);

-- ATOMIC STORED FUNCTION: Record Purchase Transaction
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
  FOR v_exp IN SELECT * FROM jsonb_to_recordset(p_expenses) AS x(expense_type text, amount numeric, notes text)
  LOOP
    IF v_exp.amount > 0 THEN
      INSERT INTO public.purchase_expenses (purchase_id, expense_type, amount, notes)
      VALUES (v_purchase_id, v_exp.expense_type, v_exp.amount, v_exp.notes);
      
      -- Also record into unified expenses log for reporting
      INSERT INTO public.expenses (expense_date, category, amount, purchase_id, notes)
      VALUES (now(), v_exp.expense_type, v_exp.amount, v_purchase_id, v_exp.notes);
    END IF;
  END LOOP;

  -- 3. Add Incoming Stock Movement (+net_weight_kg)
  INSERT INTO public.stock_movements (crop_id, purchase_id, movement_type, quantity_kg, notes)
  VALUES (p_crop_id, v_purchase_id, 'purchase', v_net_weight, 'Incoming purchase net weight');

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'invoice_no', v_invoice_no,
    'net_weight_kg', v_net_weight,
    'crop_amount', v_crop_amount
  );
END;
$$;


-- ATOMIC STORED FUNCTION: Record Sale Transaction with Stock Verification
CREATE OR REPLACE FUNCTION public.fn_record_sale(
  p_crop_id bigint,
  p_buyer_id bigint,
  p_physical_weight_kg numeric,
  p_commission_per_40kg numeric,
  p_rate_per_40kg numeric,
  p_notes text
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

  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'billable_weight_kg', v_billable_weight,
    'sale_amount', v_sale_amount
  );
END;
$$;


-- Enable Row Level Security (RLS) policies
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon access for shop management application
CREATE POLICY "Allow public access for crops" ON public.crops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for parties" ON public.parties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for purchase_expenses" ON public.purchase_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access for expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
