-- Khata (party ledger): manual payments + unified views over sales/purchases.
-- Balance convention: delta > 0 = receivable (you'll get); delta < 0 = payable (you'll give).
-- Document bills and on-document payment snapshots are read from sales/purchases.
-- Manual money in/out lives in khata_payments only — never duplicated onto the invoice.
-- Runs after 20261014_sale_purchase_payments.sql (document_total, amount_received, amount_paid).

CREATE TABLE IF NOT EXISTS public.khata_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  party_id bigint NOT NULL REFERENCES public.parties(id),
  direction text NOT NULL CHECK (direction IN ('received', 'paid')),
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  request_id uuid NOT NULL UNIQUE,
  voided_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_khata_payments_party_id ON public.khata_payments(party_id);
CREATE INDEX IF NOT EXISTS idx_khata_payments_paid_at ON public.khata_payments(paid_at);

ALTER TABLE public.khata_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_khata_payments_all" ON public.khata_payments;
CREATE POLICY "shop_khata_payments_all"
  ON public.khata_payments FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- Copy any earlier party_payments rows (older Khata UI) without duplicating.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'party_payments'
  ) THEN
    INSERT INTO public.khata_payments (party_id, direction, amount, paid_at, notes, request_id)
    SELECT
      p.party_id,
      p.direction,
      p.amount,
      COALESCE(p.created_at, now()),
      p.note,
      gen_random_uuid()
    FROM public.party_payments p
    WHERE p.direction IN ('received', 'paid')
      AND p.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.khata_payments k
        WHERE k.party_id = p.party_id
          AND k.direction = p.direction
          AND k.amount = p.amount
          AND k.paid_at = COALESCE(p.created_at, k.paid_at)
      );
  END IF;
END $$;

-- Invoice group key: keep unique per-row invoice numbers, but join PUR-xxx-1 / PUR-xxx-2.
CREATE OR REPLACE FUNCTION public.fn_khata_invoice_group(p_invoice_no text, p_id bigint)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_invoice_no IS NULL OR btrim(p_invoice_no) = '' THEN 'id-' || p_id::text
    WHEN p_invoice_no ~ '^PUR-[0-9]+-[0-9]+$' THEN regexp_replace(p_invoice_no, '-[0-9]+$', '')
    ELSE p_invoice_no
  END;
$$;

CREATE OR REPLACE VIEW public.party_ledger
WITH (security_invoker = true)
AS
SELECT
  g.party_id,
  'sale'::text AS entry_type,
  g.entry_date,
  g.reference,
  g.description,
  ROUND(g.bill_total, 2) AS delta,
  'sales'::text AS source_table,
  g.source_id,
  0 AS sort_rank,
  NULL::bigint AS khata_payment_id
FROM (
  SELECT
    s.buyer_id AS party_id,
    MIN(s.created_at) AS entry_date,
    MIN(s.invoice_no) AS reference,
    'Sale — total bill'::text AS description,
    MIN(s.id) AS source_id,
    CASE
      WHEN COUNT(s.document_total) FILTER (WHERE s.document_total IS NOT NULL) > 0
        THEN MAX(s.document_total)
      ELSE SUM(s.sale_amount) + COALESCE(SUM(ex.net), 0)
    END AS bill_total
  FROM public.sales s
  LEFT JOIN (
    SELECT se.sale_id,
      SUM(CASE WHEN COALESCE(se.is_income, false) THEN se.amount ELSE -se.amount END) AS net
    FROM public.sale_expenses se
    GROUP BY se.sale_id
  ) ex ON ex.sale_id = s.id
  WHERE s.buyer_id IS NOT NULL
  GROUP BY s.buyer_id, public.fn_khata_invoice_group(s.invoice_no, s.id)
) g
WHERE g.bill_total IS NOT NULL AND ABS(ROUND(g.bill_total, 2)) >= 0.005

UNION ALL
SELECT
  s.buyer_id,
  'payment_in'::text,
  s.created_at,
  s.invoice_no,
  'Amount received against sale'::text,
  ROUND(-s.amount_received, 2),
  'sales'::text,
  s.id,
  1,
  NULL::bigint
FROM public.sales s
WHERE s.buyer_id IS NOT NULL
  AND COALESCE(s.amount_received, 0) > 0

UNION ALL
SELECT
  g.party_id,
  'purchase'::text,
  g.entry_date,
  g.reference,
  g.description,
  ROUND(-g.bill_total, 2) AS delta,
  'purchases'::text,
  g.source_id,
  0,
  NULL::bigint
FROM (
  SELECT
    p.supplier_id AS party_id,
    MIN(p.created_at) AS entry_date,
    MIN(p.invoice_no) AS reference,
    'Purchase — total bill'::text AS description,
    MIN(p.id) AS source_id,
    CASE
      WHEN COUNT(p.document_total) FILTER (WHERE p.document_total IS NOT NULL) > 0
        THEN MAX(p.document_total)
      ELSE SUM(p.crop_amount) + COALESCE(SUM(ex.net), 0)
    END AS bill_total
  FROM public.purchases p
  LEFT JOIN (
    SELECT pe.purchase_id,
      SUM(CASE WHEN COALESCE(pe.is_income, false) THEN pe.amount ELSE -pe.amount END) AS net
    FROM public.purchase_expenses pe
    GROUP BY pe.purchase_id
  ) ex ON ex.purchase_id = p.id
  WHERE p.supplier_id IS NOT NULL
  GROUP BY p.supplier_id, public.fn_khata_invoice_group(p.invoice_no, p.id)
) g
WHERE g.bill_total IS NOT NULL AND ABS(ROUND(g.bill_total, 2)) >= 0.005

UNION ALL
SELECT
  p.supplier_id,
  'payment_out'::text,
  p.created_at,
  p.invoice_no,
  'Amount paid against purchase'::text,
  ROUND(p.amount_paid, 2),
  'purchases'::text,
  p.id,
  1,
  NULL::bigint
FROM public.purchases p
WHERE p.supplier_id IS NOT NULL
  AND COALESCE(p.amount_paid, 0) > 0

UNION ALL
SELECT
  k.party_id,
  CASE WHEN k.direction = 'received' THEN 'payment_in' ELSE 'payment_out' END,
  k.paid_at,
  'KH-' || k.id::text,
  COALESCE(NULLIF(btrim(k.notes), ''), CASE WHEN k.direction = 'received' THEN 'Money received' ELSE 'Money paid' END),
  CASE WHEN k.direction = 'received' THEN ROUND(-k.amount, 2) ELSE ROUND(k.amount, 2) END,
  'khata_payments'::text,
  k.id,
  1,
  k.id
FROM public.khata_payments k
WHERE k.voided_at IS NULL;

CREATE OR REPLACE VIEW public.party_balances
WITH (security_invoker = true)
AS
SELECT
  p.id AS party_id,
  p.name,
  p.phone,
  p.address,
  p.party_type,
  COALESCE(SUM(l.delta), 0) AS balance,
  MAX(l.entry_date) AS last_activity
FROM public.parties p
LEFT JOIN public.party_ledger l ON l.party_id = p.id
GROUP BY p.id, p.name, p.phone, p.address, p.party_type;

GRANT SELECT ON public.party_ledger TO anon, authenticated;
GRANT SELECT ON public.party_balances TO anon, authenticated;
GRANT ALL ON public.khata_payments TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.khata_payments_id_seq TO anon, authenticated;
