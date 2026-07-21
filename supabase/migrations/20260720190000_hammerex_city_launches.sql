-- City Launch Engine · per-city status + targets.
-- Phase 4.2 of the engine-first roadmap.
--
-- A "city launch" is a founder-tracked initiative to reach liquidity
-- inside a specific UK city. Status ladder:
--   PREPARE   — city added, no recruiting yet
--   RECRUIT   — actively signing up trades (scrape + drip + cold outreach)
--   ACTIVATE  — enough trades to route real demand; watch first-reply-latency
--   GROW      — liquidity hit, focus on retention + expansion (adjacent trades)
--   DOMINATE  — market share > 20% or exceeds nearest competitor
--
-- Coverage Map (/admin/coverage) reads this + hammerex_events to render
-- a per-city × per-trade heatmap and generate the "who to recruit next" list.

CREATE TABLE IF NOT EXISTS public.hammerex_city_launches (
  id                       UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- IDENTITY
  city_slug                TEXT           NOT NULL UNIQUE,   -- 'manchester', 'birmingham', 'leeds'
  city_display             TEXT           NOT NULL,
  region                   TEXT,                              -- 'North West', 'West Midlands' etc.
  country                  TEXT           NOT NULL DEFAULT 'UK',

  -- STATUS
  status                   TEXT           NOT NULL DEFAULT 'PREPARE'
                            CHECK (status IN ('PREPARE', 'RECRUIT', 'ACTIVATE', 'GROW', 'DOMINATE', 'PAUSED')),
  status_since             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- TARGETS
  target_trades_total      INTEGER,                                       -- founder's chosen target for critical mass
  target_trades_per_category JSONB,                                       -- { "plumber": 8, "electrician": 8, "roofer": 4 }
  target_homeowner_signups INTEGER,

  -- LAUNCH DATES
  planned_launch_date      DATE,
  launched_at              TIMESTAMPTZ,
  activated_at             TIMESTAMPTZ,                                   -- when first reply-latency SLA was met

  -- OPERATIONS
  owner_admin_email        TEXT,                                          -- founder / city lead assigned
  admin_notes              TEXT,
  next_step                TEXT,                                          -- "Recruit 3 electricians", "Ship city page"

  metadata                 JSONB,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_launches_status
  ON public.hammerex_city_launches (status, status_since DESC);

CREATE INDEX IF NOT EXISTS idx_city_launches_owner
  ON public.hammerex_city_launches (owner_admin_email);

ALTER TABLE public.hammerex_city_launches ENABLE ROW LEVEL SECURITY;
-- Service-role only. Admin dashboards read via API layer.
