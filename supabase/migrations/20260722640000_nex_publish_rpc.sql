-- Trade Intelligence · publish-a-new-version RPC.
-- Wraps the two-statement update (entries + versions) in a single
-- transaction with app.nex_editor=true set locally so the silent-edit
-- trigger allows the change. Route handlers call this via
-- supabase.rpc("fn_nex_publish_new_version", ...).

CREATE OR REPLACE FUNCTION public.fn_nex_publish_new_version(
  p_entry_id         UUID,
  p_next_version     INTEGER,
  p_title            TEXT,
  p_summary          TEXT,
  p_body_md          TEXT,
  p_category         TEXT,
  p_subcategory      TEXT,
  p_difficulty       TEXT,
  p_keywords         TEXT[],
  p_sources          JSONB,
  p_evidence         JSONB,
  p_confidence       INTEGER,
  p_change_kind      TEXT,
  p_change_summary   TEXT,
  p_proposed_by      TEXT,
  p_proposed_by_kind TEXT,
  p_approved_by      TEXT,
  p_review_id        UUID
)
RETURNS TABLE(version_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trade    TEXT;
  v_topic    TEXT;
  v_new_ver  UUID;
BEGIN
  -- Authorise the silent-edit guard for the duration of this transaction.
  PERFORM set_config('app.nex_editor', 'true', TRUE);

  -- Look up trade + topic from the current row (they don't change on edit).
  SELECT trade, topic INTO v_trade, v_topic
  FROM public.hammerex_nex_knowledge_entries
  WHERE id = p_entry_id;

  IF v_trade IS NULL THEN
    RAISE EXCEPTION 'entry % not found', p_entry_id;
  END IF;

  -- Update the entry's current state.
  UPDATE public.hammerex_nex_knowledge_entries SET
    title       = p_title,
    summary     = p_summary,
    body_md     = p_body_md,
    category    = p_category,
    subcategory = p_subcategory,
    difficulty  = p_difficulty,
    keywords    = p_keywords,
    sources     = p_sources,
    evidence    = p_evidence,
    confidence  = p_confidence,
    version     = p_next_version
  WHERE id = p_entry_id;

  -- Append the immutable version row.
  INSERT INTO public.hammerex_nex_knowledge_versions (
    entry_id, version, trade, topic, title, summary, body_md,
    category, subcategory, difficulty, keywords, sources, evidence,
    confidence, change_kind, change_summary,
    proposed_by, proposed_by_kind, approved_by, review_id
  ) VALUES (
    p_entry_id, p_next_version, v_trade, v_topic, p_title, p_summary, p_body_md,
    p_category, p_subcategory, p_difficulty, p_keywords, p_sources, p_evidence,
    p_confidence, p_change_kind, p_change_summary,
    p_proposed_by, p_proposed_by_kind, p_approved_by, p_review_id
  ) RETURNING id INTO v_new_ver;

  RETURN QUERY SELECT v_new_ver;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_nex_publish_new_version(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],JSONB,JSONB,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_nex_publish_new_version(UUID,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT[],JSONB,JSONB,INTEGER,TEXT,TEXT,TEXT,TEXT,TEXT,UUID) TO service_role;
