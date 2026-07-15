-- Materials tagging for Site Interest images.
--
-- Per feedback_never_suggest_extra_products.md refinement (Philip
-- 2026-07-16): a "Get the materials" button on Site Interest cards
-- is allowed ONLY when the products in the image have been human-
-- tagged. Auto-AI inference is banned because it will be wrong
-- sometimes and re-open the trust hole the "no cross-sell" rule
-- was designed to close.
--
-- Two data sources feed this:
--   1. Trade submits an image AND tags what they used (self-serve)
--   2. Admin adds/edits tags during moderation (curatorial)
--
-- The tag is a lightweight { kind, ref, label, url } tuple so the
-- same schema handles Hammerex SKUs, Trade Center listings, and
-- future external product refs (Screwfix links, etc.) without new
-- columns per product source.

alter table public.hammerex_image_submissions
  add column if not exists materials jsonb not null default '[]'::jsonb;

comment on column public.hammerex_image_submissions.materials is
  $$Array of { kind: "hammerex" | "trade_center" | "external",
     ref: string, label: string, url: string } tuples. Human-
     tagged only — never populated by AI vision inference.
     Empty array = no "Get materials" button rendered on the
     Site Interest card. See
     feedback_never_suggest_extra_products.md.$$;

-- GIN index on the JSONB so admin can search "images tagged with
-- product X" and Site Interest can filter by material class.
create index if not exists hammerex_image_submissions_materials_gin
  on public.hammerex_image_submissions using gin (materials);
