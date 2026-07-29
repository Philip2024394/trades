-- 20260728100400_nex_brain_certifications.sql
-- Living Trade Brains · Author Certifications · ADR-0037
--
-- Every Brain has a certified author identity. Named expertise creates
-- trust. Certifications carry credentials, years, certifying body,
-- and a renewal cadence. Runtime UI shows the certified author with
-- each brain answer.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_brain_certifications (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  brain_slug            text          NOT NULL
                                      REFERENCES public.hammerex_nex_brains(slug)
                                      ON DELETE CASCADE,
  author_id             text          NOT NULL,
  author_name           text          NOT NULL,
  -- displayed to end users ("John Smith, Master Stair Builder")
  credentials_text      text          NOT NULL,
  -- e.g. "Master Stair Builder · 35 years · CIOB Member"
  years_experience      integer       NULL,
  certified_by          text          NULL,
  -- certifying body ("CIOB", "self-certified", "Nex Advisory Panel")
  certified_at          timestamptz   NOT NULL DEFAULT now(),
  expires_at            timestamptz   NULL,
  review_frequency_days integer       NOT NULL DEFAULT 90,
  is_primary            boolean       NOT NULL DEFAULT true,
  -- whether this is the primary author (only ONE per brain) or a
  -- secondary certified reviewer
  status                text          NOT NULL DEFAULT 'active',
  -- active · expired · revoked
  metadata              jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_brain_certifications_slug_primary
  ON public.hammerex_nex_brain_certifications (brain_slug, is_primary, status);

CREATE INDEX IF NOT EXISTS ix_brain_certifications_author
  ON public.hammerex_nex_brain_certifications (author_id, status);

CREATE INDEX IF NOT EXISTS ix_brain_certifications_expiry
  ON public.hammerex_nex_brain_certifications (expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;

-- Only ONE primary author per brain at a time (V1 policy).
CREATE UNIQUE INDEX IF NOT EXISTS uq_brain_certifications_one_primary
  ON public.hammerex_nex_brain_certifications (brain_slug)
  WHERE is_primary = true AND status = 'active';

CREATE OR REPLACE FUNCTION public.touch_brain_certifications_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brain_certifications_touch_updated_at
  BEFORE UPDATE ON public.hammerex_nex_brain_certifications
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_brain_certifications_updated_at();

ALTER TABLE public.hammerex_nex_brain_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON public.hammerex_nex_brain_certifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "public_read_active" ON public.hammerex_nex_brain_certifications
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

COMMENT ON TABLE public.hammerex_nex_brain_certifications IS
  'Living Trade Brains · Author Certifications · ADR-0037 · named expertise creates trust';
