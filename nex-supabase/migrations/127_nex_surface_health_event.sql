-- ============================================================================
-- NEX-native Migration 127 · nex_surface_health_event
-- ============================================================================
--
-- Foundation for the NEX Chat Surfaces × Visual Themes × HQ Diagnostics
-- doctrine (sealed 2026-10-03 · doctrine_nex_chat_surfaces_visual_themes_hq
-- _2026_10_03.md). Implements §7 "HQ Diagnostics · nex_surface_health_event"
-- as the dedicated diagnostic table for user-facing surface and theme
-- failures.
--
-- Deliberately NOT an extension of worker_audit_events. Workers and
-- user-facing surfaces are separate diagnostic domains; combining them
-- produces unreadable HQ reporting. This table is for surface/theme
-- failures only.
--
-- Service-layer invariants (enforced here at DB level AND in the service
-- module src/lib/nex-native/surface-health-service.ts · defense in depth):
--
--   1. lifecycle_state ∈ {detected, recovered, fallback-active, ongoing,
--      investigating, fixed, verified} · CHECK constraint.
--   2. Legal transitions (closed set) enforced by trigger:
--        detected → recovered | fallback-active
--        fallback-active → ongoing | investigating
--        ongoing → investigating
--        investigating → fixed
--        fixed → verified
--      All other transitions raise an exception. `recovered` and
--      `verified` are terminal.
--   3. `verified` MAY NOT be entered while any OTHER row with the same
--      failure_signature is in fallback-active or ongoing. Enforced by
--      trigger · prevents "fallback = resolution" conflation.
--   4. failure_signature is deterministic and non-content-bearing · the
--      service module derives it from (surface, visual_theme,
--      component_module, error_classification, app_version, theme_version).
--      The DB stores it opaquely.
--
-- Scope decision (per sealed doctrine §12):
--   This migration establishes the TABLE ONLY. The service module +
--   contracts land in a parallel commit under src/lib/nex-native/. No
--   error boundaries, no HQ page, no kill-switch endpoint. Those remain
--   separate founder decisions (Items 2 and 3 of §12).
--
-- Related sealed doctrines:
--   · NEX Chat Surfaces × Visual Themes × HQ Diagnostics · 2026-10-03
--   · One NEX Identity · 2026-09-30
--   · Theme × Template × Profession Lock · 2026-09-30
--
-- Rollback:
--   BEGIN;
--     DELETE FROM nex_migration_history WHERE version = '127';
--     DROP TABLE IF EXISTS nex_surface_health_event CASCADE;
--     DROP FUNCTION IF EXISTS nex_surface_health_event_touch();
--     DROP FUNCTION IF EXISTS nex_surface_health_event_enforce_transition();
--     DROP FUNCTION IF EXISTS nex_surface_health_event_enforce_verify_rule();
--   COMMIT;
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_surface_health_event (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Joins to src/lib/nex/observability/correlation.ts · nullable because
  -- some signal emissions occur outside an HTTP scope (documented
  -- degradation · not an error).
  correlation_id         text,

  -- Which chat surface (per doctrine §1 terminology lock). Free-form
  -- text so new surfaces don't require a schema change · service layer
  -- validates against the known surface registry.
  surface                text NOT NULL,

  -- Which visual theme was active when the failure occurred. Free-form
  -- text for the same reason as surface. 'none' is reserved for failures
  -- that occurred in a theme-neutral context (e.g. core chat chrome).
  visual_theme           text NOT NULL,

  -- The specific optional module or renderer that failed. Values like
  -- 'bubble-renderer', 'animation-overlay', 'sticker-picker', 'composer'.
  -- When the failure is at the surface level (not a Tier 3 module), use
  -- 'surface-root'; when at the theme level, use 'theme-root'.
  component_module       text NOT NULL,

  occurred_at            timestamptz NOT NULL DEFAULT now(),

  -- Closed-set error classification per src/lib/nex-native/surface-health
  -- /classification.ts. CHECK constraint locks the enum at the DB layer
  -- so future migrations are required to extend it.
  error_classification   text NOT NULL
    CHECK (error_classification IN (
      'render_runtime_error',
      'theme_asset_missing',
      'theme_asset_invalid',
      'theme_bundle_load_failure',
      'animation_runtime_error',
      'sticker_renderer_error',
      'emoji_renderer_error',
      'bubble_renderer_error',
      'composer_render_error',
      'unknown'
    )),

  -- What the system did in response. 'none' = failure observed but no
  -- active recovery performed (should be rare · usually paired with
  -- lifecycle_state='detected' then promoted). 'fallback' = Safe Fallback
  -- Renderer or theme-neutral default engaged. 'retry' = idempotent
  -- retry succeeded. 'degrade' = optional module silently disabled.
  recovery_action        text NOT NULL
    CHECK (recovery_action IN ('none', 'fallback', 'retry', 'degrade')),

  app_version            text,
  theme_version          text,

  -- Normalized browser/device/runtime signal per doctrine §7.4. Raw
  -- user-agent strings MUST NOT be persisted. Shape (service-enforced):
  --   { browser, os, device_class, runtime, locale? }
  client_environment     jsonb,

  -- Deterministic, non-content-bearing dedup key. Service-derived from
  -- (surface, visual_theme, component_module, error_classification,
  -- app_version, theme_version). Opaque at the DB layer.
  failure_signature      text NOT NULL,

  -- One of the seven lifecycle states per doctrine §7.2. Default
  -- 'detected' is the only legal entry state; recordFailure() flips it
  -- to 'recovered' or 'fallback-active' atomically.
  lifecycle_state        text NOT NULL DEFAULT 'detected'
    CHECK (lifecycle_state IN (
      'detected',
      'recovered',
      'fallback-active',
      'ongoing',
      'investigating',
      'fixed',
      'verified'
    )),

  -- JSONB array of state transitions · each entry:
  --   { "from": "<state>", "to": "<state>", "at": "<iso>", "reason": "<text>" | null }
  state_history          jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Count of occurrences sharing this failure_signature within the
  -- current incident (dedup) window. The window closes when the row
  -- transitions to a terminal state (recovered or verified); a new row
  -- is inserted for subsequent occurrences.
  occurrence_count       integer NOT NULL DEFAULT 1
    CHECK (occurrence_count >= 1),

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE nex_surface_health_event IS
  'HQ diagnostics for NEX chat-surface / visual-theme / optional-module failures · dedicated domain · do NOT merge with worker_audit_events · sealed 2026-10-03 per Chat Surfaces × Visual Themes × HQ doctrine';

COMMENT ON COLUMN nex_surface_health_event.failure_signature IS
  'Deterministic non-content-bearing identifier · dedup key · lifecycle-rule key · MUST NOT contain conversation content or raw error text';

COMMENT ON COLUMN nex_surface_health_event.client_environment IS
  'Normalized runtime signal (browser/os/device_class/runtime/locale) · raw user-agent strings forbidden';

-- Dedup lookups + lifecycle-rule enforcement index.
CREATE INDEX IF NOT EXISTS nex_surface_health_event_signature_state_idx
  ON nex_surface_health_event (failure_signature, lifecycle_state);

-- HQ timeline / Kanban filtering.
CREATE INDEX IF NOT EXISTS nex_surface_health_event_occurred_idx
  ON nex_surface_health_event (occurred_at DESC);
CREATE INDEX IF NOT EXISTS nex_surface_health_event_lifecycle_idx
  ON nex_surface_health_event (lifecycle_state);
CREATE INDEX IF NOT EXISTS nex_surface_health_event_surface_theme_idx
  ON nex_surface_health_event (surface, visual_theme);
CREATE INDEX IF NOT EXISTS nex_surface_health_event_correlation_idx
  ON nex_surface_health_event (correlation_id)
  WHERE correlation_id IS NOT NULL;

-- ─── updated_at touch ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nex_surface_health_event_touch()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_surface_health_event_touch_trg ON nex_surface_health_event;
CREATE TRIGGER nex_surface_health_event_touch_trg
  BEFORE UPDATE ON nex_surface_health_event
  FOR EACH ROW
  EXECUTE FUNCTION nex_surface_health_event_touch();

-- ─── Legal-transition enforcement ───────────────────────────────────
-- Closed set per doctrine §7.3. All other transitions raise an
-- exception. recovered and verified are terminal.
CREATE OR REPLACE FUNCTION nex_surface_health_event_enforce_transition()
RETURNS trigger AS $$
BEGIN
  IF OLD.lifecycle_state = NEW.lifecycle_state THEN
    RETURN NEW;  -- no-op update (e.g. occurrence_count bump) is allowed
  END IF;

  -- Terminal states cannot transition out.
  IF OLD.lifecycle_state IN ('recovered', 'verified') THEN
    RAISE EXCEPTION 'nex_surface_health_event: lifecycle_state % is terminal · cannot transition to %',
      OLD.lifecycle_state, NEW.lifecycle_state;
  END IF;

  -- Closed-set legal transitions.
  IF NOT (
    (OLD.lifecycle_state = 'detected'        AND NEW.lifecycle_state IN ('recovered', 'fallback-active')) OR
    (OLD.lifecycle_state = 'fallback-active' AND NEW.lifecycle_state IN ('ongoing', 'investigating')) OR
    (OLD.lifecycle_state = 'ongoing'         AND NEW.lifecycle_state = 'investigating') OR
    (OLD.lifecycle_state = 'investigating'   AND NEW.lifecycle_state = 'fixed') OR
    (OLD.lifecycle_state = 'fixed'           AND NEW.lifecycle_state = 'verified')
  ) THEN
    RAISE EXCEPTION 'nex_surface_health_event: illegal transition % → %',
      OLD.lifecycle_state, NEW.lifecycle_state;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_surface_health_event_enforce_transition_trg ON nex_surface_health_event;
CREATE TRIGGER nex_surface_health_event_enforce_transition_trg
  BEFORE UPDATE OF lifecycle_state ON nex_surface_health_event
  FOR EACH ROW
  EXECUTE FUNCTION nex_surface_health_event_enforce_transition();

-- ─── Verify-while-active guard ──────────────────────────────────────
-- Per doctrine §7.3: `verified` MAY NOT be entered while any instance
-- of the same failure_signature is in fallback-active or ongoing.
-- Prevents "user quietly on fallback" being mistaken for resolution.
CREATE OR REPLACE FUNCTION nex_surface_health_event_enforce_verify_rule()
RETURNS trigger AS $$
DECLARE
  conflict_count integer;
BEGIN
  IF NEW.lifecycle_state = 'verified' AND OLD.lifecycle_state <> 'verified' THEN
    SELECT count(*) INTO conflict_count
      FROM nex_surface_health_event
      WHERE failure_signature = NEW.failure_signature
        AND id <> NEW.id
        AND lifecycle_state IN ('fallback-active', 'ongoing');
    IF conflict_count > 0 THEN
      RAISE EXCEPTION 'nex_surface_health_event: cannot mark verified while % other row(s) with signature % remain in fallback-active or ongoing',
        conflict_count, NEW.failure_signature;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nex_surface_health_event_enforce_verify_rule_trg ON nex_surface_health_event;
CREATE TRIGGER nex_surface_health_event_enforce_verify_rule_trg
  BEFORE UPDATE OF lifecycle_state ON nex_surface_health_event
  FOR EACH ROW
  EXECUTE FUNCTION nex_surface_health_event_enforce_verify_rule();

-- ─── RLS · service-role only ────────────────────────────────────────
-- Diagnostic events contain internal signals (surface/theme/module/
-- classification) that are not useful to anon users and must not leak.
-- Only service-role (admin) writes; anon/authenticated clients are
-- fully denied. HQ reads use service-role via admin surfaces.
ALTER TABLE nex_surface_health_event ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nex_surface_health_event_deny_all_client ON nex_surface_health_event;
CREATE POLICY nex_surface_health_event_deny_all_client
  ON nex_surface_health_event FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '127',
    'nex_surface_health_event · dedicated HQ diagnostics table for chat-surface and visual-theme failures · 7-state lifecycle with legal-transition trigger + verify-while-active guard · failure_signature dedup key · service-role only',
    'Founder-authorised 2026-10-03 as §12 Item 1 of the sealed Chat Surfaces × Visual Themes × HQ Diagnostics doctrine. Table only · boundaries, HQ page, kill-switch endpoint remain unauthorised. No private conversation content may be stored; service module enforces this at the type boundary.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
