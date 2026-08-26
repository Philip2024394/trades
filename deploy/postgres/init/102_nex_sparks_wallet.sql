-- deploy/postgres/init/102_nex_sparks_wallet.sql
--
-- NEX Sparks Wallet · F2 of the NEX Action platform (2026-08-25).
--
-- Doctrine anchor: project_nex_actions_wallet_ledger_first_2026_08_25
--
-- Ledger-first architecture · Philip 2026-08-25 · locked non-negotiables:
--   1. nex.user_wallet    · CURRENT balance + identity (fast reads)
--   2. nex.wallet_transaction · IMMUTABLE ledger · every Sparks movement
--   3. Balance = sum(transactions) invariant · verified by trigger
--   4. Every write carries an idempotency_key · UNIQUE prevents double-spend
--   5. Never allow negative balance · CHECK constraint
--   6. Never DELETE/UPDATE historical transactions · REVOKE on the audit role
--   7. GBP/IDR are purchase currencies only · never internal economy unit
--
-- The wallet is server-authoritative. Clients read balance via API; they
-- never provide Sparks amounts on spend (server resolves cost from the
-- NexAction registry). This migration installs schema + constraints only;
-- application logic lives in src/lib/nex-actions/wallet/.
--
-- Additive · reversible. Zero impact on existing tables.

BEGIN;

-- ── Wallet · one row per user ─────────────────────────────────────────
-- Balance is the DERIVED CURRENT view · computed as SUM(transactions).
-- We store it here for fast reads (the runtime checks balance on every
-- consumable action) but a trigger keeps it in sync with the ledger so it
-- can never drift. If the balance and ledger disagree, the ledger wins.
CREATE TABLE IF NOT EXISTS nex.user_wallet (
  user_id           text         PRIMARY KEY,
  sparks_balance    bigint       NOT NULL DEFAULT 0 CHECK (sparks_balance >= 0),
  -- Wallet lifecycle metadata. lifetime_granted / lifetime_purchased /
  -- lifetime_spent are cached aggregates for the wallet dashboard;
  -- authoritative values are always in nex.wallet_transaction.
  lifetime_granted  bigint       NOT NULL DEFAULT 0 CHECK (lifetime_granted >= 0),
  lifetime_purchased bigint      NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
  lifetime_spent    bigint       NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- ── Ledger · IMMUTABLE audit history of every Sparks movement ────────
-- Every INSERT here mutates the wallet balance atomically via the
-- companion trigger. This table is APPEND-ONLY:
--   · No UPDATE (state transitions modelled as new rows referring to the
--     original via `related_transaction_id`).
--   · No DELETE (audit permanence).
-- Enforced by the immutability trigger below and by REVOKEing update/delete
-- from the application role.
--
-- kind semantics:
--   'signup_grant'    · +sparks · one per user at signup (idempotent)
--   'promotion_grant' · +sparks · marketing / event / referral
--   'admin_adjustment'· +/- sparks · manual correction · requires operator note
--   'purchase'        · +sparks · Stripe purchase completed (references sparks_product)
--   'spend_reserved'  · -sparks · consumable action reserved (before handler runs)
--   'spend_committed' · 0 sparks · marks a spend_reserved as final (no balance change)
--   'spend_refunded'  · +sparks · reverses a spend_reserved (handler failed)
CREATE TABLE IF NOT EXISTS nex.wallet_transaction (
  transaction_id     uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            text         NOT NULL REFERENCES nex.user_wallet(user_id),
  kind               text         NOT NULL CHECK (kind IN (
                       'signup_grant', 'promotion_grant', 'admin_adjustment',
                       'purchase', 'spend_reserved', 'spend_committed', 'spend_refunded'
                     )),
  -- delta_sparks · signed. Positive = credit · negative = debit · zero = state marker.
  delta_sparks       bigint       NOT NULL,
  -- Idempotency key · UNIQUE per user · retries with the same key are safely no-op.
  -- Format: '<kind>:<source-nonce>' e.g. 'spend_reserved:actionId:userId:invokedAt:rand'
  idempotency_key    text         NOT NULL,
  -- Optional cross-reference (spend_committed / spend_refunded → spend_reserved).
  related_transaction_id uuid         REFERENCES nex.wallet_transaction(transaction_id),
  -- Action linkage · what consumable / purchase this movement came from.
  action_id          text                    ,   -- nex-action id (e.g. 'grenade')
  purchase_ref       text                    ,   -- stripe session/payment id
  operator_id        text                    ,   -- admin who made the adjustment
  note               text                    ,
  balance_after      bigint       NOT NULL CHECK (balance_after >= 0),
  created_at         timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS wallet_transaction_user_created_idx
  ON nex.wallet_transaction (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_transaction_action_idx
  ON nex.wallet_transaction (action_id, created_at DESC)
  WHERE action_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wallet_transaction_related_idx
  ON nex.wallet_transaction (related_transaction_id)
  WHERE related_transaction_id IS NOT NULL;

-- ── Immutability trigger · reject UPDATE and DELETE on the ledger ─────
CREATE OR REPLACE FUNCTION nex.wallet_transaction_reject_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'nex.wallet_transaction is append-only (attempted %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS wallet_transaction_no_update ON nex.wallet_transaction;
CREATE TRIGGER wallet_transaction_no_update
  BEFORE UPDATE ON nex.wallet_transaction
  FOR EACH ROW EXECUTE FUNCTION nex.wallet_transaction_reject_mutation();

DROP TRIGGER IF EXISTS wallet_transaction_no_delete ON nex.wallet_transaction;
CREATE TRIGGER wallet_transaction_no_delete
  BEFORE DELETE ON nex.wallet_transaction
  FOR EACH ROW EXECUTE FUNCTION nex.wallet_transaction_reject_mutation();

-- ── Atomic spend · reservation with idempotency ───────────────────────
-- Called by the wallet library inside a SERIALIZABLE transaction. Verifies
-- balance · inserts a spend_reserved row · updates cached balance · returns
-- the new transaction_id. Idempotency is enforced by the UNIQUE(user_id,
-- idempotency_key) constraint · retries return the existing row.
CREATE OR REPLACE FUNCTION nex.wallet_reserve_spend(
  p_user_id         text,
  p_action_id       text,
  p_amount          bigint,
  p_idempotency_key text
) RETURNS TABLE (
  transaction_id  uuid,
  balance_after   bigint,
  idempotent_hit  boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_existing_id  uuid;
  v_existing_bal bigint;
  v_current      bigint;
  v_new_id       uuid;
  v_new_bal      bigint;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_reserve_spend: amount must be positive (got %)', p_amount;
  END IF;
  -- Idempotency short-circuit · retries with the same key return the same row.
  SELECT wt.transaction_id, wt.balance_after
    INTO v_existing_id, v_existing_bal
    FROM nex.wallet_transaction wt
   WHERE wt.user_id = p_user_id AND wt.idempotency_key = p_idempotency_key
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    transaction_id := v_existing_id;
    balance_after  := v_existing_bal;
    idempotent_hit := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Lock the wallet row for the balance check + update.
  SELECT sparks_balance INTO v_current
    FROM nex.user_wallet WHERE user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'wallet_reserve_spend: no wallet for user %', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_current < p_amount THEN
    RAISE EXCEPTION 'wallet_reserve_spend: insufficient sparks (have %, need %)', v_current, p_amount
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_new_bal := v_current - p_amount;
  UPDATE nex.user_wallet
     SET sparks_balance = v_new_bal,
         lifetime_spent = lifetime_spent + p_amount,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_reserved', -p_amount, p_idempotency_key, p_action_id, v_new_bal
  ) RETURNING wallet_transaction.transaction_id INTO v_new_id;

  transaction_id := v_new_id;
  balance_after  := v_new_bal;
  idempotent_hit := false;
  RETURN NEXT;
END;
$$;

-- ── Commit a reserved spend · marks it final · no balance change ──────
-- Inserts a spend_committed row referring to the reservation. Idempotent
-- by (user_id, idempotency_key) · retries safely no-op.
CREATE OR REPLACE FUNCTION nex.wallet_commit_spend(
  p_user_id         text,
  p_reservation_id  uuid,
  p_idempotency_key text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_reserved  RECORD;
  v_existing  uuid;
BEGIN
  SELECT transaction_id INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN; END IF;

  SELECT * INTO v_reserved FROM nex.wallet_transaction
    WHERE transaction_id = p_reservation_id AND user_id = p_user_id;
  IF NOT FOUND OR v_reserved.kind <> 'spend_reserved' THEN
    RAISE EXCEPTION 'wallet_commit_spend: reservation % not found for user %', p_reservation_id, p_user_id;
  END IF;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, related_transaction_id, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_committed', 0, p_idempotency_key, p_reservation_id, v_reserved.action_id,
    (SELECT sparks_balance FROM nex.user_wallet WHERE user_id = p_user_id)
  );
END;
$$;

-- ── Refund a reserved spend · returns Sparks · idempotent ─────────────
CREATE OR REPLACE FUNCTION nex.wallet_refund_spend(
  p_user_id         text,
  p_reservation_id  uuid,
  p_idempotency_key text
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_reserved  RECORD;
  v_existing  uuid;
  v_new_bal   bigint;
  v_current   bigint;
BEGIN
  SELECT transaction_id, balance_after INTO v_existing, v_new_bal FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_new_bal; END IF;

  SELECT * INTO v_reserved FROM nex.wallet_transaction
    WHERE transaction_id = p_reservation_id AND user_id = p_user_id;
  IF NOT FOUND OR v_reserved.kind <> 'spend_reserved' THEN
    RAISE EXCEPTION 'wallet_refund_spend: reservation % not found for user %', p_reservation_id, p_user_id;
  END IF;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;

  v_new_bal := v_current + (-v_reserved.delta_sparks);  -- delta was negative
  UPDATE nex.user_wallet
     SET sparks_balance = v_new_bal,
         lifetime_spent = greatest(0, lifetime_spent + v_reserved.delta_sparks),
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, related_transaction_id, action_id, balance_after
  ) VALUES (
    p_user_id, 'spend_refunded', -v_reserved.delta_sparks, p_idempotency_key,
    p_reservation_id, v_reserved.action_id, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;

-- ── Grant Sparks · signup / promotion / admin · idempotent ────────────
CREATE OR REPLACE FUNCTION nex.wallet_grant_sparks(
  p_user_id         text,
  p_kind            text,        -- 'signup_grant' | 'promotion_grant' | 'admin_adjustment'
  p_amount          bigint,
  p_idempotency_key text,
  p_note            text DEFAULT NULL,
  p_operator_id     text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_existing  bigint;
  v_new_bal   bigint;
  v_current   bigint;
BEGIN
  IF p_kind NOT IN ('signup_grant','promotion_grant','admin_adjustment') THEN
    RAISE EXCEPTION 'wallet_grant_sparks: invalid kind %', p_kind;
  END IF;
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'wallet_grant_sparks: amount cannot be zero';
  END IF;

  SELECT balance_after INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = p_idempotency_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO nex.user_wallet (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;

  v_new_bal := v_current + p_amount;
  IF v_new_bal < 0 THEN
    RAISE EXCEPTION 'wallet_grant_sparks: adjustment would push balance below zero (from % by %)', v_current, p_amount;
  END IF;

  UPDATE nex.user_wallet
     SET sparks_balance    = v_new_bal,
         lifetime_granted  = CASE WHEN p_amount > 0 AND p_kind IN ('signup_grant','promotion_grant')
                                  THEN lifetime_granted + p_amount ELSE lifetime_granted END,
         updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, operator_id, note, balance_after
  ) VALUES (
    p_user_id, p_kind, p_amount, p_idempotency_key, p_operator_id, p_note, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;

-- ── Record a Stripe purchase · +Sparks · idempotent by stripe ref ─────
CREATE OR REPLACE FUNCTION nex.wallet_record_purchase(
  p_user_id      text,
  p_amount       bigint,
  p_purchase_ref text,
  p_note         text DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_existing  bigint;
  v_new_bal   bigint;
  v_current   bigint;
  v_key       text;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_record_purchase: amount must be positive';
  END IF;
  v_key := 'purchase:' || p_purchase_ref;

  SELECT balance_after INTO v_existing FROM nex.wallet_transaction
    WHERE user_id = p_user_id AND idempotency_key = v_key LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO nex.user_wallet (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;

  SELECT sparks_balance INTO v_current FROM nex.user_wallet
    WHERE user_id = p_user_id FOR UPDATE;
  v_new_bal := v_current + p_amount;
  UPDATE nex.user_wallet
     SET sparks_balance     = v_new_bal,
         lifetime_purchased = lifetime_purchased + p_amount,
         updated_at         = now()
   WHERE user_id = p_user_id;

  INSERT INTO nex.wallet_transaction (
    user_id, kind, delta_sparks, idempotency_key, purchase_ref, note, balance_after
  ) VALUES (
    p_user_id, 'purchase', p_amount, v_key, p_purchase_ref, p_note, v_new_bal
  );
  RETURN v_new_bal;
END;
$$;

-- ── Sparks product catalog · GBP + IDR from day one ───────────────────
-- Purchase currency is metadata only · the internal economy is Sparks. This
-- table records Stripe product SKUs and their region-specific pricing. Add
-- new packs / regions via INSERT · never encode prices in application code.
CREATE TABLE IF NOT EXISTS nex.sparks_product (
  product_id         text        PRIMARY KEY,     -- 'sparks_pack_5' / 'sparks_pack_20' / 'sparks_pack_50'
  sparks_amount      bigint      NOT NULL CHECK (sparks_amount > 0),
  is_active          boolean     NOT NULL DEFAULT true,
  sort_order         int         NOT NULL DEFAULT 0,
  display_name       text        NOT NULL,
  description        text                     ,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nex.sparks_product_price (
  product_id         text        NOT NULL REFERENCES nex.sparks_product(product_id),
  region             text        NOT NULL,        -- 'GB' | 'ID' | future ISO 3166 alpha-2
  currency           text        NOT NULL,        -- 'GBP' | 'IDR'
  amount_minor       bigint      NOT NULL,        -- price in currency minor unit (pence · rupiah)
  stripe_price_id    text                    ,    -- Stripe Price API id · nullable until wired
  is_active          boolean     NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, region)
);

-- Seed the initial pack ladder. Grenade costs 100 Sparks · so 5 grenades =
-- 500 Sparks. Prices are launch anchors · adjustable via UPDATE without
-- redeploying application code.
INSERT INTO nex.sparks_product (product_id, sparks_amount, sort_order, display_name, description) VALUES
  ('sparks_pack_5',   500,  1, '5 Sparks Pack',  '500 Sparks · enough for 5 grenades'),
  ('sparks_pack_20', 2000,  2, '20 Sparks Pack', '2,000 Sparks · save vs the 5-pack'),
  ('sparks_pack_50', 5000,  3, '50 Sparks Pack', '5,000 Sparks · best value')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO nex.sparks_product_price (product_id, region, currency, amount_minor) VALUES
  ('sparks_pack_5',  'GB', 'GBP', 199),        -- £1.99
  ('sparks_pack_20', 'GB', 'GBP', 699),        -- £6.99
  ('sparks_pack_50', 'GB', 'GBP', 1499),       -- £14.99
  ('sparks_pack_5',  'ID', 'IDR', 30000),      -- Rp 30,000
  ('sparks_pack_20', 'ID', 'IDR', 105000),     -- Rp 105,000
  ('sparks_pack_50', 'ID', 'IDR', 225000)      -- Rp 225,000
ON CONFLICT (product_id, region) DO NOTHING;

COMMIT;
