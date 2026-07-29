-- 20260728110000_nex_brain_identity_fields.sql
-- Living Trade Brains · Constitutional Identity fields · Philip 2026-07-28
--
-- Adds three constitutional identity fields to hammerex_nex_brains:
--   • mission    — one-sentence purpose statement
--   • principles — ordered list of explicit rules every answer must follow
--   • promise    — structured { will_do:[], will_not_do:[] }
--
-- These fields keep every answer aligned to a single spirit even as
-- authors change over time. Every answer surface must expose them via
-- an "About this brain" affordance. A brain cannot be promoted to
-- lifecycle_stage='production' until all three are populated.

ALTER TABLE public.hammerex_nex_brains
  ADD COLUMN IF NOT EXISTS mission     text     NULL,
  ADD COLUMN IF NOT EXISTS principles  text[]   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS promise     jsonb    NOT NULL DEFAULT jsonb_build_object(
    'will_do', jsonb_build_array(),
    'will_not_do', jsonb_build_array()
  );

COMMENT ON COLUMN public.hammerex_nex_brains.mission IS
  'One-sentence purpose statement. Answers "why does this brain exist?" · Philip 2026-07-28';

COMMENT ON COLUMN public.hammerex_nex_brains.principles IS
  'Ordered list of explicit rules every answer must follow · not a suggestion, a filter · Philip 2026-07-28';

COMMENT ON COLUMN public.hammerex_nex_brains.promise IS
  'Structured commitments · shape { will_do: text[], will_not_do: text[] } · shown to end-users before they trust the brain · Philip 2026-07-28';

-- Guardrail: enforce that a brain cannot be flipped to lifecycle_stage=production
-- without all three identity fields populated. The trigger fires on UPDATE only,
-- so historical rows can be backfilled without a big-bang migration.
CREATE OR REPLACE FUNCTION public.enforce_brain_identity_before_production()
RETURNS trigger AS $$
BEGIN
  IF NEW.lifecycle_stage = 'production'
     AND OLD.lifecycle_stage IS DISTINCT FROM 'production' THEN
    IF NEW.mission IS NULL OR length(trim(NEW.mission)) = 0 THEN
      RAISE EXCEPTION 'Brain %: cannot promote to production without a mission statement · Philip 2026-07-28', NEW.slug;
    END IF;
    IF array_length(NEW.principles, 1) IS NULL OR array_length(NEW.principles, 1) < 1 THEN
      RAISE EXCEPTION 'Brain %: cannot promote to production without at least one principle · Philip 2026-07-28', NEW.slug;
    END IF;
    IF NEW.promise IS NULL
       OR jsonb_array_length(COALESCE(NEW.promise -> 'will_do', '[]'::jsonb)) < 1 THEN
      RAISE EXCEPTION 'Brain %: cannot promote to production without at least one will_do promise · Philip 2026-07-28', NEW.slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_brains_enforce_identity_before_production
  ON public.hammerex_nex_brains;

CREATE TRIGGER trg_brains_enforce_identity_before_production
  BEFORE UPDATE ON public.hammerex_nex_brains
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_brain_identity_before_production();
