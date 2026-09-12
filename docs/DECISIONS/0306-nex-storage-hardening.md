# ADR-0306 · NEX Storage Hardening

**Status:** proposed · 2026-09-10
**Depends on:** ADR-0304 (Lab), ADR-0305 (IG enrichment)

## Context

Founder ask 2026-09-10: harden the storage layer so NEX is production-safe.
Five recommendations were on the table:

1. Keep Postgres as primary DB (already true)
2. SQLite hot-tier cache for sub-1ms client reads
3. Nightly pg_dump to MinIO
4. Encrypt Postgres data directory (Windows BitLocker or TDE)
5. Read replica plan

This ADR documents what's been shipped, what's operator-work, and what's deferred.

## Decision

| # | Item                        | Status                         | Where                                                                                                 |
| - | --------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 1 | Postgres primary            | ✅ live                        | `postgresql://localhost:5433/nex_dev` · pool max 20 · pg 17                                            |
| 2 | SQLite hot-tier cache       | 🕓 **deferred**                | `better-sqlite3` needs Windows build tools · founder decision needed on complexity                     |
| 3 | Nightly pg_dump → MinIO     | ✅ shipped                     | `scripts/nex-pg-backup.mjs` · runs via `NEX-Nightly-PG-Backup` scheduled task (2 am daily)             |
| 4 | Data-at-rest encryption     | 🛠 **operator task** (docs below) | Windows BitLocker · one-time setup by founder                                                       |
| 5 | Read replica                | 🛠 **operator task** (docs below) | Postgres streaming replication · needed when read load exceeds 1k qps · not yet                     |

## Item 3 · Nightly backup — SHIPPED

- **Script:** `scripts/nex-pg-backup.mjs`
- **Wrapper:** `scripts/_wrappers/run-nex-pg-backup.cmd`
- **Schedule:** every 24h via `NEX-Nightly-PG-Backup`
- **Format:** `pg_dump -Fc` (compressed custom format · restorable via `pg_restore`)
- **Local path:** `data/nex-backups/nex_dev_<ISO>.dump`
- **MinIO upload:** best-effort via `mc` CLI (falls back to local-only if `mc` not installed)
- **Retention:** local files pruned after 7 days
- **Provenance:** SHA256 checksum + size logged to `nex.founder_window_event` (kind=knowledge_stored)

**To enable MinIO upload:**
1. Install MinIO Client: `winget install MinIO.Client` (installs `mc.exe`)
2. Set env vars in `.env.local`:
   ```
   MINIO_ENDPOINT=http://localhost:9000
   MINIO_ACCESS_KEY=<your-minio-access-key>
   MINIO_SECRET_KEY=<your-minio-secret-key>
   ```
3. Backup will auto-upload to `s3://nex-backups/daily/<ISO>.dump`

**Verify a backup restores:**
```powershell
& "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" --list "data\nex-backups\nex_dev_<ISO>.dump" | Select-Object -First 20
```

## Item 4 · Data-at-rest encryption — OPERATOR TASK

Recommended: **Windows BitLocker on the Postgres data volume.** This is the
simplest robust approach — no Postgres TDE overhead, no per-column encryption
complexity, hardware-accelerated on modern CPUs.

**Setup (one-time, founder):**
1. Identify the Postgres data drive:
   ```powershell
   Get-Service postgresql-x64-17 | Select-Object Name, DisplayName
   # Then check the service's data-directory registry key:
   Get-ItemProperty "HKLM:\SOFTWARE\PostgreSQL\Installations\postgresql-x64-17"
   # DataDirectory is typically C:\Program Files\PostgreSQL\17\data
   ```
2. Enable BitLocker on the volume containing that directory:
   ```powershell
   # Interactive · founder chooses recovery key destination (USB or Microsoft account)
   manage-bde -on C: -RecoveryPassword
   ```
3. Verify:
   ```powershell
   manage-bde -status C:
   ```
4. Store recovery key offline (paper, safe, or hardware token). If lost, data is unrecoverable — that's the point.

**Why not Postgres TDE:**
- Postgres has no built-in TDE (Transparent Data Encryption)
- Extensions like `pgcrypto` encrypt columns, not files — different threat model
- BitLocker encrypts the whole volume at kernel level · zero application overhead · protects against physical theft
- Application-level column encryption remains available for PII fields (add per column as needed)

## Item 5 · Read replica — OPERATOR TASK (deferred until scale demands)

Not needed until:
- Concurrent Postgres connections > 15 (currently ~3)
- Read queries per second > 1000 (currently ~10)
- Any single query blocks writes for > 500 ms

**When triggered:** Postgres native streaming replication:

1. On primary (`postgresql.conf`):
   ```
   wal_level = replica
   max_wal_senders = 5
   wal_keep_size = 1024MB
   ```
2. On primary (`pg_hba.conf`):
   ```
   host replication replica_user <replica-ip>/32 scram-sha-256
   ```
3. On replica host: `pg_basebackup -h <primary> -U replica_user -D /var/lib/postgresql/17/data -R`
4. Application routes: reads → replica endpoint via `NEX_POSTGRES_READ_URL` (new env var, code change ~1 file)

## Item 2 · SQLite hot-tier cache — DEFERRED

**Why:** `better-sqlite3` requires MSVC build tools on Windows (Node.js
native compilation). Adds ~3GB installer + non-trivial setup. The founder
asked me to skip this to focus on higher-ROI work (lead generation +
Founder's Window).

**Alternative already in play:** the in-memory hot-tier from ADR-0304
(hot-tier-facts.ts) serves the sub-1ms read case for accommodation facts.
This is a language-level cache, no DB dependency.

**If SQLite becomes needed:** revive this via own BEGIN — the migration
takes ~1 hour once build tools land.
