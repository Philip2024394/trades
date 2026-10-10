# NEX Cross-DB Reconciler · Implementation Summary · 2026-10-10

**Agent:** F2 (Cross-DB Reconciler) · **Branch:** `nex/directory-work`
**Status:** NEX-side implementation complete · reconciler is OFF by default
and SIMULATE-ONLY by default · zero real Supabase calls possible until the
operator flips both env vars.

**Companions:**

- `docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md` (Agent E · operator runbook)
- `docs/doctrine/adr-nex-cross-db-owner-link-2026-10-09.md` (ADR authorising the pattern)
- `docs/doctrine/nex-cross-db-identity-model-2026-10-10.md` (identity-model doctrine)
- `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql` (Supabase side · operator-applied)

---

## 0 · What this document is

A concise completion note for the NEX-side reconciler wave. The reconciler
service, its audit log table, and the feature flag module are now authored,
tested, and (for the migration) applied to local `nex_dev`. The service is
INERT until the operator explicitly activates it after the Supabase-side
migration lands.

This file does NOT re-litigate the architecture (that lives in the runbook
and the ADR). It records what shipped, what the activation procedure looks
like, and the explicit safety claims.

---

## 1 · What shipped

### 1.1 · Audit log migration

- `deploy/postgres/init/191_nex_cross_db_reconcile_log.sql` ·
  authored + applied to local `nex_dev`.
- Schema mirrors runbook §5.4 exactly (9 sealed event types, idempotency
  key UNIQUE per attempt, simulated flag defaulting to TRUE, FKs with
  ON DELETE SET NULL to `nex.business_claim` + `nex.business_canonical`).
- Idempotent re-apply confirmed: a second `--apply` run finds the table
  already present and all CREATE statements are no-ops. Zero DML.
- Session-identity gated: the applier aborts unless
  `current_database() = 'nex_dev'`.

### 1.2 · Structural test for migration 191

- `scripts/nex-canonical/__tests__/migration-191.test.ts` · 30 assertions
  on columns, CHECKs, FKs, indexes, and safety posture (no DML, no DROP,
  no GRANT/REVOKE, no triggers, no ALTERs on pre-existing tables).
- Run with:
  ```
  npx vitest run scripts/nex-canonical/__tests__/migration-191.test.ts
  ```
  (requires an adhoc vitest config pointing `include` at the file; the
  canonical vitest.config.ts does not auto-scan `scripts/**/*.test.ts`.)

### 1.3 · Service layer

| Module | Purpose |
|---|---|
| `src/lib/nex-native/cross-db-reconciler/types.ts` | Shared types + `RECONCILE_EVENT_TYPES` + `isReconcileEventType` guard + `ReconcileResult` discriminated union. |
| `src/lib/nex-native/cross-db-reconciler/feature-flag.ts` | `isReconcilerEnabled()` (default FALSE) + `isReconcilerSimulateOnly()` (default TRUE). |
| `src/lib/nex-native/cross-db-reconciler/log-service.ts` | `recordReconcileEvent()` (idempotent UPSERT) + `readRecentReconcileEvents(limit)` (admin read). |
| `src/lib/nex-native/cross-db-reconciler/reconciler.ts` | `reconcileVerifiedClaim()` · the gated service with the full decision tree. |

### 1.4 · Test counts

| Suite | Tests | Status |
|---|---|---|
| `migration-191.test.ts` | 30 | PASS |
| `log-service.test.ts` | 24 | PASS |
| `reconciler.test.ts` | 15 | PASS |

Reconciler tests exercise: feature flag OFF, simulate-only ON, UPDATE 1 row
→ linked_existing, UPDATE 0 + INSERT 1 → stubbed_new, UPDATE >1 → ambiguous,
INSERT 23505 → ambiguous, client factory null → supabase_error, client
factory throws → supabase_error, generic rejection with sanitised detail,
idempotent re-run returning alreadyRecorded, idempotency-key stability +
format, backoff ms stepping (1s / 5s / 25s).

---

## 2 · Feature flag defaults (CRITICAL)

```
NEX_CROSS_DB_RECONCILER_ENABLED        · DEFAULT: false
NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY  · DEFAULT: true  (safe)
```

Behaviour matrix:

| ENABLED | SIMULATE_ONLY | What happens |
|---|---|---|
| false / unset | any | `feature_disabled` · zero log writes · zero Supabase calls. **Current state.** |
| `"true"` | unset / anything-not-`"false"` | `simulation_only` · one `link_attempted` audit row with `simulated = TRUE` · zero Supabase calls. |
| `"true"` | `"false"` | **Live mode.** Supabase client is loaded via dynamic import. UPDATE/INSERT path runs. Audit row written with `simulated = FALSE`. |

The SIMULATE_ONLY gate is strict: only the literal string `"false"` promotes
to live mode. `"FALSE"`, `"0"`, `"no"`, `""` all keep the reconciler in
simulate-only. This is deliberate — a missing or malformed env var MUST
NEVER silently escalate to the dangerous path.

---

## 3 · Activation procedure (operator checklist)

**Do NOT activate until all five items are true.**

1. The Supabase-side migration
   `nex-supabase/migrations/999_WIP_add_canonical_business_id_to_nex_business.sql`
   has been applied to Supabase Project B (`ijvqdvsvwtwxzcqmoqit`) via the
   procedure in `docs/doctrine/nex-cross-db-operator-runbook-2026-10-10.md`
   §3 and verified via §4.
2. The dry-run harness
   `scripts/nex-canonical/_cross-db-reconciler-dry-run.mjs` has been run
   against `nex_dev` within the current operator session and all 6
   scenarios reported PASS.
3. The audit log table `nex.cross_db_reconcile_log` is confirmed present
   in `nex_dev` via `SELECT to_regclass('nex.cross_db_reconcile_log')`.
   (The current wave already applied migration 191 to `nex_dev`.)
4. Explicit founder sign-off recorded in the operator log with reference
   to this doc at the applying commit.
5. The Supabase service-role key is loaded in the server environment as
   `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` is set.

**Activation (two-stage):**

- **Stage A · observe simulations.** Set
  `NEX_CROSS_DB_RECONCILER_ENABLED=true` in the server environment and
  redeploy. The reconciler now writes `link_attempted` audit rows with
  `simulated = TRUE` every time a verified claim fires. No Supabase calls
  are made yet. Operator inspects the audit rows via
  `readRecentReconcileEvents(100)` for a founder-chosen soak window
  (recommend: ≥24h).

- **Stage B · promote to live.** When soak is clean, set
  `NEX_CROSS_DB_RECONCILER_SIMULATE_ONLY=false` and redeploy. The reconciler
  now instantiates the Supabase client on each call and performs the real
  UPDATE/INSERT. Each outcome row carries `simulated = FALSE`.

Rollback: set `NEX_CROSS_DB_RECONCILER_ENABLED=false` and redeploy. The
reconciler returns `feature_disabled` on the first line. The audit table
is preserved for forensics.

---

## 4 · Explicit safety claims

- **Zero real Supabase calls have been made during this wave.** The
  reconciler module compiles, type-checks, and tests cleanly without ever
  invoking `createClient` from `@supabase/supabase-js`. The import is
  conditional (dynamic + guarded by env var presence) so the module stays
  safe even if the Supabase SDK were absent from `node_modules`.
- Feature flag defaults are proven at test time: with env vars untouched
  the reconciler returns `feature_disabled` and writes nothing (see
  `reconciler.test.ts` · "feature flag OFF" section).
- Simulate-only is the single-escape default: the only way to reach the
  live Supabase call site is for BOTH env vars to be explicitly set to
  their live values. There is no code path that silently promotes.
- Error messages logged to `nex.cross_db_reconcile_log.error_detail`
  are passed through a local `sanitiseError` helper (mirrors
  `directory-service.ts`) that strips Postgres URLs, `password=...`
  fragments, and JWT-shaped tokens.
- The audit log table CHECK bounds `error_detail` at 2000 chars and
  `error_code` at 64 chars. The service validates both pre-DB to fail
  fast with a typed reason.
- The audit log table stores `supabase_account_id` as raw TEXT for
  operational traceability. Any export job MUST hash this column before
  the data leaves NEX. The migration header + the TABLE comment both
  record this requirement.

---

## 5 · Known ambiguity (future founder decisions)

Two parameters were set to pragmatic defaults in this wave and SHOULD be
reviewed by the founder before Stage B promotion:

| Parameter | Default | Why ambiguous |
|---|---|---|
| Retry cap | 3 attempts (1s / 5s / 25s backoff) | Runbook §6.2 mentions a "retry queue (deferred infrastructure)" without specifying how many retries before escalation. Current reconciler returns `retryAfterMs` and lets the caller decide; after attempt 3 the backoff caps at 25s. |
| Sweep frequency | NOT YET IMPLEMENTED | Runbook §8 mentions a "weekly orphan sweep" without an exact cron cadence. The audit log already has the `sweep_run` + `orphan_detected` event types reserved. The sweep implementation is deferred to a future wave. |

Neither decision blocks Stage A. Both should be made explicit before
Stage B.

---

## 6 · Hands-off scopes (verified)

This wave touched ONLY these files:

- `deploy/postgres/init/191_nex_cross_db_reconcile_log.sql`
- `scripts/nex-canonical/_apply-migration-191.mjs`
- `scripts/nex-canonical/__tests__/migration-191.test.ts`
- `src/lib/nex-native/cross-db-reconciler/types.ts`
- `src/lib/nex-native/cross-db-reconciler/feature-flag.ts`
- `src/lib/nex-native/cross-db-reconciler/log-service.ts`
- `src/lib/nex-native/cross-db-reconciler/log-service.test.ts`
- `src/lib/nex-native/cross-db-reconciler/reconciler.ts`
- `src/lib/nex-native/cross-db-reconciler/reconciler.test.ts`
- `docs/doctrine/nex-cross-db-reconciler-implementation-2026-10-10.md` (this doc)

Parallel-agent scopes NOT touched:

- F1 (fixes 1-3): canonical-handoff, directory types, claim-service, OwnerClaimForm, directory [id] page.
- F3 (accommodation): migration 192 + accommodation runners.
- F4 (Emergency schema): migration 193 + emergency library.
- F5 (Emergency UI): settings, emergency-help, emergency components.

---

**End of implementation summary.**
