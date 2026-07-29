-- 20260728220000_nex_materials_memory.sql
-- NEX Materials · Materials Memory (Philip 2026-07-28)
--
-- Additive · per-owner knowledge layer distinct from Stock (which is
-- transactional). Materials Memory stores what the company understands
-- about its own products: canonical name, category, species, default
-- dimensions, preferred supplier, typical grade, synonyms.
--
-- Zero modifications to any existing nex_materials_* table. This
-- migration adds ONE table + supporting indexes + a trigram extension
-- for fuzzy-match lookup ("oak flooring" → "European Oak Flooring
-- Boards"). All lookups scope by owner_id.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.nex_materials_memory (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                 text          NOT NULL,
  name                     text          NOT NULL,
  category                 text          NOT NULL,
    -- hardwood · softwood · sheet · stair_part · consumable · hardware · finish · other
  species_id               text          NULL REFERENCES public.nex_materials_species(id) ON DELETE SET NULL,
  default_length_mm        integer       NULL,
  default_width_mm         integer       NULL,
  default_thickness_mm     integer       NULL,
  default_unit             text          NOT NULL DEFAULT 'board',
    -- board · sheet · length · unit · pack · linear_metre · litre · kg
  typical_grade            text          NULL,
  preferred_supplier_id    uuid          NULL REFERENCES public.nex_materials_suppliers(id) ON DELETE SET NULL,
  typical_price_per_unit   numeric(12,2) NULL,
  price_currency           text          NOT NULL DEFAULT 'GBP',
  notes                    text          NULL,
  synonyms                 text[]        NOT NULL DEFAULT '{}',
  usage_count              integer       NOT NULL DEFAULT 0,
  last_used_at             timestamptz   NULL,
  created_by               text          NOT NULL,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now(),
  deleted_at               timestamptz   NULL,

  CONSTRAINT nex_materials_memory_category_valid CHECK (category IN
    ('hardwood', 'softwood', 'sheet', 'stair_part', 'consumable', 'hardware', 'finish', 'other'))
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_memory_owner
  ON public.nex_materials_memory(owner_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_nex_materials_memory_synonyms
  ON public.nex_materials_memory USING GIN (synonyms);

CREATE INDEX IF NOT EXISTS ix_nex_materials_memory_name_trgm
  ON public.nex_materials_memory USING gin (name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_memory_owner_name
  ON public.nex_materials_memory(owner_id, lower(name)) WHERE deleted_at IS NULL;

-- Touch trigger — reuses the function from the base Materials migration
DROP TRIGGER IF EXISTS trg_nex_materials_memory_touch ON public.nex_materials_memory;
CREATE TRIGGER trg_nex_materials_memory_touch BEFORE UPDATE ON public.nex_materials_memory
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_materials_updated_at();

-- RLS
ALTER TABLE public.nex_materials_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON public.nex_materials_memory;
CREATE POLICY "service_role_all" ON public.nex_materials_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.nex_materials_memory IS
  'Materials Memory · per-owner knowledge layer distinct from Stock. Stores canonical materials the company works with · default dimensions · synonyms for fuzzy match · Philip 2026-07-28.';
COMMENT ON COLUMN public.nex_materials_memory.synonyms IS
  'Free-text synonyms owner records so NEX can resolve "Oak Flooring" or "Flooring Oak" to the same material.';
COMMENT ON COLUMN public.nex_materials_memory.usage_count IS
  'Incremented every time NEX resolves this Memory item to answer a workflow — informs recency-weighted matching.';
