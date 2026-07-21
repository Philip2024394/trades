-- Verification Engine · polymorphic credential store.
-- Phase 4.1 of the engine-first roadmap.
--
-- Every product's verification need writes here:
--   * trade → Gas Safe #, NICEIC #, ID
--   * merchant → Companies House #, VAT #
--   * homeowner → address ownership (future)
--   * driver → licence (future, CityDrivers)
--   * dating profile → age + ID (future)
--
-- Status lifecycle: pending → verified | rejected | expired
-- Manual approve/reject in v1 (admin queue). API-integration
-- (Gas Safe API, Companies House API, etc.) is Phase 6+.

CREATE TABLE IF NOT EXISTS public.hammerex_verifications (
  id                  UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SUBJECT — polymorphic
  subject_kind        TEXT           NOT NULL,          -- 'trade' | 'merchant' | 'homeowner' | 'driver' | 'dating_profile'
  subject_id          TEXT           NOT NULL,
  subject_slug        TEXT,                             -- denormalised for admin queue readability
  subject_display     TEXT,

  -- CREDENTIAL
  credential_kind     TEXT           NOT NULL,          -- 'gas_safe' | 'niceic' | 'companies_house' | 'vat' | 'id' | 'address' | 'age' | 'licence'
  credential_value    TEXT,                             -- the number / reference the subject submitted
  credential_note     TEXT,                             -- free-text context ("Registered as sole trader")

  -- EVIDENCE — optional uploaded doc URL
  evidence_url        TEXT,
  evidence_kind       TEXT,                             -- 'pdf' | 'jpg' | 'png' | 'external_link'

  -- STATUS
  status              TEXT           NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  rejection_reason    TEXT,

  -- LIFECYCLE
  submitted_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  reviewed_at         TIMESTAMPTZ,
  reviewed_by_admin_id UUID,
  reviewed_by_email   TEXT,
  expires_at          TIMESTAMPTZ,                      -- Gas Safe certs expire, IDs expire

  -- ORIGIN
  submitted_via       TEXT           NOT NULL DEFAULT 'user',  -- 'user' | 'admin_manual' | 'api_import'

  metadata            JSONB,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- One active verification per (subject, credential kind)
  -- (Expired/rejected can be resubmitted; UNIQUE partial index below.)
  UNIQUE (subject_kind, subject_id, credential_kind, status)
);

CREATE INDEX IF NOT EXISTS idx_verifications_pending_queue
  ON public.hammerex_verifications (submitted_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_verifications_subject
  ON public.hammerex_verifications (subject_kind, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_verifications_expiring
  ON public.hammerex_verifications (expires_at ASC)
  WHERE status = 'verified' AND expires_at IS NOT NULL;

ALTER TABLE public.hammerex_verifications ENABLE ROW LEVEL SECURITY;
-- Service-role only. Admin queue + subject-profile pages read via API layer.
