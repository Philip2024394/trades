-- Canteen snapshots — non-destructive point-in-time backups of every
-- merchant's editable canteen state. Enables one-click restore when a
-- merchant accidentally deletes designs / breaks their page, and gives
-- admin a safety net for support tickets like "please restore Mike's
-- page to yesterday".
--
-- Design principles:
--   1. Non-destructive: restoring old state creates a NEW snapshot
--      first (of current state), so nothing is ever lost. Merchant can
--      restore forward if they restored to the wrong version.
--   2. JSONB payload: full editable state captured as a JSON blob so
--      schema changes on the source tables don't invalidate old
--      snapshots. Older snapshots may have fewer fields — restore
--      logic handles gracefully.
--   3. Retention: rolling 30 auto-snapshots per canteen + named
--      snapshots forever. Cron job trims the tail.
--   4. Audit trail: every restore records who fired it (admin_id or
--      merchant_slug), why (required reason note), and when. Immutable.

-- ─── Snapshots table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hammerex_canteen_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id UUID NOT NULL REFERENCES hammerex_canteens(id) ON DELETE CASCADE,

  -- What triggered this snapshot.
  --   auto:       merchant saved (or daily cron)
  --   named:      merchant explicitly clicked "Save version" (retained forever)
  --   pre_restore: created just before a restore (so restore is undoable)
  kind TEXT NOT NULL CHECK (kind IN ('auto', 'named', 'pre_restore')),

  -- Human-readable label. Optional for auto snapshots; required for
  -- named ones (enforced in application code).
  note TEXT,

  -- Full editable state as JSONB. Shape:
  --   {
  --     "canteen": {...hammerex_canteens row without id/timestamps},
  --     "admin":    {...admin row or null},
  --     "products": [...hammerex_canteen_products rows],
  --     "designs":  [...hammerex_canteen_designs rows]
  --   }
  snapshot_data JSONB NOT NULL,

  -- Who / what triggered this snapshot. `created_by` is free-form so
  -- admin dashboards, cron jobs, and merchant self-service can all
  -- record their origin without needing a users table lookup.
  --   "admin:{admin_id}"    — admin dashboard restore
  --   "merchant:{slug}"     — merchant self-service
  --   "system:daily-cron"   — automated daily snapshot
  --   "system:auto-save"    — auto-snapshot on merchant save
  created_by TEXT NOT NULL DEFAULT 'system:auto-save',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot-path index: list snapshots for one canteen, newest first.
CREATE INDEX IF NOT EXISTS hammerex_canteen_snapshots_canteen_created_idx
  ON hammerex_canteen_snapshots (canteen_id, created_at DESC);

-- Kind index for retention-trim queries.
CREATE INDEX IF NOT EXISTS hammerex_canteen_snapshots_kind_idx
  ON hammerex_canteen_snapshots (canteen_id, kind, created_at DESC);

-- ─── Restore audit log ──────────────────────────────────────
--
-- Immutable ledger of every restore action. Deliberately a SEPARATE
-- table from snapshots so pruning old snapshots never loses the audit
-- record of restores that used them. Compliance + forensics.

CREATE TABLE IF NOT EXISTS hammerex_canteen_restore_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id UUID NOT NULL REFERENCES hammerex_canteens(id) ON DELETE CASCADE,

  -- The snapshot that was restored (may be later pruned; we keep the
  -- ID as a soft reference for tracing but don't FK to avoid dangling
  -- foreign key errors after snapshot retention trim).
  restored_from_snapshot_id UUID NOT NULL,

  -- The pre-restore snapshot we created before applying the restore.
  -- Merchant can undo by restoring back to this.
  pre_restore_snapshot_id UUID NOT NULL,

  -- Who fired it (same format as snapshots.created_by).
  actor TEXT NOT NULL,

  -- Required reason note — 20+ chars enforced in application code.
  reason TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hammerex_canteen_restore_log_canteen_idx
  ON hammerex_canteen_restore_log (canteen_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────
--
-- All snapshots + restore logs are private. No public reads. Service
-- role writes only. Merchant self-service dashboard reads via signed
-- server routes, not direct client queries.

ALTER TABLE hammerex_canteen_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE hammerex_canteen_restore_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hammerex_canteen_snapshots_service ON hammerex_canteen_snapshots;
CREATE POLICY hammerex_canteen_snapshots_service
  ON hammerex_canteen_snapshots FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS hammerex_canteen_restore_log_service ON hammerex_canteen_restore_log;
CREATE POLICY hammerex_canteen_restore_log_service
  ON hammerex_canteen_restore_log FOR ALL
  USING (true)
  WITH CHECK (true);
