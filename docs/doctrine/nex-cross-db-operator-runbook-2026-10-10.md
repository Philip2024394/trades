# NEX Cross-DB Operator Runbook · 2026-10-10

**Agent:** E (Cross-DB Operator Runbook) · **Branch:** `nex/directory-work`
**Status:** DRAFT · requires operator review + explicit founder sign-off before any step is executed.
**Companions:**

- `docs/doctrine/adr-nex-cross-db-owner-link-2026-10-09.md` (ADR authorising the pattern)
- `docs/doctrine/owner-claim-architecture-complete-2026-10-10.md` (Agent O's NEX-side wave)
- `docs/doctrine/nex-cross-db-identity-model-2026-10-10.md` (doctrine for why this is cross-DB)
- `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql` (DRAFT migration)
- `scripts/nex-canonical/_cross-db-reconciler-dry-run.mjs` (reconciler dry-run harness)
- `scripts/nex-canonical/_cross-db-identity-verifier.mjs` (NEX-side read-only verifier)

---

## 0 · What this document is (and is not)

This runbook is an **operator-executable procedure** for applying the
Supabase-side migration that completes the cross-DB owner link described
in the ADR. It documents preconditions, the apply sequence,
post-migration verification, the reconciler contract that runs on every
successful `verifyClaim`, failure handling, rollback, and the full set
of edge cases.

**This runbook does NOT execute anything on real Supabase.** It
describes the sequence an authorised operator will follow. The
operator may copy the SQL from §3 into the Supabase SQL editor manually
after the preconditions in §1 are satisfied.

**No cross-DB referential integrity is guaranteed by this scheme.** We
intentionally use a soft reference (nullable UUID column with no FK)
instead of a hard FK because (a) FKs cannot cross physical DB clusters
and (b) alternatives like FDW were rejected in the ADR for operational
reasons. The "contract" is enforced by the reconciler at write time
plus a weekly orphan sweep, both at the application layer.

---

## 1 · Preconditions

All of the following MUST be true before the operator applies the
migration. The operator records each item in the operator log (shared
Google Doc; append-only).

### 1.1 · Baselines captured

- [ ] `nex_business` row count in production Supabase recorded.
      Query (operator runs in Supabase SQL editor):
      ```sql
      SELECT count(*) AS nex_business_rows FROM public.nex_business;
      ```
- [ ] `nex.business_canonical` row count in local `nex_dev` recorded.
      Query (operator runs via `psql` or any pg client bound to
      `nex_dev`):
      ```sql
      SELECT count(*) AS canonical_rows FROM nex.business_canonical;
      ```
- [ ] `nex.business_canonical` row count in Project B harvest substrate
      recorded (if that database is live and distinct from `nex_dev`).

### 1.2 · Access + backup prerequisites

- [ ] Operator has shell access to the Supabase SQL editor for Project
      B (`ijvqdvsvwtwxzcqmoqit`).
- [ ] Operator has verified that the Supabase daily backup for the
      target window includes the pre-migration state.
- [ ] Operator has downloaded (or confirmed presence of) a point-in-time
      snapshot of `public.nex_business` taken within the last 24 hours.
- [ ] Dev server at `localhost:3008` is left RUNNING (do not restart) —
      the migration is schema-only and applies to Supabase, not local
      Postgres.

### 1.3 · Authorisation record

- [ ] Explicit founder sign-off recorded in the operator log with:
      - Date / time
      - Reviewer (founder name)
      - Reference to the diff of
        `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql`
        at the commit the operator is applying from.
      - Reference to this runbook at the same commit.

### 1.4 · Reconciler infrastructure prerequisites

The reconciler described in §5 does **not** run until the Supabase
column exists. Before applying the migration, the operator confirms
that the reconciler module itself is either (a) already deployed and
feature-flagged off, or (b) ready to deploy immediately after the
migration lands. If neither, applying the migration is premature —
the column will accumulate NULLs for every VERIFIED claim and the
weekly orphan sweep will begin flagging drift.

---

## 2 · Pre-migration validation (Supabase SQL)

The operator runs **all** probes below against production Supabase
BEFORE pasting the migration body. Any `UNEXPECTED` row aborts the
procedure.

### 2.1 · Confirm the column does not already exist

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'nex_business'
   AND column_name  = 'canonical_business_id';
-- EXPECTED: zero rows.
```

### 2.2 · Confirm no conflicting index name

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname  = 'nex_business_canonical_business_id_uq';
-- EXPECTED: zero rows.
```

### 2.3 · Confirm `nex_business` table exists and is writable

```sql
SELECT 1
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name   = 'nex_business';
-- EXPECTED: one row.
```

### 2.4 · Confirm current row count matches the baseline captured in §1.1

```sql
SELECT count(*) AS nex_business_rows FROM public.nex_business;
-- EXPECTED: same number as §1.1. Any drift indicates concurrent writes.
```

If any check in §2 fails, STOP. Do not proceed to §3.

---

## 3 · Applying the migration (step-by-step)

### 3.1 · Enter maintenance window (optional but recommended)

The migration is schema-only and additive (new nullable column, new
partial index). It does NOT lock the table for writes beyond the
duration of `ALTER TABLE ADD COLUMN` and `CREATE INDEX`. For a table
with ≤10k rows this is milliseconds. A maintenance window is only
required if the table is >1M rows (not currently the case).

### 3.2 · Capture a point-in-time snapshot

Operator takes a fresh dump of `public.nex_business` (schema + data)
using the Supabase dashboard "Database → Backups" surface, or:

```bash
pg_dump --schema=public --table=nex_business \
  "$SUPABASE_DIRECT_CONNECTION_STRING" \
  > ./snapshots/pre_canonical_business_id_$(date +%Y%m%d_%H%M%S).sql
```

Record the snapshot file path in the operator log.

### 3.3 · Open Supabase SQL editor

Operator opens the SQL editor in the Supabase dashboard for Project B
(`ijvqdvsvwtwxzcqmoqit`), on the `public` schema.

### 3.4 · Paste the migration body (verbatim)

The migration SQL (the body of
`nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql`
between the `BEGIN;` and the final `COMMIT;`) is reproduced here
verbatim so the operator does not need to context-switch to the
filesystem during apply:

```sql
BEGIN;

ALTER TABLE public.nex_business
  ADD COLUMN IF NOT EXISTS canonical_business_id uuid;

COMMENT ON COLUMN public.nex_business.canonical_business_id IS
  'Cross-DB soft reference to nex.business_canonical.canonical_business_id (NEX Postgres). Not a hard FK — enforced by the reconciler service at verify time. See docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md.';

CREATE UNIQUE INDEX IF NOT EXISTS nex_business_canonical_business_id_uq
  ON public.nex_business (canonical_business_id)
  WHERE canonical_business_id IS NOT NULL;

COMMIT;
```

The three statements are wrapped in a single transaction. Either all
succeed or none do.

### 3.5 · Run it

Operator clicks "Run" in the SQL editor. Expected output: a single
success message (zero rows returned by DDL).

### 3.6 · Record the migration timestamp

Operator records in the operator log:

- Supabase apply timestamp (as reported by the editor).
- Any warning messages (there should be none).
- Row count re-check (§2.4) — must still match the baseline.

---

## 4 · Post-migration verification (SQL probes)

All of the probes below MUST return the expected result. Any
`UNEXPECTED` triggers rollback (§7).

### 4.1 · Column exists and is nullable

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'nex_business'
   AND column_name  = 'canonical_business_id';
-- EXPECTED:
--   canonical_business_id | uuid | YES
```

### 4.2 · Unique partial index exists

```sql
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND indexname  = 'nex_business_canonical_business_id_uq';
-- EXPECTED: one row. indexdef contains both:
--   CREATE UNIQUE INDEX ... ON public.nex_business (canonical_business_id)
--   WHERE (canonical_business_id IS NOT NULL)
```

### 4.3 · Column comment is set

```sql
SELECT col_description(
  'public.nex_business'::regclass,
  (SELECT ordinal_position FROM information_schema.columns
    WHERE table_schema='public' AND table_name='nex_business'
      AND column_name='canonical_business_id')
) AS comment;
-- EXPECTED: starts with 'Cross-DB soft reference to ...'.
```

### 4.4 · No FK was accidentally created

```sql
SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE conrelid = 'public.nex_business'::regclass
   AND contype  = 'f';
-- EXPECTED: zero rows mentioning canonical_business_id.
```

### 4.5 · Row count unchanged

```sql
SELECT count(*) AS nex_business_rows FROM public.nex_business;
-- EXPECTED: identical to §1.1 and §2.4.
```

### 4.6 · All existing rows have NULL in the new column

```sql
SELECT count(*) AS non_null_canonical_links
  FROM public.nex_business
 WHERE canonical_business_id IS NOT NULL;
-- EXPECTED: 0.
```

### 4.7 · Partial unique index tolerates many NULLs

```sql
EXPLAIN SELECT 1
  FROM public.nex_business
 WHERE canonical_business_id = '00000000-0000-0000-0000-000000000001'::uuid;
-- EXPECTED: plan references nex_business_canonical_business_id_uq
--           (uses the partial unique index for lookups).
```

### 4.8 · Writes still work (dry-run via EXPLAIN)

```sql
EXPLAIN UPDATE public.nex_business
   SET canonical_business_id = '00000000-0000-0000-0000-000000000002'::uuid
 WHERE owner_account_id = '00000000-0000-0000-0000-000000000000'::uuid
   AND canonical_business_id IS NULL;
-- EXPECTED: a plan is produced; no error about missing column.
```

If any of §4.1–§4.8 is UNEXPECTED, proceed to rollback (§7).

---

## 5 · Reconciler contract (runs on every successful `verifyClaim`)

The reconciler is a server-side module (not yet authored; see runbook
§10 for status) that converts a successful NEX-side `verifyClaim` into
the corresponding Supabase-side link write.

### 5.1 · Signal (NEX side triggers reconciler)

- Trigger: `nex.business_claim.state` transitions to `VERIFIED` on a
  row whose `claimed_by_account_id` is non-null AND does not match the
  `anon:%` pattern.
- Delivery: the reconciler is invoked synchronously by
  `verifyClaimCodeAction` (same request path as the sealed
  `verifyClaim`). If the reconciler fails, see §6 — the NEX-side
  write is NOT rolled back.

### 5.2 · Inputs available to the reconciler

- `canonical_business_id uuid` (NEX side)
- `claimed_by_account_id text` (NEX side; is the Supabase
  `nex_account.id` cast as text)
- `verified_at timestamptz` (NEX side)

### 5.3 · Reconciler SQL (Supabase side)

**Attempt 1 — link existing profile:**

```sql
UPDATE public.nex_business
   SET canonical_business_id = $1   -- canonical uuid
 WHERE owner_account_id = $2        -- Supabase account id (uuid)
   AND canonical_business_id IS NULL
RETURNING id;
```

Behaviour by rows-affected:

- `0 rows`: owner has no `nex_business` row yet. Proceed to Attempt 2.
- `1 row`: linked. Emit audit event (§5.4). Done.
- `>1 row`: operator alert — owner has multiple business profiles with
  no canonical linked, and we have no deterministic rule for which to
  link. The reconciler ABORTS, emits a `cross_db_reconcile_ambiguous`
  audit event, and leaves the Supabase side untouched. Operator triages
  manually.

**Attempt 2 — stub a new profile (only if Attempt 1 returned 0 rows):**

```sql
INSERT INTO public.nex_business (
  owner_account_id,
  canonical_business_id,
  status,
  created_at
) VALUES (
  $2,
  $1,
  'claim_pending',
  now()
)
RETURNING id;
```

Expected: `1 row`. If the INSERT fails with a unique-violation on
`nex_business_canonical_business_id_uq`, that means a race condition
linked the canonical to a different `nex_business` row between
Attempt 1 and Attempt 2. The reconciler ABORTS and emits
`cross_db_reconcile_race` for operator triage.

### 5.4 · Audit event emission

Every reconciler outcome writes one row to the NEX Postgres audit log.
The audit table name is `nex.cross_db_reconcile_log` (to be authored
in a follow-up NEX-side migration — not part of this wave).

Shape:

```sql
-- Future NEX-side migration (NOT in this runbook; sketched for reference):
CREATE TABLE nex.cross_db_reconcile_log (
  id              bigserial PRIMARY KEY,
  canonical_id    uuid        NOT NULL,
  account_id      text        NOT NULL,
  outcome         text        NOT NULL,
  -- outcome values: linked_existing | stubbed_new | ambiguous | race |
  --                 anon_skipped | supabase_error
  supabase_row_id uuid        NULL,
  error_text      text        NULL,
  attempted_at    timestamptz NOT NULL DEFAULT now()
);
```

The reconciler emits one row per invocation. The weekly orphan sweep
(§8) joins against this log to find VERIFIED claims that never got a
successful `linked_existing` or `stubbed_new` outcome.

### 5.5 · Idempotency

- Attempt 1's `UPDATE ... WHERE canonical_business_id IS NULL`
  guarantees a second verifyClaim call on an already-linked row writes
  zero rows (NULL predicate fails on the second pass). This is the
  correct benign no-op.
- Attempt 2's `INSERT ... ON CONFLICT` is not required because the
  partial unique index rejects duplicates and the reconciler treats
  the rejection as `cross_db_reconcile_race` (see §5.3).

### 5.6 · Anonymous claims (`anon:*` fingerprint)

If `claimed_by_account_id` matches `anon:%`, the reconciler emits
`anon_skipped` and does NOT touch Supabase. The admin's manual
"link-anon-to-account" tool (future wave) is the only path from an
`anon:` claim to a real `nex_business` row.

---

## 6 · Reconciler failure handling

### 6.1 · The NEX-side claim is NOT rolled back on reconciler failure

The sealed `verifyClaim` writes NEX Postgres under its own transaction.
That transaction COMMITs before the reconciler fires. If the
reconciler throws, the NEX-side canonical remains `OWNER_CLAIMED` and
the business_claim row remains `VERIFIED`. **NEX Postgres is the
source of truth for canonical ownership.**

### 6.2 · The Supabase link is retried

Reconciler failures emit `supabase_error` to the audit log. A retry
queue (deferred infrastructure — see §10) picks up `supabase_error`
and `ambiguous` / `race` rows on a schedule and re-attempts Attempt 1.
Idempotency key is `canonical_business_id` plus
`claimed_by_account_id`.

### 6.3 · The weekly orphan sweep catches persistent failures

Every VERIFIED claim that has no successful reconcile event after N
days (recommended 7) is flagged for operator review. See §8.

### 6.4 · Explicit non-guarantee statement

Between a successful NEX-side VERIFIED write and a successful Supabase
link write, there is a time window during which:

- A Supabase account can be deleted → NEX side still believes the
  account owns the canonical. The weekly orphan sweep + the
  `AccountExistenceLookup` TTL cache (ADR §Caching) catch this.
- A `nex_business` row can be mutated → the subsequent reconciler
  attempt may hit `ambiguous` or `race`. The operator-triage path is
  the resolution.

We do NOT claim distributed-transaction semantics across the two
databases. The runbook commits only to:

1. The NEX-side state transition is atomic within NEX Postgres.
2. The Supabase-side link write is eventually consistent via the
   reconciler + retry queue + weekly sweep.
3. Any divergence surfaces in the audit log within one week.

---

## 7 · Rollback procedure

### 7.1 · When to roll back

Any of:

- Post-migration verification §4.1–§4.8 fails.
- The reconciler is producing >5% `supabase_error` outcomes.
- Founder authorisation is retracted.
- A follow-up design decision changes the shape (e.g. one-to-many
  rather than one-to-one).

### 7.2 · Pre-rollback step — DUMP existing links to a scratch table

If the reconciler has already written any rows (i.e. any
`canonical_business_id IS NOT NULL`), those links will be LOST on
rollback unless preserved. Operator runs (in Supabase SQL editor):

```sql
CREATE TABLE IF NOT EXISTS public._nex_business_canonical_link_backup AS
  SELECT id,
         owner_account_id,
         canonical_business_id,
         now() AS backed_up_at
    FROM public.nex_business
   WHERE canonical_business_id IS NOT NULL;

SELECT count(*) AS backed_up FROM public._nex_business_canonical_link_backup;
```

If the backup table already exists (from a prior rollback attempt), the
operator appends with:

```sql
INSERT INTO public._nex_business_canonical_link_backup
  (id, owner_account_id, canonical_business_id, backed_up_at)
SELECT id, owner_account_id, canonical_business_id, now()
  FROM public.nex_business
 WHERE canonical_business_id IS NOT NULL
   AND id NOT IN (SELECT id FROM public._nex_business_canonical_link_backup);
```

### 7.3 · Rollback SQL

```sql
BEGIN;
DROP INDEX IF EXISTS public.nex_business_canonical_business_id_uq;
ALTER TABLE public.nex_business DROP COLUMN IF EXISTS canonical_business_id;
COMMIT;
```

### 7.4 · Post-rollback verification

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='nex_business'
   AND column_name='canonical_business_id';
-- EXPECTED: zero rows.

SELECT indexname FROM pg_indexes
 WHERE schemaname='public' AND indexname='nex_business_canonical_business_id_uq';
-- EXPECTED: zero rows.
```

### 7.5 · NEX-side state after rollback

NEX Postgres is unchanged. All `nex.business_claim` rows remain in
their current states. The reconciler module must be feature-flagged
off (operator action) before the next verifyClaim fires, otherwise it
will immediately start failing with "column does not exist" errors.

---

## 8 · Edge cases + policies

### 8.1 · Owner deletes their Supabase account AFTER claiming

- NEX Postgres: `nex.business_claim.claimed_by_account_id` is now an
  orphan string pointing to a non-existent `nex_account.id`.
- Supabase: when the `nex_account` row is deleted, any
  `nex_business` row with `owner_account_id` matching should
  cascade-delete (per sealed Supabase FK). The `canonical_business_id`
  value is lost with the row.
- NEX side canonical remains `OWNER_CLAIMED`. **Policy:** the weekly
  orphan sweep calls the `AccountExistenceLookup` for every VERIFIED
  claim. Orphans are flagged by writing a lifecycle_log entry with
  `transition_reason = 'orphan_detected'` (per ADR §Known weaknesses).
  Admin UI (future wave) surfaces these for manual revoke.

### 8.2 · Admin deletes a canonical AFTER an owner has claimed it

- NEX Postgres has ON DELETE RESTRICT on
  `nex.business_claim.canonical_business_id` → the DELETE fails until
  an admin explicitly `revokeClaim`s.
- Supabase side: when the canonical is eventually deleted, the
  Supabase `canonical_business_id` becomes a dangling UUID. **Policy:**
  the weekly orphan sweep queries NEX for every Supabase
  `canonical_business_id` present and flags any that no longer exist.
  Admin UI nulls them out and may delete the `nex_business` row (if
  it was a stub) or leave it (if the owner has other canonicals).

### 8.3 · Owner claims canonical A, then transfers to canonical B

- Operator-authored admin action calls sealed
  `revokeClaim(old_claim_id)` → `nex.business_claim` row for A
  becomes `REVOKED`; `nex.business_canonical.lifecycle_state` for A
  returns to its pre-claim state via sealed canonical-handoff writer.
- Owner then runs a new claim flow for canonical B →
  `verifyClaim(new_claim_id)` → sealed service writes VERIFIED and
  invokes the reconciler.
- Reconciler Attempt 1: `UPDATE ... WHERE owner_account_id = $2 AND
  canonical_business_id IS NULL`. If the owner's `nex_business` row
  already had canonical A linked, that row is NO LONGER NULL — Attempt
  1 returns 0 rows. Attempt 2 then INSERTs a new stub row linking the
  owner's account to canonical B. The owner now has TWO `nex_business`
  rows (one for the revoked A, one for the active B). **Policy:** the
  revoked A row's `canonical_business_id` is NOT cleared automatically;
  it stays as audit lineage. An admin may `UPDATE SET
  canonical_business_id = NULL` on the stale row if the business
  identity is reused.

### 8.4 · Two owners claim the same canonical in a race

- Sealed `verifyClaim` writes under `BEGIN ... FOR UPDATE` on the
  canonical row. One wins VERIFIED; the other receives
  `reject_canonical_already_claimed`. The second owner never reaches
  the reconciler. No cross-DB issue.

### 8.5 · Operator applies the migration twice

- Idempotent: `ADD COLUMN IF NOT EXISTS` and `CREATE UNIQUE INDEX IF
  NOT EXISTS` both no-op on the second run. Operator still records
  the apply attempt in the operator log.

### 8.6 · Partial failure during apply

- The three statements in §3.4 are wrapped in `BEGIN; ... COMMIT;`.
  If any fails, the whole transaction rolls back and the operator
  sees the error in the SQL editor. The database state is identical
  to pre-apply. Operator investigates, fixes, re-runs.

### 8.7 · Reconciler sees `claimed_by_account_id` that does not exist in Supabase

- The ADR's write-time `AccountExistenceLookup` already prevents this
  for new claims. But a very old claim verified before the lookup was
  wired could carry a stale account id. **Policy:** the reconciler
  emits `supabase_error` with the lookup failure, retries once, then
  surrenders to the weekly orphan sweep.

---

## 9 · Identity model doctrine (summary)

Full doctrine is in
`docs/doctrine/nex-cross-db-identity-model-2026-10-10.md`. Summary:

- **NEX Postgres** owns canonical business facts, claims, evidence,
  media, directory view.
- **Supabase** owns user identity (`nex_account`) and owner-side
  business profile (`nex_business`).
- NEX side holds `claimed_by_account_id text` — a soft reference to
  Supabase.
- Supabase side holds `canonical_business_id uuid` — a soft reference
  to NEX.
- Both sides enforce their own uniqueness constraints.
- Neither side can CASCADE across the boundary.
- The "contract" is maintained by the reconciler + weekly orphan
  sweep + the ADR's `AccountExistenceLookup`.

---

## 10 · Not applied here

**This document does not execute any migration.** The operator applies
the migration file after:

1. Reviewing this runbook end-to-end.
2. Satisfying all preconditions in §1.
3. Running the pre-migration validation in §2.
4. Capturing explicit founder sign-off per §1.3.
5. Running the pre-apply snapshot per §3.2.

**Reconciler infrastructure status:**

- Reconciler module: NOT YET AUTHORED. The sealed `verifyClaim` does
  not currently invoke any Supabase write. §5 describes the shape of
  the module when it is authored.
- Retry queue: NOT YET AUTHORED. §6.2 describes the shape.
- Weekly orphan sweep: NOT YET AUTHORED. §8 and the ADR describe the
  shape.
- Audit log table (`nex.cross_db_reconcile_log`): NOT YET MIGRATED.
  §5.4 provides a sketch for the future migration.

These are documented so that when the migration is applied, there is
a clear picture of the application-layer work that must follow before
the system can be considered end-to-end functional.

---

## 11 · Operator log template

Operator captures these fields on apply attempt. Append-only log; a
fresh row per attempt even on idempotent re-runs.

```
Attempt timestamp (UTC)   :
Operator identity         :
Founder sign-off ref      :
Commit SHA of this runbook:
Commit SHA of 999_WIP file:
Pre-count: nex_business   :
Pre-count: canonical rows :
Pre-flight §2 result      : PASS / FAIL (which probe)
Snapshot captured path    :
Apply result              : SUCCESS / ROLLED_BACK
Post-flight §4 result     : PASS / FAIL (which probe)
Rollback executed?        : YES / NO
Notes                     :
```
