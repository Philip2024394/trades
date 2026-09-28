-- Bridge 22c-3 · Server-side cart persistence.
--
-- One row per signed-in NEX account · holds their cross-device
-- cart so tapping Add on a laptop shows up on the phone. Cart
-- state lives client-side in localStorage until the buyer signs
-- in · once signed-in, this table becomes the source of truth
-- and the client mirrors it into localStorage on every load.
--
-- Non-destructive · idempotent · additive-only migration.
-- Sealed 2026-09-28.

BEGIN;

CREATE TABLE IF NOT EXISTS public.nex_cart (
  account_id uuid PRIMARY KEY REFERENCES public.nex_account (id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Row-Level Security · a signed-in NEX account can only see + write
-- its own cart row.
ALTER TABLE public.nex_cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_cart_owner_select ON public.nex_cart;
CREATE POLICY nex_cart_owner_select
  ON public.nex_cart
  FOR SELECT
  USING (account_id = auth.uid());

DROP POLICY IF EXISTS nex_cart_owner_insert ON public.nex_cart;
CREATE POLICY nex_cart_owner_insert
  ON public.nex_cart
  FOR INSERT
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS nex_cart_owner_update ON public.nex_cart;
CREATE POLICY nex_cart_owner_update
  ON public.nex_cart
  FOR UPDATE
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS nex_cart_owner_delete ON public.nex_cart;
CREATE POLICY nex_cart_owner_delete
  ON public.nex_cart
  FOR DELETE
  USING (account_id = auth.uid());

-- Auto-touch updated_at whenever the row changes so the client can
-- decide which side is fresher when reconciling localStorage vs
-- server on load.
CREATE OR REPLACE FUNCTION public.nex_cart_touch_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nex_cart_updated_at_trg ON public.nex_cart;
CREATE TRIGGER nex_cart_updated_at_trg
  BEFORE UPDATE ON public.nex_cart
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_cart_touch_updated_at();

COMMIT;
