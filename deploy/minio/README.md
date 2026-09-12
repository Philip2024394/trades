# NEX Object Storage · MinIO

**Founder 2026-09-10** · Self-hosted S3-compatible object storage. Zero third-party dependency.

## Access

- **S3 API endpoint**: `http://localhost:9000`
- **Web console**: `http://localhost:9001`
- **Access key**: `nex_admin`
- **Secret key**: `NexStorageRockSolid2026!!`

⚠️ Change the secret in production. Update:
1. `deploy/minio/start-minio.cmd` — `MINIO_ROOT_PASSWORD`
2. Any code using MinIO credentials (search: `MinIO_SECRET_KEY`)

## Buckets provisioned

| Bucket | Purpose (per ADR-0301) |
|---|---|
| `nex-notebook-receipts` | Homeowner receipt scans (private) |
| `nex-sitebook-cost-docs` | Cost documents PDF/JPG (private) |
| `nex-network-uploads` | Generic upload endpoint files |
| `nex-media-videos` | Video files from site editor (large) |
| `nex-backups` | ZIP snapshots + pg_dump archives |

## Operations

**Start manually:**
```
deploy\minio\start-minio.cmd
```

**Verify listening:**
```powershell
Get-NetTCPConnection -LocalPort 9000 -State Listen
```

**Windows Scheduled Task:**
`NEX-MinIO-Server` — fires on user logon AND hourly. Idempotent (NOOP if already listening).

**Data location:**
`deploy/minio/data/` — each bucket lives in its own subfolder.

**Logs:**
- `deploy/minio/minio-server.log` — stdout
- `deploy/minio/minio-server.log.err` — stderr

## Migration from Supabase Storage

Per ADR-0301, run this once per bucket to backfill historical files:
```bash
# TODO: script needed — list Supabase objects, download, upload to MinIO
node scripts/nex-migrate-supabase-storage.mjs --bucket sitebook-cost-documents
```

Until that script ships, new uploads go to MinIO (via adapter — TBD), old files stay on Supabase Storage.

## Uptime discipline

- Windows Task hourly re-launches if crashed
- Data persists on local disk (`deploy/minio/data/`)
- Backup discipline: `pg_dump | gzip > deploy/minio/data/nex-backups/pg-YYYYMMDD.sql.gz` daily
- Monthly restore drill: verify a bucket file can be downloaded end-to-end

## Verification

Bucket list check (no external SDK required):
```bash
node -e "..." # (see scripts/nex-postgres-parity-check.mjs for signing pattern)
```

Live-tested 2026-09-10:
- 5 buckets created via S3 API PUT
- List returned all 5
- Server RELEASE.2025-09-07T16-13-09Z
