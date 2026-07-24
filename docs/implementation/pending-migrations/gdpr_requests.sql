-- Pending migration · GDPR portability + Right to be Forgotten
-- Depends on: ADR-0016 (Memory Privacy) · ES-04 §8 (GDPR workflows)
-- Status: PREPARED · not yet in supabase/migrations/ · awaiting ADR acceptance
-- Promotion path: on ADR-0016 acceptance, copy to supabase/migrations/20260728_gdpr_requests.sql

BEGIN;

-- ─── GDPR request orchestrator ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_gdpr_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug       TEXT NOT NULL,
  requested_by        UUID NOT NULL REFERENCES auth.users(id),
  request_kind        TEXT NOT NULL
                        CHECK (request_kind IN ('portability_export', 'right_to_be_forgotten')),

  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'appeal_window', 'complete', 'cancelled', 'failed')),

  -- Portability export fields
  export_url          TEXT,                    -- Signed URL to zip file
  export_expires_at   TIMESTAMPTZ,             -- 7-day signed URL expiry
  export_tables       TEXT[],                  -- Which tables included

  -- RTBF fields
  appeal_window_ends_at  TIMESTAMPTZ,          -- 30-day appeal window
  cascade_delete_started_at TIMESTAMPTZ,
  cascade_delete_completed_at TIMESTAMPTZ,
  audit_retention_kept  BOOLEAN DEFAULT TRUE,  -- Audit rows retained with PII redacted per jurisdiction

  -- Common
  jurisdiction        TEXT NOT NULL,           -- ISO country code · determines legal retention floor
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  error_message       TEXT,

  UNIQUE (merchant_slug, request_kind, requested_at)  -- Prevent duplicate concurrent requests
);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_merchant
  ON public.hammerex_nex_platform_gdpr_requests (merchant_slug, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status
  ON public.hammerex_nex_platform_gdpr_requests (status)
  WHERE status IN ('pending', 'processing', 'appeal_window');

-- ─── RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.hammerex_nex_platform_gdpr_requests ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own GDPR requests
CREATE POLICY "gdpr_requests_read_own"
  ON public.hammerex_nex_platform_gdpr_requests
  FOR SELECT
  USING (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Only owner can initiate GDPR requests
CREATE POLICY "gdpr_requests_insert_owner_only"
  ON public.hammerex_nex_platform_gdpr_requests
  FOR INSERT
  WITH CHECK (
    merchant_slug IN (
      SELECT merchant_slug FROM public.hammerex_nex_team_members
      WHERE user_id = auth.uid()
        AND role = 'owner'
        AND status = 'active'
    )
  );

-- ─── Merchant deletion audit trail ───────────────────────────────
-- Retention floor per jurisdiction · PII redacted after cascade

CREATE TABLE IF NOT EXISTS public.hammerex_nex_platform_gdpr_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gdpr_request_id   UUID REFERENCES public.hammerex_nex_platform_gdpr_requests(id),
  table_name        TEXT NOT NULL,
  row_count_deleted INTEGER NOT NULL,
  pii_redacted      BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gdpr_audit_request
  ON public.hammerex_nex_platform_gdpr_audit (gdpr_request_id, occurred_at);

COMMENT ON TABLE public.hammerex_nex_platform_gdpr_requests IS
  'Phase 0 Week 3 · GDPR portability + RTBF orchestrator · per ADR-0016 §5 + ES-04 §8.';

COMMIT;
