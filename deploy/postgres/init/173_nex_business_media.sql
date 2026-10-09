-- 173_nex_business_media.sql
--
-- NEX Directory Canonical Spine · migration 8 of 12 · universal media.
-- Phase 1 of the N=7-primitive architecture (founder-sealed 2026-10-07,
-- Phase-1 build authorised 2026-10-09).
--
-- Primitive 4 of the sealed 7-primitive spine.
--
-- WHAT THIS MIGRATION DOES
--   Creates `nex.business_media` — the universal media table keyed on
--   `canonical_business_id` with per-row source attribution via FK to
--   `nex.source_registry`. One row per (canonical, media_kind, source)
--   tuple.
--
--   This is the sealed replacement for the polymorphic
--   `nex.business_image` (migration 080) which keyed on
--   (business_type, business_country, business_ref) and lacked a
--   FK into the sealed source_registry.
--
-- SWAP STRATEGY (NOT this migration)
--   · This migration CREATES `nex.business_media` side-by-side with
--     `nex.business_image`. It does NOT drop or ALTER the old table.
--   · A future, separately authorised swap wave will:
--       1. Backfill `nex.business_media` from `nex.business_image`
--          (via the resolver that knows the canonical for each legacy
--          (business_type, business_country, business_ref) tuple).
--       2. Cut over the image resolver in the Directory service
--          (`src/lib/nex-native/directory/`) to read `business_media`.
--       3. Mark `nex.business_image` as DEPRECATED (header comment).
--       4. Optionally DROP `nex.business_image` after a soaking period.
--   · THIS migration never touches `nex.business_image`. The two live
--     in parallel until the swap wave authorises the cutover.
--
-- SEALED MEDIA KINDS (4 values)
--   owner_image         — uploaded by the business owner (ADR + migration 080)
--   verified_real       — Walker/discovery acquired, confidence-threshold passed
--   crowdsourced        — User upload (not from owner, not from walker; e.g. visitor photo)
--   category_fallback   — Generic category image · NEVER represents the specific business
--
-- APPROVAL GATES (mirrors 080)
--   `owner_approved` — the owner has signed off on this specific image.
--                      Relevant only to owner_image rows.
--   `approved`       — the system approval that must be TRUE before the
--                      row is renderable. Mechanical publication for
--                      verified_real (confidence ≥ 0.95); explicit
--                      owner sign-off for owner_image; admin review
--                      for crowdsourced; always TRUE for category_fallback.
--
-- INDEXING
--   The hot read path is "what media should I render for canonical X?"
--   → one row per media_kind sorted by the sealed precedence
--   (owner_image > verified_real > crowdsourced > category_fallback).
--
-- IDEMPOTENCE
--   CREATE TABLE IF NOT EXISTS. CREATE INDEX IF NOT EXISTS.
--   No DML. Safe to re-run.
--
-- ROLLBACK
--   DROP TABLE nex.business_media;
--   (No FKs point AT this table yet.)
--
-- SAFE ON POPULATED DB
--   Yes. New table. Zero impact on nex.business_image, nex.media_object
--   (migration 118), or any current reader or writer.
--
-- WHAT THIS TABLE IS NOT
--   · Not a replacement for `nex.media_object` (migration 118) — that's
--     a general media envelope; business_media is specifically for
--     canonical-keyed, published business imagery.
--   · Not a bytes store. `storage_key` points at an external object
--     store (R2 / MinIO) that holds the actual bytes.
--   · Not a license registry. `nex.license_registry` remains deferred
--     per migration 166. For now, license information flows via the
--     cited source_registry row's attribution_template + attribution_required.
--
-- DEPLOYMENT PREREQUISITES
--   · nex.business_canonical: migration 167.
--   · nex.source_registry: migration 166.
--   · gen_random_uuid(): PG 13+ pg_catalog.
--
-- NOT APPLIED
--   Phase 1 of the sealed architecture. MUST NOT be applied to any
--   live database without an explicit founder authorisation.

-- ═══════════════════════════════════════════════════════════════════
-- business_media — one row per (canonical, media_kind, source)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nex.business_media (
  media_id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical this media attests to.
  canonical_business_id     uuid         NOT NULL,

  -- Sealed 4-value media kind.
  media_kind                text         NOT NULL,

  -- Source attribution · FK into nex.source_registry (migration 166).
  -- Required even for owner_image (source_id = 'owner_upload').
  source_id                 text         NOT NULL,

  -- Object-store pointer. Opaque identifier the storage layer resolves.
  -- NOT a public URL · the Directory service builds URLs by signing or
  -- CDN-prefixing this key at render time.
  storage_key               text         NOT NULL,

  -- MIME type · 'image/jpeg', 'image/png', 'image/webp', etc.
  mime_type                 text         NOT NULL,

  -- Pixel dimensions · NULL until the storage layer probes the object.
  width_px                  integer      NULL,
  height_px                 integer      NULL,

  -- SHA-256 content hash of the stored bytes · for dedup + integrity.
  content_sha256            text         NULL,

  -- Discovery confidence 0..1 · relevant to verified_real rows (sealed
  -- auto-publish threshold ≥ 0.95 per Universal Image Doctrine).
  confidence                numeric      NULL,

  -- CATEGORY_FALLBACK metadata · the canonical category_id this
  -- fallback image belongs to. NULL except for media_kind = 'category_fallback'.
  fallback_category         text         NULL,

  -- Approval gates (same semantics as migration 080).
  owner_approved            boolean      NOT NULL DEFAULT false,
  approved                  boolean      NOT NULL DEFAULT false,

  -- Record lineage.
  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),

  -- ─────────────── CHECKs ────────────────────────────────────────

  CONSTRAINT ck_bm_media_kind CHECK (media_kind IN (
    'owner_image',
    'verified_real',
    'crowdsourced',
    'category_fallback'
  )),

  CONSTRAINT ck_bm_mime_type_nonblank CHECK (
    length(trim(mime_type)) > 0
  ),

  CONSTRAINT ck_bm_storage_key_nonblank CHECK (
    length(trim(storage_key)) > 0
  ),

  CONSTRAINT ck_bm_dimensions_positive CHECK (
    (width_px IS NULL OR width_px > 0)
    AND (height_px IS NULL OR height_px > 0)
  ),

  CONSTRAINT ck_bm_content_sha256_fmt CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$'
  ),

  CONSTRAINT ck_bm_confidence_range CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),

  -- fallback_category is required for category_fallback rows AND
  -- forbidden for every other kind.
  CONSTRAINT ck_bm_fallback_category_consistency CHECK (
    (media_kind = 'category_fallback' AND fallback_category IS NOT NULL)
    OR
    (media_kind <> 'category_fallback' AND fallback_category IS NULL)
  ),

  -- ─────────────── FKs ──────────────────────────────────────────

  CONSTRAINT fk_bm_canonical_business
    FOREIGN KEY (canonical_business_id)
    REFERENCES nex.business_canonical (canonical_business_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_bm_source
    FOREIGN KEY (source_id)
    REFERENCES nex.source_registry (source_id)
    ON DELETE RESTRICT,

  -- ─────────────── UNIQUE ──────────────────────────────────────
  -- One row per (canonical, kind, source) · owner_image + verified_real
  -- can coexist from different sources; the resolver chooses precedence.
  CONSTRAINT uq_bm_canonical_kind_source UNIQUE
    (canonical_business_id, media_kind, source_id)
);

-- ─────────────── Indexes ──────────────────────────────────────

-- "What media should I render for canonical X?" · hot read path.
CREATE INDEX IF NOT EXISTS idx_bm_canonical_kind
  ON nex.business_media (canonical_business_id, media_kind)
  WHERE approved = true;

-- "Which media rows came from this source?" · attribution + source
-- policy audit.
CREATE INDEX IF NOT EXISTS idx_bm_source
  ON nex.business_media (source_id);

-- Content dedup lookup.
CREATE INDEX IF NOT EXISTS idx_bm_content_sha256
  ON nex.business_media (content_sha256)
  WHERE content_sha256 IS NOT NULL;

-- "Pending approval" admin queue.
CREATE INDEX IF NOT EXISTS idx_bm_pending_approval
  ON nex.business_media (created_at DESC)
  WHERE approved = false;

-- ─────────────── Documentation ──────────────────────────────────

COMMENT ON TABLE nex.business_media IS
  'Sealed primitive 4 of the NEX Directory canonical spine. One row per (canonical_business_id, media_kind, source_id). Succeeds nex.business_image (migration 080) side-by-side; the two coexist until a separately authorised swap wave cuts over the image resolver.';

COMMENT ON COLUMN nex.business_media.media_kind IS
  'owner_image > verified_real > crowdsourced > category_fallback. Sealed by Universal Image Doctrine. CATEGORY_FALLBACK NEVER represents the specific business.';

COMMENT ON COLUMN nex.business_media.source_id IS
  'FK into nex.source_registry (migration 166). All attribution flows from this row (attribution_required + attribution_template on the registry row).';

COMMENT ON COLUMN nex.business_media.storage_key IS
  'Opaque pointer into the object store (R2 / MinIO). NOT a public URL; the Directory service builds signed/CDN URLs from this key at render.';

COMMENT ON COLUMN nex.business_media.approved IS
  'System approval gate. verified_real: mechanical when confidence ≥ 0.95. owner_image: owner_approved flip. crowdsourced: admin review. category_fallback: TRUE on insert.';

-- ═══════════════════════════════════════════════════════════════════
-- End of migration 173.
--
-- Downstream (173 does NOT ship these):
--   · Backfill from nex.business_image → nex.business_media (requires
--     canonical_business_id to be populated on legacy *_business rows
--     via migration 169 + resolver backfill wave).
--   · Image resolver cutover in src/lib/nex-native/directory/.
--   · nex.business_image DEPRECATED header + eventual DROP (soaking
--     period required).
--   · nex.license_registry primitive (deferred per migration 166).
-- ═══════════════════════════════════════════════════════════════════
