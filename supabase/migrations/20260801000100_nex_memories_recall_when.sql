-- ============================================================================
-- NEX Living Memory Engine · Follow-up migration
-- Adds recall_when field per Philip's Ship 2 rule:
--
--   "Memory must have a reason to recall. Every memory should answer:
--    'When would this help NEX serve this person better?'"
--   — Philip O'Farrell · 2026-07-30
--
-- Runs AFTER 20260801000000_nex_living_memory_engine.sql.
--
-- The field prevents memory becoming a warehouse. Every stored memory now
-- carries a semantic hint about WHEN it should surface in future conversations.
-- Retrieval logic will use this alongside vector similarity to decide which
-- memories to bring back at each turn.
--
-- Example (Philip 2026-07-30):
--   Bad:  { content: "User likes blue." }
--   Good: { content: "User prefers blue when choosing interior elements.",
--           recall_when: "Design recommendations are being generated." }
-- ============================================================================

-- Add recall_when to the Living Memory table.
-- Nullable so existing rows (none yet, but future-proof) don't break.
ALTER TABLE public.hammerex_nex_memories
  ADD COLUMN IF NOT EXISTS recall_when TEXT;

COMMENT ON COLUMN public.hammerex_nex_memories.recall_when IS
  'Ship 2 · reason to recall · answers "when would this help NEX serve this person better?" · populated by the meaning-extractor at Layer 2 curation time · prevents memory becoming a warehouse (Philip 2026-07-30).';

-- Index for retrieval by recall context — used by the retrieval pipeline
-- to surface memories whose recall_when hint matches the current conversation
-- topic (via keyword or embedding match).
CREATE INDEX IF NOT EXISTS hammerex_nex_memories_recall_when_idx
  ON public.hammerex_nex_memories (user_surface, user_key)
  WHERE recall_when IS NOT NULL AND superseded_by IS NULL;

-- ============================================================================
-- APPROVAL STATUS
-- ============================================================================
-- 🟢 Ready to apply immediately after 20260801000000_nex_living_memory_engine
--    per Philip 2026-07-30 Ship 2 approval. Small addition · ALTER TABLE only ·
--    no data migration needed (table has no rows yet).
--
-- Apply command:
--   supabase migration up
-- ============================================================================
