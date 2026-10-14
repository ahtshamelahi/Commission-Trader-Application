-- Initial payment fields (ledger in Phase 4). Multi-line invoices store payment on first row.

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS document_total numeric CHECK (document_total IS NULL OR document_total >= 0),
  ADD COLUMN IF NOT EXISTS amount_received numeric NOT NULL DEFAULT 0 CHECK (amount_received >= 0);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS document_total numeric CHECK (document_total IS NULL OR document_total >= 0),
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0 CHECK (amount_paid >= 0);
