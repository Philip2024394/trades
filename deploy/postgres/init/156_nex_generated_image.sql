-- 156_nex_generated_image.sql
--
-- Founder Phase 8 · P8-4 · Generated image provenance table.
--
-- Every image NEX generates gets one row here. Doctrine anchor:
-- "IMAGE GENERATION EXTRACTS INTENT · IMAGE OUTPUT NEVER ESTABLISHES TRUTH".
--
-- Row schema captures:
--   · what the user asked for (prompt)
--   · which provider + model produced the image (model_id · provider)
--   · deterministic hash of the bytes (content_hash · for de-dup)
--   · resolved seed (for reproducibility)
--   · safety verdict at generation time
--   · when it was generated
--   · conversation_id for context tracing
--
-- Row is append-only. Never mutated after write.

CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.generated_image (
  image_id             uuid        PRIMARY KEY,
  ref_id               text        NOT NULL,
  content_hash         text        NOT NULL,
  provider             text        NOT NULL,
  model_id             text        NOT NULL,
  prompt               text        NOT NULL,
  negative_prompt      text        NULL,
  width                integer     NOT NULL,
  height               integer     NOT NULL,
  seed                 bigint      NOT NULL,
  bytes                integer     NOT NULL,                 -- payload size
  mime_type            text        NOT NULL,
  safety_verdict       text        NOT NULL,                 -- clean | flagged | unknown
  conversation_id      text        NULL,
  generated_at         timestamptz NOT NULL DEFAULT now(),
  latency_ms           integer     NULL,
  CONSTRAINT generated_image_safety_bounds CHECK (safety_verdict IN ('clean','flagged','unknown'))
);

CREATE INDEX IF NOT EXISTS idx_nex_generated_image_recent
  ON nex.generated_image (generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_generated_image_conv
  ON nex.generated_image (conversation_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_generated_image_hash
  ON nex.generated_image (content_hash);
CREATE INDEX IF NOT EXISTS idx_nex_generated_image_ref
  ON nex.generated_image (ref_id);

COMMENT ON TABLE nex.generated_image IS
  'Founder Phase 8 · P8-4 · every image NEX generates. Doctrine: image output never establishes truth. Rows append-only.';
