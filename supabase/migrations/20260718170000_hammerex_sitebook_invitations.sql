-- Sitebook trade / supplier invitations (2026-07-18).
--
-- Owner-initiated invites: pick a trade from the canteens directory
-- → compose WhatsApp with a nw.app/join/{token} link → 1 washer
-- deducted → trade taps the link, sees a brief for the invited
-- project(s), accepts/declines. On accept we create
-- hammerex_sitebook_members rows for each ticked project.
--
-- Token security mirrors the reply-link pattern
-- (hammerex_sitebook_wa_threads): crypto-random 12+ chars, single-use
-- for accept/decline, revocable by owner.
--
-- SLA: 24 hours Mon-Sat (Sundays skipped) from sent_at → if still
-- pending, status flips to 'unavailable' on next read and the owner
-- panel surfaces the "invite another" notice.

CREATE TABLE IF NOT EXISTS public.hammerex_sitebook_invitations (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  token                TEXT          NOT NULL,

  homeowner_id         UUID          NOT NULL REFERENCES public.hammerex_homeowners(id) ON DELETE CASCADE,
  trade_listing_id     UUID          NOT NULL,
  trade_merchant_slug  TEXT,
  trade_merchant_name  TEXT,
  trade_whatsapp_e164  TEXT,

  -- Which project(s) the trade is being invited to. Owner picks 1+
  -- from their live projects; opt-in (empty ticks = form invalid).
  project_ids          UUID[]        NOT NULL DEFAULT '{}',

  message_body         TEXT          NOT NULL,

  -- 'pending'     — sent, awaiting trade response
  -- 'accepted'    — trade tapped Accept on /join/{token}
  -- 'declined'    — trade tapped Decline
  -- 'revoked'     — owner killed the invitation
  -- 'unavailable' — SLA elapsed without response (owner notice)
  status               TEXT          NOT NULL DEFAULT 'pending',

  -- 1 washer at send. We record it here for audit + so a resend
  -- within 7 days can skip re-charging.
  washers_charged      INTEGER       NOT NULL DEFAULT 1,
  resend_count         INTEGER       NOT NULL DEFAULT 0,

  sent_at              TIMESTAMPTZ,
  responded_at         TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  sla_marked_at        TIMESTAMPTZ,        -- when the 24h Mon-Sat flip happened

  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_sitebook_invitations_token   ON public.hammerex_sitebook_invitations (token);
CREATE INDEX IF NOT EXISTS idx_sitebook_invitations_homeowner       ON public.hammerex_sitebook_invitations (homeowner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sitebook_invitations_trade           ON public.hammerex_sitebook_invitations (trade_listing_id);
CREATE INDEX IF NOT EXISTS idx_sitebook_invitations_status          ON public.hammerex_sitebook_invitations (status);

ALTER TABLE public.hammerex_sitebook_invitations ENABLE ROW LEVEL SECURITY;
