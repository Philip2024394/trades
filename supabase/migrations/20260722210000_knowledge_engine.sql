-- Trade Knowledge Engine — trade-agnostic RAG infrastructure.
--
-- Every construction trade (concrete, plumbing, electrical, roofing,
-- carpentry, plastering, tiling, kitchens, bathrooms, staircases,
-- landscaping, groundworks, drylining, decorating, flooring, HVAC,
-- solar, EV charging, building regs, H&S, etc) plugs into the same
-- 6-table schema below. Adding a new trade is DATA, not code.
--
-- Design rules:
--  · No table knows anything about a specific trade. Everything
--    routes through knowledge_trades.slug.
--  · Every entry has verifiable source_url + last_verified_at +
--    confidence_score so quality is measurable.
--  · Region-aware (uk / eu / au / us) so trade regs don't cross
--    borders incorrectly.
--  · Embedding-ready via pgvector but fully functional without
--    embeddings (falls back to full-text + tag search).
--  · Community-contribution ready via contributed_by_merchant_slug
--    + moderation_status (Philip's long-term moat idea).

create extension if not exists vector;

-- ─── 1. Trades ────────────────────────────────────────────────────
create table if not exists hammerex_knowledge_trades (
  slug                text primary key,
  display_name        text not null,
  description         text,
  merchant_categories text[] not null default '{}',
  trade_categories    text[] not null default '{}',
  icon_slug           text,
  sort_order          int    not null default 0,
  created_at          timestamptz not null default now()
);

comment on table  hammerex_knowledge_trades is 'One row per trade. Adding a new trade = insert here + populate topics + entries. No code change.';

-- ─── 2. Topics (hierarchical per trade) ───────────────────────────
create table if not exists hammerex_knowledge_topics (
  id              uuid primary key default gen_random_uuid(),
  trade_slug      text not null references hammerex_knowledge_trades(slug) on delete cascade,
  slug            text not null,
  display_name    text not null,
  description     text,
  parent_topic_id uuid references hammerex_knowledge_topics(id) on delete set null,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  unique (trade_slug, slug)
);
create index if not exists idx_knowledge_topics_trade on hammerex_knowledge_topics(trade_slug);
create index if not exists idx_knowledge_topics_parent on hammerex_knowledge_topics(parent_topic_id);

-- ─── 3. Entries (the knowledge itself) ────────────────────────────
create table if not exists hammerex_knowledge_entries (
  id                       uuid primary key default gen_random_uuid(),
  trade_slug               text not null references hammerex_knowledge_trades(slug) on delete cascade,
  topic_id                 uuid references hammerex_knowledge_topics(id) on delete set null,
  content_type             text not null check (content_type in (
    'fundamentals','specification','material','tool','problem',
    'best-practice','installation','regulation','safety','faq',
    'product','method','troubleshooting','standard'
  )),
  title                    text not null,
  ai_summary               text not null,     -- 1-2 sentences for RAG context
  detailed_explanation     text,              -- full markdown
  video_tags               text[] not null default '{}',   -- ['footing','pour','curing']
  related_entry_ids        uuid[] not null default '{}',
  related_topic_slugs      text[] not null default '{}',
  merchant_categories      text[] not null default '{}',   -- for recommendations
  trade_categories         text[] not null default '{}',   -- for recommendations
  region_applicability     text[] not null default '{uk}', -- uk/eu/au/us
  source_url               text,
  source_type              text check (source_type in (
    'gov','standard','manufacturer','trade-body','community','engine-seed','engineer-review'
  )),
  source_publisher         text,              -- 'gov.uk', 'MPA', 'Concrete Society'
  last_verified_at         timestamptz not null default now(),
  confidence_score         numeric(3,2) not null default 1.00 check (confidence_score >= 0 and confidence_score <= 1),
  contributed_by_merchant_slug text,          -- future community pipeline
  moderation_status        text not null default 'approved' check (moderation_status in ('pending','approved','rejected')),
  embedding                vector(1536),
  search_text              tsvector,
  view_count               int not null default 0,
  cited_by_ai_count        int not null default 0,  -- how many times AI cited this entry
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- pgvector HNSW index for semantic search (fast approx nearest-neighbour)
create index if not exists idx_knowledge_entries_embedding
  on hammerex_knowledge_entries using hnsw (embedding vector_cosine_ops);

-- Full-text search fallback (when embedding is null or key missing)
create index if not exists idx_knowledge_entries_search
  on hammerex_knowledge_entries using gin (search_text);

create index if not exists idx_knowledge_entries_trade    on hammerex_knowledge_entries(trade_slug);
create index if not exists idx_knowledge_entries_topic    on hammerex_knowledge_entries(topic_id);
create index if not exists idx_knowledge_entries_content  on hammerex_knowledge_entries(content_type);
create index if not exists idx_knowledge_entries_tags     on hammerex_knowledge_entries using gin (video_tags);
create index if not exists idx_knowledge_entries_moderation on hammerex_knowledge_entries(moderation_status);

-- Auto-populate search_text tsvector on write
create or replace function knowledge_entries_search_text_trg()
returns trigger as $$
begin
  new.search_text :=
    setweight(to_tsvector('english', coalesce(new.title, '')),                 'A') ||
    setweight(to_tsvector('english', coalesce(new.ai_summary, '')),            'B') ||
    setweight(to_tsvector('english', coalesce(new.detailed_explanation, '')),  'C') ||
    setweight(to_tsvector('english', array_to_string(new.video_tags, ' ')),    'D');
  new.updated_at := now();
  return new;
end $$ language plpgsql;

drop trigger if exists knowledge_entries_search_trg on hammerex_knowledge_entries;
create trigger knowledge_entries_search_trg
  before insert or update on hammerex_knowledge_entries
  for each row execute function knowledge_entries_search_text_trg();

-- ─── 4. Video tag ontology ────────────────────────────────────────
-- Canonical list of activities/tools/materials/methods that can be
-- detected in videos. Enables the auto-linking pipeline.
create table if not exists hammerex_knowledge_video_tags (
  slug          text primary key,
  trade_slug    text references hammerex_knowledge_trades(slug) on delete cascade,
  display_name  text not null,
  tag_kind      text not null check (tag_kind in (
    'activity','tool','material','method','stage','problem','safety'
  )),
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_knowledge_video_tags_trade on hammerex_knowledge_video_tags(trade_slug);
create index if not exists idx_knowledge_video_tags_kind  on hammerex_knowledge_video_tags(tag_kind);

-- ─── 5. Video → knowledge pivot ───────────────────────────────────
-- Populated by processVideoAI when it detects a tag that matches
-- a KB entry. Lets the Ask-AI panel show "this video covers X" and
-- feeds RAG context.
create table if not exists hammerex_video_knowledge_links (
  video_id     uuid not null references hammerex_videos(id) on delete cascade,
  entry_id     uuid not null references hammerex_knowledge_entries(id) on delete cascade,
  match_score  numeric(3,2) not null default 0.50,
  match_type   text not null check (match_type in ('embedding','tag','manual')),
  created_at   timestamptz not null default now(),
  primary key (video_id, entry_id)
);
create index if not exists idx_video_knowledge_video on hammerex_video_knowledge_links(video_id);
create index if not exists idx_video_knowledge_entry on hammerex_video_knowledge_links(entry_id);

-- ─── 6. Community contributions (moderation queue) ────────────────
-- Verified trades submit knowledge; admin approves; approved entries
-- roll into hammerex_knowledge_entries. Contributor gets washer
-- credit (wired in Phase 2).
create table if not exists hammerex_knowledge_contributions (
  id                    uuid primary key default gen_random_uuid(),
  trade_slug            text not null references hammerex_knowledge_trades(slug) on delete cascade,
  contributor_merchant_slug text not null,
  proposed_title        text not null,
  proposed_content      text not null,
  proposed_source_url   text,
  proposed_topic_slug   text,
  proposed_content_type text,
  status                text not null default 'pending' check (status in ('pending','approved','rejected','duplicate')),
  reviewer_admin_id     text,
  review_notes          text,
  reviewed_at           timestamptz,
  approved_entry_id     uuid references hammerex_knowledge_entries(id) on delete set null,
  reward_washers        int  not null default 0,
  created_at            timestamptz not null default now()
);
create index if not exists idx_knowledge_contributions_status on hammerex_knowledge_contributions(status);
create index if not exists idx_knowledge_contributions_merchant on hammerex_knowledge_contributions(contributor_merchant_slug);

-- ─── Extend hammerex_videos with detected activity/stage columns ──
alter table hammerex_videos
  add column if not exists detected_activities        text[] not null default '{}',
  add column if not exists detected_installation_stage text,
  add column if not exists detected_common_mistakes   text[] not null default '{}',
  add column if not exists knowledge_pack_trade       text references hammerex_knowledge_trades(slug) on delete set null;
create index if not exists idx_videos_knowledge_pack on hammerex_videos(knowledge_pack_trade);
