# NEX Object Storage · Point-in-Time Recovery Design

**Status:** DESIGN · not yet implemented · awaiting Philip's authorisation
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Close refactor-plan row F15 · specify how objects deleted or overwritten in `nex.object_blobs` can be recovered to a chosen wall-clock point.
**Rule:** Design lands; migrations do not run without explicit go.

---

## Current state (2026-08-10)

`nex.object_blobs` stores every version of every uploaded object · `nex.object_blob_current` points at the live version. What this already gives us:

- **Delete recovery** — `delete()` is soft by default (writes a `is_delete_marker=TRUE` row). The prior version is still in `object_blobs`.
- **Version history** — `listVersions()` returns every version newest-first. Manual "roll back to prior version" is one `UPDATE` on `object_blob_current`.
- **Hard deletes** — `delete({hard:true})` removes the row(s) permanently. **This is the only irreversible path today.**

What's missing:

- **No retention window** on delete markers. If someone soft-deletes then hard-deletes 5 minutes later, no undo.
- **No historical bucket snapshot** — "restore the bucket to how it looked at 14:00 yesterday" requires walking every key manually.
- **No PITR guarantee for the underlying bytes.** Postgres PITR (if enabled) covers `object_blobs` rows; hard-deleted BYTEA is only recoverable by rolling the DB back — not what most operators expect.

---

## Design

### 1 · Soft-delete retention window (deferrable hard-delete)

Introduce a policy: `delete()` never removes bytes immediately even when `{hard:true}` is passed. Instead:

- Soft delete writes `is_delete_marker=TRUE` (unchanged).
- Hard delete writes `is_delete_marker=TRUE` AND `pending_hard_delete_at = NOW() + hard_delete_delay`.
- A background sweeper (daily cron) evicts bytes only after `pending_hard_delete_at` passes.

New column: `nex.object_blobs.pending_hard_delete_at TIMESTAMPTZ NULL`.

Config: `NEX_OBJECT_HARD_DELETE_DELAY_DAYS` env (default 30).

Undo window: any time between the delete request and the sweeper runs, the operator can `UPDATE ... SET pending_hard_delete_at = NULL`.

### 2 · Bucket-scoped point-in-time restore

Given a `(bucket, target_ts)` pair, restore the bucket's `object_blob_current` pointers to reflect what was live at that timestamp.

Algorithm (documented as `nex.restore_bucket_pit(bucket TEXT, target_ts TIMESTAMPTZ)`):
```
FOR each key IN nex.object_blob_current WHERE bucket = target:
  SELECT the newest version_id from object_blobs
  WHERE bucket = target AND key = this_key AND uploaded_at <= target_ts
    AND NOT is_delete_marker AT that point in time
  IF found:
    UPDATE object_blob_current SET version_id = <found>, updated_at = NOW()
  ELSE:
    (key did not exist at target_ts · either delete or leave · operator picks)
```

Wrap in one transaction so the restore is atomic. Emit a `nex.object_blob_pit_restore` audit row per key so history is queryable.

### 3 · Read-only historical view

Add a helper view for the common "what did this key look like at T?" question:
```sql
CREATE OR REPLACE VIEW nex.object_blob_history AS
  SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
         is_delete_marker, uploaded_at, uploaded_by, source_ref, custom
  FROM nex.object_blobs
  ORDER BY bucket, key, uploaded_at DESC;
```

### 4 · Operator dashboards + runbook

- New Section in `HEADQUARTERS-STORAGE-*` doc listing:
  - How to query the deletion pipeline
  - How to cancel a pending hard delete
  - How to run a PIT restore
- Extend `docs/operations/runbooks/storage-unreachable.md` with a "PIT restore" appendix.

---

## Proposed migration (draft only · NOT applied)

Would land as `deploy/postgres/init/048_object_storage_pitr.sql` when authorised. Contents:

```sql
ALTER TABLE nex.object_blobs
  ADD COLUMN IF NOT EXISTS pending_hard_delete_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_object_blobs_pending_hard_delete
  ON nex.object_blobs (pending_hard_delete_at)
  WHERE pending_hard_delete_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS nex.object_blob_pit_restore (
  restore_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket         TEXT NOT NULL,
  key            TEXT NOT NULL,
  target_ts      TIMESTAMPTZ NOT NULL,
  restored_from  TEXT,             -- version_id restored, NULL if key deleted at target
  restored_by    TEXT,
  restored_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW nex.object_blob_history AS
  SELECT bucket, key, version_id, content_hash, size_bytes, mime_type,
         is_delete_marker, uploaded_at, uploaded_by, source_ref, custom
  FROM nex.object_blobs;

CREATE OR REPLACE FUNCTION nex.restore_bucket_pit(p_bucket TEXT, p_target_ts TIMESTAMPTZ, p_actor TEXT)
RETURNS TABLE(bucket TEXT, key TEXT, action TEXT, restored_from TEXT) LANGUAGE plpgsql AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT bucket, key FROM nex.object_blobs WHERE bucket = p_bucket
  LOOP
    -- newest non-delete-marker at or before p_target_ts
    WITH candidate AS (
      SELECT version_id
      FROM nex.object_blobs
      WHERE bucket = rec.bucket AND key = rec.key
        AND uploaded_at <= p_target_ts
        AND NOT is_delete_marker
      ORDER BY uploaded_at DESC
      LIMIT 1
    )
    UPDATE nex.object_blob_current oc
    SET version_id = c.version_id, updated_at = NOW(), is_delete_marker = FALSE
    FROM candidate c
    WHERE oc.bucket = rec.bucket AND oc.key = rec.key;
    -- audit row (both restored and skipped)
    INSERT INTO nex.object_blob_pit_restore (bucket, key, target_ts, restored_from, restored_by)
    SELECT rec.bucket, rec.key, p_target_ts, c.version_id, p_actor
    FROM candidate c;
    RETURN QUERY SELECT rec.bucket, rec.key, 'restored'::TEXT, c.version_id
                 FROM candidate c;
  END LOOP;
END $$;
```

---

## Adapter code changes (draft only)

`src/lib/nex/storage/adapters/object-postgres.ts::delete()` gains one line:

```ts
// D2/F15 pattern · hard delete is soft-delete + pending-hard-delete-at
if (options?.hard) {
  const days = Number(process.env.NEX_OBJECT_HARD_DELETE_DELAY_DAYS ?? "30");
  await c.query(
    `UPDATE nex.object_blobs SET is_delete_marker = TRUE, pending_hard_delete_at = NOW() + ($1 || ' days')::INTERVAL
     WHERE bucket = $2 AND key = $3`,
    [days, bucket, key],
  );
  return;
}
```

New sweeper: `scripts/sweep-object-storage-hard-deletes.mjs` (runs daily), issues:

```sql
DELETE FROM nex.object_blobs
WHERE pending_hard_delete_at IS NOT NULL AND pending_hard_delete_at <= NOW();
```

Then vacuums the table.

---

## Roll-out plan (all 🔴 · authorisation required per step)

1. Philip authorises `048_object_storage_pitr.sql` migration → I apply to local Postgres.
2. Ship adapter code change (delete → deferred hard delete). Local tests + prod-smoke.
3. Land sweeper script. Add cron entry (`0 4 * * *`).
4. Extend storage-unreachable runbook with the PIT-restore procedure.
5. After 7-day stability, publish "how to recover a deleted object" doc externally to trades team.

## Non-goals

- Replicating bytes off-cluster. If we want cross-region redundancy, that's a separate design (external adapter — R2 / S3).
- Full DB-level PITR. Postgres backup posture (managed provider or wal-g / pgbackrest on self-hosted) is orthogonal and complements this.
- Replacing `object_manifest`. Manifest continues to be the index; this doc is about the storage plane.
