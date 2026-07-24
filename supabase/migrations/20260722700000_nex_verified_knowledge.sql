-- Verified-Knowledge upgrade for Nex Research.
--
-- Records the tier split + whether official guidance was found in
-- every research pass. Powers the trust-language chat replies and
-- the review UI tier chips.

ALTER TABLE public.hammerex_nex_research_reports
  ADD COLUMN IF NOT EXISTS tier_counts      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS found_official   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS search_summary   JSONB;

COMMENT ON COLUMN public.hammerex_nex_research_reports.tier_counts IS
  'How many drafts came back per tier: { official: N, industry: N, educational: N, community: N }';
COMMENT ON COLUMN public.hammerex_nex_research_reports.found_official IS
  'True if at least one draft cites an Official (Level 1) source. Chat reply changes wording based on this.';
COMMENT ON COLUMN public.hammerex_nex_research_reports.search_summary IS
  'Verbose search summary: which tiers were checked, which returned, notes.';
