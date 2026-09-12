# ADR-0301 — NEX Image + File Storage Migration Off Supabase

**Founder Mission (2026-09-10):** Move image storage off Supabase. "Full world class system."

**Status:** BLUEPRINT · execution requires MinIO deploy + per-bucket migration scripts.
**Author:** Master AI Engineer

---

## 1. Current Supabase Storage inventory (10 buckets)

| Bucket | Purpose | Approx. usage |
|---|---|---|
| `nex-teaching` | NEX teaching materials + brain seeds | small |
| `notebook-receipts` | Homeowner receipt scans | growing |
| `sitebook-cost-documents` | Homeowner cost docs (PDF/JPG) | growing |
| `sitebook-photos` | Homeowner project photos | growing |
| `social-media` | Site editor + video output | large |
| `network-uploads` | General upload endpoint | large |
| `product-images` | Merchant products + affiliates + videos | large |
| `template-thumbnails` | Admin site-editor thumbnails | small |
| `bg-removal-output` | Background-removed images | small |
| `nex-backup` | ZIP snapshots (rotating) | very large |

---

## 2. Target architecture

**Two-tier own-storage:**
1. **ImageKit** (already integrated) — public images, thumbnails, transforms, CDN delivery
2. **MinIO self-hosted** — private files, PDFs, videos, backups (S3-compatible, Docker container)

**Both eliminate Supabase Storage dependency.** ImageKit already handles image transforms (better than Supabase Storage) and CDN. MinIO handles the rest at zero recurring cost.

---

## 3. Migration path per bucket

| Bucket | Target | Reason |
|---|---|---|
| `nex-teaching` | ImageKit | small, public-ok, benefits from CDN |
| `notebook-receipts` | MinIO (private) | personal financial docs, must stay private |
| `sitebook-cost-documents` | MinIO (private) | same |
| `sitebook-photos` | ImageKit (with signed URLs) | benefits from image transforms |
| `social-media` | ImageKit (images) + MinIO (videos) | mixed content |
| `network-uploads` | MinIO | generic files |
| `product-images` | ImageKit | product photos, CDN critical |
| `template-thumbnails` | ImageKit | small, public |
| `bg-removal-output` | ImageKit | processed images |
| `nex-backup` | MinIO with lifecycle rule (90-day expiry) | backup archive |

---

## 4. Migration execution plan

### Phase 1 · MinIO deployment (Day 1)
```yaml
# deploy/minio/docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    volumes:
      - ./data:/data
    environment:
      MINIO_ROOT_USER: nex_admin
      MINIO_ROOT_PASSWORD: <generate secure>
    command: server /data --console-address ":9001"
```

Create 5 MinIO buckets (private): `nex-notebook-receipts`, `nex-sitebook-cost-docs`, `nex-network-uploads`, `nex-media-videos`, `nex-backups`.

### Phase 2 · Adapter layer (Days 2-3)
Wrap current `supabaseAdmin.storage.from(BUCKET)` calls in a `nexStorage(bucket, kind)` factory that:
- Routes image kinds → ImageKit uploader
- Routes private/file kinds → MinIO S3 SDK
- Preserves the same interface (`upload`, `download`, `remove`, `getPublicUrl`)

One file to edit: `src/lib/nex/storage/adapter.ts` (new). Every existing `storage.from(...)` call gets rewritten to `nexStorage(...)`.

### Phase 3 · Dual-write (Days 4-7)
Every upload writes to Supabase AND own storage. Reads still from Supabase. Parity checker verifies file counts nightly.

### Phase 4 · Dual-read → cutover (Days 8-14)
Flip reads to own storage. Writes still dual. After 7 days validation with zero drift, disable Supabase Storage.

### Phase 5 · Data backfill (Days 15-18)
Bulk migrate historical files from Supabase Storage to own storage. Use Supabase's `listObjects` + `download` + upload to target.

---

## 5. Rollback strategy

- Supabase Storage kept read-only for 90 days after cutover
- Adapter has `NEX_STORAGE_ROLLBACK=1` flag that flips reads back to Supabase
- Full backup ZIPs archived monthly to a separate offline location

---

## 6. Cost projection

| Component | Before (Supabase) | After (own) | Delta |
|---|---|---|---|
| Storage (100GB) | ~$20/mo | MinIO: $0 · ImageKit: existing plan | -$20/mo |
| Egress (500GB/mo) | ~$45/mo | ImageKit CDN included · MinIO: $0 local | -$45/mo |
| Transforms | Supabase image transform: included | ImageKit: existing plan | $0 |
| **Total savings** | | | **~$65/mo** |

---

## 7. Timeline

**18 days risk-neutral execution** (matching ADR-0300 Postgres migration cadence).

Start Day 1 = MinIO container up + Windows Task Scheduler entry for daily backup.
Deliver Day 18 = zero Supabase Storage calls in production, dashboard shows "Own storage: 100%".

---

## 8. Founder authorizations required

Before starting:
1. ✅ Storage migration authorization (in today's brief)
2. ⏳ MinIO ~10 GB disk allocation on Victus (already have ~7.5 GB free — need to identify a separate drive or clean space)
3. ⏳ ImageKit plan review (existing plan may need upgrade if bulk migration adds >10 GB of images)

---

## 9. Alternative: skip MinIO, go pure ImageKit

If MinIO ops burden is unwanted:
- ImageKit supports **private files** with signed URLs
- ImageKit supports **videos** (up to 100 MB per file)
- ImageKit supports **PDFs** and generic files

**Tradeoff:** All files leave the machine (not truly "own storage" per founder's brief) but zero ops burden.

**My recommendation:** MinIO for private + backup, ImageKit for public images. This aligns with the founder's "never rely on third party" principle for sensitive data.
