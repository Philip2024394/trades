-- 20260728150000_nex_materials.sql
-- NEX Materials Application Module · Hardwood Manager foundation
-- Philip 2026-07-28 · Application Module (NOT Reference Brain) per three-layer architecture
--
-- All tables prefixed `nex_materials_*` to signal Application Module (Layer 2)
-- distinctly from `hammerex_nex_brain_*` Reference Brain platform (Layer 1).
--
-- Design intent (per Philip's spec):
--   · Scale to millions of boards
--   · Normalised · no duplicated measurements
--   · Proper indexes
--   · Audit history via generic audit_log table
--   · Soft deletes via deleted_at
--   · Measurement versioning (never overwrite · always append)
--   · Provider-agnostic where possible (species table extensible for future materials)
--   · Worker link surface = separate token-authenticated write path

-- ─── Reference / catalogue tables ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_species (
  id                text          PRIMARY KEY,       -- e.g. 'oak_american_white', 'ash', 'walnut_european'
  display_name      text          NOT NULL,
  category          text          NOT NULL,          -- hardwood · softwood · engineered · glass · metal · etc.
  density_kg_m3     numeric(6,1)  NULL,
  janka_hardness_lbf integer       NULL,
  notes             text          NULL,
  active            boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_species_category
  ON public.nex_materials_species(category) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.nex_materials_suppliers (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text          NOT NULL,
  contact_email     text          NULL,
  contact_phone     text          NULL,
  notes             text          NULL,
  owner_id          text          NOT NULL,          -- links to hammerex_nex_users.email
  active            boolean       NOT NULL DEFAULT true,
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  deleted_at        timestamptz   NULL
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_suppliers_owner
  ON public.nex_materials_suppliers(owner_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_suppliers_owner_name
  ON public.nex_materials_suppliers(owner_id, name) WHERE deleted_at IS NULL;

-- ─── Hardwood packs ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_packs (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_ref              text          NOT NULL,       -- human ref e.g. 'PACK-2026-042'
  species_id            text          NOT NULL REFERENCES public.nex_materials_species(id),
  supplier_id           uuid          NULL REFERENCES public.nex_materials_suppliers(id) ON DELETE SET NULL,
  grade                 text          NULL,           -- prime · character · rustic · etc.
  board_count_expected  integer       NULL,           -- how many boards the pack should contain
  purchase_date         date          NULL,
  purchase_reference    text          NULL,           -- invoice / PO reference
  cost_at_purchase      numeric(12,2) NULL,           -- internal transactional data (Reference Brain no-prices rule does NOT apply here)
  cost_currency         text          NOT NULL DEFAULT 'GBP',
  notes                 text          NULL,
  status                text          NOT NULL DEFAULT 'pending',
    -- pending · measuring · complete · allocated · consumed · retired
  owner_id              text          NOT NULL,
  created_by            text          NOT NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  deleted_at            timestamptz   NULL,

  CONSTRAINT nex_materials_packs_status_valid CHECK (status IN
    ('pending', 'measuring', 'complete', 'allocated', 'consumed', 'retired'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_packs_owner_ref
  ON public.nex_materials_hardwood_packs(owner_id, pack_ref) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_packs_owner_status
  ON public.nex_materials_hardwood_packs(owner_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_packs_species
  ON public.nex_materials_hardwood_packs(species_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_packs_supplier
  ON public.nex_materials_hardwood_packs(supplier_id) WHERE deleted_at IS NULL;

-- ─── Hardwood boards ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_boards (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id           uuid          NOT NULL REFERENCES public.nex_materials_hardwood_packs(id) ON DELETE CASCADE,
  board_ref         text          NOT NULL,           -- e.g. '17' or '3-17' unique within pack
  position_in_pack  integer       NOT NULL,           -- for sortable ordering
  status            text          NOT NULL DEFAULT 'awaiting_measurement',
    -- awaiting_measurement · measured · allocated · machined · installed · offcut · disposed
  current_measurement_id uuid     NULL,               -- FK added later after measurements table exists
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  deleted_at        timestamptz   NULL,

  CONSTRAINT nex_materials_boards_status_valid CHECK (status IN
    ('awaiting_measurement', 'measured', 'allocated', 'machined', 'installed', 'offcut', 'disposed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_boards_pack_ref
  ON public.nex_materials_hardwood_boards(pack_id, board_ref) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_boards_pack_status
  ON public.nex_materials_hardwood_boards(pack_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_boards_status
  ON public.nex_materials_hardwood_boards(status) WHERE deleted_at IS NULL;

-- ─── Board measurements (versioned · never overwritten) ─────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_board_measurements (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id              uuid          NOT NULL REFERENCES public.nex_materials_hardwood_boards(id) ON DELETE CASCADE,
  measurement_version   integer       NOT NULL,       -- auto-incremented per board
  is_current            boolean       NOT NULL DEFAULT true,
  length_mm             integer       NOT NULL,
  width_end_a_mm        integer       NOT NULL,
  width_centre_mm       integer       NOT NULL,
  width_end_b_mm        integer       NOT NULL,
  thickness_end_a_mm    integer       NOT NULL,
  thickness_centre_mm   integer       NOT NULL,
  thickness_end_b_mm    integer       NOT NULL,
  moisture_content_pct  numeric(4,1)  NULL,
  photo_url             text          NULL,
  notes                 text          NULL,
  measured_by_kind      text          NOT NULL,       -- 'user' | 'worker_link'
  measured_by_ref       text          NOT NULL,       -- user email OR worker_link.id
  measured_at           timestamptz   NOT NULL DEFAULT now(),
  created_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT nex_materials_meas_measured_by_kind_valid CHECK (measured_by_kind IN ('user', 'worker_link')),
  CONSTRAINT nex_materials_meas_dimensions_positive CHECK (
    length_mm > 0 AND width_end_a_mm > 0 AND width_centre_mm > 0 AND width_end_b_mm > 0 AND
    thickness_end_a_mm > 0 AND thickness_centre_mm > 0 AND thickness_end_b_mm > 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_meas_board_version
  ON public.nex_materials_hardwood_board_measurements(board_id, measurement_version);
CREATE INDEX IF NOT EXISTS ix_nex_materials_meas_board_current
  ON public.nex_materials_hardwood_board_measurements(board_id) WHERE is_current = true;

-- Now add the FK from boards.current_measurement_id → measurements.id
ALTER TABLE public.nex_materials_hardwood_boards
  ADD CONSTRAINT fk_nex_materials_boards_current_measurement
  FOREIGN KEY (current_measurement_id)
  REFERENCES public.nex_materials_hardwood_board_measurements(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ─── Board defects ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_board_defects (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      uuid          NOT NULL REFERENCES public.nex_materials_hardwood_boards(id) ON DELETE CASCADE,
  defect_type   text          NOT NULL,       -- knot · split · cup · twist · bow · sap · other
  severity      text          NOT NULL DEFAULT 'minor',    -- minor · moderate · severe
  location      text          NULL,           -- e.g. 'end A', 'centre'
  notes         text          NULL,
  observed_by_kind text       NOT NULL,       -- 'user' | 'worker_link'
  observed_by_ref  text       NOT NULL,
  observed_at   timestamptz   NOT NULL DEFAULT now(),
  created_at    timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT nex_materials_defects_type_valid CHECK (defect_type IN
    ('knot', 'split', 'cup', 'twist', 'bow', 'sap', 'other')),
  CONSTRAINT nex_materials_defects_severity_valid CHECK (severity IN
    ('minor', 'moderate', 'severe'))
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_defects_board
  ON public.nex_materials_hardwood_board_defects(board_id);
CREATE INDEX IF NOT EXISTS ix_nex_materials_defects_type
  ON public.nex_materials_hardwood_board_defects(defect_type);

-- ─── Worker links (token-authenticated write surface) ───────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_worker_links (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text          NOT NULL UNIQUE,        -- cryptographically-random URL-safe string
  pack_id       uuid          NOT NULL REFERENCES public.nex_materials_hardwood_packs(id) ON DELETE CASCADE,
  label         text          NULL,                    -- optional human label e.g. 'Steve · workshop'
  created_by    text          NOT NULL,               -- user email of owner/admin
  expires_at    timestamptz   NULL,
  revoked_at    timestamptz   NULL,
  revoke_reason text          NULL,
  max_uses      integer       NULL,
  current_uses  integer       NOT NULL DEFAULT 0,
  last_used_at  timestamptz   NULL,
  last_ip       text          NULL,
  last_user_agent text        NULL,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_worker_links_pack
  ON public.nex_materials_worker_links(pack_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_worker_links_token
  ON public.nex_materials_worker_links(token) WHERE revoked_at IS NULL;

-- ─── Allocations (board → project · with partial support) ───────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_allocations (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id            uuid          NOT NULL REFERENCES public.nex_materials_hardwood_boards(id) ON DELETE RESTRICT,
  project_ref         text          NOT NULL,       -- FK to future projects table · text for now
  portion_mm3         bigint        NULL,           -- NULL = whole board · else partial in mm³
  allocated_at        timestamptz   NOT NULL DEFAULT now(),
  allocated_by        text          NOT NULL,
  released_at         timestamptz   NULL,           -- when allocation is released (board returned)
  released_by         text          NULL,
  released_reason     text          NULL,
  notes               text          NULL
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_allocations_board
  ON public.nex_materials_hardwood_allocations(board_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_nex_materials_allocations_project
  ON public.nex_materials_hardwood_allocations(project_ref) WHERE released_at IS NULL;

-- ─── Offcuts (derived from partial board consumption) ───────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_hardwood_offcuts (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_board_id       uuid          NOT NULL REFERENCES public.nex_materials_hardwood_boards(id) ON DELETE CASCADE,
  offcut_ref            text          NOT NULL,
  length_mm             integer       NOT NULL,
  width_mm              integer       NOT NULL,
  thickness_mm          integer       NOT NULL,
  status                text          NOT NULL DEFAULT 'available',
    -- available · allocated · disposed
  created_from_measurement_id uuid    NULL REFERENCES public.nex_materials_hardwood_board_measurements(id) ON DELETE SET NULL,
  notes                 text          NULL,
  created_by            text          NOT NULL,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT nex_materials_offcuts_status_valid CHECK (status IN
    ('available', 'allocated', 'disposed')),
  CONSTRAINT nex_materials_offcuts_dimensions_positive CHECK (
    length_mm > 0 AND width_mm > 0 AND thickness_mm > 0
  )
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_offcuts_parent
  ON public.nex_materials_hardwood_offcuts(parent_board_id);
CREATE INDEX IF NOT EXISTS ix_nex_materials_offcuts_status
  ON public.nex_materials_hardwood_offcuts(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_nex_materials_offcuts_parent_ref
  ON public.nex_materials_hardwood_offcuts(parent_board_id, offcut_ref);

-- ─── Generic audit log (per Materials module) ───────────────────────

CREATE TABLE IF NOT EXISTS public.nex_materials_audit_log (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text          NOT NULL,       -- pack · board · measurement · allocation · worker_link · offcut · supplier
  entity_id     uuid          NOT NULL,
  event_type    text          NOT NULL,       -- created · updated · measured · allocated · released · revoked · deleted · ...
  actor_kind    text          NOT NULL,       -- user · worker_link · system
  actor_ref     text          NOT NULL,       -- user email OR worker_link.id OR 'system'
  before_json   jsonb         NULL,
  after_json    jsonb         NULL,
  metadata      jsonb         NOT NULL DEFAULT '{}'::jsonb,
  occurred_at   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT nex_materials_audit_actor_kind_valid CHECK (actor_kind IN ('user', 'worker_link', 'system'))
);

CREATE INDEX IF NOT EXISTS ix_nex_materials_audit_entity
  ON public.nex_materials_audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_nex_materials_audit_actor
  ON public.nex_materials_audit_log(actor_kind, actor_ref, occurred_at DESC);

-- ─── Updated_at triggers ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_nex_materials_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_materials_suppliers_touch ON public.nex_materials_suppliers;
CREATE TRIGGER trg_nex_materials_suppliers_touch BEFORE UPDATE ON public.nex_materials_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_materials_updated_at();

DROP TRIGGER IF EXISTS trg_nex_materials_packs_touch ON public.nex_materials_hardwood_packs;
CREATE TRIGGER trg_nex_materials_packs_touch BEFORE UPDATE ON public.nex_materials_hardwood_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_materials_updated_at();

DROP TRIGGER IF EXISTS trg_nex_materials_boards_touch ON public.nex_materials_hardwood_boards;
CREATE TRIGGER trg_nex_materials_boards_touch BEFORE UPDATE ON public.nex_materials_hardwood_boards
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_materials_updated_at();

DROP TRIGGER IF EXISTS trg_nex_materials_offcuts_touch ON public.nex_materials_hardwood_offcuts;
CREATE TRIGGER trg_nex_materials_offcuts_touch BEFORE UPDATE ON public.nex_materials_hardwood_offcuts
  FOR EACH ROW EXECUTE FUNCTION public.touch_nex_materials_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.nex_materials_species                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_suppliers                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_packs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_boards                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_board_measurements    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_board_defects         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_worker_links                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_allocations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_hardwood_offcuts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nex_materials_audit_log                      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'nex_materials_species',
    'nex_materials_suppliers',
    'nex_materials_hardwood_packs',
    'nex_materials_hardwood_boards',
    'nex_materials_hardwood_board_measurements',
    'nex_materials_hardwood_board_defects',
    'nex_materials_worker_links',
    'nex_materials_hardwood_allocations',
    'nex_materials_hardwood_offcuts',
    'nex_materials_audit_log'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "service_role_all" ON public.%I', t);
    EXECUTE format('CREATE POLICY "service_role_all" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- Species reference table readable by any authenticated user (it's catalogue data)
DROP POLICY IF EXISTS "auth_read_species" ON public.nex_materials_species;
CREATE POLICY "auth_read_species" ON public.nex_materials_species
  FOR SELECT TO authenticated USING (active = true);

-- ─── Seed initial hardwood species ──────────────────────────────────

INSERT INTO public.nex_materials_species (id, display_name, category, density_kg_m3, janka_hardness_lbf) VALUES
  ('oak_american_white',  'American White Oak',  'hardwood',  770, 1360),
  ('oak_european',        'European Oak',        'hardwood',  720, 1120),
  ('ash_european',        'European Ash',        'hardwood',  680, 1320),
  ('walnut_american',     'American Walnut',     'hardwood',  660, 1010),
  ('walnut_european',     'European Walnut',     'hardwood',  640,  900),
  ('beech_european',      'European Beech',      'hardwood',  720, 1300),
  ('maple_hard',          'Hard Maple',          'hardwood',  700, 1450),
  ('sapele',              'Sapele',              'hardwood',  640, 1510),
  ('tulipwood',           'American Tulipwood',  'hardwood',  510,  540),
  ('iroko',               'Iroko',               'hardwood',  660, 1260),
  ('pine_yellow',         'Yellow Pine',         'softwood',  600,  870),
  ('accoya',              'Accoya',              'modified',  510,  660)
ON CONFLICT (id) DO NOTHING;

-- ─── Comments ───────────────────────────────────────────────────────

COMMENT ON TABLE public.nex_materials_species IS
  'Materials species catalogue · shared reference · extensible for future materials (glass · steel · MDF · etc.) · Philip 2026-07-28';
COMMENT ON TABLE public.nex_materials_hardwood_packs IS
  'Hardwood packs · one row per purchase batch · owner-scoped · Philip 2026-07-28';
COMMENT ON TABLE public.nex_materials_hardwood_boards IS
  'Individual board digital twin · one row per physical board · never deleted (soft delete) · Philip 2026-07-28';
COMMENT ON TABLE public.nex_materials_hardwood_board_measurements IS
  'Versioned measurements per board · never overwritten · is_current flag identifies latest · Philip 2026-07-28';
COMMENT ON TABLE public.nex_materials_worker_links IS
  'Token-authenticated worker links · isolated write surface · workers never touch admin app · Philip 2026-07-28';
