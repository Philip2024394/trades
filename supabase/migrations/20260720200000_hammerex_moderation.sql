-- Moderation Engine · polymorphic content-review queue.
-- Phase 5.1 of the engine-first roadmap.
--
-- Every product's user-generated content submits flags here:
--   * Yard post reported by another user   → subject_kind = 'yard_post'
--   * SiteBook photo uploaded              → subject_kind = 'sitebook_photo'
--   * Review left on a trade               → subject_kind = 'review'
--   * Chat message flagged                 → subject_kind = 'chat_message'
--   * Merchant profile field looks off     → subject_kind = 'merchant_profile'
--
-- Sources:
--   * user_report        — another user pressed "Report"
--   * auto_heuristic     — server-side pattern match (spam link, phone number leak, banned word)
--   * auto_ai            — LLM classifier (Phase 6+)
--   * admin_manual       — admin walking the site
--
-- Lifecycle: pending → approved | hidden | removed | escalated
--   * approved  = leave visible, clear flag
--   * hidden    = soft-hide (Rule 3: non-destructive; visible_to_admin only)
--   * removed   = hard-remove target row (rare, only for illegal content)
--   * escalated = kicks to legal/ops queue

CREATE TABLE IF NOT EXISTS public.hammerex_moderation_flags (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SUBJECT — polymorphic pointer to whatever is being reviewed
  subject_kind          TEXT           NOT NULL,
  subject_id            TEXT           NOT NULL,
  subject_display       TEXT,                          -- denormalised for queue readability
  subject_url           TEXT,                          -- deep-link admin uses to see it in context

  -- FLAG
  flag_kind             TEXT           NOT NULL,      -- 'spam' | 'offensive' | 'off_topic' | 'personal_info' | 'copyright' | 'low_quality' | 'other'
  flag_source           TEXT           NOT NULL,      -- 'user_report' | 'auto_heuristic' | 'auto_ai' | 'admin_manual'
  flag_note             TEXT,                         -- free-text reason the reporter gave
  reporter_kind         TEXT,                         -- 'homeowner' | 'trade' | 'merchant' | 'admin' | 'system'
  reporter_id           TEXT,

  -- STATUS
  status                TEXT           NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'approved', 'hidden', 'removed', 'escalated')),
  severity              TEXT           NOT NULL DEFAULT 'normal'
                          CHECK (severity IN ('low', 'normal', 'high', 'critical')),

  -- RESOLUTION
  resolved_at           TIMESTAMPTZ,
  resolved_by_admin_id  UUID,
  resolved_by_email     TEXT,
  resolution_note       TEXT,

  -- METADATA
  metadata              JSONB,
  created_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_pending_queue
  ON public.hammerex_moderation_flags (severity DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_moderation_by_subject
  ON public.hammerex_moderation_flags (subject_kind, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_moderation_recent
  ON public.hammerex_moderation_flags (created_at DESC);

ALTER TABLE public.hammerex_moderation_flags ENABLE ROW LEVEL SECURITY;
-- Service-role only. Admin dashboards + report APIs write here.

-- Rule 3 · non-destructive: soft-hide flag on any moderatable target row.
-- Products opt-in by adding hidden_at + hidden_reason columns; the engine
-- writes them via product-specific adapters (see engine.ts).
