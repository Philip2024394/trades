-- GDPR Requests · registry of every export + delete request.
-- Phase 5.2 of the engine-first roadmap.
--
-- We must be able to prove:
--   * we received the request (submitted_at)
--   * we fulfilled it within 30 days (fulfilled_at)
--   * we notified the subject (notified_at)
--
-- Types:
--   * export = right-of-access (Art. 15) — bundle all data as JSON
--   * delete = right-to-be-forgotten (Art. 17) — hard-delete personal data,
--             preserving anonymised aggregates (payment history, event counts)

CREATE TABLE IF NOT EXISTS public.hammerex_gdpr_requests (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SUBJECT
  subject_kind          TEXT           NOT NULL,           -- 'homeowner' | 'trade' | 'merchant'
  subject_id            TEXT           NOT NULL,
  subject_email         TEXT           NOT NULL,           -- so we can reach them if the account is deleted

  -- REQUEST TYPE
  request_kind          TEXT           NOT NULL
                          CHECK (request_kind IN ('export', 'delete')),
  submission_source     TEXT           NOT NULL DEFAULT 'admin_manual',
                          -- 'user_self_service' | 'admin_manual' | 'legal_response'
  reason                TEXT,

  -- FULFILMENT
  status                TEXT           NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'fulfilled', 'rejected', 'error')),
  fulfilled_at          TIMESTAMPTZ,
  notified_at           TIMESTAMPTZ,
  export_bundle_url     TEXT,                              -- pre-signed URL to bundle JSON
  export_bundle_bytes   INTEGER,
  rejection_reason      TEXT,

  -- OPERATIONS
  actioned_by_admin_id  UUID,
  actioned_by_email     TEXT,

  metadata              JSONB,
  submitted_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_pending
  ON public.hammerex_gdpr_requests (submitted_at ASC)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_gdpr_subject
  ON public.hammerex_gdpr_requests (subject_kind, subject_id, submitted_at DESC);

ALTER TABLE public.hammerex_gdpr_requests ENABLE ROW LEVEL SECURITY;
-- Service-role only.
