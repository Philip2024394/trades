-- SiteBook — homeowner-owned project workbook (2026-07-18).
--
-- Mirror of the merchant canteen pattern, opposite direction:
--   Merchant canteen = merchant's shop, customers browse in.
--   Homeowner SiteBook = homeowner's project folder, trades collaborate in.
--
-- Every homeowner gets a SiteBook — one row per project (bathroom
-- refit, boiler replacement, etc). Trades are invited into projects
-- as members and can chat, upload photos, log warranties.
--
-- The homeowner OWNS the SiteBook. Multiple trades collaborate.
-- Homeowner can export the whole file for a fee — becomes the
-- house's permanent record and transfers with the property.
--
-- Legal: homeowner data is personal (GDPR). All tables have RLS
-- with policies scoped by session-owned homeowner_id.

-- =====================================================================
-- hammerex_homeowners — homeowner user accounts (separate from merchants)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_homeowners (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT          NOT NULL,
  password_hash         TEXT,                                     -- bcrypt / argon
  whatsapp_number       TEXT,
  first_name            TEXT,
  last_name             TEXT,
  city                  TEXT,
  postcode              TEXT,
  house_nickname        TEXT,                                     -- optional — "Chez Sarah" or "The Manor"
  session_token         TEXT,                                     -- rotating auth token in cookie
  session_expires_at    TIMESTAMPTZ,
  premium_tier          TEXT          NOT NULL DEFAULT 'free',    -- 'free' | 'premium'
  premium_since         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_homeowners_email
  ON public.hammerex_homeowners (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_homeowners_session_token
  ON public.hammerex_homeowners (session_token) WHERE session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_homeowners_whatsapp
  ON public.hammerex_homeowners (whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- =====================================================================
-- hammerex_sitebook_projects — the projects a homeowner is running
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_projects (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  title                 TEXT          NOT NULL,
  description           TEXT,
  trade_types           TEXT[]        NOT NULL DEFAULT ARRAY[]::TEXT[],   -- e.g. ['plumber','tiler','electrician']
  address_postcode      TEXT,
  address_city          TEXT,
  address_line          TEXT,                                      -- optional, private (only shared with hired trades)
  budget_min_gbp        NUMERIC(10,2),
  budget_max_gbp        NUMERIC(10,2),
  timeline              TEXT,                                      -- 'urgent' | '1-4-weeks' | '1-3-months' | '3-plus-months' | 'flexible'
  status                TEXT          NOT NULL DEFAULT 'draft',    -- 'draft' | 'active' | 'in-progress' | 'complete' | 'archived'
  cover_photo_url       TEXT,
  posted_to_beacon      BOOLEAN       NOT NULL DEFAULT FALSE,
  beacon_posted_at      TIMESTAMPTZ,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  total_spent_gbp       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_projects_homeowner ON public.hammerex_sitebook_projects (homeowner_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_projects_status    ON public.hammerex_sitebook_projects (status);
CREATE INDEX IF NOT EXISTS idx_sitebook_projects_postcode  ON public.hammerex_sitebook_projects (address_postcode);

-- =====================================================================
-- hammerex_sitebook_members — trades assigned to a project
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_members (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  listing_id            UUID          NOT NULL,                    -- merchant's hammerex_trade_off_listings.id
  merchant_slug         TEXT          NOT NULL,
  merchant_name         TEXT          NOT NULL,
  trade_type            TEXT,                                      -- their role on this project (may differ from primary trade)
  member_role           TEXT          NOT NULL DEFAULT 'sub',      -- 'lead' | 'sub' | 'consultant'
  status                TEXT          NOT NULL DEFAULT 'invited',  -- 'invited' | 'accepted' | 'quoting' | 'hired' | 'in-progress' | 'complete' | 'declined'
  quote_amount_gbp      NUMERIC(10,2),
  quote_notes           TEXT,
  quote_at              TIMESTAMPTZ,
  invited_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  accepted_at           TIMESTAMPTZ,
  hired_at              TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  UNIQUE (project_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_sitebook_members_project  ON public.hammerex_sitebook_members (project_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_members_listing  ON public.hammerex_sitebook_members (listing_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_members_status   ON public.hammerex_sitebook_members (status);

-- =====================================================================
-- hammerex_sitebook_messages — collaboration chat inside a project
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_messages (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  author_type           TEXT          NOT NULL,                    -- 'homeowner' | 'trade' | 'system'
  author_id             UUID,                                      -- homeowner_id OR listing_id
  author_name           TEXT          NOT NULL,
  body                  TEXT          NOT NULL,
  attachment_url        TEXT,
  attachment_kind       TEXT,                                      -- 'photo' | 'document' | 'quote' | 'invoice'
  visibility            TEXT          NOT NULL DEFAULT 'all',      -- 'all' (default) | 'homeowner-only' | 'trades-only'
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_messages_project  ON public.hammerex_sitebook_messages (project_id, created_at DESC);

-- =====================================================================
-- hammerex_sitebook_photos — project photo gallery
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_photos (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  uploaded_by_type      TEXT          NOT NULL,                    -- 'homeowner' | 'trade'
  uploaded_by_id        UUID,
  uploaded_by_name      TEXT,
  storage_url           TEXT          NOT NULL,
  caption               TEXT,
  stage                 TEXT,                                      -- 'before' | 'in-progress' | 'after'
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_photos_project  ON public.hammerex_sitebook_photos (project_id, created_at DESC);

-- =====================================================================
-- hammerex_sitebook_events — timeline log (every meaningful action)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_events (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  event_type            TEXT          NOT NULL,                    -- 'project_created' | 'trade_invited' | 'trade_accepted' | 'trade_hired' | 'trade_quoted' | 'photo_added' | 'message_posted' | 'project_started' | 'project_completed' | 'warranty_added' | 'invoice_added'
  actor_type            TEXT          NOT NULL,                    -- 'homeowner' | 'trade' | 'system'
  actor_id              UUID,
  actor_name            TEXT,
  metadata              JSONB,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_events_project ON public.hammerex_sitebook_events (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_events_type    ON public.hammerex_sitebook_events (event_type);

-- =====================================================================
-- hammerex_sitebook_warranties — warranty records logged per project
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_warranties (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID          NOT NULL REFERENCES public.hammerex_sitebook_projects(id) ON DELETE CASCADE,
  trade_listing_id      UUID          NOT NULL,
  trade_name            TEXT          NOT NULL,
  work_description      TEXT          NOT NULL,
  work_completed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  warranty_years        INTEGER       NOT NULL DEFAULT 1,
  warranty_expires_at   TIMESTAMPTZ   NOT NULL,
  invoice_url           TEXT,
  invoice_amount_gbp    NUMERIC(10,2),
  notes                 TEXT,
  reminder_sent_at      TIMESTAMPTZ,                               -- for auto-reminder cron before expiry
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_warranties_project ON public.hammerex_sitebook_warranties (project_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_warranties_expiry  ON public.hammerex_sitebook_warranties (warranty_expires_at);

-- =====================================================================
-- hammerex_sitebook_exports — paid export requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_exports (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  homeowner_id          UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  project_ids           UUID[],                                    -- specific projects, or NULL for all
  scope                 TEXT          NOT NULL DEFAULT 'all',      -- 'all' | 'selection'
  format                TEXT          NOT NULL DEFAULT 'pdf-zip',  -- 'pdf-zip' | 'pdf-only'
  status                TEXT          NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'generated' | 'downloaded' | 'expired'
  amount_pence          INTEGER       NOT NULL DEFAULT 999,        -- £9.99 default
  stripe_session_id     TEXT,
  stripe_payment_id     TEXT,
  paid_at               TIMESTAMPTZ,
  download_url          TEXT,
  download_expires_at   TIMESTAMPTZ,
  generated_at          TIMESTAMPTZ,
  downloaded_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitebook_exports_homeowner ON public.hammerex_sitebook_exports (homeowner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_exports_status    ON public.hammerex_sitebook_exports (status);

-- =====================================================================
-- Row-level security — homeowner-scoped access + trade-member access
-- =====================================================================
-- NB: our stack uses supabaseAdmin (service role) for the API layer,
-- which bypasses RLS. RLS enabled here as a defence-in-depth measure
-- against accidental anon-key exposure. Application-level auth is
-- authoritative.

ALTER TABLE public.hammerex_homeowners            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_photos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_warranties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hammerex_sitebook_exports      ENABLE ROW LEVEL SECURITY;
-- No public policies. Service role only.

-- =====================================================================
-- Auto-update updated_at on homeowners + projects
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hammerex_sitebook_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_homeowners_updated_at ON public.hammerex_homeowners;
CREATE TRIGGER trg_homeowners_updated_at
  BEFORE UPDATE ON public.hammerex_homeowners
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_touch_updated_at();

DROP TRIGGER IF EXISTS trg_sitebook_projects_updated_at ON public.hammerex_sitebook_projects;
CREATE TRIGGER trg_sitebook_projects_updated_at
  BEFORE UPDATE ON public.hammerex_sitebook_projects
  FOR EACH ROW EXECUTE FUNCTION public.hammerex_sitebook_touch_updated_at();
