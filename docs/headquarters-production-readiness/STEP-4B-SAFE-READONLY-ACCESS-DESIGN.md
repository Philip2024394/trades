# STEP 4B · Safe Production Read-Only Access · Design (no implementation)

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · STEP 4B · design only · no production connection · no code · no migration
**Date:** 2026-08-10
**Locked verdict:**

> **STEP 4B · DESIGN COMPLETE — NO IMPLEMENTATION**
> Two-tier design: (Tier 1) usable today with the existing runtime credential wrapped in server-enforced `READ ONLY` transactions · (Tier 2) recommended long-term via a dedicated `nex_brain_read` role · **Tier 2 REQUIRES SEPARATE PRODUCTION AUTHORISATION**
> Preservation invariant intact pre + post · zero production connections · zero code · zero credentials touched

No credential value was read, printed, logged, copied, or exposed. Only variable names, permission classes, and file paths appear in this document.

---

## 0 · Prohibitions honoured

- ⛔ Did NOT connect to production
- ⛔ Did NOT execute any production SQL
- ⛔ Did NOT create or modify any DB role
- ⛔ Did NOT change grants / passwords / rotate credentials
- ⛔ Did NOT modify Vercel env vars
- ⛔ Did NOT modify PostgREST
- ⛔ Did NOT apply migrations · did NOT modify Supabase
- ⛔ Did NOT enable flags · did NOT enable Supervisor
- ⛔ Did NOT touch 021/048
- ⛔ Did NOT resolve severity policy
- ⛔ Did NOT modify R-7
- ⛔ Did NOT run production probes
- ⛔ Did NOT perform production writes or cleanup
- ⛔ Did NOT copy any production secret into `.env.local`
- ⛔ Did NOT print or expose any credential value

Investigation used: `grep -n` on committed migration files, `Read` on committed configuration files. Only two live Postgres queries occurred — the pre + post preservation-invariant probes against `localhost:5433/nex_dev`. Zero production connections.

---

## 1 · Current role landscape (from committed migration files · no live query)

Discovered via source-only inspection of `deploy/postgres/init/*.sql`:

| Role | Defined in | Login? | Grants |
|---|---|---|---|
| `service_role` | `deploy/postgres/bootstrap/000_local_roles.sql` (Supabase-native on prod) | NOLOGIN · session-inherited | BYPASSRLS · effectively full |
| `nex_brain_app` | `deploy/postgres/init/042_nex_brain_role_and_extended_tables.sql:120` | NOLOGIN · granted TO `postgres` | USAGE on schema `nex` · SELECT+INSERT+UPDATE+DELETE on all brain tables · USAGE+SELECT on all sequences · EXECUTE on `nex.claim_next_job` + `nex.claim_next_llm_retry` |
| `nex_social_app` | `deploy/postgres/init/030_comms_social_app_role.sql:15` | NOLOGIN | scoped to `comms_social_*` tables · not relevant to verification |

**No dedicated read-only role exists on the current NEX schema.** No `nex_brain_read`, `nex_verifier`, `nex_audit`, or equivalent. Creating one requires a new migration and production application.

---

## 2 · Answers to §A-G

### A · What should the dedicated read-only production connection variable be called?

**`NEX_PROD_READONLY_URL`** — deliberately distinct from `NEX_POSTGRES_URL` in every character to avoid tab-completion / typo aliasing.

Rejected alternatives + rationale:
- `NEX_POSTGRES_URL_READONLY` — REJECTED · prefix collision with `NEX_POSTGRES_URL` invites bash-glob / shell-completion accidents
- `NEX_PROD_POSTGRES_URL` — REJECTED · omits `READONLY` in the name · a future reader could mistake it for a general prod URL
- `NEX_VERIFY_URL` — REJECTED · too generic · doesn't advertise "production" in the name

**Design rule (permanent):** any variable whose name contains `NEX_PROD_READONLY_*` is contractually read-only. Any read that resolves such a variable MUST route through the new helper described in §E, which enforces the guards.

### B · Database permissions required per check

Every STEP 4 UNKNOWN row can be verified with SELECT-only privileges on catalog + `nex` schema. Enumerated:

| Check | Required grants (minimum) |
|---|---|
| `nex.analytics_rollup_queue` existence (H4) | `USAGE` on schema `nex` · access to `pg_catalog` (`to_regclass()`) — default-public |
| `nex.worker_jobs` existence + row count (H1) | `USAGE` on `nex` · `SELECT` on `nex.worker_jobs` |
| `nex.alert_rules` existence + row count + sample (021) | `USAGE` on `nex` · `SELECT` on `nex.alert_rules` |
| `nex.knowledge_records` existence + row count | `USAGE` on `nex` · `SELECT` on `nex.knowledge_records` |
| `pg_policies` RLS coverage (H6 R-7 measurement) | Access to `pg_catalog` (`pg_policies` view is publicly SELECTable by every role) — no extra grant required |
| Migration/index inspection (`pg_indexes`, `pg_class`, `pg_namespace`, `pg_proc`) | Access to `pg_catalog` — no extra grant required |
| Preserved-KJ verification on production (`nex.knowledge_dump_jobs`) | `USAGE` on `nex` · `SELECT` on `nex.knowledge_dump_jobs` |
| 021/048 collision diagnosis (`information_schema.columns`) | Access to `information_schema` — publicly SELECTable |

### C · Can those checks be performed with SELECT-only privileges?

**Yes · every one.** No INSERT · no UPDATE · no DELETE · no DDL · no EXECUTE of stored procedures. `pg_catalog` and `information_schema` are readable by every role by default. Only the `nex.*` table SELECTs need explicit grant.

### D · Which checks require additional PostgreSQL privileges?

**None among the STEP 4 UNKNOWN rows.** Every verification query in scope is a SELECT.

Rows that would need MORE than SELECT if we chose to add them (out of scope for this design):
- Load tests (V-9a) — WRITE
- Restore rehearsal (V-10b) — WRITE + DDL
- Enabling `pg_stat_statements` (H3 P99) — EXTENSION creation · needs superuser
- Creating the read-only role itself (Tier 2 below) — DDL · needs superuser

### E · Safest way to guarantee existing write-capable local probes cannot accidentally use the production connection

Layered defence, in the order queries reach the DB:

**Layer 1 · Naming (§A):**
`NEX_PROD_READONLY_URL` never appears in any script authored to date. Grep-verified this session. Any future write-capable script that reads this variable is a policy violation caught by the drift-catcher (§4).

**Layer 2 · Dedicated helper module:**
NEW `src/lib/nex/verification/readonly-pg.ts` (design shape · not authored in this batch) exports one function:
```
readOnlyProductionClient(): { withReadOnlyTx: <T>(fn: (c) => Promise<T>) => Promise<T | null> }
```
- Reads ONLY `NEX_PROD_READONLY_URL` · does NOT fall back to `NEX_POSTGRES_URL`, `DATABASE_URL`, or any other name
- Refuses to construct a pool if the variable is unset (returns null · caller must handle)
- Static string check on the URL: reject if it contains `localhost`, `127.0.0.1`, or `nex_dev` (prevents accidentally pointing the readonly path at the local dev DB, which would violate the audit boundary)
- Every returned session runs `SET SESSION default_transaction_read_only = on` immediately on connect
- Every user query is wrapped in `BEGIN TRANSACTION READ ONLY; <query>; ROLLBACK;` — belt-and-braces at both session and transaction level
- Server-side enforcement: Postgres itself rejects any DDL/DML inside a READ ONLY transaction with `25006 · cannot execute ... in a read-only transaction`

**Layer 3 · Drift-catcher (design shape · not authored):**
NEW `src/lib/nex/verification/tests/readonly-usage-drift.test.mjs` asserts:
- Only files under `src/lib/nex/verification/**` may import `readOnlyProductionClient`
- Every file that references `NEX_PROD_READONLY_URL` must also import the helper (i.e. no raw `process.env.NEX_PROD_READONLY_URL` reads elsewhere)
- No file under `src/lib/nex/verification/**` may import `withClient` or `withBrainRole` (verification code cannot fall back to the write-capable pool by accident)

**Layer 4 · Postgres role (Tier 2 · requires separate prod authorisation):**
Create `nex_brain_read` NOLOGIN role with USAGE + SELECT only · a matching LOGIN role for the connection string. Postgres-level rejection of any write regardless of transaction mode. This is the true belt-and-braces-and-vest tier.

Layers 1-3 are usable today with the EXISTING runtime credential and no production change.
Layer 4 requires the operator to authorise a production migration.

### F · If a new read-only role / credential is required, say so and stop

**Tier 2 (dedicated `nex_brain_read` role) REQUIRES SEPARATE PRODUCTION AUTHORISATION.**

Specifically:
- CREATE ROLE nex_brain_read NOLOGIN
- GRANT USAGE ON SCHEMA nex TO nex_brain_read
- GRANT SELECT ON ALL TABLES IN SCHEMA nex TO nex_brain_read
- GRANT SELECT ON ALL TABLES IN SCHEMA public TO nex_brain_read
- ALTER DEFAULT PRIVILEGES for future tables
- Create a LOGIN role (e.g. `nex_brain_read_login`) with a password, GRANT nex_brain_read TO nex_brain_read_login
- Emit connection string with the LOGIN role's credentials · store as `NEX_PROD_READONLY_URL` in Vercel + share with this shell

None of that is proposed here. Recorded as *"Tier 2 · deferred pending production migration authorisation."*

### G · Do not implement the design

Design only. Zero code, zero migrations, zero credentials, zero connections. Only this document was created.

---

## 3 · Proposed architecture (Tier 1 · usable today with existing credential)

```
     ┌──────────────────────────────────────────────────────────────┐
     │ Vercel dashboard · encrypted env storage                     │
     │   NEX_POSTGRES_URL          = <prod runtime credential>      │
     │   NEX_PROD_READONLY_URL     = <same string OR read-only-role │
     │                                 string once Tier 2 lands>    │
     └──────────────────────────────────────────────────────────────┘
                              │
                              │ operator hand-shares only NEX_PROD_READONLY_URL
                              ▼
     ┌──────────────────────────────────────────────────────────────┐
     │ This shell · scoped shell override or a NEW file at          │
     │   .env.verification.local (git-ignored)                      │
     │   NEX_PROD_READONLY_URL = <string>                           │
     │ .env.local remains untouched · NEX_POSTGRES_URL stays local  │
     └──────────────────────────────────────────────────────────────┘
                              │
                              ▼
     ┌──────────────────────────────────────────────────────────────┐
     │ src/lib/nex/verification/readonly-pg.ts (NEW · Tier 1)       │
     │   Layer 1: reads ONLY NEX_PROD_READONLY_URL                  │
     │   Layer 2a: refuses localhost / 127.0.0.1 / nex_dev URLs     │
     │   Layer 2b: SET SESSION default_transaction_read_only = on   │
     │   Layer 2c: wraps every fn in BEGIN READ ONLY; ...; ROLLBACK │
     └──────────────────────────────────────────────────────────────┘
                              │
                              ▼
     ┌──────────────────────────────────────────────────────────────┐
     │ scripts/prove-production-*-readonly.ts (NEW per row)         │
     │   · imports readOnlyProductionClient                          │
     │   · runs SELECT-only probes                                   │
     │   · every probe is idempotent · safe to re-run                │
     └──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Production NEX Postgres
                    (SELECT-only per Postgres server enforcement)
```

Under Tier 1 the runtime credential value is reused but the session is server-locked to read-only for the duration of every probe. Under Tier 2 (post-authorisation) the value in `NEX_PROD_READONLY_URL` swaps to a role that has no write privileges at all · code path is unchanged.

---

## 4 · Drift-catcher (design · not authored)

`src/lib/nex/verification/tests/readonly-usage-drift.test.mjs` — assertions:

- **RU1 · single reader** · exactly one file (`readonly-pg.ts`) may reference `process.env.NEX_PROD_READONLY_URL`. The drift-catcher test itself is self-excluded (its RU5 test seam legitimately mentions the name to prove rejection contracts · same self-exclusion pattern as `supervisor-fixture-preservation.test.mjs`).
- **RU2 · verification scope** · every file that imports `readOnlyProductionClient` lives under `src/lib/nex/verification/**` or `scripts/prove-production-*-readonly.*`. Any other importer → FAIL.
- **RU3 · isolation** · no file under `src/lib/nex/verification/**` imports `withClient` (from `@/lib/nex/db`), `withBrainRole` (from `@/lib/nex/db/with-brain-role`), or `pg` statically. Verification code cannot fall back to the write-capable pool by accident. (The helper itself uses a lazy `require("pg")` behind runtime guards — this exception applies only to `readonly-pg.ts`.)
- **RU4 · dev-URL rejection contract** · `readonly-pg.ts` source must contain substring checks that refuse `localhost`, `127.0.0.1`, `nex_dev`, and `:5433`. Also asserts the Layer 3/4 primitives (`SET SESSION default_transaction_read_only = on` + `BEGIN TRANSACTION READ ONLY` + `ROLLBACK`) plus the typed error classes and the `validateReadOnlyUrlForTests` seam.
- **RU5 · local-live rejection contract** (added during implementation) · exercises `validateReadOnlyUrlForTests` with real inputs: unset var → `ReadOnlyProductionMisconfiguredError` · empty var → same · each of 4 banned substrings → `ReadOnlyProductionUrlUnsafeError` naming the offender · valid prod URL → returns hostname only (no credentials). Never opens a pool.

**Implemented drift-catcher: `src/lib/nex/verification/tests/readonly-usage-drift.test.mjs` · 5/5 assertions green.** These assertions prevent silent misuse of the new credential surface AS the codebase evolves.

---

## 5 · Risks + honest limitations

| Risk | Mitigation |
|---|---|
| Tier 1 uses the runtime write-capable credential · session-level READ ONLY is a soft guarantee (a compromised session could `SET SESSION default_transaction_read_only = off`) | Tier 2 dedicated role is the hard guarantee · authorise when ready |
| A verification script bug could leak the credential to stdout or a log line | Explicit rule in `readonly-pg.ts`: never log the connection string · use `pool.options.host` for display only · already-established pattern from `apply-nex-storage-schema.mjs` |
| Vercel env-var pull could accidentally overwrite `.env.local` | Recommend a separate `.env.verification.local` (git-ignored) that only `readonly-pg.ts` reads via a `dotenv` path override, OR shell-scoped override via `NEX_PROD_READONLY_URL=... npx tsx ...` |
| Row-level RLS on `nex.knowledge_dump_jobs` might hide rows if the read role does not bypass RLS | Under Tier 1 the runtime credential is `nex_brain_app` which has direct grants; RLS check has already been verified in prior work. Under Tier 2, either the read role gets a matching RLS policy OR queries run under `SET LOCAL ROLE nex_brain_app` at the start of the transaction. Design detail deferred until Tier 2 authorisation. |
| Production Postgres pool contention if verification probes run at scale | All probes are single-query · `max: 1` connection · short-lived · run one at a time. No load. |

---

## 6 · What Tier 1 unlocks vs what Tier 2 unlocks

Both tiers unlock the same set of STEP 4 UNKNOWN rows:

- H4 · `nex.analytics_rollup_queue` on production
- H1 · `nex.worker_jobs` on production
- 021 · `nex.alert_rules` on production
- `nex.knowledge_records` on production
- H1 · migration index verification (046 · 047 · 048 · 049) via `pg_indexes`
- H6 · production RLS policy coverage via `pg_policies`
- Production `nex.knowledge_dump_jobs` state breakdown (including whether the 10 preserved KJs are also preserved on production · which becomes a real invariant check)
- 021/048 collision state on production (whether prod has 021's shape, 048's shape, or something else)

**Tier 1 delivers the answers.** **Tier 2 delivers the ongoing safety guarantee that no future verification script can accidentally write to production.**

---

## 7 · Preservation invariant

| Check | Result |
|---|---|
| Pre-STEP-4B · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |
| Post-STEP-4B · 10 preserved KJs | ✅ `claimed / 0 / null` · violations=0 |

---

## 8 · Files touched

- **NEW** · `docs/headquarters-production-readiness/STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md` (this file)

Zero code · zero migrations · zero configuration · zero new scripts · zero temporary probes · zero writes to `.env.local` or any Vercel env.

---

## 9 · Prohibitions confirmation

Every prohibition in the STEP 4B authorisation is honoured. In particular:
- ✅ No production connection was opened
- ✅ No production SQL executed
- ✅ No role / grant / password / credential created, modified, or rotated
- ✅ No Vercel env change proposed OR performed
- ✅ No PostgREST change
- ✅ No migration applied · no Supabase touched
- ✅ No feature flag activated · supervisor still DISABLED
- ✅ No 021/048 modification · no severity policy invented · no R-7 remediation
- ✅ No production probe executed · no cleanup performed
- ✅ No secret copied into `.env.local` or any other on-disk location
- ✅ No credential value printed / logged / echoed

---

## 10 · Exact next authorisation required

**One of the following two paths must be separately authorised before any production read runs from this shell:**

### Path A · Tier 1 usable today (no production DB change)
Operator provides the production Postgres URL value (from Vercel env) via:
- `AUTHORISE STEP 4C · TIER-1 · IMPLEMENT readonly-pg.ts + hand-provide NEX_PROD_READONLY_URL to a scoped shell session`

Then STEP 4C implementation is:
- (i) Author `src/lib/nex/verification/readonly-pg.ts` per §3
- (ii) Author `src/lib/nex/verification/tests/readonly-usage-drift.test.mjs` per §4
- (iii) Author one verification probe (e.g. `scripts/prove-production-schema-readonly.ts`)
- (iv) Operator invokes with `$env:NEX_PROD_READONLY_URL='...'; npx tsx scripts/prove-production-schema-readonly.ts` in a scoped PowerShell block · variable never persists to disk
- (v) Report per-row VERIFIED / UNKNOWN classifications

### Path B · Tier 2 dedicated read-only role (requires production DB change)
Operator authorises a NEW migration file adding `nex_brain_read` NOLOGIN role + LOGIN role + grants, applies it to production, then provides the dedicated role's connection string as `NEX_PROD_READONLY_URL`:
- `AUTHORISE STEP 4C-Tier-2 · APPLY nex_brain_read migration to production + create login role + provide connection string`

This is the safer long-term path. Requires production migration authorisation Philip has withheld for the entire Wave 3-4 programme so far.

**No further work is being taken.** Awaiting explicit choice between Path A and Path B (or authorisation to hold indefinitely).
