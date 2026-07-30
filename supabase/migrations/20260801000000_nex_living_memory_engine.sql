-- ============================================================================
-- NEX Living Memory Engine · Phase 1 Schema
--
--   "This is not a database migration.
--    This is the moment NEX gains the ability to remember a human life."
--     — Philip O'Farrell, 2026-07-30
--
-- ----------------------------------------------------------------------------
-- Philip O'Farrell · 2026-07-30 · Priority #1 (100/100) per Living Intelligence
-- Architecture v1.0 at docs/nex/living-intelligence-architecture-v1.md
--
-- This migration adds the Living Memory Engine schema on TOP of the existing
-- memory infrastructure (hammerex_mate_user_memory · hammerex_mate_conversations
-- · hammerex_mate_messages). The aggregate memory table is preserved; this
-- migration adds normalised per-memory rows with Philip's field spec:
--   memory_id · source · created_date · confidence · importance · category
--   · user_visibility · deletion_status
--
-- Six governance decisions from Philip 2026-07-30 are enforced at the schema
-- level where possible:
--   1. GDPR/Right to Forget → deletion is DESTRUCTION, not hiding (see delete
--      function at the bottom)
--   2. Consent Model → consent_status column · high-impact categories flagged
--   3. Identity Resolution → hammerex_nex_identity_links table (below)
--   4. Memory Approval → consent_status enum · no dashboard fanout
--   5. Contradiction Handling → superseded_by column · arcs preserved forever
--   6. Cross-Surface Identity → user_key + surface pair · identity links bridge
--
-- NOT YET APPLIED. This file is a reviewable artefact. Run only after Philip
-- has reviewed the schema shape and confirmed the six decisions are correctly
-- encoded. Once applied, the DELETION function irrecoverably destroys memories
-- on request per GDPR compliance.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. hammerex_nex_memories · per-memory rows (the Living Memory table)
-- ----------------------------------------------------------------------------
-- Each row is one CURATED memory (not a raw transcript · not a full summary).
-- Every memory has confidence, importance, and category. Every memory can be
-- superseded by a newer version — the old version stays for arc tracking.
--
-- Composite user identity: (user_surface, user_key) matches the existing
-- convention in src/lib/nex/memory.ts. Visitor surface (ip-hash keyed) is
-- explicitly disallowed here — memories only for real user identities.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_memories (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identity (matches existing convention)
  user_surface          TEXT NOT NULL CHECK (user_surface IN ('merchant', 'homeowner')),
  user_key              TEXT NOT NULL,

  -- The memory itself (curated · not raw transcript)
  category              TEXT NOT NULL CHECK (category IN (
                          'story',       -- narrative arcs (forever home · renovation · new child)
                          'preference',  -- expressed tastes (likes oak · dislikes chrome)
                          'aspiration',  -- hopes and goals (wants home to grow old in)
                          'fear',        -- expressed concerns (worried about cost · safety)
                          'fact',        -- measurable state (2 children · Victorian terrace · Bristol)
                          'context'      -- situational (currently renovating · about to move)
                        )),
  content               TEXT NOT NULL,

  -- LOCK 1 (Philip 2026-07-30) · every memory needs "why"
  -- The intellectual reason this memory became important. Distinct from raw content.
  -- Example content: "prefers oak staircases"
  -- Example meaning_reason: "Values craftsmanship, natural materials and long-term
  --                          quality. User repeatedly linked oak with warmth and permanence."
  meaning_reason        TEXT,

  -- Emotional context · why it matters at the felt level (distinct from meaning_reason)
  -- Example: "Nostalgic connection to grandfather's workshop. Speaks about oak with tenderness."
  -- NOTE: added alongside Lock 1 as inferred from Philip's Perfect Memory Object
  -- ("Emotion: why it matters"). Confirm keep or drop.
  emotional_context     TEXT,

  confidence            SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  importance            SMALLINT NOT NULL CHECK (importance BETWEEN 0 AND 100),

  -- LOCK 2 (Philip 2026-07-30) · human_impact_score
  -- Database importance ≠ life significance. Two memories can both be "important"
  -- to retrieve but only one can be life-changing.
  -- Example: "likes dark blue" → human_impact_score: 30
  -- Example: "building first family home" → human_impact_score: 100
  human_impact_score    SMALLINT NOT NULL DEFAULT 50 CHECK (human_impact_score BETWEEN 0 AND 100),

  -- LOCK 3 (Philip 2026-07-30) · memory has to have expiry logic
  -- Human beings change. Memory without evolution becomes a prison.
  -- review_after triggers a soft prompt to reconfirm the memory next natural moment.
  -- NULL = never expires (facts like "has 2 children" don't need review · a preference does)
  -- The smartest AI is not the one that remembers everything · it is the one that
  -- knows what has changed.
  review_after          TIMESTAMPTZ,

  -- Source (traceability · which conversation this memory came from)
  source_conversation_id UUID REFERENCES public.hammerex_mate_conversations(id) ON DELETE SET NULL,
  source_message_id      UUID REFERENCES public.hammerex_mate_messages(id) ON DELETE SET NULL,
  source_turn_number     INTEGER,

  -- Consent state (Decision 2 · Consent Model)
  -- silent_ok       → NEX may store silently · does not need to ask
  -- needs_approval  → high-impact category · MUST ask before commit
  -- approved        → user has explicitly approved this memory
  -- pending         → NEX is awaiting user confirmation on next relevant turn
  -- rejected        → user rejected this memory · will not be surfaced
  consent_status        TEXT NOT NULL DEFAULT 'silent_ok' CHECK (consent_status IN (
                          'silent_ok', 'needs_approval', 'approved', 'pending', 'rejected'
                        )),

  -- Visibility to the user
  -- visible            → user sees this memory in their story timeline
  -- hidden_supporting  → memory helps NEX compose but doesn't appear to user
  user_visibility       TEXT NOT NULL DEFAULT 'visible' CHECK (user_visibility IN (
                          'visible', 'hidden_supporting'
                        )),

  -- Contradiction handling (Decision 5 · never overwrite history)
  -- When a memory is contradicted, the new memory sets superseded_by → self.id
  -- on the older memory. Old memory remains queryable for arc reconstruction.
  superseded_by         UUID REFERENCES public.hammerex_nex_memories(id) ON DELETE SET NULL,
  superseded_reason     TEXT,
  superseded_at         TIMESTAMPTZ,

  -- Confirmation tracking (Decision 4 · invisible until important)
  confirmed_at          TIMESTAMPTZ,      -- when user explicitly confirmed
  last_surfaced_at      TIMESTAMPTZ,      -- last time this memory was used in a reply

  -- Standard columns
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the primary retrieval pattern: "give me relevant memories for this user"
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_user_idx
  ON public.hammerex_nex_memories (user_surface, user_key, category)
  WHERE superseded_by IS NULL;

-- Index for confidence-weighted retrieval (surface high-confidence memories first)
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_confidence_idx
  ON public.hammerex_nex_memories (user_surface, user_key, confidence DESC, importance DESC)
  WHERE superseded_by IS NULL;

-- Index for pending-approval workflow ("what memories need user confirmation?")
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_pending_idx
  ON public.hammerex_nex_memories (user_surface, user_key, consent_status)
  WHERE consent_status IN ('needs_approval', 'pending');

-- Index for arc reconstruction ("show me the evolution of this preference")
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_supersession_idx
  ON public.hammerex_nex_memories (superseded_by)
  WHERE superseded_by IS NOT NULL;

-- LOCK 3 index · which memories are due for evolutionary review?
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_review_due_idx
  ON public.hammerex_nex_memories (user_surface, user_key, review_after)
  WHERE review_after IS NOT NULL AND superseded_by IS NULL;

-- LOCK 2 index · surface memories by life significance (not just DB importance)
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_human_impact_idx
  ON public.hammerex_nex_memories (user_surface, user_key, human_impact_score DESC)
  WHERE superseded_by IS NULL AND human_impact_score >= 70;

-- ----------------------------------------------------------------------------
-- 2. hammerex_nex_memory_events · audit trail
-- ----------------------------------------------------------------------------
-- Every meaningful action on a memory produces an event. Used for observability,
-- feedback-loop training (Phase 4), and debugging memory drift.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_memory_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id             UUID NOT NULL REFERENCES public.hammerex_nex_memories(id) ON DELETE CASCADE,

  event_type            TEXT NOT NULL CHECK (event_type IN (
                          'created',       -- memory candidate committed
                          'confirmed',     -- user confirmed on later turn
                          'contradicted',  -- user contradicted · new version created
                          'superseded',    -- explicitly superseded by newer memory
                          'approval_requested', -- NEX asked user for approval
                          'approved',      -- user approved a needs_approval memory
                          'rejected',      -- user rejected a memory
                          'surfaced',      -- memory used in a reply
                          'reinforced',    -- feedback signal confirmed the memory helped
                          'deleted'        -- GDPR erasure (destruction · not hide)
                        )),

  old_value             JSONB,             -- snapshot of memory row before event
  new_value             JSONB,             -- snapshot after event

  triggered_by          TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN (
                          'system',        -- NEX runtime made the change
                          'user',          -- user action (confirmation · edit · deletion)
                          'admin',         -- admin intervention
                          'conversation'   -- inferred from a conversation turn
                        )),
  triggered_by_context  JSONB,             -- e.g. { conversation_id, message_id }

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hammerex_nex_memory_events_memory_idx
  ON public.hammerex_nex_memory_events (memory_id, created_at DESC);

CREATE INDEX IF NOT EXISTS hammerex_nex_memory_events_type_idx
  ON public.hammerex_nex_memory_events (event_type, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. hammerex_nex_identity_links · cross-surface identity resolution (Decision 3 · 6)
-- ----------------------------------------------------------------------------
-- Two user identities may be the same person. This table stores proposed and
-- confirmed identity bridges. Confidence-gated per Decision 3:
--   ≥92 → allow merge (link_status: confirmed)
--   60-91 → ask (link_status: proposed_awaiting_confirmation)
--   <60  → keep separate (not stored)
--
-- Same-person recognition NEVER collapses role-appropriate context isolation
-- (Decision 6). Merchant and homeowner personas remain queryable separately
-- even after the identity link is confirmed.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_identity_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  primary_surface       TEXT NOT NULL CHECK (primary_surface IN ('merchant', 'homeowner')),
  primary_key           TEXT NOT NULL,

  linked_surface        TEXT NOT NULL CHECK (linked_surface IN ('merchant', 'homeowner')),
  linked_key            TEXT NOT NULL,

  confidence            SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),

  link_status           TEXT NOT NULL DEFAULT 'proposed' CHECK (link_status IN (
                          'proposed',                      -- system detected potential link
                          'proposed_awaiting_confirmation',-- 60-91% confidence · user asked
                          'confirmed',                     -- ≥92% or explicitly confirmed
                          'rejected'                       -- user said "not the same person"
                        )),

  linked_via            TEXT NOT NULL CHECK (linked_via IN (
                          'email_match',
                          'phone_match',
                          'conversation_content',   -- said "as a merchant" or similar
                          'manual_admin',
                          'user_confirmed'
                        )),

  proposed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at          TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,

  UNIQUE (primary_surface, primary_key, linked_surface, linked_key)
);

CREATE INDEX IF NOT EXISTS hammerex_nex_identity_links_primary_idx
  ON public.hammerex_nex_identity_links (primary_surface, primary_key, link_status);

CREATE INDEX IF NOT EXISTS hammerex_nex_identity_links_linked_idx
  ON public.hammerex_nex_identity_links (linked_surface, linked_key, link_status);

-- ----------------------------------------------------------------------------
-- 4. GDPR ERASURE FUNCTION · Decision 1 · destruction, not hiding
-- ----------------------------------------------------------------------------
-- When a person exercises right-to-forget:
--   - All hammerex_nex_memories rows for that user are HARD-DELETED
--   - CASCADE deletes their memory_events audit trail
--   - Identity links referencing them are HARD-DELETED
--
-- Aggregate patterns already learned into Phase 3 · Wisdom Memory (future table)
-- must persist ONLY in anonymised form with no reference back to the deleted
-- user. That belongs in a separate table with an anonymisation guarantee.
--
-- This function is called from the existing GDPR pipeline
-- (src/lib/gdpr/engine.ts · eraseHomeowner() and future eraseTrade()).

CREATE OR REPLACE FUNCTION public.nex_erase_user_memories(
  p_user_surface TEXT,
  p_user_key     TEXT
)
RETURNS TABLE (memories_destroyed INT, events_destroyed INT, identity_links_destroyed INT) AS $$
DECLARE
  v_memory_count INT;
  v_event_count  INT;
  v_link_count   INT;
BEGIN
  -- Count what we're about to destroy (for audit return)
  SELECT COUNT(*) INTO v_memory_count
    FROM public.hammerex_nex_memories
   WHERE user_surface = p_user_surface AND user_key = p_user_key;

  SELECT COUNT(*) INTO v_event_count
    FROM public.hammerex_nex_memory_events e
   WHERE e.memory_id IN (
     SELECT id FROM public.hammerex_nex_memories
      WHERE user_surface = p_user_surface AND user_key = p_user_key
   );

  SELECT COUNT(*) INTO v_link_count
    FROM public.hammerex_nex_identity_links
   WHERE (primary_surface = p_user_surface AND primary_key = p_user_key)
      OR (linked_surface = p_user_surface AND linked_key = p_user_key);

  -- Destroy (CASCADE on memory_events fires automatically)
  DELETE FROM public.hammerex_nex_memories
   WHERE user_surface = p_user_surface AND user_key = p_user_key;

  DELETE FROM public.hammerex_nex_identity_links
   WHERE (primary_surface = p_user_surface AND primary_key = p_user_key)
      OR (linked_surface = p_user_surface AND linked_key = p_user_key);

  RETURN QUERY SELECT v_memory_count, v_event_count, v_link_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.nex_erase_user_memories IS
  'GDPR right-to-forget · Decision 1 · destroys (not hides) all memory rows, memory events, and identity links for the given user. Called from src/lib/gdpr/engine.ts erasure pipeline. Irrecoverable.';

-- ----------------------------------------------------------------------------
-- 5. UPDATED_AT trigger for hammerex_nex_memories
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.nex_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hammerex_nex_memories_updated_at_trigger
  BEFORE UPDATE ON public.hammerex_nex_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.nex_memories_updated_at();

-- ----------------------------------------------------------------------------
-- 6. COMMENTS FOR SCHEMA DOCUMENTATION
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.hammerex_nex_memories IS
  'NEX Living Memory Engine · per-memory rows · Phase 1 of Living Intelligence Architecture v1.0. Every memory is CURATED (not raw), has confidence + importance, and supports arc versioning via superseded_by. Deletion is destruction (Decision 1). See docs/nex/living-intelligence-architecture-v1.md.';

COMMENT ON TABLE public.hammerex_nex_memory_events IS
  'Audit trail for every memory action · feeds Phase 4 feedback-loop training and Phase 3 Wisdom Memory aggregation. Preserves the ARC of change per Decision 5.';

COMMENT ON TABLE public.hammerex_nex_identity_links IS
  'Cross-surface identity resolution · Decisions 3 and 6 · confidence-gated merger (≥92 confirmed · 60-91 ask · <60 not stored). Never collapses role-appropriate context isolation.';

-- ============================================================================
-- REVIEW CHECKLIST BEFORE APPLYING
-- ============================================================================
-- Philip must confirm each before this migration is applied:
--
-- [ ] Six governance decisions correctly encoded in schema constraints
-- [ ] Category enum matches Living Intelligence Architecture (6 categories)
-- [ ] Consent status enum covers the "silent_ok" default per Decision 2
-- [ ] GDPR erasure function destroys · does not soft-delete
-- [ ] Identity links preserve role isolation per Decision 6
-- [ ] Existing hammerex_mate_user_memory aggregate NOT touched (both coexist)
-- [ ] Migration numbering (20260801000000) doesn't conflict with in-flight work
-- [ ] RLS policies deferred to a follow-up migration once auth pattern
--     confirmed (this migration ships table structure only)
--
-- THREE SAFETY LOCKS ADDED 2026-07-30 (Philip's founder-level review · IMMUTABLE)
--
-- [ ] Lock 1: meaning_reason column present · every memory carries its "why"
--     (intellectual reason this memory became important · distinct from raw content)
-- [ ] Lock 2: human_impact_score column present · life significance, not DB priority
--     (0-100 · default 50 · surfaces "building first family home" ahead of "likes dark blue")
-- [ ] Lock 3: review_after column present · memory evolution logic
--     (nullable · when set, prompts NEX to reconfirm at natural moment · prevents
--      memory becoming a prison as the person changes)
--
-- FOURTH FIELD (KEEP · confirmed 2026-07-30)
--
-- [x] emotional_context column · Philip 2026-07-30 explicit confirm:
--     "one of the most important fields · humans do not make their biggest
--      decisions only through logic · they decide through pride, memories,
--      dreams, fear, identity, family, achievement, belonging. Keep it."
--
-- ROADMAP · NOT IN THIS MIGRATION (add in follow-up)
--
-- [ ] memory_origin_type column (Philip 2026-07-30 · deferred to next migration)
--     Enum: USER_DIRECT · INFERRED · AI_GENERATED · SYSTEM · HUMAN_REVIEWED
--     Purpose: prevent false familiarity ("did I tell NEX this?" vs "did NEX assume it?")
--     Trust requires knowing where understanding came from.
--     Ship in follow-up migration after this one applies cleanly.
--
-- ============================================================================
-- APPROVAL STATUS · 2026-07-30
-- ============================================================================
-- 🟢 APPROVED FOR APPLICATION · Philip O'Farrell · 2026-07-30
--
-- Reason for green-light: "Do not over-engineer before NEX has its first
-- memories. A perfect memory system with no memories is a museum. The
-- system now has identity · meaning · emotion · confidence · importance ·
-- human impact · evolution · permission · lifecycle. This is enough for
-- version one. Future additions can evolve from real usage."
--
-- Apply command:
--   supabase migration up
--
-- After application, the Ship 2 track (Meaning Extraction Layer) begins.
-- Ship 2 philosophy (Philip 2026-07-30):
--   "Do not ask 'What facts can we save?' Ask 'What understanding would
--    make tomorrow's NEX better than today's NEX?'"
-- ============================================================================
