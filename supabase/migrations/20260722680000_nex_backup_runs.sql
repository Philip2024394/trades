-- Nex Brain · Backup & Restore.
--
-- Three tables:
--   hammerex_nex_backup_runs      — every backup produced (full/incremental)
--   hammerex_nex_restore_attempts — every restore attempted
--   hammerex_nex_backup_audit     — append-only audit log for both
--
-- All service-role only; RLS enabled so nothing leaks via anon key.

-- ─── Backup runs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_backup_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               TEXT NOT NULL CHECK (kind IN ('full','incremental','pre_restore_snapshot')),
  base_backup_id     UUID REFERENCES public.hammerex_nex_backup_runs(id) ON DELETE SET NULL,   -- for incrementals
  status             TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','complete','failed')),
  entries_count      INTEGER NOT NULL DEFAULT 0,
  versions_count     INTEGER NOT NULL DEFAULT 0,
  edges_count        INTEGER NOT NULL DEFAULT 0,
  reviews_count      INTEGER NOT NULL DEFAULT 0,
  uploads_count      INTEGER NOT NULL DEFAULT 0,
  research_count     INTEGER NOT NULL DEFAULT 0,
  size_bytes         BIGINT NOT NULL DEFAULT 0,
  storage_bucket     TEXT NOT NULL DEFAULT 'nex-backups',
  storage_path       TEXT,                                 -- backups/YYYY/MM/backup-<uuid>.zip
  manifest_json      JSONB,                                -- full backup_manifest.json
  checkpoint_json    JSONB,                                -- { table: max_ts } after this backup
  error_message      TEXT,
  created_by         TEXT NOT NULL,                        -- admin id or 'cron'
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nex_backup_runs_recent
  ON public.hammerex_nex_backup_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_backup_runs_kind_status
  ON public.hammerex_nex_backup_runs (kind, status, created_at DESC);

ALTER TABLE public.hammerex_nex_backup_runs ENABLE ROW LEVEL SECURITY;

-- ─── Restore attempts ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hammerex_nex_restore_attempts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_backup_id         UUID,                           -- may be internal or external
  source_manifest_json     JSONB,                          -- uploaded manifest (from ZIP)
  status                   TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','validated','previewed','executing','restored','failed','rolled_back')),
  validation_errors        JSONB,                          -- [{ file, error }]
  preview_json             JSONB,                          -- counts + sample rows
  restored_counts_json     JSONB,                          -- { entries: { inserted, updated }, versions: {...} }
  pre_restore_snapshot_id  UUID REFERENCES public.hammerex_nex_backup_runs(id) ON DELETE SET NULL,
  error_message            TEXT,
  attempted_by             TEXT NOT NULL,
  attempted_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_nex_restore_recent
  ON public.hammerex_nex_restore_attempts (attempted_at DESC);

ALTER TABLE public.hammerex_nex_restore_attempts ENABLE ROW LEVEL SECURITY;

-- ─── Audit log ───────────────────────────────────────────────────
-- Append-only. Every backup + restore action lands here.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_backup_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor          TEXT NOT NULL,
  action         TEXT NOT NULL,                            -- 'backup.started' | 'backup.completed' | 'restore.uploaded' etc
  backup_run_id  UUID REFERENCES public.hammerex_nex_backup_runs(id)      ON DELETE SET NULL,
  restore_id     UUID REFERENCES public.hammerex_nex_restore_attempts(id) ON DELETE SET NULL,
  details_json   JSONB,
  at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nex_backup_audit_recent
  ON public.hammerex_nex_backup_audit (at DESC);

CREATE INDEX IF NOT EXISTS idx_nex_backup_audit_backup
  ON public.hammerex_nex_backup_audit (backup_run_id, at DESC)
  WHERE backup_run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_nex_backup_audit_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'hammerex_nex_backup_audit is append-only.'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'hammerex_nex_backup_audit is append-only.'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_backup_audit_append_only ON public.hammerex_nex_backup_audit;
CREATE TRIGGER trg_nex_backup_audit_append_only
  BEFORE UPDATE OR DELETE ON public.hammerex_nex_backup_audit
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_backup_audit_append_only();

ALTER TABLE public.hammerex_nex_backup_audit ENABLE ROW LEVEL SECURITY;

-- ─── Comments ────────────────────────────────────────────────────
COMMENT ON TABLE public.hammerex_nex_backup_runs IS
  'Every backup ever produced. Storage path points into private nex-backups bucket. checkpoint_json is what the NEXT incremental compares against.';
COMMENT ON TABLE public.hammerex_nex_restore_attempts IS
  'Every restore attempted (successful or not). pre_restore_snapshot_id links to the auto-backup taken before the restore ran.';
COMMENT ON TABLE public.hammerex_nex_backup_audit IS
  'Append-only audit log. Trigger blocks UPDATE + DELETE. Read via /admin/nex/backup.';
