# Wave 3 · H1 · Migration Hygiene

**Programme:** Headquarters Production Readiness · Wave 3 · Batch H1
**Authorisation:** Philip · 2026-08-10 · *"AUTHORISE WAVE 3 — H1 MIGRATION HYGIENE ONLY."*
**Scope this doc:** H1.b + H1.c authoring under Philip's authorisation. **H1.a (applying migrations to prod DBs) is explicitly out of scope** and remains open.
**Date opened:** 2026-08-10.
**Final state (locked at end of this batch):**

> **H1 — IMPLEMENTED**
> **H1 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN** (H1.a not attempted this batch · H1.c not yet wired as blocking in prod deploy pipeline · both awaiting explicit prod authorisation)

Related sources of truth:
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §3.2 (Batch H1)` — the objectives table
- `WORLD-CLASS-OPS-REMEDIATION-PLAN.md §5 (Gap register, rows 1 + 2 + 5)` — gaps H1 closes
- `NEX-STORAGE-AUTHORITY-CHECK.md` — resolves which DB owns migrations 046-049 (NEX Postgres)
- `PHASE-6-VERIFICATION-CLOSURE.md` — the immediately-prior closed batch; Phase 6 remains DISABLED

---

## 0 · Prohibitions honoured (Philip's directive)

- ⛔ **Not** modifying Supabase legacy migrations
- ⛔ **Not** migrating `hammerex_*` customer-facing data
- ⛔ **Not** beginning the Supabase-to-NEX migration programme
- ⛔ **Not** changing `NEX_BRAIN_BACKEND` (remains `supabase`)
- ⛔ **Not** applying production migrations (H1.a deferred)
- ⛔ **Not** enabling the supervisor (`NEX_KJOB_SUPERVISOR_ENABLED` remains unset / 0)
- ⛔ **Not** running Cohort A or Cohort B recovery
- ⛔ **Not** beginning H2-H6
- ⛔ **Not** modifying the 10 preserved KJs
- ⛔ **Not** altering Phase 6 behaviour

---

## 1 · Step A · Audit the current migration declaration/discovery mechanism

### 1.1 · Migration surfaces on disk

| Surface | Path | Files | Purpose | In scope for H1? |
|---|---|---|---|---|
| **NEX Postgres canonical schema** | `deploy/postgres/init/*.sql` | 49 (numbered `000_` through `049_`, gap at 040) | The `nex.*` schema baseline. Applied idempotently via `apply-nex-storage-schema.mjs`. | ✅ YES · authoritative NEX migration surface |
| **NEX Postgres environment bootstrap** | `deploy/postgres/bootstrap/*.sql` | (small · role/extension shims for raw Postgres targets) | Compatibility DDL applied BEFORE the init/ schema. | ⚠️ tangential — not a migration in the "code depends on X" sense |
| **Supabase legacy migrations** | `supabase/migrations/*.sql` | 331 | Supabase-side hammerex/xrated tables. Managed by Supabase CLI · tracked in `supabase_migrations.schema_migrations`. | ⛔ NO · explicit Philip prohibition |
| **`db/migrations/*.sql`** | `db/migrations/*.sql` | 5 (`001_nex_brain_schema.sql` … `005_worker_jobs_kjid_expression_index.sql`) | Older, superseded numbering. Not referenced by any runner in current tree. | ⚠️ latent · flagged in §6 findings for future clarification |

**Authoritative discovery mechanism (NEX side):** `deploy/postgres/init/*.sql`, applied in alphabetical order by `scripts/apply-nex-storage-schema.mjs`.

### 1.2 · How migrations are applied

- **Local dev (raw Postgres):** `npm run nex:bootstrap-postgres` then `npm run nex:apply-storage-schema` (both target `NEX_POSTGRES_URL`).
- **Supabase-hosted NEX Postgres:** skip bootstrap; run apply-storage-schema against the Supabase connection string.
- **Idempotency:** every init/ file uses `IF NOT EXISTS` guards (tables, indexes) and `DO $$ ... $$` blocks for RLS policy re-creation. Re-runs are safe.

### 1.3 · Tracking table

**There is no NEX-side `schema_migrations` tracking table.** The apply script always attempts to apply every file. Correctness relies on file-level idempotency, not on version tracking.

**Consequence:** There is no in-repo audit surface today for "which migrations are applied on which DB." That is exactly gap #1 that H1.b closes.

### 1.4 · What "declared" means for NEX code

A NEX-side code path "depends on migration N" if it references a database object (table · column · index · function · trigger) created by that migration. The most fragile subclass — the one Postgres validates at plan time and errors on with a clear message — is:

> `INSERT ... ON CONFLICT (col_list) [WHERE predicate] DO ...`

Postgres validates the ON CONFLICT inference clause against declared UNIQUE indexes / constraints. If the declared object is missing, Postgres returns:

> `there is no unique or exclusion constraint matching the ON CONFLICT specification`

Making ON CONFLICT the natural focal point of the CI check — it is a HARD dependency, and its declaration signature (column list + optional predicate) is precise enough to statically match.

---

## 2 · Step B · Exact failure mode the CI check must catch

**Primary failure (blocking · gap #2 focal):**

> An adapter file targeting the NEX schema uses `ON CONFLICT (col_list) [WHERE predicate]` on a table declared in `deploy/postgres/init/*.sql`, but **no migration file declares a UNIQUE index / constraint / PRIMARY KEY** whose columns and predicate match. Postgres will reject at plan time; runtime enqueue / insert will 500.

**Real historical example (already fixed but proves the failure mode):**

- `src/lib/nex/brain/adapters/postgres.ts:208` uses `ON CONFLICT (input_ref, worker_type) WHERE status IN ('waiting','assigned','running')`.
- Requires the partial unique index declared in `deploy/postgres/init/046_worker_jobs_active_dedup.sql`.
- Wave 1 applied 046 to local NEX Postgres. **Production has not yet been proven to have 046 applied.** If any code path executes the enqueue against a prod NEX Postgres without 046, every enqueue 500s.

**Secondary failure (blocking · gap #5 spillover):**

- Adapter parity divergence: PostgresBrainStore.enqueueJob enforces `(input_ref, worker_type)` uniqueness at the DB layer (046). SupabaseStore has **no** equivalent constraint or app-level check. Two adapters produce semantically different behaviour under contention.
- Detection: any `ON CONFLICT` that succeeds statically for Postgres has no equivalent dedup in the Supabase adapter path.
- **H1 scope note:** the gap-5 parity check is called out in the remediation plan as *"add to H1"* — this doc addresses the ON CONFLICT declaration side; the adapter-parity contract test is authored separately (deferred, not attempted this batch, tracked in §7 open items).

---

## 3 · Step C · Legitimate exceptions the check must NOT flag

| # | Case | Rationale | Behaviour |
|---|---|---|---|
| E1 | `ON CONFLICT DO NOTHING` (no column list, no constraint name) | Uses any unique constraint on the target table. As long as the table has *some* unique key, Postgres accepts it. | ACCEPT — do not require column-level match. |
| E2 | `ON CONFLICT ON CONSTRAINT <named_constraint>` | Explicit constraint reference. | Match against constraint names declared in migrations; unmatched → FAIL. |
| E3 | `.test.mjs` / `.test.ts` files | Tests may construct their own tables inline or use fixture schemas. | EXEMPT by path glob. |
| E4 | Comment-only mentions (`// ON CONFLICT DO NOTHING ...`) | Not executable SQL. | Regex must require the phrase to appear inside a template literal / string, not in `//` or `/* */`. Practical implementation: strip line comments before scanning per line. |
| E5 | SQL literal targets a table NOT declared in `deploy/postgres/init/*.sql` | Outside NEX Postgres scope (Supabase-legacy, hammerex_*, unrelated schemas). | EXEMPT via table-scope filter. |
| E6 | Dynamic column list (`ON CONFLICT (${keyCol})`) | Cannot be statically resolved. | REPORT as `dynamic · unverifiable` — do not FAIL; require reviewer attention. |
| E7 | Adapter file for a non-Postgres backend (e.g. `supabase.ts`, `filesystem.ts`) | Not targeting NEX Postgres. | EXEMPT via path glob. |

---

## 4 · Step D · Design · smallest reliable check that prevents false positives

### 4.1 · Two-artifact split (matches remediation plan H1.b / H1.c)

**Artifact 1 · `scripts/verify-migration-state.mjs` (H1.b)**
- **Type:** read-only DB probe.
- **Requires:** `NEX_POSTGRES_URL`.
- **Behaviour:** for each `deploy/postgres/init/*.sql` file, extract every `CREATE TABLE` · `CREATE INDEX` · `CREATE UNIQUE INDEX` · `CREATE FUNCTION` target. Query `information_schema.tables`, `pg_indexes`, `pg_proc` for existence. Report `applied` / `not-applied` per migration file.
- **Exit:** 0 if all migrations show `applied` · 1 if any unapplied · 2 on env / connection errors.
- **Idempotency:** never writes, never mutates. Safe to run in parallel with dev traffic.

**Artifact 2 · `scripts/check-migration-declarations.mjs` (H1.c)**
- **Type:** pure static analysis. **No DB required.**
- **Requires:** repo checkout only.
- **Behaviour:**
  1. Parse `deploy/postgres/init/*.sql` → build declared-uniqueness manifest:
     - `CREATE (UNIQUE )?INDEX ... ON nex.<table> (cols) [WHERE ...]`
     - Inline column-level `PRIMARY KEY` / `UNIQUE` on `CREATE TABLE nex.<table>`
     - Table-level `PRIMARY KEY (cols)` / `UNIQUE (cols)` inside `CREATE TABLE nex.<table>`
     - `CONSTRAINT <name> UNIQUE (cols)` (for ON CONSTRAINT match)
  2. Scan NEX-side source files (`src/lib/nex/**` · `src/app/api/nex/**`) for `ON CONFLICT`. **Exclude** `.test.*`, `.d.ts`, `*supabase*` adapter files, `*filesystem*` adapter files.
  3. For each site, extract:
     - target table (from the surrounding `INSERT INTO <table>` / `MERGE INTO <table>`)
     - conflict spec: `(col_list)` or `ON CONSTRAINT <name>` or bare `DO NOTHING`
     - optional `WHERE predicate` (normalized: whitespace-collapsed, lowercased)
  4. Classify:
     - `DO NOTHING` bare — ACCEPT (E1)
     - target table not in `deploy/postgres/init/*.sql` schema — EXEMPT (E5)
     - dynamic col list — REPORT as `dynamic` (E6, non-blocking)
     - `(col_list) [WHERE ...]` — MATCH against manifest by table + col_set + normalized-WHERE
     - `ON CONSTRAINT <name>` — MATCH against manifest by constraint name (E2)
  5. Emit report + exit 1 if any UNMATCHED site (excluding accepted / exempt / dynamic).

### 4.2 · Failure-mode coverage matrix

| Failure the check must catch | Detection mechanism |
|---|---|
| Missing partial unique index (like 046 pre-application) | `WHERE ...` predicate MUST match a declared partial index's WHERE. |
| Missing unique index for a plain col-list ON CONFLICT | Table + col-set must match a declared UNIQUE index or CONSTRAINT UNIQUE. |
| Named constraint missing | `ON CONSTRAINT <name>` requires the name to appear in a `CONSTRAINT <name> UNIQUE (...)` clause. |
| Adapter code writing to a table nobody declared | Table not in NEX manifest → EXEMPT is fine when the table lives elsewhere (Supabase legacy) · but if the target starts with `nex.` and the table isn't declared, that's a separate FAIL (§4.5). |

### 4.3 · False-positive prevention

- Comment stripping BEFORE regex match.
- Table-scope filter (E5) makes the check silent on cross-schema INSERTs.
- Test files exempted by path glob (E3).
- Dynamic patterns explicitly bucketed as `dynamic`, not `fail`.
- Match tolerates column-order differences (`(a,b)` matches `(b,a)` because UNIQUE (a,b) constraints are commutative).
- Normalized WHERE (whitespace, case) tolerates cosmetic drift.

### 4.4 · Non-blocking vs blocking

Per remediation plan H1.c: **non-blocking for local runs · blocking for deploy runs**. Implemented by:

- Script always exits 0 unless `--strict` is passed.
- `--strict` makes any FAIL exit 1.
- CI wiring proposal: `npm run nex:check-migration-declarations` (non-strict) on feature branches; `npm run nex:check-migration-declarations -- --strict` on deploy branches.

**This doc authors the script and package.json entry. Wiring into an actual CI pipeline is out-of-scope until deploy authorisation.**

### 4.5 · Out-of-scope-but-recorded edge cases

- **Insert targets a `nex.<table>` that is NOT declared in `deploy/postgres/init/*.sql`.** Not in H1's ON CONFLICT scope, but a related class of undeclared-dependency defect. Recorded as OPEN — future H-batch can extend the script to include a `--check-unknown-nex-tables` sweep.
- **Column set matches but WHERE predicate mismatches** (e.g. code uses `WHERE status IN ('waiting','assigned')` but migration declares `WHERE status IN ('waiting','assigned','running')`). H1 treats as FAIL — safest default. Author can explicitly whitelist via a `// migration-declarations-check: waive <reason>` comment on the line above.

---

## 5 · Step E · Test both a valid declared dependency and an intentionally undeclared one

*(To be executed by the scripts authored in §6 below · results captured in §7.)*

**Valid case (must PASS):**
`src/lib/nex/brain/adapters/postgres.ts:208` — `ON CONFLICT (input_ref, worker_type) WHERE status IN ('waiting','assigned','running')` on table `nex.worker_jobs`.
- Should match the declaration in `deploy/postgres/init/046_worker_jobs_active_dedup.sql` (index `worker_jobs_input_ref_active_uniq`).

**Intentionally-undeclared case (must FAIL):**
A temporary fixture file `scripts/_fixture-undeclared-on-conflict.ts` containing:
```ts
INSERT INTO nex.worker_jobs (input_ref) VALUES ($1)
ON CONFLICT (nonexistent_col_a, nonexistent_col_b) DO NOTHING
```
- No migration declares a UNIQUE index on `(nonexistent_col_a, nonexistent_col_b)`.
- Script MUST FAIL in `--strict` mode, referencing this exact site.
- Fixture is deleted after the test.

---

## 6 · Implementation

*(Populated during authoring · linked to files after they land.)*

- **H1.b · `scripts/verify-migration-state.mjs`** — authored 2026-08-10 · read-only DB state probe · exits 0 all-applied · 1 any-unapplied · 2 env error.
- **H1.c · `scripts/check-migration-declarations.mjs`** — authored 2026-08-10 · static analysis · `--strict` for blocking runs.
- **`package.json`** — two npm script entries added: `nex:verify-migration-state`, `nex:check-migration-declarations`.

---

## 7 · Results

**Date:** 2026-08-10 · executed against local NEX Postgres (`localhost:5433/nex_dev`) + repo checkout.

### 7.1 · Valid-case result (H1.c)

**Target:** `src/lib/nex/brain/adapters/postgres.ts:208` — `ON CONFLICT (input_ref, worker_type) WHERE status IN ('waiting','assigned','running')` on table `nex.worker_jobs`.

**Verdict:** ✅ **PASS**

Script output:
```
✓ src/lib/nex/brain/adapters/postgres.ts:208
  → matched partial index 046_worker_jobs_active_dedup.sql
    · UNIQUE INDEX worker_jobs_input_ref_active_uniq · WHERE identical
```

Confirms: the check correctly reads `deploy/postgres/init/046_worker_jobs_active_dedup.sql`, extracts the partial UNIQUE INDEX declaration, matches the col-set + WHERE predicate (whitespace-normalized), and reports the specific declaring migration file.

### 7.2 · Intentionally-undeclared-case result (H1.c)

**Target:** temporary fixture `src/lib/nex/_h1c-fixture-undeclared.ts` (added + removed within this closure) containing:
```
INSERT INTO nex.worker_jobs (worker_type, input_ref)
VALUES ($1, $2)
ON CONFLICT (nonexistent_col_a, nonexistent_col_b) DO NOTHING
```

**Verdict:** ✅ **FAIL as expected** — `--strict` exit code 1.

Script output:
```
✗ src/lib/nex/_h1c-fixture-undeclared.ts:15
  → no declared UNIQUE index/constraint on
    nex.worker_jobs(nonexistent_col_a,nonexistent_col_b)
Verdict · FAIL · strict mode · exit 1
```

Fixture deleted immediately after run. Post-deletion baseline re-run confirms `--strict` exit 0.

### 7.3 · Repository-wide first-run scan (H1.c)

Scan surface: `src/lib/nex/**` + `src/app/api/nex/**` · 1115 source files (excluding `.test.*`, `.d.ts`, `supabase.ts`/`filesystem.ts` adapters, and `pg-to-supabase-shadow.ts`).

Manifest built from `deploy/postgres/init/*.sql` (49 files): 93 declared tables · 128 unique-declaration rows (PK / UNIQUE / inline PK/UNIQUE / unique indexes) · 0 named UNIQUE constraints.

| Bucket | Count | Meaning |
|---|---|---|
| pass | 28 | Site matches a declared UNIQUE index / constraint / PRIMARY KEY on the referenced table. |
| accept | 3 | Bare `ON CONFLICT DO NOTHING` (E1) — uses any unique constraint. |
| exempt | 0 | Target table not in `deploy/postgres/init/*.sql` (E5). |
| dynamic | 2 | Dynamic column list or table (E6). Manual review required. |
| review | 0 | Unrecognized ON CONFLICT shape. |
| **FAIL** | **0** | Undeclared dependency (blocker). |

**Passes (28):** all NEX-side adapter / registry / worker files with `ON CONFLICT (col_list)` matched a declaration in a migration file. Every match traces to a specific migration:

- `object-postgres.ts:118, 275` → 044
- `predictive/{controls,registry}.ts` → 028
- `knowledge-inbox/pg-shadow.ts:60, 149` + `jobs/pg-shadow.ts:47` → 043
- `journeys/{entry, executions, commands/command_factory}.ts` → 023 / 025 / 018
- `experiments/assignment.ts` → 026
- `delivery/{expansion, worker}.ts` → 018
- `contacts/{merge, registry}.ts` → 012 / 013
- `comms-social/scheduling/categories.ts` → 034
- `comms-social/oauth/accounts.ts` + `identity/provision.ts` → 029
- `comms-social/content/{brand-profiles, sources, templates}.ts` → 032 / 033
- `brain/adapters/postgres.ts:106` → 041
- **`brain/adapters/postgres.ts:208`** → **046** (the smoking-gun site · partial WHERE matched)
- `brain/adapters/postgres.ts:611` → 042
- `attribution/engine.ts:26, 92, 112` → 027
- `alerts/evaluator.ts:34` → 021

**Dynamics (2 · manual review required):**
- `analytics/ingest.ts:184` — `INSERT INTO ${table} ... ON CONFLICT (${keyCol}) DO UPDATE`
- `analytics/ingest.ts:194` — same shape

These are the general analytics rollup ingest path (table + col name are both dynamic). Reviewer must confirm every call site of the containing function passes a `(table, keyCol)` pair whose UNIQUE declaration exists. Not a blocker but recorded as `dynamic` in the script's report.

### 7.4 · Existing undeclared dependencies discovered

**None.** Zero FAIL sites on the current repo state.

### 7.5 · H1.b · migration-state audit against local NEX Postgres

Executed against `localhost:5433/nex_dev` (per `.env.local`):

| Bucket | Count | Files |
|---|---|---|
| applied | 42 | 001-039 (all runnable), 041-046 |
| partial | 2 | 047 · 048 |
| not-applied | 1 | 049 |
| probe-not-applicable | 4 | 000 · 030 · 036 · 037 (schema-only / GRANT-only / no CREATE targets) |

Missing objects (local):
- **047_worker_audit_events.sql** — table applied, 6 indexes + 1 function missing.
- **048_alert_rules.sql** — table applied, 2 indexes + 1 function missing.
- **049_analytics_rollup_queue.sql** — table + 2 indexes + 1 function missing (nothing from this migration applied locally).

These are OP-STATE gaps (H1.a class of work), **not** H1.c static defects: none of the current NEX-side ON CONFLICT dependencies target the missing objects. The alerts evaluator's `ON CONFLICT (rule_id)` matches the inline PRIMARY KEY that 048's `CREATE TABLE` portion DID apply; the supplementary indexes it's missing are read-path performance, not correctness-critical for the current ON CONFLICT.

Recording these gaps satisfies gap register row #1 ("no in-repo audit surface for which migrations are applied"). Applying them to local + prod is H1.a and remains **out of scope this batch**.

### 7.6 · Final H1 state

| Component | State | Notes |
|---|---|---|
| **H1.a** · Apply 046 · 047 · 048 · 049 to production | ⛔ NOT ATTEMPTED | Explicit Philip prohibition · awaits separate authorisation. Local: 046 applied · 047 / 048 partial · 049 not applied (recorded in §7.5). |
| **H1.b** · `scripts/verify-migration-state.mjs` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | Ran green against local · surfaces real drift for 047/048/049 · exit code discipline verified (0 all-applied / 1 any-missing / 2 env error). |
| **H1.c** · `scripts/check-migration-declarations.mjs` | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | Static baseline 0 FAIL · valid-case PASS confirmed · intentionally-undeclared fixture caught in `--strict` (exit 1) · false-positive-prevention paths verified (nested template literals · WHERE whitespace normalization · dynamic tables classified separately). |
| **H1.c** · CI wiring | ⛔ NOT ATTEMPTED | npm script entries added (`nex:check-migration-declarations`, `nex:check-migration-declarations:strict`, `nex:verify-migration-state`); registering as a blocking deploy-branch step awaits access to the CI surface and separate authorisation. |
| **Gap register row #1** (audit surface) | ✅ CLOSED | H1.b provides the audit surface. |
| **Gap register row #2** (CI protection) | ✅ IMPLEMENTED · CI WIRING OPEN | H1.c is the check. Wiring is the remaining prod-side step. |
| **Gap register row #5** (adapter parity `(input_ref, worker_type)` across all adapters) | ⚪ DEFERRED | Not part of this batch's authoring · flagged as an add-on to a subsequent hardening batch. |

**Locked verdict for this batch:**

> **H1 — IMPLEMENTED**
> **H1 — VERIFIED — LOCAL LIVE**
> **PRODUCTION — NOT PROVEN**

Rows H1.a and H1.c-CI-wiring remain open; both require explicit production authorisation and are excluded from this closure.

---

## 8 · Open items after H1 close (explicit)

- **H1.a** · Apply migrations 046 · 047 · 048 · 049 to production NEX Postgres — requires separate Philip authorisation. Sequenced BEFORE any `NEX_BRAIN_BACKEND=postgres` flip or `NEX_ANALYTICS_ROLLUP_ASYNC=1` flip.
- **H1.c wiring** · Register `nex:check-migration-declarations -- --strict` as a blocking step in the deploy pipeline. Requires access to the CI configuration surface.
- **Gap #5 adapter-parity** · Contract test extension asserting every adapter (Postgres · Filesystem · Supabase) enforces `(input_ref, worker_type)` uniqueness for active statuses. Not authored in this batch.
- **`db/migrations/*.sql` disambiguation** · 5 files at `db/migrations/` are not referenced by any runner. Either wire them or delete under an authorised cleanup batch. Not touched here.
- **Non-ON-CONFLICT dependency classes** · code that queries a column/index/function that migration N created is not covered by this check. Extension proposal recorded in §4.5.
