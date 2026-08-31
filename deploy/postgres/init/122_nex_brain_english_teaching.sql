-- 122_nex_brain_english_teaching.sql
--
-- NEX English-Teaching Brain · Philip 2026-08-28.
--
-- World-class English-teaching schema for Indonesian learners. Aligned to
-- CEFR (Common European Framework of Reference for Languages) levels
-- A1 · A2 · B1 · B2 · C1 · C2. This is a KNOWLEDGE schema — not a runtime
-- lesson delivery system. Ollama pipelines populate rows from source content
-- (Oxford 3000 vocab · CEFR grammar reference · Wikipedia Simple English ·
-- Tatoeba parallel sentences · VoA Learning English · KBBI for Indonesian
-- gloss). Delivery UI is a separate later concern.
--
-- Doctrine anchors:
--   · project_nex_translation_and_learning_vision_2026_08_28.md
--   · project_nex_free_infrastructure_principle_2026_08_27.md
--   · ADR-0028 (never fabricate · cite source · confidence bands)
--   · ADR-0033 (brain isolation · this is the ENGLISH_TEACHING brain,
--     never contaminated with staircase/door/interior brains)
--
-- Truth model:
--   · Every row carries source + source_reference + source_licence_terms
--   · Every row carries confidence (0-100 · <85 flags for admin review)
--   · Every row carries cefr_level (A1/A2/B1/B2/C1/C2)
--   · Every row carries created_by ('ollama_qwen2.5' / 'wikipedia_simple' /
--     'oxford_3000' / 'tatoeba' / 'human_admin')
--
-- Bilingual by design: every teaching artefact has EN + ID pair
-- (Indonesian gloss / explanation / example translation).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- brain_english_vocabulary · single-word or short-phrase vocabulary
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.brain_english_vocabulary (
  vocab_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word                    text NOT NULL,
  word_normalised         text NOT NULL,   -- lowercase, trimmed, for dedup
  part_of_speech          text NOT NULL CHECK (part_of_speech = ANY (ARRAY[
    'noun','verb','adjective','adverb','pronoun','preposition',
    'conjunction','determiner','interjection','phrasal_verb','idiom'
  ])),
  cefr_level              text NOT NULL CHECK (cefr_level = ANY (ARRAY[
    'A1','A2','B1','B2','C1','C2'
  ])),
  definition_en           text NOT NULL,
  definition_id           text NOT NULL,   -- Indonesian gloss
  pronunciation_ipa       text,            -- /wɜːd/ IPA
  pronunciation_id_hint   text,            -- Indonesian phonetic hint e.g. "wərd"
  example_sentence_en     text NOT NULL,
  example_sentence_id     text NOT NULL,   -- ID translation of the example
  common_mistake_note_id  text,            -- e.g. "orang Indonesia sering keliru dengan..."
  register                text CHECK (register = ANY (ARRAY[
    'formal','neutral','informal','slang','technical','literary'
  ])),
  variety                 text CHECK (variety = ANY (ARRAY[
    'british','american','both','international'
  ])),
  tags                    text[],
  frequency_rank          integer,         -- Oxford 3000/5000 rank if applicable
  source                  text NOT NULL,
  source_reference        text NOT NULL,
  source_licence_terms    text NOT NULL,
  created_by              text NOT NULL,
  confidence              integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  flagged_for_review      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word_normalised, part_of_speech)
);

CREATE INDEX IF NOT EXISTS idx_vocab_cefr ON nex.brain_english_vocabulary (cefr_level);
CREATE INDEX IF NOT EXISTS idx_vocab_pos  ON nex.brain_english_vocabulary (part_of_speech);
CREATE INDEX IF NOT EXISTS idx_vocab_freq ON nex.brain_english_vocabulary (frequency_rank) WHERE frequency_rank IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- brain_english_grammar · grammar rules with ID explanation
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.brain_english_grammar (
  grammar_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_slug               text NOT NULL UNIQUE,  -- e.g. "present-simple-vs-continuous"
  topic_en                text NOT NULL,
  topic_id                text NOT NULL,
  cefr_level              text NOT NULL CHECK (cefr_level = ANY (ARRAY[
    'A1','A2','B1','B2','C1','C2'
  ])),
  category                text NOT NULL CHECK (category = ANY (ARRAY[
    'tenses','articles','pronouns','prepositions','conjunctions','word_order',
    'conditionals','modal_verbs','passive_voice','reported_speech',
    'gerunds_infinitives','comparatives','question_forms','phrasal_verbs',
    'punctuation','spelling','pronunciation','other'
  ])),
  explanation_en          text NOT NULL,
  explanation_id          text NOT NULL,   -- Indonesian explanation of the rule
  positive_examples       jsonb NOT NULL,  -- [{en, id, note}]
  common_indonesian_error jsonb,           -- [{wrong_en, correct_en, why_id}]
  contrast_with_indonesian text,            -- how the rule differs from Bahasa Indonesia
  source                  text NOT NULL,
  source_reference        text NOT NULL,
  source_licence_terms    text NOT NULL,
  created_by              text NOT NULL,
  confidence              integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  flagged_for_review      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grammar_cefr ON nex.brain_english_grammar (cefr_level);
CREATE INDEX IF NOT EXISTS idx_grammar_cat  ON nex.brain_english_grammar (category);

-- ─────────────────────────────────────────────────────────────────────
-- brain_english_lesson · structured lesson combining vocab + grammar
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.brain_english_lesson (
  lesson_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_slug             text NOT NULL UNIQUE,
  title_en                text NOT NULL,
  title_id                text NOT NULL,
  cefr_level              text NOT NULL CHECK (cefr_level = ANY (ARRAY[
    'A1','A2','B1','B2','C1','C2'
  ])),
  topic_theme             text NOT NULL,   -- e.g. "greetings", "asking_directions", "ordering_food"
  learning_objectives_en  text[] NOT NULL,
  learning_objectives_id  text[] NOT NULL,
  intro_dialogue_en       text NOT NULL,
  intro_dialogue_id       text NOT NULL,
  key_vocabulary          jsonb NOT NULL,  -- [{word, gloss_id, cefr}]
  key_grammar_slugs       text[] NOT NULL,
  practice_prompts        jsonb NOT NULL,  -- [{prompt_en, expected_en, hint_id}]
  cultural_note_en        text,
  cultural_note_id        text,
  estimated_minutes       integer NOT NULL DEFAULT 15,
  prerequisite_lesson_slugs text[],
  source                  text NOT NULL,
  source_reference        text,
  source_licence_terms    text NOT NULL,
  created_by              text NOT NULL,
  confidence              integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  flagged_for_review      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_cefr  ON nex.brain_english_lesson (cefr_level);
CREATE INDEX IF NOT EXISTS idx_lesson_theme ON nex.brain_english_lesson (topic_theme);

-- ─────────────────────────────────────────────────────────────────────
-- brain_english_practice · practice items (fill-in-blank / translate / MCQ)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.brain_english_practice (
  practice_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_slug             text REFERENCES nex.brain_english_lesson(lesson_slug),
  cefr_level              text NOT NULL CHECK (cefr_level = ANY (ARRAY[
    'A1','A2','B1','B2','C1','C2'
  ])),
  practice_kind           text NOT NULL CHECK (practice_kind = ANY (ARRAY[
    'translate_en_to_id','translate_id_to_en','fill_in_blank','multiple_choice',
    'reorder_words','listen_and_type','pronounce_and_record','free_response'
  ])),
  prompt_en               text,
  prompt_id               text,
  correct_answer          text NOT NULL,
  acceptable_variants     text[],
  distractor_options      text[],           -- for MCQ / reorder
  hint_id                 text,             -- Indonesian hint if learner stuck
  explanation_id          text,             -- shown AFTER answer submitted
  difficulty              integer NOT NULL DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  source                  text NOT NULL,
  source_licence_terms    text NOT NULL,
  created_by              text NOT NULL,
  confidence              integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  flagged_for_review      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_lesson ON nex.brain_english_practice (lesson_slug);
CREATE INDEX IF NOT EXISTS idx_practice_cefr   ON nex.brain_english_practice (cefr_level);
CREATE INDEX IF NOT EXISTS idx_practice_kind   ON nex.brain_english_practice (practice_kind);

-- ─────────────────────────────────────────────────────────────────────
-- brain_english_progress · per-user progress (identifier is generic to
--   avoid FK-locking a specific user-table shape · nex_id / nex_name)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nex.brain_english_progress (
  progress_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_ref             text NOT NULL,   -- e.g. "nex_id:71415178"
  vocab_id                uuid REFERENCES nex.brain_english_vocabulary(vocab_id) ON DELETE CASCADE,
  grammar_id              uuid REFERENCES nex.brain_english_grammar(grammar_id) ON DELETE CASCADE,
  lesson_slug             text REFERENCES nex.brain_english_lesson(lesson_slug) ON DELETE CASCADE,
  practice_id             uuid REFERENCES nex.brain_english_practice(practice_id) ON DELETE CASCADE,
  attempts                integer NOT NULL DEFAULT 0,
  correct_count           integer NOT NULL DEFAULT 0,
  last_seen_at            timestamptz NOT NULL DEFAULT now(),
  mastery_score           integer NOT NULL DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
  next_review_at          timestamptz,     -- spaced-repetition schedule
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (vocab_id IS NOT NULL)::int
    + (grammar_id IS NOT NULL)::int
    + (lesson_slug IS NOT NULL)::int
    + (practice_id IS NOT NULL)::int
    = 1
  )
);

CREATE INDEX IF NOT EXISTS idx_progress_learner ON nex.brain_english_progress (learner_ref);
CREATE INDEX IF NOT EXISTS idx_progress_due     ON nex.brain_english_progress (next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Comments on all tables to document their role for future readers.
-- ─────────────────────────────────────────────────────────────────────
COMMENT ON TABLE nex.brain_english_vocabulary IS
  'CEFR-aligned English vocabulary for Indonesian learners. Bilingual (EN + ID gloss). Populated by Ollama from Oxford 3000 / Wikipedia Simple / KBBI cross-refs. Confidence + source + licence tracked per row.';

COMMENT ON TABLE nex.brain_english_grammar IS
  'CEFR-aligned English grammar rules with Indonesian explanations. Includes contrast_with_indonesian and common_indonesian_error to address mistakes specific to Bahasa Indonesia speakers.';

COMMENT ON TABLE nex.brain_english_lesson IS
  'Structured English lessons: dialogue + vocab + grammar + practice + cultural note. All bilingual. Referenced by brain_english_practice via lesson_slug.';

COMMENT ON TABLE nex.brain_english_practice IS
  'Practice items across 8 kinds (translate / fill-blank / MCQ / reorder / listen / pronounce / free-response). Difficulty 1-5. Distractors and hints in Indonesian.';

COMMENT ON TABLE nex.brain_english_progress IS
  'Per-learner progress across vocab / grammar / lesson / practice. Spaced-repetition next_review_at drives NEX daily lesson selection. Isolated to English-teaching brain per ADR-0033.';

COMMIT;
