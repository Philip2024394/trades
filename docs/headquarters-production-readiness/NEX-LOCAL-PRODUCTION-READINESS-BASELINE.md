# NEX · Local Production-Readiness Baseline

**Programme:** Headquarters Production Readiness
**Authorisation:** Philip · consolidation only · documentation-only pass
**Date:** 2026-08-10
**Locked verdict:**

> **NEX is LOCALLY VERIFIED across every hardening, verification, and probe surface it has been engineered against.**
> **NEX is NOT PRODUCTION-PROVEN.** Production evidence is BLOCKED at the infrastructure/provisioning layer, not at the engineering layer.
> **Supervisor DISABLED · every default feature flag OFF · 10 preserved KJs 10/10 `claimed / 0 / null` (verified 18× across the session · zero drift).**

This document consolidates evidence from every batch in the session. It does not add new evidence, propose fixes, or resolve open items. It records the state as it is.

Companion documents referenced throughout: `WAVE-3-H1-MIGRATION-HYGIENE.md` · `WAVE-3-H2-CID-LOGGER.md` · `WAVE-3-H3-TIMEOUT-BUDGETS.md` · `WAVE-3-H4-MIGRATION-049-GATE.md` · `WAVE-3-H5-DISPATCHER.md` · `WAVE-3-H6-RLS-DESIGN.md` · `WAVE-4-VERIFICATION-MATRIX.md` · `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md` · `STEP-4-PRODUCTION-EVIDENCE-READONLY.md` · `STEP-4A-PRODUCTION-ACCESS-PATH-DISCOVERY.md` · `STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md` · `E5-PATH-Y-R1-R2-INVESTIGATION.md` · `PHASE-6-VERIFICATION-CLOSURE.md`

---

## 🟢 GREEN · VERIFIED LOCAL

### Programme milestones · all closed at their stated local scope

| Batch | Local verdict | Evidence artifact |
|---|---|---|
| Wave 1 · Migration 046 (local) | ✅ CLOSED | applied to `localhost:5433/nex_dev` · verified via H1.b probe |
| Wave 2 · Phase 6 Supervisor | ✅ VERIFIED — LOCAL LIVE · DISABLED | `PHASE-6-VERIFICATION-CLOSURE.md` |
| Wave 3 · H1 · Migration hygiene | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H1-MIGRATION-HYGIENE.md` · verify-migration-state.mjs + check-migration-declarations.mjs |
| Wave 3 · H2 · CID + Logger | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H2-CID-LOGGER.md` · LAYER1_ADOPTED at 12 routes · 9/9 workers instrumented |
| Wave 3 · H3 · Timeout budgets | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H3-TIMEOUT-BUDGETS.md` · SET LOCAL statement_timeout live-verified with SQLSTATE 57014 |
| Wave 3 · H4 · Migration 049 gate | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H4-MIGRATION-049-GATE.md` · fail-closed with typed `MigrationDependencyError` |
| Wave 3 · H5 · Alert dispatcher (Subsystem A wiring · Q7 shrink) | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H5-DISPATCHER.md` · dispatch gate + fail-closed no-transport counter · webhook delivered to local sink |
| Wave 3 · H6 · Legacy RLS audit + drift-catcher | ✅ VERIFIED — LOCAL LIVE | `WAVE-3-H6-RLS-DESIGN.md` · 191-table baseline locked · CD1+CD2 green |
| Wave 4 · Verification matrix | ✅ LOCAL PASS | `WAVE-4-VERIFICATION-MATRIX.md` · 9 verified · 3 engineering-open · 4 production-open · 2 pre-existing failed (both since resolved: W4-1 by W4-1-fix · V-2c documented as 021/048 consequence) · 1 operator |
| W4-1 · Rollup-drain locale bug | ✅ VERIFIED — LOCAL LIVE | `rollup-worker.ts` normalises via `normalizeTimestamptzForCast` · 5/5 regression + V-3a live |
| W4-2 · Runbook doc drift | ✅ VERIFIED — LOCAL LIVE | `queue-stuck.md` line 5 now references `041_nex_brain_schema.sql` correctly · V-7a broken refs 1 → 0 |
| V-1b · Brain-route zod validation | ✅ VERIFIED — LOCAL LIVE | 11/12 input-taking brain routes migrated to `validateSearchParams`/`validateJsonBody` · supervisor-sweep deferred with recorded rationale |
| STEP 3 · 021/048 collision report | ✅ REPORT COMPLETE | `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md` · factual · no resolution proposed |
| STEP 4 · Read-only production evidence | ✅ ATTEMPT COMPLETE | `STEP-4-PRODUCTION-EVIDENCE-READONLY.md` · 2 verified (Supabase reachability both projects) · 4 unknown (PGRST106 `nex` schema not PostgREST-exposed) · 11 not-testable |
| STEP 4A · Access-path discovery | ✅ COMPLETE | `STEP-4A-PRODUCTION-ACCESS-PATH-DISCOVERY.md` · production `NEX_POSTGRES_URL` exists in Vercel · not in this shell · two blockers (name collision + no read-only role) |
| STEP 4B · Safe access design | ✅ COMPLETE | `STEP-4B-SAFE-READONLY-ACCESS-DESIGN.md` · two-tier plan with `readonly-pg.ts` helper spec |
| STEP 4C · Tier-1 implementation | ✅ IMPLEMENTED · VERIFIED — LOCAL LIVE | `src/lib/nex/verification/readonly-pg.ts` + RU1-RU5 drift-catcher · 5/5 green |
| E5 · Local-live re-verification sweep | ✅ COMPLETE WITH FINDINGS | 3 findings (R1 · R2 · R3) surfaced · all subsequently closed |
| PATH Y · R1 + R2 investigation + fix | ✅ VERIFIED — LOCAL LIVE | `E5-PATH-Y-R1-R2-INVESTIGATION.md` + test-scaffolding fixes · attest/review/CR4b/CR4c all green |
| R3 · Lock-probe port fix | ✅ VERIFIED — LOCAL LIVE | `prove-supervisor-lock.ts` default now `:3008` (matches `package.json` "dev") · concurrent probe confirms advisory lock engages · 2 sweeps ran · 2 skipped_concurrent |

### Currently passing probes (all executed live in E5 or after)

| Probe | What it proves |
|---|---|
| `prove-preservation-invariant.mjs` | 10/10 preserved KJs remain `claimed / 0 / null` |
| `verify-migration-state.mjs` (H1.b) | 47/49 migrations fully applied (047 · 048 partial · known-open) |
| `check-migration-declarations.mjs --strict` (H1.c) | 28 pass · 3 accept · 2 dynamic · 0 FAIL |
| `prove-v3a-rollup-drain.ts` (W4-1 regression) | queue pending → completed · zero failures |
| `prove-concurrent-claim-3.ts` (V-11) | 6/6 unique concurrent claims across 3 workers · zero duplicates |
| `prove-reverse-shadow-live.ts` (V-12) | primary pg insert mirrors to Supabase within 5 s |
| `prove-unsubscribe-roundtrip.ts` (V-13) | state=unsubscribed · gate BLOCKS next send with reason `never_contact` |
| `prove-timeout-injection-live.ts` (H3) | pg_sleep(5) cancelled at ~1s with SQLSTATE 57014 |
| `prove-supervisor-attest.ts` (Phase 6 · Path A · post-R1 fix) | Path A live · burner attested · 10 preserved fixtures untouched · idempotent |
| `prove-supervisor-review.ts` (Phase 6 · Path B · post-R1 fix) | Path B live · burner reviewed · 10 preserved fixtures untouched |
| `prove-supervisor-lock.ts` (Phase 6 · concurrency · post-R3 fix) | 4 concurrent requests · 2 ran · 2 `skipped_concurrent:true` · advisory lock engaged |
| `prove-supervisor-cli.ts` (Phase 6 · CLI) | preserved-KJ guard REFUSED (exit 2) · burner claimed → completed · audit row on Supabase · preservation intact |
| `prove-alerts-dispatch-gate-live.ts` (H5) | gate=off inhibits · gate=on + no env → fail-closed counter · gate=on + webhook → sent=1 |
| `prove-rollup-gate-live.ts` (H4) | flag=0 no-op · flag=1 + 049 absent → typed error · flag=1 + 049 applied → allows · cached |

### Currently passing drift-catchers

- **CADP1-5** · correlation-adoption (H2 · Wave 3): 5/5 · LAYER1_ADOPTED at 12 routes
- **RU1-RU5** · readonly-usage (STEP 4C-Tier-1): 5/5
- **CD1-CD2** · legacy-rls-coverage (H6): 2/2 · baseline locked at 191 gap tables (9 P0 · 5 P1 · 32 P2 · 145 P3)
- **FZA1-FZA5** · finalizeWorkerJob adoption (Wave 11 · Step 8): 5/5
- **W1-W4** · worker-logger-adoption (H2.b): 4/4
- **TB1-TB3** · unbudgeted mutations (H3): 3/3 · 9-entry T-5b allowlist
- **HD1-HD4** · dispatch-gate (H5): 4/4
- **G1-G8** · rollup-gate (H4): 8/8
- **T1-T8** · timeouts config (H3): 8/8
- **TI1-TI5** · timeout-injection (H3): 5/5
- **CR1-CR8** (post-R2 fix): 10/10 · atomic-claim invariant proven end-to-end

### Regression sweep

- **240 pass / 241 total** (observability · workers · config · db · analytics · alerts · verification · jobs · require-cron-token)
- 1 pre-existing failure (CFGA2 · see 🟡 below)
- Zero new failures introduced by any Wave 3 · Wave 4 · W4-1 · W4-2 · V-1b · STEP · E5 · Path-Y · R3 batch

### Preservation invariant · 18 consecutive verifications · zero drift

| Session batch | Result |
|---|---|
| Phase 6 close · pre + post | 10/10 · 10/10 |
| H1 pre + post | 10/10 · 10/10 |
| H2 pre + post | 10/10 · 10/10 |
| H3 pre + post | 10/10 · 10/10 |
| H4 pre + post | 10/10 · 10/10 |
| H5 pre + post | 10/10 · 10/10 |
| H6 pre + post | 10/10 · 10/10 |
| Wave 4 pre + post | 10/10 · 10/10 |
| W4-1 pre + post | 10/10 · 10/10 |
| W4-2 pre + post | 10/10 · 10/10 |
| V-1b pre + post | 10/10 · 10/10 |
| STEP 3 pre + post | 10/10 · 10/10 |
| STEP 4 · 4A · 4B · 4C pre + post | 10/10 · 10/10 |
| E5 pre + post | 10/10 · 10/10 |
| PATH Y pre + post | 10/10 · 10/10 |
| R1 + R2 fix pre + post | 10/10 · 10/10 |
| R3 fix pre + post | 10/10 · 10/10 |
| This consolidation pre | 10/10 |

Every preserved KJ has remained `status=claimed · progress=0 · completion_result=null` throughout the entire session. Zero writes ever touched them.

---

## 🟡 OPEN · KNOWN

### CFGA2 · pre-existing regression · deliberately untouched

**Failure:** `src/lib/nex/config/tests/adoption-drift.test.mjs::CFGA2 · HQ files that read process.env.NEX_POSTGRES_URL directly are on CFGA2_KNOWN_EXCEPTIONS · list cannot grow silently`

**Flagged file:** `src/lib/nex/brain/adapters/postgres.wc-companion.test.ts` (line 37 · direct `process.env.NEX_POSTGRES_URL` read)

**Why still failing:** the flagged file was not added to `CFGA2_KNOWN_EXCEPTIONS` in `adoption-drift.test.mjs`. It has legitimate direct-env-read behaviour for its own test setup (Wave 11 F28 explicitly grandfathered similar cases via the allowlist mechanism · this file was overlooked at allowlist-creation time).

**Why untouched in this session:** every batch authorisation this session explicitly excluded CFGA2 with a standing prohibition (E1 was rejected as unnecessary during E5 planning). The failure predates every batch this session and is unrelated to any Wave 3 · Wave 4 · W4-1 · W4-2 · V-1b · STEP · E5 · Path-Y · R3 work.

**Resolution shape (recorded, not proposed):** add `src/lib/nex/brain/adapters/postgres.wc-companion.test.ts` to the `CFGA2_KNOWN_EXCEPTIONS` set with a one-line justification. Alternative: refactor that test to use a shared config helper. Neither is proposed for action here. A future `AUTHORISE CFGA2-FIX` batch would close it in minutes.

### 021 / 048 · `nex.alert_rules` schema collision · unresolved architectural decision

**State:** two migration files (`021_alerts.sql` · `048_alert_rules.sql`) both `CREATE TABLE IF NOT EXISTS nex.alert_rules` with **hard-incompatible schemas**. 021 wins alphabetically at apply time · 048's CREATE is a silent no-op. Subsystem B (`observability/alert-evaluator.ts` · `observability/alert-rules.ts` · `/api/nex/observability/alert-rules/*`) targets 048's expected shape and cannot function against the live 021 schema.

**Where the finding is recorded:** `WAVE-3-STEP-3-021-048-COLLISION-REPORT.md` — factual report, 12 sections, includes full trace of every affected file / migration / consumer.

**Operator decisions still open (from §8 of the report):**
- **§8.1 · Which subsystem is authoritative?** (A · B · both)
- **§8.2 · How to resolve the table-name collision?** (5 paths R1-R5, plus R6 = accept status quo — see §9 of the report for risk profiles)
- **§8.3 · Severity vocabulary?** (info/warning/critical vs p0-p3 · 4 paths i-iv · none mechanical)
- **§8.4 · Production Supabase state unknown** — will remain unknown until production infrastructure exists

**Not touched in this consolidation.** Resolution requires explicit authorisation naming a specific path from §9. Any resolution touching `nex.alert_rules` requires production migration authorisation Philip has withheld throughout Wave 3-4.

### Production H1-H6 verification · NOT PROVEN

Every H1-H6 batch closed at LOCAL scope with the explicit distinction that PRODUCTION remained NOT PROVEN pending:
- Production migration application (H1)
- Production log-drain vendor pick (H2 R-3)
- Per-worker P99 measurement (H3)
- Production 049 application + flag flip (H4)
- Production dispatch enablement (H5)
- Actual per-subsystem policy application to legacy Supabase (H6)
- V-2b · V-2c · V-4a-prod · V-5a-prod · V-8a · V-9a · V-10b (Wave 4 rows)

None of these can advance until the underlying production infrastructure exists (see 🔴 below · this is not a failed test · it is a missing prerequisite).

### R3 remaining note (already fixed but recorded)

The R3 fix (default port 3000 → 3008) landed in `prove-supervisor-lock.ts`. Not open · listed here only for completeness of the E5-era findings.

---

## 🔴 NOT YET POSSIBLE

### Production database verification requires infrastructure not yet provisioned

Per Philip's STOP directive (2026-08-10): *"I do NOT currently have a Vercel production environment. Therefore there is no production `NEX_POSTGRES_URL` available yet."*

Consequence: every production-only check remains untestable — not because of engineering defect, but because the target environment does not exist.

| Check | Blocker | Nature |
|---|---|---|
| Production migration state (046/047/048/049 index audit) | no production Postgres URL | infrastructure absent |
| Production `nex.knowledge_dump_jobs` state (incl. whether the 10 preserved KJs are also preserved on prod) | no production Postgres URL | infrastructure absent |
| Production 021/048 collision state | no production Postgres URL | infrastructure absent |
| Production RLS coverage via `pg_policies` | no production Postgres URL | infrastructure absent |
| V-2b · F5 rule catalogue populated on prod | no production HTTP URL | infrastructure absent |
| V-2c · F5 evaluator observable on prod | no production HTTP URL · also 021/048 blocker | infrastructure absent + design open |
| V-4a-prod · HMAC signed request on prod | no production HTTP URL | infrastructure absent |
| V-5a-prod · scoped-token supervisor-sweep on prod | no production HTTP URL + supervisor prohibited | infrastructure absent + policy |
| V-8a · production smoke via `scripts/prod-smoke.mjs` | no `NEX_APP_URL` (production/Vercel) | infrastructure absent |
| V-9a · load test | no staging URL | infrastructure absent |
| V-10b · restore rehearsal | no separately-hosted PG target | infrastructure absent |
| H2 R-3 · production log-drain observation | no log-drain vendor pick + drain wiring | infrastructure absent |
| H3 · production P99 measurement | `pg_stat_statements` on prod + query telemetry | infrastructure absent |
| H4 · production 049 application observation | no production Postgres URL | infrastructure absent |
| H6 · production RLS policy coverage per `pg_policies` | no production Postgres URL | infrastructure absent |

The engineering deliverables for every one of these rows exist and are locally verified:
- `readonly-pg.ts` + `prove-production-schema-readonly.ts` are ready to run · they HALT correctly when `NEX_PROD_READONLY_URL` is unset (this is a designed feature, not a bug · STEP 4C retry demonstrated the fail-closed path fires)
- `scripts/prod-smoke.mjs` exists and is authored to accept `NEX_APP_URL`
- Every gate / drift-catcher / audit script is CI-ready

**All that is missing is the production environment.**

### Anything requiring `NEX_PROD_READONLY_URL`

Same category as above. The scoped-shell mechanism designed in STEP 4B works · it has not been exercised because the URL value is not available to any shell (production Postgres does not yet exist).

---

## What must happen next

The engineering programme has reached a durable local baseline. Nothing further is engineering-blocked. The next actions are ORGANISATIONAL or ARCHITECTURAL choices, not code:

1. **Provision production infrastructure** (Vercel project + production NEX Postgres). This is the single unblocking action for the entire 🔴 category. Once provisioned, STEP 4C · Tier-1 (or Tier-2 with the dedicated read-only role) can produce actual production evidence for every row in the 🔴 table. This is an operator/infrastructure decision, not an engineering task.
2. **Take a decision on the 021 / 048 collision.** The report enumerates 6 resolution paths (R1-R5 · R6=hold) each with its own risk profile. Every non-R6 path requires production migration authorisation. The decision includes the severity-vocabulary policy question (§8.3 of the collision report).
3. **Consider closing CFGA2** with a two-line allowlist addition. Trivial when authorised — not proposed for action here per your standing directive.
4. **Ordering:** items 1 and 2 can proceed in either order or in parallel. Item 3 is not on the critical path.

Anything else Philip may want to do (H5 Subsystem B work · R-7 remediation · 047/048 supplementary index application · Class C CID broadening · per-worker P99 tuning · vendor picks for F3/log-drain) is downstream of the above and does not need a decision today.

---

## Preservation invariant (post-consolidation)

- Pre-consolidation: 10/10 preserved KJs `claimed / 0 / null` · violations=0
- Post-consolidation: 10/10 preserved KJs `claimed / 0 / null` · violations=0
- 18 consecutive verifications across the session · zero drift

**End of report.**
