-- NEX Composer · §5.6 · Templates + Campaign block persistence
--
-- Templates are reusable block-based emails · seeded on install +
-- extended by users. Campaigns get a body_blocks JSONB alongside the
-- rendered body_html — blocks are the source of truth for further
-- editing, body_html is what the Email Runtime sends.
--
-- Idempotent · additive-only.

CREATE TABLE IF NOT EXISTS nex.email_templates (
  template_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'   CHECK (category IN (
                    'announcement','newsletter','feature_release','welcome',
                    'quote_followup','reminder','event','seasonal','other'
                  )),
  description     TEXT,
  subject         TEXT,
  preview_text    TEXT,
  blocks          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_seed         BOOLEAN NOT NULL DEFAULT FALSE,           -- shipped-with-NEX templates · protected from user deletion
  is_draft        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_count      INT NOT NULL DEFAULT 0,
  last_used_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_templates_category_idx  ON nex.email_templates (category) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS email_templates_used_idx      ON nex.email_templates (last_used_at DESC NULLS LAST) WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_seed_name_uniq ON nex.email_templates (name) WHERE is_seed = TRUE;

ALTER TABLE nex.email_templates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'nex' AND tablename = 'email_templates' AND policyname = 'service_role_all_email_templates') THEN
    CREATE POLICY "service_role_all_email_templates" ON nex.email_templates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Attach block-form body to campaigns · rendered body_html stays as-is
-- (Email Runtime uses body_html at send-time · body_blocks is the
-- editable source of truth).
ALTER TABLE nex.campaigns ADD COLUMN IF NOT EXISTS body_blocks JSONB;
ALTER TABLE nex.campaigns ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES nex.email_templates(template_id) ON DELETE SET NULL;

COMMENT ON TABLE  nex.email_templates       IS 'Reusable block-based email templates · seeded + user-created';
COMMENT ON COLUMN nex.campaigns.body_blocks IS 'Source of truth for the composer · re-rendered to body_html on every edit';
COMMENT ON COLUMN nex.campaigns.template_id IS 'Origin template · NULL for from-scratch composition';
