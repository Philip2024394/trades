# NEX Cross-DB Identity Model · Doctrine · 2026-10-10

**Agent:** E (Cross-DB Operator Runbook) · **Branch:** `nex/directory-work`
**Status:** doctrine · informs the operator runbook and the ADR

**Companions:**

- `docs/doctrine/adr-nex-cross-db-owner-link-2026-10-09.md`
- `docs/doctrine/owner-claim-architecture-complete-2026-10-10.md`
- `docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md`

---

## 1 · NEX has TWO Postgres authorities, not one

Many agents and new readers of the codebase arrive expecting a single
Postgres cluster. The NEX ecosystem has **two**, physically separate,
each with its own:

- Cluster endpoint and credentials.
- Backup schedule and retention.
- Migration runner and migration file set.
- Transactional boundary (no cross-cluster transactions are possible).
- RBAC model (NEX Postgres uses direct roles; Supabase uses `auth.*`).

The two authorities are:

| Authority | Host | Project ref | Primary role |
|---|---|---|---|
| **NEX Postgres** | local `nex_dev` + Project B harvest substrate | n/a (direct) | Canonical business spine, claims, evidence, media |
| **Supabase** | Project B | `ijvqdvsvwtwxzcqmoqit` | User identity, owner-side business profile, friends, socials |

This split is a sealed architectural decision (see §2). Code or docs
that imply a single DB are wrong and must be updated when noticed.

---

## 2 · Why cross-DB (not one DB)

This is a **sealed** decision. Do not revisit without an explicit
founder authorisation. Summary of the original drivers (historical,
preserved here so new agents understand the context without re-litigating):

- NEX Postgres is a **harvest substrate** that holds raw and merged
  canonical rows (currently ~22,616 rows in `nex.business_canonical`).
  It accumulates evidence, conflict logs, and lifecycle audit rows at
  a volume that would complicate Supabase's RLS + auth-coupled model.
- Supabase is an **identity + application-state** substrate. Its
  `auth.users` ↔ `nex_account` ↔ RLS policy chain is tuned for
  per-user access patterns. Shoehorning the canonical spine into
  Supabase would (a) explode RLS complexity, (b) couple canonical
  mutations to end-user auth tokens, and (c) make the harvest pipeline
  dependent on Supabase operational SLAs.
- Alternatives considered and REJECTED (see ADR §Alternatives):
  - **FDW (postgres_fdw)**: no stable TCP endpoint on Supabase, cross-
    cutting operational dependency.
  - **Push/webhook mirror**: not transactional with Supabase's own
    writes, two sources of truth to reconcile.
  - **Merge both DBs into one**: deferred as a large architectural
    migration not currently justified by any user-facing need.

The cross-DB pattern is accepted as a permanent constraint. Everything
in this document flows from that constraint.

---

## 3 · What each authority owns

### 3.1 · NEX Postgres (schema `nex`)

Primary tables (sealed canonical spine · N=7 primitives · founder-sealed
2026-10-07):

- `nex.business_canonical` — one row per real-world business. Holds
  identity, lifecycle_state, and the Section M boundary
  (`canonical_business_id`, `name_canonical`, `country`, `city`,
  `coordinates`, `lifecycle_state`).
- `nex.source_registry` — one row per harvest source (OSM, Google,
  owner upload, admin edit, etc.).
- `nex.business_evidence` — one row per observed fact about a
  business, with provenance back to a source.
- `nex.business_media` — one row per uploaded or linked media asset.
- `nex.business_fact_conflict` — surfaced disagreements between
  evidence rows for the same field.
- `nex.business_freshness_band()` — SQL function returning the
  per-row freshness classification.
- `nex.business_claim` — universal claim-code record (migration 176).
  Includes `claimed_by_account_id text` — the soft cross-DB reference.
- `nex.business_claim_draft` — pre-claim owner draft store
  (migration 190).
- `nex.business_canonical_lifecycle_log` — append-only audit trail of
  lifecycle_state transitions.

NEX Postgres is the sole writer for all of the above. Supabase does
not write to the `nex` schema. Supabase reads from the Directory
service HTTP contract described in the ADR, never from the DB directly.

### 3.2 · Supabase Project B (schema `public`)

Primary tables (relevant to this doctrine; many others exist):

- `public.nex_account` — the authoritative user identity. `id uuid`
  matches `auth.users.id`.
- `public.nex_business` — owner-side business profile (name, phone,
  address, logo, verification state). One per claimed business.
  AFTER the WIP migration lands: adds `canonical_business_id uuid`
  as the soft cross-DB reference.
- `public.nex_friend_edge` — social-graph edges.
- `public.nex_peer_conversation` + `public.nex_peer_message` —
  one-to-one chat (sealed Vault B.4+).

NEX Postgres does not write to the `public` schema in Supabase.

### 3.3 · What crosses the boundary

Exactly two soft references cross the boundary:

| Direction | Field | Type | Target |
|---|---|---|---|
| NEX → Supabase | `nex.business_claim.claimed_by_account_id` | `text` | `public.nex_account.id` (uuid, cast to text) OR `anon:<uuid>` |
| Supabase → NEX | `public.nex_business.canonical_business_id` | `uuid` | `nex.business_canonical.canonical_business_id` |

**No other field crosses.** Everything else is strictly owned by one
authority. Agents writing new features must preserve this discipline;
every new cross-DB field accumulates another reconciler obligation.

---

## 4 · Soft-reference pattern

The two fields above are "soft references": they store the
counterparty's identifier without any database-level foreign key.

### 4.1 · Mechanical shape

- NEX side holds the Supabase identifier as `text` (not `uuid`),
  because the field also stores `anon:<uuid>` fingerprints that are
  not valid UUIDs. The CHECK on
  `nex.business_claim.ck_bcl_state_fields_consistency` enforces that
  VERIFIED rows have this field NOT NULL (migration 176).
- Supabase side holds the NEX identifier as `uuid`, nullable, with a
  unique partial index on non-null values. See WIP migration.

### 4.2 · What the pattern guarantees

- Both sides have a stable, indexable identifier for the counterparty.
- Lookups in either direction are index-backed and O(log n).
- Uniqueness is enforced within each side (NEX enforces one VERIFIED
  claim per canonical; Supabase enforces one `nex_business` row per
  canonical).

### 4.3 · What the pattern does NOT guarantee

- **No referential integrity across the boundary.** A row on either
  side can hold an identifier that no longer exists on the other side.
- **No distributed transaction.** A write on one side cannot be
  atomic with a write on the other.
- **No cascading.** Deletes on either side do not propagate.

The runbook treats these non-guarantees as first-class concerns; the
reconciler, retry queue, and weekly sweep collectively re-establish
eventual consistency.

---

## 5 · Enforcement: reconciler + weekly sweep

Two application-layer mechanisms substitute for the missing DB-level
integrity:

### 5.1 · Reconciler (synchronous, on write)

- Fires on every successful `verifyClaim`.
- Writes the Supabase soft reference immediately after the NEX-side
  VERIFIED transaction commits.
- Emits an audit event per outcome: `linked_existing`, `stubbed_new`,
  `ambiguous`, `race`, `anon_skipped`, `supabase_error`.
- Does NOT roll back the NEX side on Supabase failure. NEX is the
  source of truth for canonical ownership; the Supabase link is
  eventual consistency.

### 5.2 · Account existence lookup (synchronous, on write, pre-commit)

- Specified in the ADR §Decision §Invariant 3.
- Called by `verifyClaim` BEFORE promoting the canonical to
  OWNER_CLAIMED.
- Confirms the Supabase `nex_account.id` exists and is active.
- Fails CLOSED: if Supabase is unreachable, the claim is refused.
- Cached for ≤60s on positive results; never cached on negative.

### 5.3 · Weekly orphan sweep (asynchronous, batch)

- Scans every VERIFIED `nex.business_claim` row.
- Calls the `AccountExistenceLookup` for the claimed account.
- Flags accounts that have been deleted since claim verification by
  writing a lifecycle_log entry with `transition_reason =
  'orphan_detected'`.
- Separately, scans every Supabase `nex_business.canonical_business_id`
  value and verifies it exists in NEX. Flags dangling values for
  admin review.

### 5.4 · Audit trail

Every reconciler event emits one row to the NEX Postgres audit log
table `nex.cross_db_reconcile_log` (future migration; sketched in the
operator runbook §5.4).

This table is the single source of truth for cross-DB divergence
investigation. Any time an admin asks "why does Supabase think X owns
canonical Y but NEX disagrees?", the answer is in this table.

---

## 6 · Why NOT a hard FK (even a logical one)

The decision not to add a hard FK is deliberate. Explicitly:

### 6.1 · PostgreSQL does not support cross-cluster FKs

A foreign key constraint can only reference a table in the same
database. There is no mode in which `nex.business_claim` can declare
a FK on Supabase's `public.nex_account`.

### 6.2 · FDW would require distributed-transaction primitives we don't have

A foreign data wrapper could expose `public.nex_account` as a foreign
table in NEX Postgres. But a FK declared on a foreign table has
been experimental since PG9.6 and is NOT enforced at write time for
foreign tables in production. More importantly, enforcing
cross-cluster referential integrity at write time requires two-phase
commit or similar distributed-transaction primitives. Neither
Supabase nor Vercel supports distributed transactions today. Running
2PC manually at the application layer re-introduces every reconciler
problem we were trying to avoid.

### 6.3 · Logical FKs ("I promise I'll always point to a real row") buy nothing

Decorating the column with a comment like `references nex_account.id`
without an actual FK constraint provides no enforcement — only
documentation. We already have that documentation in the column
`COMMENT ON`.

### 6.4 · Honest documentation is better than false guarantees

A column named `fk_account_id` with no actual FK is a trap. A column
named `canonical_business_id uuid` with a `COMMENT ON` describing it
as a soft cross-DB reference is honest. The runbook and this doctrine
make the semantics explicit.

---

## 7 · Audit trail (future migration sketch)

The audit log that proves eventual consistency has NOT been migrated
yet. Shape (sketched for the future NEX-side migration):

```sql
-- Future: deploy/postgres/init/NNN_cross_db_reconcile_log.sql
CREATE SCHEMA IF NOT EXISTS nex;

CREATE TABLE IF NOT EXISTS nex.cross_db_reconcile_log (
  id              bigserial    PRIMARY KEY,
  canonical_id    uuid         NOT NULL,
  account_id      text         NOT NULL,
  outcome         text         NOT NULL
                               CHECK (outcome IN (
                                 'linked_existing',
                                 'stubbed_new',
                                 'ambiguous',
                                 'race',
                                 'anon_skipped',
                                 'supabase_error'
                               )),
  supabase_row_id uuid         NULL,
  error_text      text         NULL,
  attempted_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdrl_canonical
  ON nex.cross_db_reconcile_log (canonical_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_cdrl_outcome_recent
  ON nex.cross_db_reconcile_log (outcome, attempted_at DESC)
  WHERE outcome IN ('ambiguous', 'race', 'supabase_error');
```

The two partial / covering indexes support (a) "most recent reconcile
event per canonical" lookups and (b) "unresolved problems in the last
week" admin dashboards.

Admin review surface, retry queue, and weekly sweep all join against
this table. See operator runbook §5.4 for details.

---

## 8 · Operational boundary summary

| Concern | NEX Postgres | Supabase | Boundary |
|---|---|---|---|
| User identity | — | `nex_account` | — |
| Canonical facts | `business_canonical`, `evidence`, `media`, `fact_conflict`, `freshness_band()` | — | — |
| Claim lifecycle | `business_claim`, `business_claim_draft` | — | `claimed_by_account_id` text soft ref |
| Owner profile | — | `nex_business` | `canonical_business_id` uuid soft ref |
| Chat / social | — | `nex_peer_*`, `nex_friend_edge`, `nex_account.social_intents` | — |
| Audit trail (reconciler) | `cross_db_reconcile_log` (future) | — | — |
| Lifecycle audit | `business_canonical_lifecycle_log` | — | — |

Every row above either lives on one side only or has an explicit soft
reference entry. Any addition to this table requires a design
decision — not an implementation detail.

---

## 9 · For agents arriving later

If you are a NEX agent and you're about to:

- **Add a new field that crosses the boundary** → stop. Prefer putting
  the field entirely on one side. If it genuinely needs to cross,
  document the soft reference in both the migration and this doctrine
  (update the table in §3.3), and extend the reconciler.
- **Add a FK referencing the other DB** → impossible. See §6.
- **Query Supabase from NEX code or vice versa without going through
  the typed service contract** → stop. The ADR §Decision defines the
  only two typed lookups (`AccountExistenceLookup`,
  `BusinessesOwnedByAccount`). Any new cross-DB read extends that set
  explicitly with a new interface.
- **Cache a cross-DB result for more than 60s** → stop. See the ADR
  §Caching discussion.
- **Delete rows on one side without considering orphans on the other**
  → stop. Review §4.3 and §5.3.

Honest soft references > false hard FK guarantees. Keep the boundary
small, documented, and auditable.
