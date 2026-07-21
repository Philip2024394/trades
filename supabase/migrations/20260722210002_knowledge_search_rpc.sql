-- knowledge_search_semantic — pgvector cosine similarity search
-- with trade filter, tag boost, confidence gate.
--
-- knowledge_search_fulltext — tsvector fallback with same filters.
--
-- Both return the same shape so search.ts can pick either based on
-- whether an embedding was generated.

create or replace function knowledge_search_semantic(
  query_embedding    vector(1536),
  trade_filter       text[]   default null,
  tag_filter         text[]   default null,
  top_k              int      default 6,
  min_confidence     numeric  default 0.5
)
returns table (
  id                    uuid,
  trade_slug            text,
  content_type          text,
  title                 text,
  ai_summary            text,
  detailed_explanation  text,
  video_tags            text[],
  merchant_categories   text[],
  trade_categories      text[],
  source_url            text,
  source_publisher      text,
  source_type           text,
  last_verified_at      timestamptz,
  confidence_score      numeric,
  match_score           float
)
language sql
stable
as $$
  select
    e.id, e.trade_slug, e.content_type, e.title, e.ai_summary, e.detailed_explanation,
    e.video_tags, e.merchant_categories, e.trade_categories,
    e.source_url, e.source_publisher, e.source_type,
    e.last_verified_at, e.confidence_score,
    ((1 - (e.embedding <=> query_embedding))::float
      + case when tag_filter is not null and e.video_tags && tag_filter then 0.15 else 0 end
    ) as match_score
  from hammerex_knowledge_entries e
  where e.moderation_status = 'approved'
    and e.confidence_score >= min_confidence
    and e.embedding is not null
    and (trade_filter is null or e.trade_slug = any(trade_filter))
  order by match_score desc
  limit top_k
$$;

create or replace function knowledge_search_fulltext(
  query_text         text,
  trade_filter       text[]   default null,
  tag_filter         text[]   default null,
  top_k              int      default 6,
  min_confidence     numeric  default 0.5
)
returns table (
  id                    uuid,
  trade_slug            text,
  content_type          text,
  title                 text,
  ai_summary            text,
  detailed_explanation  text,
  video_tags            text[],
  merchant_categories   text[],
  trade_categories      text[],
  source_url            text,
  source_publisher      text,
  source_type           text,
  last_verified_at      timestamptz,
  confidence_score      numeric,
  match_score           float
)
language sql
stable
as $$
  with q as (
    select plainto_tsquery('english', query_text) as ts
  )
  select
    e.id, e.trade_slug, e.content_type, e.title, e.ai_summary, e.detailed_explanation,
    e.video_tags, e.merchant_categories, e.trade_categories,
    e.source_url, e.source_publisher, e.source_type,
    e.last_verified_at, e.confidence_score,
    (ts_rank(e.search_text, q.ts)::float
      + case when tag_filter is not null and e.video_tags && tag_filter then 0.2 else 0 end
    ) as match_score
  from hammerex_knowledge_entries e, q
  where e.moderation_status = 'approved'
    and e.confidence_score >= min_confidence
    and (
      e.search_text @@ q.ts
      or (tag_filter is not null and e.video_tags && tag_filter)
    )
    and (trade_filter is null or e.trade_slug = any(trade_filter))
  order by match_score desc
  limit top_k
$$;

-- Cite counter — bumps cited_by_ai_count for a set of entries
create or replace function knowledge_bump_citation(entry_ids uuid[])
returns void
language sql
as $$
  update hammerex_knowledge_entries
  set cited_by_ai_count = cited_by_ai_count + 1
  where id = any(entry_ids)
$$;
