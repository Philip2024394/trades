-- Apprenticeship requests + contact ledger.
-- Young people (16+) submit structured apprenticeship applications;
-- verified trades in the requested trade + area get notified and can
-- reveal contact details for 1 washer. Contact is one-time per
-- trade+request pair (no double-charging).

CREATE TABLE IF NOT EXISTS hammerex_apprenticeship_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_slug            text        NOT NULL,
  full_name             text        NOT NULL,
  age                   int         NOT NULL CHECK (age >= 16 AND age <= 65),
  whatsapp              text        NOT NULL,
  city                  text,
  postcode              text,
  address_line          text,
  worked_before         boolean     NOT NULL DEFAULT false,
  leaving_school        boolean     NOT NULL DEFAULT false,
  experience_summary    text,
  duties_aware          boolean     NOT NULL DEFAULT false,
  discipline_aware      boolean     NOT NULL DEFAULT false,
  about_me              text,
  cv_url                text,
  photo_url             text,
  status                text        NOT NULL DEFAULT 'live'
                        CHECK (status IN ('live','matched','withdrawn','expired')),
  contact_count         int         NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  yard_post_id          uuid
);

CREATE INDEX IF NOT EXISTS idx_apprentice_reqs_trade_status
  ON hammerex_apprenticeship_requests (trade_slug, status);
CREATE INDEX IF NOT EXISTS idx_apprentice_reqs_city_status
  ON hammerex_apprenticeship_requests (city, status);
CREATE INDEX IF NOT EXISTS idx_apprentice_reqs_created
  ON hammerex_apprenticeship_requests (created_at DESC);

-- Contact ledger. Every row = a trade paid 1 washer to reveal the
-- apprentice's WhatsApp. UNIQUE keeps it one-time per pair.
CREATE TABLE IF NOT EXISTS hammerex_apprenticeship_contacts (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id              uuid        NOT NULL
                          REFERENCES hammerex_apprenticeship_requests(id) ON DELETE CASCADE,
  merchant_slug           text        NOT NULL,
  washer_transaction_id   uuid,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, merchant_slug)
);

CREATE INDEX IF NOT EXISTS idx_apprentice_contacts_merchant
  ON hammerex_apprenticeship_contacts (merchant_slug);
