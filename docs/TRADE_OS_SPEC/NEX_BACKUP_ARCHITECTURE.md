# Nex Brain — Backup & Restore Architecture

Enterprise disaster-recovery for the knowledge platform. Purpose: The
Nex knowledge base is the company's biggest long-term asset. If
Supabase disappears tomorrow, the platform must be reconstructable
from local ZIP files.

**Design principles (enforced by code, not documentation):**

1. **Portable** — the whole brain fits in one ZIP. Copy to USB, cloud, external drive.
2. **Verifiable offline** — SHA-256 checksum per file inside the manifest. Anyone can verify without Supabase.
3. **Incremental by default** — daily backups only export changes since the last one. Full backups on Sundays.
4. **Versioned format** — `NEX_BACKUP_FORMAT_VERSION` in every manifest; restore refuses incompatible ZIPs.
5. **Never destructive** — restore is additive-by-default. Content-immutable tables (entries) get insert-only-if-missing to protect existing knowledge from being silently downgraded.
6. **Auto pre-snapshot** — every restore takes a `pre_restore_snapshot` first. Cannot be skipped.
7. **Audited** — every action lands in `hammerex_nex_backup_audit` (append-only trigger).

---

## Data model

| Table | Purpose |
|---|---|
| `hammerex_nex_backup_runs` | Every backup ever produced. Includes storage path + manifest + checkpoint. |
| `hammerex_nex_restore_attempts` | Every restore attempt (successful or not). Links to the pre-snapshot it took. |
| `hammerex_nex_backup_audit` | Append-only log of every backup/restore action. Trigger blocks UPDATE + DELETE. |

Storage bucket: `nex-backups` (private, service-role only). Path scheme:
`YYYY/MM/backup-<uuid>.zip`. Signed URLs for admin download expire in 5 minutes.

## Backup ZIP structure

```
NEX_BACKUP/
├── database/
│   ├── knowledge_entries.json
│   ├── versions.json
│   ├── graph_edges.json
│   ├── reviews.json
│   ├── teaching_uploads.json
│   └── research_reports.json
├── metadata/
│   ├── backup_manifest.json     ← source of truth (manifest + checksums)
│   ├── system_version.json
│   └── checkpoint.json
└── restore_instructions.md      ← human-readable, offline
```

Every file listed in `metadata/backup_manifest.json.integrity` must
match its SHA-256 + size at restore time. Any mismatch = restore
refuses.

## Manifest (`metadata/backup_manifest.json`)

```json
{
  "format_version":    "1.0.0",
  "backup_id":         "UUID",
  "kind":              "full" | "incremental" | "pre_restore_snapshot",
  "base_backup_id":    "UUID or null",
  "created_at":        "ISO",
  "created_by":        "admin id or 'cron'",
  "db_schema_version": "20260722680000",
  "record_counts":     { "entries": N, "versions": N, ... },
  "integrity":         { "database/knowledge_entries.json": { "sha256": "...", "size_bytes": N }, ... },
  "checkpoint":        { "entries": "ISO", "versions": "ISO", ... }
}
```

## Incremental strategy

Each backup records a **checkpoint** = MAX timestamp column per table
at backup time. The next incremental exports rows where the timestamp
column is `>` the previous checkpoint.

`readLastCheckpoint()` reads the most recent completed backup's
`checkpoint_json`. Full backups skip this and export everything.

## Restore lifecycle

```
[admin uploads ZIP]
    ↓
validateAndPreview()
├─ parse ZIP → { path → Buffer } map
├─ read metadata/backup_manifest.json
├─ verify format_version compatible
├─ verify SHA-256 + size for every file listed
├─ diff each table's rows against current DB
├─ stash ZIP into storage under restore-stash/
└─ insert restore_attempts row (status='previewed')
    ↓
[admin reads preview, hits Execute]
    ↓
executeRestore()
├─ createBackup({ kind: 'pre_restore_snapshot' })  ← MANDATORY
├─ pull stashed ZIP
├─ per table: upsert (or insert-only for content-immutable)
├─ record inserted/updated/skipped/failed counts
├─ audit the restore
└─ clean up stash
```

## Content-immutable protection

`hammerex_nex_knowledge_entries` is protected by the silent-edit
trigger (see `KNOWLEDGE_ARCHITECTURE.md`). Restore respects this by
inserting only rows that don't already exist. Existing entries are
NOT downgraded to backup versions — anyone who wants that must
explicitly delete then restore, which is out of scope for the safe
default.

Versions table is append-only; restore uses `insert ... ignoreDuplicates: true` so replayed backups don't reject.

## API surface

| Route | Purpose |
|---|---|
| `GET  /api/admin/nex/backup/list` | dashboard data |
| `POST /api/admin/nex/backup/run` | `{ kind: "full"|"incremental" }` |
| `GET  /api/admin/nex/backup/[id]/download` | signed URL (5-min expiry) |
| `POST /api/admin/nex/backup/restore/upload` | multipart ZIP → validate + preview |
| `POST /api/admin/nex/backup/restore/execute` | `{ attempt_id, confirm: true }` — never runs without `confirm: true` |
| `GET  /api/cron/nex-backup-daily` | secret-gated, full on Sundays, incremental otherwise, dedup per day |

## Automation

`vercel.json` (or equivalent) points a daily cron at
`/api/cron/nex-backup-daily` with `x-cron-secret: <CRON_SECRET>`.
The endpoint is idempotent within a UTC day.

Weekly full backup lands on Sunday; incrementals through the week.
Roughly 6 files per week retained forever (until admin deletes).

## Disaster recovery drill

1. Sign into a fresh Supabase project.
2. Apply migrations up to `20260722680000_nex_backup_runs.sql`.
3. Open Admin → Nex → Backup.
4. Upload the most recent full backup ZIP. Validate + preview.
5. Execute restore. Pre-restore snapshot is auto-taken (empty since new DB).
6. Verify counts match `record_counts` in the manifest.
7. For every incremental backup taken after that full, upload + restore in date order.

Nothing in this process requires the original Supabase project or the
original OpenAI/Anthropic keys. The knowledge is portable.

## What's shipped vs deferred

**Shipped this pass:**
- Full + incremental + pre-restore snapshot kinds
- SHA-256 integrity for every file
- Storage bucket with signed download URLs
- Validate + preview + execute restore flow
- Automatic pre-restore snapshot
- Append-only audit trigger
- Admin dashboard (latest backup + create + download + restore)
- Daily cron endpoint (dedup + full-on-Sunday)
- 84 passing tests including integrity helpers + table ordering

**Deferred (documented):**
- Teaching-upload file bytes are not currently included in the ZIP — DB rows (with storage paths) are backed up, so pointers survive. Streaming actual bytes into the ZIP is a follow-up when needed.
- Selective restore (pick which tables) — MVP is all-or-nothing.
- Encryption at rest inside the ZIP — bucket is already private + signed-URL only. Adding merchant-managed passphrase encryption is optional pass 2.
- Compressed diff format for very large incrementals — JSON with tsvector rows fits comfortably today.

## Guardrails you cannot bypass

1. Restore refuses without `confirm: true` (never one-click).
2. Restore always takes a pre-restore snapshot first.
3. Restore refuses if any file's SHA-256 mismatches the manifest.
4. Restore refuses if `format_version` doesn't match the running code.
5. Content-immutable tables (`hammerex_nex_knowledge_entries`) are never silently overwritten by restore.
6. Every backup + restore action lands in the append-only audit log.
