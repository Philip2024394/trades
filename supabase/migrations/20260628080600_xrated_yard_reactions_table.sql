-- Xrated Trades — The Yard reactions.
--
-- Facebook-style emoji per post. One row per (post, reactor) — toggling
-- changes the kind, removing deletes the row. Type
-- HammerexTradeOffYardReaction in src/lib/supabase.ts:791-797.
--
-- No route writes this yet (drift on the type-side, ahead of the
-- implementation). Codified for forward-compat so the schema matches the
-- type catalog.
--
-- post_id + listing_id are plain uuid (no FK) — yard_posts may live in a
-- different timeline on the shared DB. listing_id here is the REACTOR's
-- listing, not the post's owner.

CREATE TABLE IF NOT EXISTS public.hammerex_trade_off_yard_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('like','dislike','fire','lol','strong','wow')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hammerex_trade_off_yard_reactions_unique
  ON public.hammerex_trade_off_yard_reactions (post_id, listing_id);

CREATE INDEX IF NOT EXISTS hammerex_trade_off_yard_reactions_post_idx
  ON public.hammerex_trade_off_yard_reactions (post_id, kind);
