-- Customer Q&A — public visitors ask questions on a product's PDP;
-- the trade (and any owner-marked customer) can post answers. Same
-- moderation model as yard comments: rows default to 'live', a flag
-- count trigger hides at 3+ flags pending admin review.
--
-- Questions are 1-to-many with answers. Both soft-delete via
-- deleted_at so the thread stays coherent when a moderator removes
-- content. Public listing joins answers back to the parent question.

CREATE TABLE IF NOT EXISTS hammerex_xrated_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL
    REFERENCES hammerex_xrated_products(id) ON DELETE CASCADE,
  -- Free-text display name at the time of asking. NULL renders as
  -- "Anonymous" on the PDP. We don't force sign-in — a shopper
  -- shouldn't need an account to ask a question about a product.
  asked_by text CHECK (asked_by IS NULL OR char_length(asked_by) BETWEEN 1 AND 60),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 500),
  flag_count int NOT NULL DEFAULT 0 CHECK (flag_count >= 0),
  moderation_status text NOT NULL DEFAULT 'live'
    CHECK (moderation_status IN ('live', 'hidden', 'spam')),
  moderated_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xrated_questions_product_created_idx
  ON hammerex_xrated_questions (product_id, created_at DESC)
  WHERE deleted_at IS NULL AND moderation_status = 'live';


CREATE TABLE IF NOT EXISTS hammerex_xrated_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL
    REFERENCES hammerex_xrated_questions(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 1000),
  -- by_vendor=true = the trade themselves answered (badges as "From
  -- <trade name>" on the PDP). by_vendor=false = a customer answered
  -- (renders "— by_name" or "Verified customer").
  by_vendor boolean NOT NULL DEFAULT false,
  by_name text CHECK (by_name IS NULL OR char_length(by_name) BETWEEN 1 AND 60),
  moderation_status text NOT NULL DEFAULT 'live'
    CHECK (moderation_status IN ('live', 'hidden', 'spam')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS xrated_answers_question_created_idx
  ON hammerex_xrated_answers (question_id, created_at)
  WHERE deleted_at IS NULL AND moderation_status = 'live';
