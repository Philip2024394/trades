-- Nex Intelligence — trade knowledge base.
-- Every entry is scoped to a trade (or "any"). Full-text search via
-- generated tsvector. Adding a trade = inserting rows, no code change.

CREATE TABLE IF NOT EXISTS public.hammerex_nex_knowledge_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade        TEXT NOT NULL,                     -- 'carpentry' | 'plumbing' | 'business' | 'any'
  topic        TEXT NOT NULL,                     -- 'joinery-first-fix' | 'vat-thresholds'
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,                     -- 1-3 sentences Nex quotes verbatim
  body_md      TEXT,                              -- optional long-form for admin editing
  keywords     TEXT[] NOT NULL DEFAULT '{}',
  source_url   TEXT,                              -- provenance
  verified_by  TEXT,                              -- admin who approved
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  search_tsv   TSVECTOR
);

-- tsvector maintained by trigger (to_tsvector with regconfig arg is
-- not immutable so a GENERATED column is rejected).
CREATE OR REPLACE FUNCTION public.fn_nex_knowledge_tsv()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title,    '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.summary,  '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.keywords, '{}'), ' ')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nex_knowledge_tsv ON public.hammerex_nex_knowledge_entries;
CREATE TRIGGER trg_nex_knowledge_tsv
  BEFORE INSERT OR UPDATE ON public.hammerex_nex_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_nex_knowledge_tsv();

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_trade
  ON public.hammerex_nex_knowledge_entries (trade, topic);

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_search
  ON public.hammerex_nex_knowledge_entries USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS idx_nex_knowledge_keywords
  ON public.hammerex_nex_knowledge_entries USING GIN (keywords);

ALTER TABLE public.hammerex_nex_knowledge_entries ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated merchants (knowledge is not merchant-scoped).
DROP POLICY IF EXISTS nex_knowledge_read ON public.hammerex_nex_knowledge_entries;
CREATE POLICY nex_knowledge_read
  ON public.hammerex_nex_knowledge_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- ─── First knowledge pack — carpentry starter (10 entries) ──────

INSERT INTO public.hammerex_nex_knowledge_entries (trade, topic, title, summary, keywords, verified_by, verified_at) VALUES
('carpentry', 'first-fix',    'First-fix carpentry scope',
 'First-fix carpentry covers structural work before plastering — stud walls, floor joists, roof timbers, door linings, window boards, loft hatch framing. Priced per m2 studwork or day rate.',
 ARRAY['first fix', 'stud wall', 'joists', 'linings'], 'seed', NOW()),

('carpentry', 'second-fix',   'Second-fix carpentry scope',
 'Second-fix runs after plastering — hanging doors, fitting skirting and architrave, staircases, kitchen units, built-in wardrobes, worktops. Priced per door hung, per m of skirting, or fixed-price project.',
 ARRAY['second fix', 'skirting', 'architrave', 'doors'], 'seed', NOW()),

('carpentry', 'day-rate',     'UK carpentry day rate 2026',
 'Typical UK carpenter day rate 2026: £220-£320 south, £180-£260 north. Time-served with own tools + van commands the top of range. Add £40-£60 for labourer supplied.',
 ARRAY['day rate', 'labour cost', 'pricing'], 'seed', NOW()),

('carpentry', 'timber-grade', 'Softwood grading (C16 vs C24)',
 'C16 is standard structural softwood (cheaper, most house-building). C24 is stronger, kiln-dried, for spans over 4m or exposed joists. Never mix in a single beam. Building Regs Part A applies.',
 ARRAY['timber', 'C16', 'C24', 'structural'], 'seed', NOW()),

('carpentry', 'building-regs','Building Regs approvals carpenter needs',
 'Loadbearing timber work needs Building Control notification. Building Notice for small jobs; Full Plans for extensions. Structural calcs from an engineer if spans exceed 4m or supporting a roof.',
 ARRAY['building regs', 'Part A', 'building control'], 'seed', NOW()),

('business', 'vat-threshold', 'VAT registration threshold 2026',
 'UK VAT threshold rose to £90,000 turnover April 2024. Register within 30 days of exceeding. Voluntary registration below threshold recovers input VAT on tools + van but adds 20% to every invoice.',
 ARRAY['VAT', 'threshold', 'registration', 'HMRC'], 'seed', NOW()),

('business', 'cis',           'Construction Industry Scheme (CIS)',
 'If you subcontract to another contractor, 20% is deducted at source (30% if unregistered). Register at gov.uk/cis. Monthly returns due 19th of following month. Applies to labour, not materials.',
 ARRAY['CIS', 'subcontractor', 'HMRC', 'deduction'], 'seed', NOW()),

('business', 'insurance',     'Public liability minimum for trades',
 'Standard is £1m public liability minimum, £2m for commercial contracts, £5m for public-sector work. Employers liability legally required (£5m minimum) if you have ANY staff including subcontracted labour.',
 ARRAY['insurance', 'public liability', 'employers liability'], 'seed', NOW()),

('marketing', 'first-100',    'Getting your first 100 leads',
 'Fastest 100-lead paths for a new UK trade: (1) Google Business Profile with 20+ real photos, (2) local Facebook trade groups sharing before/after weekly, (3) Checkatrade or MyBuilder subscription, (4) van signwriting so every job site is an ad.',
 ARRAY['leads', 'marketing', 'growth', 'Google Business'], 'seed', NOW()),

('marketing', 'quote-close',  'Quote follow-up rule of 3',
 'Follow up every quote three times: same-day thank-you text, 3-day gentle nudge, 7-day final check-in. Trade quotes close ~40% higher with structured follow-up vs one-touch.',
 ARRAY['quote', 'follow up', 'sales', 'closing'], 'seed', NOW())
ON CONFLICT DO NOTHING;
