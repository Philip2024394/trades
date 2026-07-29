-- 20260728230000_nex_materials_memory_library_slug.sql
-- NEX Materials Memory · add library_slug provenance column
-- (Philip 2026-07-28 · corrected architecture)
--
-- The Materials Library is FILE-BASED (git-versioned JSON under
-- `data/materials/**/*.json`), NOT a database table. It is slowly-
-- changing reference knowledge, product-authored, shared across all
-- installations — the same shape as Reference Brains, one layer down.
--
-- We still want per-Memory provenance ("this row was imported from
-- Library slug X"), so this migration adds a plain-text `library_slug`
-- column with NO foreign key (there's no table to reference).
-- The Library service resolves the slug against on-disk JSON.
--
-- Additive · zero touched columns · safe to apply after
-- 20260728220000_nex_materials_memory.sql.

ALTER TABLE public.nex_materials_memory
  ADD COLUMN IF NOT EXISTS library_slug text NULL;

CREATE INDEX IF NOT EXISTS ix_nex_materials_memory_library_slug
  ON public.nex_materials_memory(library_slug) WHERE library_slug IS NOT NULL;

COMMENT ON COLUMN public.nex_materials_memory.library_slug IS
  'Provenance · when set, this Memory row was imported from the file-based Materials Library (data/materials/**/*.json) with this slug. Plain text, no FK — the Library lives in git, not the database.';
