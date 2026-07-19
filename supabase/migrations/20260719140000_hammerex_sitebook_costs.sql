-- SiteBook Project Costs — homeowner-private cost ledger.
-- Phase 1 · Blueprint v2.2 (2026-07-19).
--
-- Every construction cost has THREE natural anchors:
--   • project    (which house-project)
--   • trade      (who's owed)
--   • moment     (usually a post — quote agreed, variation, invoice paid)
--
-- Cost lifecycle: draft → agreed → part_paid → paid
-- (or cancelled if it falls through).
--
-- Payments are separate rows (one cost, many payments — deposit +
-- mid + final). Trigger auto-updates parent cost's paid_pence +
-- status.
--
-- STRICT PRIVACY: Homeowner-only. Trades NEVER see other trades'
-- amounts, NEVER see the running total, NEVER see payment status.
-- Enforced at the API layer + RLS.

-- ═════════════════════════════════════════════════════════════════
-- hammerex_sitebook_costs
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_costs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,

  -- Trade / supplier — nullable when it's a materials cost with no
  -- named contractor (bought materials direct from a merchant).
  trade_listing_id      UUID,
  trade_name            TEXT,

  -- labour · materials · deposit · final · extra · supplier · other
  kind                  TEXT          NOT NULL DEFAULT 'labour',

  description           TEXT,
  agreed_pence          INTEGER       NOT NULL DEFAULT 0,
  paid_pence            INTEGER       NOT NULL DEFAULT 0,   -- kept in sync via trigger

  -- draft · agreed · part_paid · paid · cancelled
  status                TEXT          NOT NULL DEFAULT 'agreed',

  -- Optional anchors — helpful when reading a cost back to its origin
  post_id               UUID          REFERENCES public.hammerex_sitebook_posts(id) ON DELETE SET NULL,
  invitation_id         UUID          REFERENCES public.hammerex_sitebook_invitations(id) ON DELETE SET NULL,

  agreed_at             TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_costs_project
  ON public.hammerex_sitebook_costs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_costs_homeowner
  ON public.hammerex_sitebook_costs (homeowner_id, status);
CREATE INDEX IF NOT EXISTS idx_costs_trade
  ON public.hammerex_sitebook_costs (trade_listing_id) WHERE trade_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_costs_post
  ON public.hammerex_sitebook_costs (post_id) WHERE post_id IS NOT NULL;

-- ═════════════════════════════════════════════════════════════════
-- hammerex_sitebook_cost_payments — event ledger per cost
-- ═════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_cost_payments (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_id               UUID          NOT NULL REFERENCES public.hammerex_sitebook_costs(id) ON DELETE CASCADE,
  amount_pence          INTEGER       NOT NULL,           -- +ve = paid, -ve = refund

  -- cash · bank · card · other
  method                TEXT          NOT NULL DEFAULT 'other',
  paid_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  note                  TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_payments_cost
  ON public.hammerex_sitebook_cost_payments (cost_id, paid_at DESC);

-- ═════════════════════════════════════════════════════════════════
-- Trigger: keep costs.paid_pence + status in sync with payments
-- ═════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_cost_recompute()
RETURNS TRIGGER AS $$
DECLARE
  target_cost_id UUID;
  new_paid       INTEGER;
  agreed         INTEGER;
  new_status     TEXT;
BEGIN
  target_cost_id := COALESCE(NEW.cost_id, OLD.cost_id);
  SELECT COALESCE(SUM(amount_pence), 0)
    INTO new_paid
    FROM public.hammerex_sitebook_cost_payments
   WHERE cost_id = target_cost_id;
  SELECT agreed_pence INTO agreed
    FROM public.hammerex_sitebook_costs
   WHERE id = target_cost_id;
  -- status derivation — draft + cancelled are homeowner-set, we
  -- never overwrite them here. agreed/part_paid/paid derive from
  -- the ratio of paid vs agreed.
  new_status := CASE
    WHEN new_paid <= 0        THEN 'agreed'
    WHEN new_paid >= agreed   THEN 'paid'
    ELSE                           'part_paid'
  END;
  UPDATE public.hammerex_sitebook_costs
     SET paid_pence = new_paid,
         status = CASE WHEN status IN ('draft','cancelled') THEN status ELSE new_status END,
         updated_at = NOW()
   WHERE id = target_cost_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cost_payments_recompute ON public.hammerex_sitebook_cost_payments;
CREATE TRIGGER trg_cost_payments_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.hammerex_sitebook_cost_payments
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_cost_recompute();

-- Also touch updated_at on cost edits
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_costs_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_costs_touch ON public.hammerex_sitebook_costs;
CREATE TRIGGER trg_costs_touch
  BEFORE UPDATE ON public.hammerex_sitebook_costs
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_costs_touch();

ALTER TABLE public.hammerex_sitebook_costs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_cost_payments ENABLE ROW LEVEL SECURITY;
