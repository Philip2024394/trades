# Wave 3 · STEP 3 · 021 / 048 Collision · Factual Report (no changes made)

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · STEP 3 · report-only investigation of the `nex.alert_rules` collision
**Date captured:** 2026-08-10
**Locked verdict:**

> **021/048 — FACTUAL REPORT COMPLETE — NO CHANGES MADE**
> No migrations modified · no code modified · no schema modified · no Supabase · no production · 10/10 preserved KJs intact pre + post

This document contains **no proposed solution**. It gives the operator the verified facts required to make an authorised architectural decision.

Companion prior findings:
- `WAVE-3-H5-DISPATCHER.md` §2 · first surfaced the collision
- `WAVE-4-VERIFICATION-MATRIX.md` §2.2 · V-2c fails because of it

---

## 1 · Method

- Read `deploy/postgres/init/021_alerts.sql` verbatim
- Read `deploy/postgres/init/048_alert_rules.sql` verbatim
- Read live schema of `nex.alert_rules` via `information_schema.columns` on `localhost:5433/nex_dev`
- Read live check constraints via `pg_constraint`
- Read live indexes via `pg_indexes`
- Read live rows counts + samples via `SELECT COUNT(*)`
- Read live `nex.alert_rules_bump_updated_at` function existence via `pg_proc`
- Grep every source file that references `nex.alert_rules` under `src/**`
- Grep every UI component that fetches an alerts-related endpoint
- Preservation invariant verified pre + post

Zero mutations. Investigation probe (`_investigate-021-048.mjs`) was created + deleted in the same shell command.

---

## 2 · Migration 021 · what it intended

File: `deploy/postgres/init/021_alerts.sql` (97 lines)

Purpose per file header: *"NEX Operational Alerts · rule catalogue + lifecycle + immutable dispatch audit ... Monitoring → Alert Rules → Canonical system.health_alert event → Alert Dispatcher → { Email · Webhook · Slack · future channels }"*

Creates **three tables + policies + indexes**:

### 2.1 · `nex.alert_rules` (21's shape)
```
rule_id           TEXT PRIMARY KEY                              -- stable slug
name              TEXT NOT NULL
category          TEXT NOT NULL                                 -- 'queue' | 'workers' | 'providers' | 'compliance' | 'rates' | 'webhook' | 'limiter' | 'infra'
severity          TEXT NOT NULL CHECK (severity IN ('info','warning','critical'))
description       TEXT
params            JSONB NOT NULL DEFAULT '{}'                   -- thresholds tunable at runtime
enabled           BOOLEAN NOT NULL DEFAULT TRUE
dedup_window_sec  INT NOT NULL DEFAULT 300
notify_channels   TEXT[] NOT NULL DEFAULT ARRAY['email','webhook','slack']
root_cause_of     TEXT[] NOT NULL DEFAULT ARRAY[]               -- incident-correlation graph
created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

### 2.2 · `nex.alerts` (lifecycle-aware alert instances)
- 16 columns · UUID PK · FK to `nex.alert_rules.rule_id` (`ON DELETE RESTRICT`)
- CHECK constraint: `state IN ('open','acknowledged','resolved')`
- Partial UNIQUE INDEX: one open alert per rule at a time (`alerts_one_open_per_rule`)
- Indexes on `(state, last_triggered_at DESC)`, `(rule_id, state)`, `(incident_id) WHERE incident_id IS NOT NULL`

### 2.3 · `nex.alert_dispatches` (immutable audit)
- 10 columns · UUID PK · FK to `nex.alerts.alert_id` (`ON DELETE CASCADE`)
- CHECK: `status IN ('sent','failed','skipped')`

### 2.4 · RLS
All three tables `ENABLE ROW LEVEL SECURITY`. `service_role` gets `FOR ALL ... USING (true) WITH CHECK (true)`.

---

## 3 · Migration 048 · what it intended

File: `deploy/postgres/init/048_alert_rules.sql` (70 lines)

Purpose per file header: *"F5 · Alert-rule storage. Prior state (per operational audit): 12 rules were hardcoded inside SystemHealthPanel.tsx — operators had to push code to add/remove/tune one. This migration adds the table + minimal audit so alerts become operator-editable data, not code."*

Creates **one table + trigger + indexes**:

### 3.1 · `nex.alert_rules` (048's intended shape)
```
rule_id         UUID PRIMARY KEY DEFAULT gen_random_uuid()
counter_name    TEXT NOT NULL                                     -- references observability counters
comparison      TEXT NOT NULL CHECK (comparison IN ('gt','gte','lt','lte','eq'))
threshold       NUMERIC NOT NULL
window_seconds  INTEGER NOT NULL CHECK (window_seconds > 0)
severity        TEXT NOT NULL CHECK (severity IN ('p0','p1','p2','p3'))
enabled         BOOLEAN NOT NULL DEFAULT TRUE
description     TEXT
channels        JSONB NOT NULL DEFAULT '[]'                       -- future: email/slack/pagerduty destination hints
created_by      TEXT
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
disabled_at     TIMESTAMPTZ
```

### 3.2 · Supporting infrastructure 048 also creates
- Index `idx_alert_rules_counter_enabled ON nex.alert_rules (counter_name, enabled)`
- Index `idx_alert_rules_severity ON nex.alert_rules (severity)`
- Trigger function `nex.alert_rules_bump_updated_at()` · sets `updated_at = NOW()` on UPDATE + toggles `disabled_at` when `enabled` flips
- Trigger `trg_alert_rules_bump BEFORE UPDATE ON nex.alert_rules FOR EACH ROW`
- RLS: same `service_role_all_alert_rules` policy name as 021

---

## 4 · Live schema · what actually exists

Confirmed on `localhost:5433/nex_dev` via `information_schema.columns` + `pg_constraint` + `pg_indexes` + `pg_proc`:

| Aspect | Live state | Matches |
|---|---|---|
| `nex.alert_rules` columns (12) | `rule_id text · name text · category text · severity text · description text · params jsonb · enabled bool · dedup_window_sec int · notify_channels text[] · root_cause_of text[] · created_at timestamptz · updated_at timestamptz` | **021 exactly** |
| CHECK constraint on severity | `severity IN ('info','warning','critical')` | **021 exactly** |
| Indexes on `nex.alert_rules` | Only `alert_rules_pkey` (PK) · **no** `idx_alert_rules_counter_enabled` · **no** `idx_alert_rules_severity` | **021 · 048 supplementary indexes ABSENT** |
| `nex.alerts` table exists | Yes · 16 columns | **021 exactly** |
| `nex.alert_dispatches` table exists | Yes · 10 columns | **021 exactly** |
| `nex.alert_rules_bump_updated_at` function | **not present** (`pg_proc` count = 0) | **048 trigger fn ABSENT** |
| RLS policy `service_role_all_alert_rules` | Present | Same policy name in both files · 021's created first |
| Row count `nex.alert_rules` | **14 rows** (021 shape · e.g. `bounce_rate_spike/warning/rates`, `complaint_rate_high/critical/compliance`, `database_unavailable/critical/infra`) | 021 seed via `alerts/evaluator.ts::seedCatalogue` |
| Row count `nex.alerts` | 4 rows | 021 lifecycle-aware alerts |
| Row count `nex.alert_dispatches` | 12 rows | 021 dispatch audit |

**Root cause of "silent no-op":** both files use `CREATE TABLE IF NOT EXISTS nex.alert_rules`. The apply-schema runner sorts filenames alphabetically, so `021_...` runs first, creates the table with 021's shape, and 048's `CREATE TABLE IF NOT EXISTS` sees the existing table and does nothing. 048's supplementary indexes + trigger + trigger function were also skipped because they gate on shapes the 021 table doesn't have (or, in the trigger fn case, silently no-oped by dev environment despite the table existing — worth further investigation but out of this report's read-only scope).

(H1.b's original probe reported 048 as *partial* — `[partial] 1/4 objects present`. That's consistent: 021 created the table so 048's table-probe finds it, but the 048-specific indexes + function do not exist.)

---

## 5 · Runtime consequences of the collision

### 5.1 · Two independent code paths write / read `nex.alert_rules`

**Subsystem A · `src/lib/nex/alerts/*`**
Consumer files (5 SQL sites):
- `alerts/evaluator.ts:41` — `INSERT INTO nex.alert_rules (rule_id, name, category, severity, description, params, dedup_window_sec, notify_channels, root_cause_of) VALUES (...)` — the seeding path (fires on first `evaluate()`)
- `alerts/evaluator.ts:54` — `SELECT * FROM nex.alert_rules WHERE enabled = TRUE ORDER BY rule_id`
- `alerts/evaluator.ts:276` — `SELECT * FROM nex.alert_rules ORDER BY category, rule_id`
- `alerts/evaluator.ts:290-291` — `UPDATE ... WHERE rule_id = $N ... RETURNING *`

Behaviour: writes/reads 021's columns. Works against live schema.

**Subsystem B · `src/lib/nex/observability/*`**
Consumer files (5 SQL sites):
- `observability/alert-rules.ts:53` — `SELECT * FROM nex.alert_rules ORDER BY enabled DESC, updated_at DESC LIMIT 500`
- `observability/alert-rules.ts:64` — `SELECT * FROM nex.alert_rules WHERE rule_id = $1 LIMIT 1`
- `observability/alert-rules.ts:75-76` — `INSERT INTO nex.alert_rules (counter_name, comparison, threshold, window_seconds, severity, enabled, description, channels, created_by) ...`
- `observability/alert-rules.ts:108` — `UPDATE nex.alert_rules SET ... WHERE rule_id = $N RETURNING *`
- `observability/alert-rules.ts:119` — `DELETE FROM nex.alert_rules WHERE rule_id = $1`

Behaviour against live schema:
- **SELECT works but returns wrong shape** · pg returns 021's columns; `rowToRule()` accesses `r.counter_name`, `r.comparison`, `r.threshold`, `r.window_seconds`, `r.channels`, `r.created_by`, `r.disabled_at` — all `undefined` at runtime · `String(undefined)`=`"undefined"` · `Number(undefined)`=`NaN` · `Boolean(undefined)`=`false` · array field defaults to `[]`. Every returned rule has `enabled: false` because `Boolean(undefined) === false`.
- **INSERT fails** · attempts to insert `counter_name`, `comparison`, `threshold`, `window_seconds`, `channels`, `created_by` into a table that does not have those columns · PG error `42703 · column "counter_name" of relation "alert_rules" does not exist`.
- **UPDATE partially fails** · dynamic SET list built from field diff · if any 048-only field is set, PG rejects with same 42703.
- **DELETE works** · UUID-typed `rule_id` param sent to a TEXT column would fail with `22P02 · invalid input syntax for type text`... but actually `text` accepts any string form of a uuid, so DELETE by rule_id would work if the caller passed a string. Not an actionable path today (see §5.2).

### 5.2 · Downstream consumers

**Subsystem B endpoint route `/api/nex/observability/alert-rules/{,[id]}`**
- Full CRUD wrapper around `observability/alert-rules.ts`
- **NO UI CONSUMES IT.** Grep of `src/components/**/*.tsx` for `observability/alert-rules` returns zero hits.
- Only V-2a/V-2b in Wave 4 exercised it directly via a test probe.

**Subsystem B evaluator `observability/alert-evaluator.ts::evaluateAlertRules()`**
- Called from `src/app/api/nex/brain/llm-health/route.ts:41` — `try { alerts = await evaluateAlertRules(); } catch { alerts = null; }`
- Loads rules via `listAlertRules()` → returns 14 garbage-fielded rows → filters `enabled === true` → returns zero rows (because every `Boolean(undefined) === false`).
- **Net observable behaviour:** `/api/nex/brain/llm-health` reports `observability.alerts.fires = null` (Wave 4 V-2c captured this exact state).

**Subsystem A endpoint routes `/api/nex/alerts/{evaluate,rules,dispatches,metrics,[id]/acknowledge,[id]/resolve,rules/[rule_id]}`**
- Full lifecycle · consumed by `AlertsCentrePanel.tsx` (verified via grep · sole UI consumer)
- Works correctly against 021's live schema
- 14 rules seeded · 4 alerts open · 12 dispatches audited (per live counts §4)

### 5.3 · What's still operational

| Component | Status |
|---|---|
| 021 tables (`nex.alert_rules`, `nex.alerts`, `nex.alert_dispatches`) | ✅ Fully operational · live rows · used by UI |
| Subsystem A evaluator + dispatch | ✅ Operational (H5 wired dispatch behind `NEX_ALERTS_DISPATCH_ENABLED` gate · gate is OFF by default) |
| Subsystem A CRUD via `/api/nex/alerts/rules` (the URL AlertsCentrePanel uses) | ✅ Operational |
| Subsystem B storage adapter (`observability/alert-rules.ts::listAlertRules`) | ⚠️ Returns garbage-fielded rows · silent semantic corruption for callers · every rule reads `enabled=false` |
| Subsystem B CRUD via `/api/nex/observability/alert-rules` | ❌ Writes fail with PG 42703 · reads return garbage · zero UI callers |
| Subsystem B evaluator via `/api/nex/brain/llm-health` | ❌ `observability.alerts.fires = null` (V-2c FAIL) |
| Subsystem B trigger function `nex.alert_rules_bump_updated_at` | ❌ Not present · would fail if any INSERT/UPDATE succeeded on a 048-shaped table (moot because no such table exists) |
| Subsystem B supplementary indexes | ❌ Not present |

### 5.4 · Data safety

- `nex.alert_rules` under 021 shape has valid data (14 seeded rules)
- No data has ever been written under 048's shape (writes always fail with 42703)
- Preservation invariant unaffected · alerts subsystem does not touch KJs

---

## 6 · Incompatible severity models

### 6.1 · The two vocabularies

| Subsystem | Values | Source |
|---|---|---|
| **A · 021** | `'info' \| 'warning' \| 'critical'` (3 levels) | CHECK constraint · used by `nex.alert_rules.severity`, `nex.alerts.severity`, and `alerts/dispatch.ts::SEVERITY_RANK` |
| **B · 048** | `'p0' \| 'p1' \| 'p2' \| 'p3'` (4 tiers · pager-oriented) | CHECK constraint · used by `observability/alert-rules.ts::AlertRule.severity` + `observability/alert-evaluator.ts::RuleFiring.severity` |

### 6.2 · Where each is enforced

- **A** · Enforced at DB level (live CHECK constraint) AND at code level (TypeScript type)
- **B** · Would be enforced at DB level if 048 had landed (it didn't) · currently only enforced at code level

### 6.3 · Interaction with dispatch gate

`alerts/dispatch.ts::meetsMinSeverity()` reads `NEX_ALERTS_MIN_SEVERITY` (default `warning`) and compares against A's `SEVERITY_RANK = { info: 0, warning: 1, critical: 2 }`. A B-value like `p0` or `p3` would not appear in this map · `SEVERITY_RANK[sev] >= 1` would be `undefined >= 1` = `false` · the alert would be treated as sub-threshold and skipped.

### 6.4 · Why a mechanical mapping is unsafe

- `p0` maps to `critical` intuitively (paging escalation)
- `p1` might map to `critical` or `warning` depending on organisational convention
- `p2` might map to `warning`
- `p3` might map to `info` or be dropped
- The mapping is an **incident-response policy decision**, not a code transformation. Different orgs use these tiers differently. Encoding it in code without an authorised policy could silently escalate or under-escalate alerts.

**This report does NOT propose a mapping.** Recording only that the two spaces are semantically distinct and non-mechanically-mappable.

---

## 7 · Every module / route / test that depends on either schema

### 7.1 · Subsystem A (021)
| Kind | Path | What it does |
|---|---|---|
| Migration | `deploy/postgres/init/021_alerts.sql` | Creates 3 tables + RLS + indexes |
| Adapter | `src/lib/nex/alerts/evaluator.ts` | Seeds catalogue · reads + updates rules · opens/dedups/resolves alerts · dispatches |
| Adapter | `src/lib/nex/alerts/dispatch.ts` | Delivers alerts to email/webhook/slack transports · fail-closed no-transport counter |
| Types | `src/lib/nex/alerts/types.ts` | `AlertRule` (021 shape) · `Alert` · `AlertDispatch` |
| Catalogue | `src/lib/nex/alerts/catalogue.ts` | 12+ rule definitions with `info/warning/critical` severities |
| Snapshot | `src/lib/nex/alerts/snapshot.ts` | Builds platform snapshot for rule evaluators |
| Route | `src/app/api/nex/alerts/evaluate/route.ts` | POST/GET · dispatch behind gate (H5) |
| Route | `src/app/api/nex/alerts/rules/route.ts` + `[rule_id]/route.ts` | CRUD used by `AlertsCentrePanel.tsx` |
| Route | `src/app/api/nex/alerts/[id]/acknowledge/route.ts` · `[id]/resolve/route.ts` · `dispatches/route.ts` · `metrics/route.ts` | Alert lifecycle + observability |
| UI | `src/components/nex-app/nex-brain/AlertsCentrePanel.tsx` | Only UI · consumes A endpoints |
| Contract | `src/lib/nex/alerts/tests/dispatch-gate.test.mjs` (H5) | HD1-HD4 |

### 7.2 · Subsystem B (048)
| Kind | Path | What it does |
|---|---|---|
| Migration | `deploy/postgres/init/048_alert_rules.sql` | Silent no-op on live schema (§4) |
| Adapter | `src/lib/nex/observability/alert-rules.ts` | CRUD against 048's expected shape · fails at runtime (§5.1) |
| Adapter | `src/lib/nex/observability/alert-evaluator.ts` | Reads counter snapshot · returns `null` because A rules have no `counter_name` |
| Types | inline in `observability/alert-rules.ts` | `AlertRule` (048 shape · p0-p3) |
| Route | `src/app/api/nex/observability/alert-rules/route.ts` + `[id]/route.ts` | CRUD · zero UI consumers · writes 500 |
| Consumer | `src/app/api/nex/brain/llm-health/route.ts:41` | Best-effort try/catch · silently returns `null` |
| Probe (Wave 4) | `scripts/prove-v2-alert-rules-and-fires.ts` | V-2c confirmed FAIL 2026-08-10 |

### 7.3 · Shared tests / drift-catchers
- `src/lib/nex/observability/tests/correlation-adoption.test.mjs` — LAYER1_ADOPTED includes `/api/nex/alerts/evaluate` (Subsystem A · H5). No B route adopted.
- `src/lib/nex/observability/tests/unbudgeted-mutations.test.mjs` — `alerts/dispatch.ts` on allowlist (T-5b · H3).

---

## 8 · Decisions the operator must make (no recommendation)

These questions must be answered before any migration or code change is authorised:

### 8.1 · Which subsystem is authoritative for alert rules going forward?
- **A · 021** (currently live · UI + dispatch operational · uses rich rule metadata + custom evaluators)
- **B · 048** (counter-based · matches the F5 architecture · currently dead code · no UI)
- **Both** (each covers a distinct alert class · requires the collision to be resolved by giving each subsystem its own table name)

### 8.2 · How is the table-name collision resolved?
- (a) Rename 048's target to e.g. `nex.counter_alert_rules` · requires new migration authorisation · Subsystem B code + route updates
- (b) Extend 021's table with nullable 048 columns · Subsystem B reads/writes only its subset · requires migration authorisation · requires severity-mapping decision
- (c) Retire Subsystem B · delete `observability/alert-rules.ts`, `observability/alert-evaluator.ts`, `/api/nex/observability/alert-rules/*` · no migration needed
- (d) Retire Subsystem A · biggest change · UI + evaluator + dispatch rewrite · requires migration authorisation
- (e) Merge Subsystem B's counter concept into A's `params jsonb` field · no migration · Subsystem B code rewritten

### 8.3 · How is the severity vocabulary resolved?
- (i) Adopt `info/warning/critical` for both (matches live DB · Subsystem B code updated · but pager mapping lost)
- (ii) Adopt `p0/p1/p2/p3` for both (requires migration · rewrites dispatch severity gate)
- (iii) Keep both · maintain a mapping table in a policy document (requires operator to author the mapping)
- (iv) Something else Philip proposes

### 8.4 · Production implications
- Local dev has 14 rules · 4 alerts · 12 dispatches in the 021 shape
- Production Supabase state unknown to this report (read-only investigation was against local · production access not authorised)
- Any resolution touching `nex.alert_rules` needs production migration authorisation
- The gap has existed since 048 landed · service_role uses BYPASSRLS · no live safety issue
- Enabling `NEX_ALERTS_DISPATCH_ENABLED=1` in production would trigger the Subsystem A path against production rule data (which may or may not be seeded · unknown from this report)

---

## 9 · Possible resolution paths + risk profile

Enumerated for the operator. **No recommendation.**

| Path | Description | Migration required? | Code changes | UI impact | Risk highlights |
|---|---|---|---|---|---|
| **R1 · Rename 048's table** | New migration renames the 048 target to `nex.counter_alert_rules` (or similar) · re-runs 048's DDL against the new name | ✅ new migration | Subsystem B: table names + route paths | none (no UI consumer) | Two rule engines coexist · policy decision on severity mapping still required |
| **R2 · Extend 021 with nullable 048 columns** | New migration adds `counter_name text null · comparison text null · threshold numeric null · window_seconds int null · channels jsonb null · created_by text null · disabled_at timestamptz null` · Subsystem B reads/writes only its columns · rows can be Subsystem A OR B based on which nullable set is populated | ✅ new migration | Subsystem B: keep types · Subsystem A: unchanged | none | Severity CHECK must be widened (info/warning/critical + p0-p3 or new unified vocabulary) · severity policy decision required · schema becomes bifunctional/ambiguous |
| **R3 · Retire Subsystem B** | Delete `observability/alert-rules.ts` · `observability/alert-evaluator.ts` · `/api/nex/observability/alert-rules/*` route + `[id]` route · remove `evaluateAlertRules` call in `llm-health/route.ts` | ❌ none | Subsystem B removed · llm-health no longer surfaces `observability.alerts` | none | Counter-based rules lost as a concept (would need re-encoding as 021 rules with a new custom evaluator per counter) · V-2c is closed by removal, not by fix |
| **R4 · Retire Subsystem A** | Delete `alerts/*` including evaluator + dispatch + types + catalogue · UI (`AlertsCentrePanel.tsx`) rewritten against B · new migration drops 021's tables · Subsystem B extended with everything A provides (lifecycle, dispatch, incident correlation, etc.) | ✅ new migration + destructive drop | Massive · rewrites the entire alert engine | Complete UI rewrite | Highest blast radius · loses working code that has real users (4 open alerts, 12 dispatches) · not a like-for-like swap |
| **R5 · Encode B's model in A's `params jsonb`** | Every B-shaped rule stored as an A row with `params = { counter_name, comparison, threshold, window_seconds, channels }` · Subsystem B rewritten to read from A's `params` field instead of top-level columns | ❌ none | Subsystem B storage adapter rewritten (~one file) · evaluator rewritten to iterate A rows filtering by `category='counter'` or similar | none | No migration · smallest schema change · but Subsystem B's typed shape becomes a runtime unpack of `params jsonb` · severity mapping still required |
| **R6 · Do nothing** | Accept the current state as a documented architectural gap · V-2c stays FAILED · `/api/nex/observability/alert-rules` remains dead · Subsystem B is understood as vestigial | ❌ none | none | none | Preserves audit history · does not address the gap · risk that future work re-encounters B's dead code and reintroduces confusion |

Each of R1-R5 also requires a **severity-mapping decision** (§6). R6 requires no decision but does not close the gap.

---

## 10 · What this report does NOT do

- Does NOT choose R1-R6
- Does NOT invent a severity mapping
- Does NOT modify any migration file
- Does NOT modify any code
- Does NOT modify any production or local database schema
- Does NOT touch Supabase (dev or prod)
- Does NOT touch the 10 preserved KJs (verified pre + post: 10/10 `claimed / 0 / null`)
- Does NOT enable any feature flag
- Does NOT declare Subsystem B's R-4 gap closed (that remains OPEN)
- Does NOT modify Wave 4 verification matrix
- Does NOT propose additional test coverage · that would be pre-work for a decided resolution

---

## 11 · Final state

> **021/048 — FACTUAL REPORT COMPLETE — NO CHANGES MADE**
> Awaiting Philip's decision on §8 questions before any subsequent step can be authorised.
