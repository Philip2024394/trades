-- ============================================================================
-- NEX-native Migration 039 · nex_generated_site · Wave D Slice 16a
-- ============================================================================
-- 10th sealed keypad capability · "Build App / Website".
-- Founder directive 2026-09-25: "must be perfect · add prompt and nex generates
-- the 1 page app or website that has contact or chat button that diverts
-- direct into the user chat".
--
-- Phase 1 scope:
--   · One record per generated site · one business can have many drafts +
--     one published live site
--   · prompt          text · free-form merchant intent (≤2000)
--   · template_name   CHECK IN ('modern-minimal') · single template ships now ·
--                     future slices add: 'warm-artisan', 'bold-brutalist',
--                     'elegant-serif', 'playful-rounded'
--   · params          jsonb · normalised from prompt (accent, hero_headline,
--                     hero_subline, cta_label, show_products, show_hours,
--                     show_banners) · deep validation in site-service
--   · view_token      text 16-char [a-z0-9] · unique · used in public URL
--   · published_at    timestamptz nullable · null = draft
--   · created_at + updated_at (touch trigger)
--
-- Doctrine:
--   · Chat button ALWAYS routes to /nex-native/<business.slug> · that page
--     is the merchant's real conversation surface (existing infra)
--   · Products come from real nex_product rows · never fabricated
--   · Prompt drives STYLE only · content is business data
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS nex_generated_site (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES nex_business(id) ON DELETE CASCADE,
  prompt         text NOT NULL DEFAULT '',
  template_name  text NOT NULL DEFAULT 'modern-minimal',
  params         jsonb NOT NULL DEFAULT '{}'::jsonb,
  view_token     text NOT NULL,
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nex_generated_site_prompt_length CHECK (char_length(prompt) <= 2000),
  CONSTRAINT nex_generated_site_template_known
    CHECK (template_name IN ('modern-minimal')),
  CONSTRAINT nex_generated_site_view_token_shape
    CHECK (view_token ~ '^[a-z0-9]{16}$')
);

COMMENT ON TABLE nex_generated_site IS
  'Wave D · prompt-driven generated site per business · one template today (modern-minimal) · phase 2 adds more · view_token is the public URL segment · publish sets published_at.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_nex_generated_site_view_token
  ON nex_generated_site (view_token);
CREATE INDEX IF NOT EXISTS idx_nex_generated_site_business
  ON nex_generated_site (business_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nex_generated_site_published
  ON nex_generated_site (published_at DESC)
  WHERE published_at IS NOT NULL;

DROP TRIGGER IF EXISTS nex_generated_site_touch ON nex_generated_site;
CREATE TRIGGER nex_generated_site_touch
  BEFORE UPDATE ON nex_generated_site
  FOR EACH ROW EXECUTE FUNCTION nex_touch_updated_at();

ALTER TABLE nex_generated_site ENABLE ROW LEVEL SECURITY;

INSERT INTO nex_migration_history (version, description, notes)
  VALUES (
    '039',
    'Wave D Slice 16a · nex_generated_site · prompt-driven 1-page site',
    'Phase 1 · one template modern-minimal · chat CTA routes to /nex-native/<slug>. Future slices add more templates + preview UX.'
  )
  ON CONFLICT (version) DO NOTHING;

COMMIT;
