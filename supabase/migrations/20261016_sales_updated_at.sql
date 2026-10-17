-- Track when a sale row is edited so All Sales can show status "Updated".
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;
