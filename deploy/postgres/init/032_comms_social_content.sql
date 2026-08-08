-- NEX Comms Centre · Social · Phase 2 · Content Generation + Grounding
--
-- Charter §S-III: content grounding · never invent claims · two modes
-- (template-fill · LLM-composed with token-level provenance) · Fact-
-- checker distinct from Generator · time-of-check vs time-of-publish
-- gap closed.
--
-- Three tables:
--   1. nex.social_content_sources    · merchant-authorised source data
--      (business profile · projects · products · services · offers ·
--       testimonials · faqs)
--   2. nex.social_content_templates  · tenant-owned or nex-owned
--      templates with typed variable slots
--   3. nex.social_content_drafts     · generated draft posts with
--      grounding_state + full provenance JSONB
--
-- All tables tenant-scoped via RLS + `nex_social_app` role (established
-- in migrations 029/030).

-- ── 1 · Content sources ──────────────────────────────────────
--
-- Each row is one piece of merchant-authorised source data. The
-- generator can only ground claims against `active = TRUE AND
-- rights_status IN ('owned', 'uploaded_by_customer_attested',
-- 'nex_owned_evergreen', 'approved_nex_asset', 'nex_owned_licensed_with_expiry',
-- 'licensed_with_expiry')` — everything else is invisible to autopublish.
CREATE TABLE IF NOT EXISTS nex.social_content_sources (
  source_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN (
                    'business_profile','project','product','service','offer',
                    'testimonial','faq','company_milestone','review_aggregate',
                    'certification','award','press_mention','service_area')),
  slug            TEXT,                                                     -- optional stable ref (e.g. 'oak-staircase-nottingham-2026')
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,                      -- typed per-kind structure · schema validated in application
  rights_status   TEXT NOT NULL DEFAULT 'unknown' CHECK (rights_status IN (
                    'owned','uploaded_by_customer_attested',
                    'licensed_with_expiry','licensed_expires_at_null_forbidden',
                    'nex_owned_evergreen','nex_owned_licensed_with_expiry',
                    'approved_nex_asset','ai_generated_provenance_pending',
                    'unknown','restricted')),
  contains_identifiable_persons BOOLEAN NOT NULL DEFAULT FALSE,             -- GDPR gate per S-IV
  person_release_evidence_url   TEXT,                                       -- if contains_identifiable_persons=TRUE and autopublish desired
  attested_by     TEXT,
  attested_at     TIMESTAMPTZ,
  attestation_ip  INET,
  expires_at      TIMESTAMPTZ,                                              -- for _with_expiry categories
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, kind, slug)
);
CREATE INDEX IF NOT EXISTS social_content_sources_tenant_kind_idx
  ON nex.social_content_sources (tenant_id, kind, active);
CREATE INDEX IF NOT EXISTS social_content_sources_active_rights_idx
  ON nex.social_content_sources (tenant_id, active, rights_status);

-- ── 2 · Content templates ────────────────────────────────────
--
-- Each template is a body with typed variable slots. Phase 2 uses
-- template-fill mode: variables are extracted from source data (never
-- LLM-composed). Templates may be per-tenant or Nex-owned. Nex-owned
-- templates have tenant_id NULL and are visible to all tenants (read-
-- only for tenants; only HQ admin can write).
CREATE TABLE IF NOT EXISTS nex.social_content_templates (
  template_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,   -- NULL = Nex-owned global template
  slug            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN (
                    'project','educational','inspiration','product','faq',
                    'before_after','testimonial','seasonal','company','offer')),
  body            TEXT NOT NULL,                                            -- e.g. "New {{project.kind}} completed in {{business.city}}. {{project.summary}}"
  variable_slots  JSONB NOT NULL DEFAULT '[]'::jsonb,                      -- [{name,source_kind,source_path,required,claim_class}]
  hashtags_slots  JSONB NOT NULL DEFAULT '[]'::jsonb,                      -- static hashtags always allowed (must be whitelisted)
  cta_slot        JSONB,                                                    -- {template, source_kind?, source_path?}
  min_source_refs INT NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX IF NOT EXISTS social_content_templates_tenant_kind_idx
  ON nex.social_content_templates (tenant_id, kind, status);

-- ── 3 · Content drafts ───────────────────────────────────────
--
-- One row per generated draft post. Provenance JSONB captures per-claim
-- grounding — which source_id produced each variable value, and which
-- claim class it belongs to. `grounding_state` moves one-way from
-- `pending` → `grounded` OR `rejected`. Autopublish is only permitted
-- when grounding_state='grounded' (Phase 3 pipeline enforces).
CREATE TABLE IF NOT EXISTS nex.social_content_drafts (
  draft_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES nex.social_tenants(tenant_id) ON DELETE CASCADE,
  template_id         UUID REFERENCES nex.social_content_templates(template_id) ON DELETE SET NULL,
  generation_mode     TEXT NOT NULL DEFAULT 'template_fill' CHECK (generation_mode IN ('template_fill','llm_composed')),
  platform            TEXT NOT NULL,
  caption             TEXT NOT NULL,
  hashtags            TEXT[] NOT NULL DEFAULT '{}',
  cta                 TEXT,
  source_refs         UUID[] NOT NULL DEFAULT '{}',                       -- refs into nex.social_content_sources
  claims              JSONB NOT NULL DEFAULT '[]'::jsonb,                 -- [{text,class,grounded,source_ref?,reason?}]
  provenance          JSONB NOT NULL DEFAULT '{}'::jsonb,                 -- per-variable trace {var_name: {source_id, source_path, value}}
  grounding_state     TEXT NOT NULL DEFAULT 'pending' CHECK (grounding_state IN ('pending','grounded','rejected')),
  rejection_reasons   JSONB NOT NULL DEFAULT '[]'::jsonb,                 -- when rejected · array of {code,detail,offending_claim}
  created_by          TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS social_content_drafts_tenant_state_idx
  ON nex.social_content_drafts (tenant_id, grounding_state, created_at DESC);

-- ── 4 · RLS on new tables ────────────────────────────────────
--
-- Templates get a special SELECT policy: any tenant may read Nex-owned
-- templates (tenant_id IS NULL) in addition to their own.
ALTER TABLE nex.social_content_sources    ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_content_sources    FORCE  ROW LEVEL SECURITY;
ALTER TABLE nex.social_content_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_content_templates  FORCE  ROW LEVEL SECURITY;
ALTER TABLE nex.social_content_drafts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nex.social_content_drafts     FORCE  ROW LEVEL SECURITY;

-- Standard tenant-scoped policies for sources + drafts (identical shape
-- to migration 029 pattern).
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['social_content_sources','social_content_drafts']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_select ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_select ON nex.%I FOR SELECT USING ((tenant_id = nex._current_social_tenant()) OR nex._admin_bypass_active())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_insert ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_insert ON nex.%I FOR INSERT WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_update ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_update ON nex.%I FOR UPDATE USING (tenant_id = nex._current_social_tenant()) WITH CHECK (tenant_id = nex._current_social_tenant())',
      t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_delete ON nex.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_tenant_delete ON nex.%I FOR DELETE USING (tenant_id = nex._current_social_tenant())',
      t, t);
  END LOOP;
END $$;

-- Templates: tenant may read own OR Nex-owned (tenant_id IS NULL). Write
-- to Nex-owned templates requires admin bypass (HQ authors global templates).
DROP POLICY IF EXISTS social_content_templates_tenant_select ON nex.social_content_templates;
CREATE POLICY social_content_templates_tenant_select ON nex.social_content_templates
  FOR SELECT USING (
    (tenant_id = nex._current_social_tenant())
    OR tenant_id IS NULL
    OR nex._admin_bypass_active()
  );
DROP POLICY IF EXISTS social_content_templates_tenant_insert ON nex.social_content_templates;
CREATE POLICY social_content_templates_tenant_insert ON nex.social_content_templates
  FOR INSERT WITH CHECK (
    (tenant_id = nex._current_social_tenant())
    OR (tenant_id IS NULL AND nex._admin_bypass_active())
  );
DROP POLICY IF EXISTS social_content_templates_tenant_update ON nex.social_content_templates;
CREATE POLICY social_content_templates_tenant_update ON nex.social_content_templates
  FOR UPDATE USING (
    (tenant_id = nex._current_social_tenant())
    OR (tenant_id IS NULL AND nex._admin_bypass_active())
  ) WITH CHECK (
    (tenant_id = nex._current_social_tenant())
    OR (tenant_id IS NULL AND nex._admin_bypass_active())
  );
DROP POLICY IF EXISTS social_content_templates_tenant_delete ON nex.social_content_templates;
CREATE POLICY social_content_templates_tenant_delete ON nex.social_content_templates
  FOR DELETE USING (
    (tenant_id = nex._current_social_tenant())
    OR (tenant_id IS NULL AND nex._admin_bypass_active())
  );

-- ── 5 · Grants ────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON
  nex.social_content_sources,
  nex.social_content_templates,
  nex.social_content_drafts
  TO nex_social_app;

COMMENT ON TABLE nex.social_content_sources IS
  'Charter §S-III + §S-IV · merchant-authorised source data · rights_status gates autopublish visibility';
COMMENT ON TABLE nex.social_content_templates IS
  'Charter §S-III · template-fill mode · typed variable slots · tenant-owned or Nex-owned global';
COMMENT ON TABLE nex.social_content_drafts IS
  'Charter §S-III · one row per generated draft · provenance JSONB traces every variable to source · grounding_state one-way transition';
