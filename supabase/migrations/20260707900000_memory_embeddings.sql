-- G6 · Memory embeddings — pgvector + similarity search RPC.
--
-- Adds a 1536-dim embedding column on memory_records + an ivfflat
-- index for fast cosine similarity search. Enables the "show me every
-- sandstone patio in LS6 with grey pointing" natural-language query
-- pattern that motivated the three-tier design in the first place.
--
-- The 1536-dim choice matches OpenAI text-embedding-3-small — swap
-- dims + provider without changing the caller by updating this
-- migration + the embedText.ts constant together.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE memory_records
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- ivfflat is the pragmatic choice for small-to-medium catalogues
-- (< 1M rows). Lists = sqrt(rows) rule of thumb; 100 is right for
-- the first few thousand records + scales fine to ~100k.
CREATE INDEX IF NOT EXISTS memory_records_embedding_idx
  ON memory_records
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- SQL function callers hit via Supabase RPC. Enforces merchant
-- scoping in the function body so callers can't leak cross-merchant
-- results even with a leaked service key.
CREATE OR REPLACE FUNCTION match_memory_records(
  filter_merchant_id uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 10,
  min_similarity float DEFAULT 0.0
) RETURNS TABLE (
  id uuid,
  record_type text,
  facets jsonb,
  postcode text,
  latitude double precision,
  longitude double precision,
  linked_event_ids uuid[],
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.record_type,
    r.facets,
    r.postcode,
    r.latitude,
    r.longitude,
    r.linked_event_ids,
    r.created_at,
    r.updated_at,
    (1 - (r.embedding <=> query_embedding)) AS similarity
  FROM memory_records r
  WHERE r.merchant_id = filter_merchant_id
    AND r.embedding IS NOT NULL
    AND (1 - (r.embedding <=> query_embedding)) >= min_similarity
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMIT;
