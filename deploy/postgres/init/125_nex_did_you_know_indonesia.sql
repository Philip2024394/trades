-- 125_nex_did_you_know_indonesia.sql
--
-- NEX Indonesia · DID YOU KNOW Notebook · Philip 2026-08-28.
--
-- Dedicated table for premium curated "Did You Know" facts about Indonesia.
-- Different from knowledge_inbox (which is walker-derived Wikipedia dumps).
-- These are hand-picked / human-authored / world-class quality facts that
-- users will screenshot, share, and be proud to learn.
--
-- Four surfaces consume this table:
--   1. Ambient chat injection (preferred over walker Wikipedia)
--   2. /nex-did-you-know-indonesia notebook page (browse + filter)
--   3. Game mode (swipe deck · "See 10 in a row" streak)
--   4. Home widget (fact of the day)
--
-- Doctrine anchors:
--   · project_nex_ambient_knowledge_injector_doctrine_2026_08_28.md
--   · project_nex_fact_vs_knowledge_doctrine_2026_08_28.md

BEGIN;

CREATE TABLE IF NOT EXISTS nex.brain_did_you_know_indonesia (
  fact_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  title             text NOT NULL,
  body              text NOT NULL,
  category          text NOT NULL CHECK (category = ANY (ARRAY[
    'nature', 'geology', 'culture', 'history', 'language', 'food',
    'rituals', 'science', 'society', 'symbols'
  ])),
  region_slug       text,
  region_label      text,
  truth_class       text NOT NULL DEFAULT 'confirmed_fact' CHECK (truth_class = ANY (ARRAY[
    'confirmed_fact', 'academic_reference',
    'traditional_folk', 'spiritual_belief', 'unconfirmed', 'ai_generated'
  ])),
  difficulty        integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  verified_source   text NOT NULL DEFAULT 'human_curated_v1',
  source_url        text,
  licence_terms     text NOT NULL DEFAULT 'CC0 · public factual data',
  priority          integer NOT NULL DEFAULT 5,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dyk_category
  ON nex.brain_did_you_know_indonesia (category) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_dyk_region
  ON nex.brain_did_you_know_indonesia (region_slug) WHERE is_active AND region_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dyk_active
  ON nex.brain_did_you_know_indonesia (priority DESC, created_at DESC) WHERE is_active;

-- Per-user saved facts · lightweight, one row per (learner, fact) pair.
CREATE TABLE IF NOT EXISTS nex.brain_user_saved_facts (
  save_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref       text NOT NULL,
  fact_id           uuid NOT NULL REFERENCES nex.brain_did_you_know_indonesia(fact_id) ON DELETE CASCADE,
  saved_at          timestamptz NOT NULL DEFAULT now(),
  seen_count        integer NOT NULL DEFAULT 1,
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (learner_ref, fact_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_learner
  ON nex.brain_user_saved_facts (learner_ref, saved_at DESC);

COMMIT;
