# NEX Headquarters · World-Class Operational System · Gap Register

**Programme:** Headquarters Production Readiness · Delta audit beyond Wave 11
**Date:** 2026-08-11
**Author role:** Chief Engineer AI · NEX Corporation
**Objective:** Surface the remaining gaps between current Headquarters state and a world-class operational system. Everything Wave 11 covered is OUT of this doc's scope · it belongs to Wave 11.
**Not-a-goal:** Re-audit anything already surfaced by `HEADQUARTERS-PRODUCTION-READINESS-AUDIT.md` (living master roll-up) · `WAVE-11-ENGINEERING-QUALITY-AUDIT.md` (37 engineering-quality findings) · Appendices A1 (data storage map) or A2 (worker deployment).

## Scope

Five operational lenses. Each was surveyed by an independent Explore agent with an explicit "do not re-cover Wave 11" boundary and a structured `EXISTS / PARTIAL / MISSING` return format.

| # | Lens | Focus |
|---|---|---|
| 1 | **Observability & operator experience** | Dashboards · alerts · runbooks · SLOs · correlation IDs · log aggregation |
| 2 | **Security beyond boundary validation** | Secrets · RBAC · rate limits · dependency vulns · CSP/CORS/CSRF · RLS coverage |
| 3 | **Deployment & release engineering** | CI/CD · deploy topology · rollback · migrations under load · env parity · feature-flag lifecycle |
| 4 | **Data safety & recovery** | Backups · PITR · restore drills · retention · GDPR erasure · encryption at rest/in transit · migration reversibility |
| 5 | **Reliability engineering** | Circuit breakers · retries · timeouts · idempotency · graceful degradation · load/chaos testing · capacity planning |

## Methodology

- 5 parallel `Explore` agents (read-only · Glob · Grep · Read)
- Each agent given an explicit list of Wave 11 findings to EXCLUDE (F1-F37)
- Each returned findings in three buckets: `EXISTS AND WORKING` · `PARTIAL / INCOMPLETE` · `MISSING (world-class gap)`
- Structured evidence with `file:line` references
- Severity ranking P0/P1/P2/P3 aligned with Wave 11's convention

## Severity semantics (same as Wave 11)

- **P0** · Blocks production for a world-class deployment. Correctness · data-safety · unrecoverable.
- **P1** · Serious. Directly limits operational maturity or scale.
- **P2** · Important. Improves posture · defers well only if never scaled beyond current single-user topology.
- **P3** · Nice-to-fix. Deferrable indefinitely without material risk.

## Executive summary

| Metric | Count |
|---|---|
| **Genuinely new gaps** (not in master audit or Wave 11) | **46** |
| P0 · world-class blocker | **0** (initial survey identified 2 · **both verification-corrected 2026-08-11** · see `WORLD-CLASS-OPS-P0-VERIFICATION.md`) |
| P1 · serious | **29** (was 28 · +1 from W-SEC-1 downgrade + Supabase-legacy split) |
| P2 · important | **15** |
| P3 · deferrable | **1** |
| Lenses with world-class strengths worth naming | **3** (Observability infra · Reliability substrate · Data-crypto architecture) |

> **Verification correction (Philip 2026-08-11 · authorized):** The initial survey identified two P0 candidates (W-SEC-1 · W-OBS-1). Subsequent evidence verification corrected both: W-SEC-1 is **not** a `nex.*` gap (36 tables have 96 policies + `nex_brain_app` role fully wired) · the real issue is a P1 defense-in-depth gap in ~20 Supabase-legacy `public` schema tables where RLS is enabled but zero policies exist. W-OBS-1 is limited to the Brain worker chain (0/9 workers) + HTTP edge · journeys / attribution / error-envelope subsystems already thread correlation IDs correctly. **No verified P0 blockers remain.** Full evidence in `WORLD-CLASS-OPS-P0-VERIFICATION.md`.

## World-class strengths (the substrate is strong)

Before the gaps, three areas already at world-class or approaching it:

1. **Reliability substrate** — LLM 10-provider circuit-breaker chain with per-provider fault isolation (30s cooldown auto-close) · exponential backoff with ±20% jitter across LLM + delivery paths · bounded retry ring buffer (F9 · capacity 1000 · overflow signals) · dual-write audit (filesystem event bus + Supabase) · chaos test adapter (`NEX_CHAOS_MODE` env gate) · 7-scenario recovery test suite. `src/lib/nex/brain/llm.ts:154-412` · `src/lib/nex/delivery/retry.ts` · `src/lib/nex/observability/retry-buffer.ts` · `src/lib/nex/delivery/adapters/chaos.ts`
2. **Cryptography & data-at-rest** — AES-256-GCM envelope encryption for payment creds + per-tenant DEK-wrapped-by-KEK for OAuth tokens · `nex.social_dek_wraps` enforces one-active-DEK-per-(tenant,purpose) rotation-ready · SHA-256-checked backup manifests with anti-downgrade protection · 84-test backup suite. `src/lib/credentialCrypto.ts` · `src/lib/nex/comms-social/crypto/envelope.ts` · `docs/TRADE_OS_SPEC/NEX_BACKUP_ARCHITECTURE.md`
3. **Observability core** (Wave 11 Step 6) — discriminated `Outcome` type · 14 named counters with `honest "—"` for uninstrumented paths · bounded signal emission (240 char cap · secrets-safe) · `validateOrDrop<T>` at JSON boundaries. `src/lib/nex/observability/{outcome,counters,signals,validate}.ts`

These are the foundations. The gaps below are what stands between them and world-class end-to-end.

---

## Fix-together clusters

Related findings that share a strategic remediation. Fix them together or the individual patches drift.

### Cluster W-A · Cross-cutting request identity (correlation IDs)

Every request from user → API route → worker → audit trail should share ONE `correlation_id`. Verification (2026-08-11) confirmed the journey / attribution / error-envelope subsystems already thread it. **The remaining gap is Brain worker chain (0/9 workers) + HTTP edge · not system-wide.**

- W-OBS-1 · Correlation ID threading absent on Brain workers + HTTP edge (P1 · design-first · 3 paths in `WORLD-CLASS-OPS-W-OBS-1-DECISION-RECORD.md`)
- W-OBS-4 · Structured logging without context
- W-SEC-7 · Admin-action audit logging absent
- **Strategic fix:** design decision precedes implementation. See W-OBS-1 decision record for three options with blast-radius analysis.

### Cluster W-B · Rate-limit + DoS ingress protection

- W-SEC-4 · In-memory rate limiter fails on multi-instance
- W-REL-4 · Load-test harness absent (can't prove the limiter works)
- W-REL-7 · Load shedding / backpressure absent
- **Strategic fix:** Vercel Edge Config rate-limit OR Upstash Ratelimit backing (per-tenant + per-endpoint) · same rules re-used by k6 load harness · queue-depth counter drives backpressure.

### Cluster W-C · Timeout budgets end-to-end

- W-REL-1 · Storage-layer timeouts absent
- W-REL-2 · Worker cycle/job timeouts absent
- **Strategic fix:** `AbortController` on every external call · per-worker cycle deadline (default 15m) · per-job deadline (default 5m · overridable) · timeout throws propagate to retry buffer.

### Cluster W-D · Row-Level Security defense-in-depth · Supabase-legacy only

Verification (2026-08-11) confirmed the `nex.*` schema (`deploy/postgres/init/`) has 96 policies + `nex_brain_app` role fully wired · **no gap there**. The real issue is ~20 Supabase-legacy migration files (`supabase/migrations/os_*.sql` and similar) that enable RLS but define zero policies. Runtime is currently safe because `service_role` bypasses RLS · defense-in-depth is a false comfort.

- W-SEC-1 · RLS defense-in-depth gap · Supabase-legacy public schema only (P1 · design-first · not a blanket sweep)
- **Strategic fix:** per-subsystem access-model design pass · one Supabase-legacy file at a time · each producing intended access model doc + policy migration + positive/negative role tests + staged rollout.

### Cluster W-E · Observability export

- W-OBS-3 · No Prometheus / DataDog / CloudWatch export
- W-OBS-5 · No Vercel Log Drain / Fly log target configured
- W-OBS-9 · No MTTD/MTTA/MTTR targets
- **Strategic fix:** `/api/nex/observability/metrics` in Prometheus text format · Vercel logDrains → Datadog · SLO doc defines the targets Prometheus alerts fire on.

### Cluster W-F · GDPR / compliance operational flow

- W-DAT-3 · Vendor training opt-outs undocumented (P1)
- W-DAT-4 · Secrets-in-logs pattern audit missing (P1)
- W-DAT-5 · Cross-border data transfer documentation absent (P1)
- W-DAT-6 · PII per-field labeling absent (P2)
- W-DAT-7 · Retention-job automation absent (P2)
- **Strategic fix:** author `docs/compliance/GDPR-OPERATIONAL-PLAYBOOK.md` covering all 5 · per-table PII labels in schema comments · daily retention cron using existing `retention_days` columns.

### Cluster W-G · Release engineering discipline

- W-DEP-1 · CHANGELOG / semantic versioning / release notes
- W-DEP-2 · Pre-deploy smoke tests
- W-DEP-3 · Post-deploy verification automation
- W-DEP-4 · Drift-catchers not in CI
- W-DEP-5 · Deployment topology diagram
- **Strategic fix:** conventional commits → automated CHANGELOG · `scripts/smoke-test.mjs` gates deploy · Vercel/Fly post-deploy health-probe cron · CI job runs `adapter-isolation.test.mjs` + `adoption-drift.test.mjs` on every PR.

---

## Findings register

Each finding uses the Wave 11 8-column format condensed to what actually varies here (severity, evidence, required change, closure condition). ID prefixes: `W-OBS-*` observability · `W-SEC-*` security · `W-DEP-*` deployment · `W-DAT-*` data safety · `W-REL-*` reliability.

### Lens 1 · Observability & operator experience

#### W-OBS-1 · Correlation IDs missing on the Brain worker chain + HTTP edge (scope-corrected 2026-08-11 · **Layer 1 IMPLEMENTED 2026-08-11**)

| Column | Content |
|---|---|
| **Severity** | **P1** (unchanged · scope narrowed after verification) |
| **Original survey claim (INCORRECT SCOPE)** | "zero callers populate it" · agent's grep excluded populated subsystems and implied system-wide absence. |
| **Verified reality** | correlation_id IS populated in `journeys/entry.ts` · every `journeys/triggers/*` file · `attribution/engine.ts` · `attribution/types.ts` · `api/error-envelope.ts` — journey/attribution/error subsystems have full threading. **The real gap is narrower**: (a) 9 Brain worker files (`_finalize · image-analyst · knowledge-context · knowledge-extractor · learning-context · llm-retry · memory-guardian · quality-checker · voice-context`) have **0 correlation_id references** · they use `job_id` as de-facto identity (Wave 11 F35). (b) `src/middleware.ts` is a host-routing middleware only · does NOT generate `x-request-id`. (c) The inbox → job boundary discards any upstream identity because `job_id` is generated fresh at enqueue time. |
| **Runtime effect (pre-Layer-1)** | An operator receiving a client-facing error with `correlation_id: X` (via error-envelope) can trace it through journeys/attribution paths · but if the same client action later triggers a Brain worker chain via inbox upload, correlation is **LOST at the inbox → job boundary**. |
| **Remediation shipped (Layer 1 · 2026-08-11)** | Path A Edge-middleware + AsyncLocalStorage · Option 1 for `nex.events` persistence (JSONB payload · no schema change). Full implementation summarized in `WORLD-CLASS-OPS-W-OBS-1-PATH-A-PLAN.md` § Implementation outcome. End-to-end trace now functions: HTTP edge → route handler ALS → inbox item CID persistence → dispatch copies to `WorkerJob.input_payload` → worker enters ALS scope from claim → `finalizeWorkerJob` inherits parent CID into child jobs → signals + audit inherit via `emitSignal` ALS fallback. **No schema change · no migration · Layer 2 boundary intact.** |
| **Retest** | 10/10 CID contract + 5/5 CADP drift-catcher + 15/15 F35 preserved + 188/188 baseline (6 pre-existing fails unchanged). See § Implementation outcome in the Path A plan doc for full gate matrix. |
| **State** | **READY** (Layer 1 shipped in working tree pending commit · Layer 2 remains deferred pending 4-week production measurement) · Cluster W-A · full evidence in `WORLD-CLASS-OPS-P0-VERIFICATION.md` · path analysis in `WORLD-CLASS-OPS-W-OBS-1-DECISION-RECORD.md` · implementation in `WORLD-CLASS-OPS-W-OBS-1-PATH-A-PLAN.md` § Implementation outcome. |

#### W-OBS-2 · Operator runbooks absent · zero SOPs for failure modes

| Column | Content |
|---|---|
| **Severity** | **P1** — operator seeing "storage unreachable" or "oldest pending 10m" has no written procedure |
| **Evidence** | `find docs/ -iname '*runbook*' -o -iname '*oncall*' -o -iname '*incident*' -o -iname '*sop*'` → **no matches**. `SystemHealthPanel` renders health status, no linked SOP. |
| **Required change** | Author `docs/operations/runbooks/` with SOP templates: `storage-unreachable.md` · `queue-backlog.md` · `worker-heartbeat-missing.md` · `dead-letter-jobs.md` · `llm-provider-outage.md` · minimum 5 to start. |
| **Retest** | Grep `docs/operations/runbooks/*.md` returns ≥5 files each ≥30 lines. |
| **State** | **OPEN** |

#### W-OBS-3 · Metrics never exported to a time-series backend

| Column | Content |
|---|---|
| **Severity** | **P1** — cannot visualize trends across days/weeks · impossible to spot slow degradation |
| **Evidence** | `src/lib/nex/observability/counters.ts:86-100` — `snapshot()` returns a `Map` only. No `/api/nex/observability/metrics` route. `grep -r "prometheus\|datadog\|cloudwatch\|statsd" src/` → zero. |
| **Required change** | New `/api/nex/observability/metrics` route emitting Prometheus text format `# HELP` / `# TYPE` / `counter_name value` from `snapshot()`. Optional: DataDog agent integration for hosted push. |
| **Retest** | `curl /api/nex/observability/metrics` returns valid Prometheus format · every counter in `KNOWN_COUNTERS` appears. |
| **State** | **OPEN** · Cluster W-E |

#### W-OBS-4 · Structured logging with context absent · plain `console.log` everywhere

| Column | Content |
|---|---|
| **Severity** | **P1** — production log grep is O(n) string search · no field query · no aggregation |
| **Evidence** | `grep -c "console.log\|console.warn" src/lib/nex/brain/**/*.ts` → hundreds. Sample `src/lib/nex/knowledge-inbox/storage.ts:660` — plain string · no `job_id` · no `brain_id` · no `attempt`. |
| **Required change** | Introduce `src/lib/nex/observability/logger.ts` wrapping `console.log` with JSON output: `{ level, timestamp, subsystem, correlation_id, job_id?, brain_id?, message, error_code? }`. Migrate high-value worker log lines first (per-worker `_finalize.ts`). |
| **Retest** | New test asserts every worker's log lines are valid JSON with `subsystem` + `correlation_id` fields. |
| **State** | **OPEN** · Cluster W-A |

#### W-OBS-5 · Log aggregation / drain not configured

| Column | Content |
|---|---|
| **Severity** | **P1** — Vercel logs evaporate after 24h · Fly logs after 7d · no historical debugging |
| **Evidence** | `vercel.json` contains crons only · no `logDrains` key. `fly.toml` no `log_shipping`. `grep -r "winston\|pino\|bunyan\|log.*drain" src/` → zero. |
| **Required change** | Choose target (Datadog · Better Stack · self-hosted Loki) · configure Vercel logDrains via project settings · add Fly log_shipping if we keep Fly. |
| **Retest** | Manual smoke: emit a distinctive log line · confirm it appears in the drain target within 5m. |
| **State** | **OPEN** · Cluster W-E |

#### W-OBS-6 · Alert rules hardcoded · no CRUD UI for operator

| Column | Content |
|---|---|
| **Severity** | **P1** — new failure mode requires code push · operator cannot tune thresholds live |
| **Evidence** | `AlertsCentrePanel.tsx` — 12 rules hardcoded. Runtime toggle exists · runtime CREATE does not. |
| **Required change** | Rule storage moves to DB (`nex.alert_rules` table) · panel gains editor: condition expression, threshold, channels, dedup window, auto-resolve. |
| **Retest** | New test: create a rule via API · fire matching signal · assert dispatch. |
| **State** | **OPEN** |

#### W-OBS-7 · SLO / SLI contract undefined

| Column | Content |
|---|---|
| **Severity** | **P2** (world-class operators need bands · deferrable while single-tenant) |
| **Evidence** | `grep "SLO\|SLI\|uptime.*target\|99\.9" docs/` → matches in roadmap docs only (aspirational) · no active policy file. |
| **Required change** | Author `docs/operations/slos-slis.md` — per-subsystem: `inbox-processing p95 <5m` · `alert-dispatch <30s` · `heartbeat every 2m` · `overall uptime 99.9%` · define green/yellow/red bands. |
| **Retest** | Doc exists · every SLO has a metric emitted by the observability layer that can evaluate it. |
| **State** | **OPEN** · Cluster W-E |

#### W-OBS-8 · No automatic incident correlation / RCA grouping

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | `AlertsCentrePanel` groups alerts by `incident_id` (hand-assigned in payload). No auto-heuristic (timing proximity · shared subsystems · shared correlation_id). |
| **Required change** | Grouper reads recent alerts · groups by ≤60s timing window AND shared subsystem OR shared correlation_id. Emit `incident-grouped` signal. |
| **State** | **OPEN** |

#### W-OBS-9 · MTTD/MTTA/MTTR targets absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | `SystemHealthPanel` reads MTTA/MTTR from alerts · defines no target. |
| **Required change** | Add targets in the SLO doc (W-OBS-7) · dashboard displays actual-vs-target color banding. |
| **State** | **OPEN** · Cluster W-E |

#### W-OBS-10 · On-call scheduler + PagerDuty/Opsgenie integration absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Roadmap promises "oncall" · not delivered. Alerts dispatch to fixed env-var recipients only. |
| **Required change** | On-call rotation table + escalation policy (5m → primary · 15m → secondary · 30m → manager) · PagerDuty webhook integration. |
| **State** | **OPEN** |

### Lens 2 · Security beyond boundary validation

#### W-SEC-1 · RLS defense-in-depth gap · **Supabase-legacy public schema only** (verification-corrected 2026-08-11)

| Column | Content |
|---|---|
| **Severity** | **P1** (defense-in-depth · was **P0** in initial survey · downgraded after verification) |
| **Original survey claim (INCORRECT)** | "44 tables · 0 `CREATE POLICY` in nex.*" · agent audited only `supabase/migrations/**` and missed the entire `deploy/postgres/init/*.sql` layer where nex.* policies actually live. |
| **Verified reality** | `nex.*` schema (`deploy/postgres/init/`) has **36 tables with 96 CREATE POLICY statements** · `nex_brain_app` role created in `042_nex_brain_role_and_extended_tables.sql:120` · per-table policies scoped to that role generated by DO block at `042:185` · application uses `SET LOCAL ROLE nex_brain_app` (verified `src/lib/nex/brain/adapters/postgres.ts:53`) → **`nex.*` schema has NO GAP**. The real issue is **~20 Supabase-legacy migration files in `supabase/migrations/*.sql` that enable RLS but define zero policies anywhere** (e.g. `20260709000000_os_foundation.sql` rls=7 pol=0 · `20260717120500_os_consent_architecture.sql` rls=4 pol=0). These tables work today only because Supabase `service_role` has `BYPASSRLS` · any anon/authenticated session gets 0 rows. |
| **Runtime effect** | Currently NO exploit path (only service_role connects) · escalates to P0 the moment: anon/authenticated Supabase sessions are added · or service_role credentials leak · or a subsystem connects as non-BYPASS role. |
| **Required change** | **Per-subsystem access-model design pass** — one Supabase-legacy file at a time. Each design step produces: intended access model doc · policy migration · contract test (positive + negative role) · staged rollout. **NOT a blanket sweep** — different subsystems have different intended ownership models (`os_billing` = per-merchant · `os_consent_architecture` = per-contact · `os_project_workflow` = per-homeowner+trade · `os_event_bus` = operator-only). |
| **Test** | New test `pg_policies_coverage.test.mjs` asserts every `public.os_*` table with RLS has ≥1 policy · initially fails for the ~20 identified files · fixed one-at-a-time as design work lands. |
| **State** | **OPEN · design-first** · Cluster W-D · full evidence in `WORLD-CLASS-OPS-P0-VERIFICATION.md` |

#### W-SEC-2 · Centralized RBAC absent · per-route permission scattered

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `src/middleware.ts:87-88` comment: *"Per-brain permission enforcement happens inside individual routes."* No `canPerform()` gate module. `/api/nex/projects` uses `x-nex-session-id` header with no server-side auth. `/api/nex/feedback` has no auth. `/api/nex/brain/guardian` no auth, relies on cron secret. |
| **Required change** | New module `src/lib/nex/auth/rbac.ts` exports `canPerform(session, action, resource)` · single source of truth · middleware invokes at edge for admin routes · every non-cron API route calls it. Enum of actions + resources. |
| **Retest** | New test: matrix of (role × action × resource) with expected allow/deny. |
| **State** | **OPEN** |

#### W-SEC-3 · CSP nonce system not implemented · 10 `dangerouslySetInnerHTML` sites unprotected

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `next.config.mjs:169-171` comment: *"CSP is deliberately NOT set here — the site uses inline dangerouslySetInnerHTML for JSON-LD in ~10 places, which needs nonce-based CSP (deferred to middleware pass)."* Zero nonce implementation found. |
| **Required change** | Middleware generates per-request nonce · injects into `Content-Security-Policy` header · JSON-LD renderers accept + emit the nonce as `<script nonce="...">`. |
| **Retest** | Response `csp-report-only` header contains `script-src 'nonce-...'` · every inline script has matching nonce. |
| **State** | **OPEN** |

#### W-SEC-4 · In-memory rate limiter fails on multi-instance / cold start

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `src/app/api/nex/merchant-assistant/route.ts:55-71` — in-memory bucket (60/5min per merchant). Vercel spins multiple instances · each has its own bucket · effective rate becomes N×60/5min. Brain endpoints (compute-heavy) fully unprotected. |
| **Required change** | Upstash Ratelimit OR Vercel KV backing · per-tenant × per-endpoint · every brain endpoint gated. |
| **Retest** | New test: 100 requests to a limited endpoint · assert ~60 succeed · rest 429. |
| **State** | **OPEN** · Cluster W-B |

#### W-SEC-5 · Webhook signature verification (HMAC) on cron missing

| Column | Content |
|---|---|
| **Severity** | **P1** — extends Wave 11 F14/F15 · token leakage = unlimited brain job injection |
| **Evidence** | `require-cron-token.ts` validates bearer token equality · no HMAC signature over payload + timestamp · no replay-attack protection. |
| **Required change** | Cron caller signs `${timestamp}.${body}` with shared secret · sends `X-Signature: sha256=<hex>` · handler verifies + rejects `abs(now - timestamp) > 5min`. |
| **Retest** | Test: valid signature accepted · tampered payload rejected · stale timestamp rejected. |
| **State** | **OPEN** |

#### W-SEC-6 · Secret-scanning pre-commit hook absent

| Column | Content |
|---|---|
| **Severity** | **P1** — human-error surface |
| **Evidence** | No `.pre-commit-config.yaml` · no husky · no gitleaks · no TruffleHog. |
| **Required change** | Install husky + gitleaks · pre-commit hook scans staged diff · blocks commit on secret match. |
| **Retest** | Attempt `git commit` with a fake API key in a file · verify block. |
| **State** | **OPEN** |

#### W-SEC-7 · Admin-action audit logging absent

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | Middleware logs nothing on admin routes. Destructive ops (canteen restore via `ADMIN_RESET_PASSCODE`) leave no provenance. |
| **Required change** | Middleware writes `nex.admin_audit_log` row for every `/admin/**` + `/api/admin/**` request: `{ actor, action, resource, correlation_id, ip, user_agent, timestamp }`. |
| **Retest** | Hit an admin route · verify audit row lands. |
| **State** | **OPEN** · Cluster W-A |

#### W-SEC-8 · CORS not configured · wildcard risk if third-party integrations added

| Column | Content |
|---|---|
| **Severity** | **P2** (conditional on third-party API ambition) |
| **Evidence** | Zero `Access-Control-Allow-Origin` in code. All routes assume same-origin. |
| **Required change** | Middleware sets CORS allowlist from env `NEX_CORS_ALLOWED_ORIGINS` (default empty) · preflight `OPTIONS` handled. |
| **State** | **OPEN** |

#### W-SEC-9 · `npm audit` not wired to CI

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | No audit step in `.github/workflows/ci.yml`. Dependencies pinned · vulnerabilities unmonitored. |
| **Required change** | CI step: `pnpm audit --audit-level=high` · fail on high/critical. Dependabot config for auto-PR on advisories. |
| **State** | **OPEN** |

#### W-SEC-10 · Heterogeneous auth patterns across API routes

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Sampling: `/api/nex/chat` uses `loadStudioSession()` · `/api/nex/projects` uses client-supplied `x-nex-session-id` · `/api/nex/feedback` no auth · `/api/nex/brain/guardian` cron-secret only. |
| **Required change** | Depends on W-SEC-2 (RBAC) landing · every route routes through the same gate. |
| **State** | **OPEN** (blocked on W-SEC-2) |

#### W-SEC-11 · Test data with live-shaped secrets in `.env.local`

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | `.env.local` contains `ADMIN_PASSWORD=12345` · `HAMMEREX_TRADE_FROM_EMAIL` hardcoded. |
| **Required change** | Scrub `.env.local` of any live-shape secrets · move test fixtures to `test-fixtures.env` (gitignored + git-hooked to prevent prod leak). |
| **State** | **OPEN** |

### Lens 3 · Deployment & release engineering

#### W-DEP-1 · No CHANGELOG · no semantic versioning · no release notes

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | No `CHANGELOG.md` · no commit tags · no release script in `package.json`. Production rollback requires archaeology: "when did we last deploy?" |
| **Required change** | Conventional Commits convention · automated CHANGELOG via `conventional-changelog-cli` · release tags on every deploy · `docs/RELEASES.md` linking each tag to its Wave 11 finding closures. |
| **State** | **OPEN** · Cluster W-G |

#### W-DEP-2 · Pre-deploy smoke tests absent

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `.github/workflows/ci.yml` runs typecheck + tests (unit + contract). Zero deployment-level smoke tests. |
| **Required change** | `scripts/smoke-test.mjs` runs post-build against a preview deploy: 6-8 canary GETs on critical routes (`/api/nex/system/health` · `/api/nex/storage/gates` · `/api/nex/brain/status` etc.). Deploy fails if any 5xx. |
| **State** | **OPEN** · Cluster W-G |

#### W-DEP-3 · Post-deploy verification automation absent

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | Fly has `/health` endpoint · Vercel has no post-deploy hook. No synthetic-monitor cron on prod. |
| **Required change** | Cron `/api/nex/observability/synthetic-check` every 5m: GETs critical prod endpoints · records latency + status · fires signal on regression. |
| **State** | **OPEN** · Cluster W-G |

#### W-DEP-4 · Drift-catchers not gated in CI

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `adapter-isolation.test.mjs` + `adoption-drift.test.mjs` exist and pass · CI doesn't yet run them explicitly (they'd run in the general test suite but not called out as gate). |
| **Required change** | CI job `architectural-invariants` runs both files · fails build on regression · comment on PR when a drift-catcher fires. |
| **State** | **OPEN** · Cluster W-G |

#### W-DEP-5 · Deployment topology diagram absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Topology scattered across `fly.toml` · `vercel.json` · READMEs · audit docs · with no unified diagram. |
| **Required change** | Author `docs/architecture/DEPLOYMENT-TOPOLOGY.md` with a Mermaid diagram showing every process, every data store, every env boundary. Refresh on every topology change. |
| **State** | **OPEN** |

#### W-DEP-6 · Feature-flag lifecycle tracking absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Gates readable via `/api/nex/storage/gates` (F29 · shipped). No documented removal schedule per flag · no rollback procedure per flag · no auto-expiry. |
| **Required change** | `docs/operations/FEATURE-FLAG-REGISTRY.md` — table per gate: `added_at · scheduled_removal · rollback_procedure · owner`. Enforced by drift-catcher `flag-lifecycle.test.mjs` — new gate in `GATE_ENV_NAMES` requires a registry row. |
| **State** | **OPEN** |

#### W-DEP-7 · ESLint non-blocking in CI (`continue-on-error: true`)

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | `.github/workflows/ci.yml:54` — ESLint runs but does not block merge on failure. |
| **Required change** | Flip to blocking after a one-time cleanup pass on existing warnings. |
| **State** | **OPEN** |

### Lens 4 · Data safety & recovery

#### W-DAT-1 · Multi-region data pinning absent · single-region only

| Column | Content |
|---|---|
| **Severity** | **P1** (P0 the moment SLA commitments exceed single-region availability) |
| **Evidence** | Supabase pinned to single region (UK) · own Postgres single-host · Fly LHR only. No read-replica config · no multi-region write strategy documented. |
| **Required change** | Author `docs/operations/MULTI-REGION-STRATEGY.md` capturing target state (read-replicas · region-pinned tenants · failover DNS). Even the *decision* to stay single-region is a documented commitment. |
| **State** | **OPEN** |

#### W-DAT-2 · Encryption key rotation runbook absent

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `PAYMENTS_ENCRYPTION_KEY` + `NEX_COMMS_SOCIAL_KEK` exist. `adminKeys/registry.ts:602` notes *"Never rotate without a migration to re-encrypt existing rows"* but no re-encryption tooling. |
| **Required change** | `scripts/rotate-key.mjs` — takes old + new key · re-encrypts every row · atomic swap · audit trail. Runbook `docs/operations/runbooks/key-rotation.md`. Quarterly rotation cadence documented in W-OBS-7 SLO doc. |
| **State** | **OPEN** · Cluster W-F |

#### W-DAT-3 · Vendor "do not train" opt-outs never audited

| Column | Content |
|---|---|
| **Severity** | **P1** — merchant business data may be sitting in LLM training corpora |
| **Evidence** | LLM providers (Groq · Gemini · Mistral · Anthropic) called via code · no evidence of vendor-account "do not train" toggles enabled. Master audit row 130 already flagged P1. |
| **Required change** | Doc `docs/compliance/VENDOR-DATA-HANDLING.md` — per-provider: link to opt-out setting · date verified · account owner. Quarterly re-verification. |
| **State** | **OPEN** · Cluster W-F |

#### W-DAT-4 · Secrets-in-logs pattern audit absent

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `maskCredential` helper exists · used in UI display only · not in logging paths. No redaction discipline verified. |
| **Required change** | (a) Grep-based pre-commit hook rejects `console.log(secret)` patterns. (b) Structured logger (W-OBS-4) applies redaction on known-sensitive field names. (c) One-time audit of existing log lines. |
| **State** | **OPEN** · Cluster W-F |

#### W-DAT-5 · Cross-border data transfer documentation absent

| Column | Content |
|---|---|
| **Severity** | **P1** (GDPR / Privacy Act require documented transfer basis) |
| **Evidence** | Fly-LHR · Supabase region unclear · Vercel region unclear · LLM providers geographically unclear. |
| **Required change** | Doc `docs/compliance/DATA-TRANSFER-REGISTER.md` — table: `{ data_class, source_region, destination_region, transfer_mechanism (SCC / adequacy / consent), date_verified }`. |
| **State** | **OPEN** · Cluster W-F |

#### W-DAT-6 · PII per-field labeling absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Encryption present for payments + OAuth · no schema-level labels marking `email` · `phone` · `address` as PII. |
| **Required change** | Add `COMMENT ON COLUMN` in migrations OR ADR-tracked convention: JSDoc `@pii` annotation. Drift-catcher validates every column matching known PII names has a label. |
| **State** | **OPEN** · Cluster W-F |

#### W-DAT-7 · Retention-job automation absent · TTL columns unused

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | `retention_days` column exists on consent purposes · no cron running `DELETE FROM ... WHERE created_at < now() - interval` · stale data accumulates indefinitely. |
| **Required change** | Cron `/api/nex/cron/retention-sweep` daily · iterates tables with `retention_days` metadata · deletes / archives expired rows · writes summary audit event. |
| **State** | **OPEN** · Cluster W-F |

### Lens 5 · Reliability engineering

#### W-REL-1 · Storage-layer timeouts absent · hung PG query blocks worker indefinitely

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `src/lib/nex/storage/adapters/postgres.ts` — no `statement_timeout` set · no per-query `AbortController`. LLM calls have timeouts via AbortController · Postgres calls do not. |
| **Required change** | Pool config: `statement_timeout: 30000` (30s default) · `idle_in_transaction_session_timeout: 60000` · per-query override via `withClient(async (c) => c.query(sql, params, { timeout: ms }))`. |
| **Retest** | Test: mock slow query · assert TimeoutError propagates within budget. |
| **State** | **OPEN** · Cluster W-C |

#### W-REL-2 · Worker cycle / job timeouts absent · single item can stall pipeline

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `src/lib/nex/brain/manager.ts:49-127` — no max duration per job · no cycle deadline. Worker can hang indefinitely on one item. |
| **Required change** | Job-level `AbortController` with 5m default (overridable per worker type) · cycle-level 15m deadline · timeout throws to retry buffer + emits `worker-timeout` signal. |
| **Retest** | Test: worker with intentionally-slow LLM · assert cycle aborts at 15m + timeout signal fires. |
| **State** | **OPEN** · Cluster W-C |

#### W-REL-3 · Graceful-degradation feature gate absent · exhausted LLM = infinite retry

| Column | Content |
|---|---|
| **Severity** | **P1** |
| **Evidence** | `src/lib/nex/brain/llm.ts` chain fallback ends at mock · if all providers down + mock disabled, worker throws → inbox item stalls. No off-path (cached / placeholder / "pending human review"). |
| **Required change** | New gate `NEX_INBOX_FALLBACK_MODE=queue|placeholder|reject` · `queue` = mark item `awaiting-llm-retry` · `placeholder` = save low-confidence knowledge draft · `reject` = mark item failed. Surface state in ProcessingReport. |
| **State** | **OPEN** |

#### W-REL-4 · Load-test harness absent · production capacity unknown

| Column | Content |
|---|---|
| **Severity** | **P1** (P0 the moment 50k-merchant marketing lands) |
| **Evidence** | `find scripts/ -iname "*load*" -o -iname "*bench*" -o -iname "*stress*"` → zero. No k6 · artillery · wrk. |
| **Required change** | `scripts/load-test.mjs` using k6 or custom Node · simulates N concurrent inbox uploads + M workers · records P50/P95/P99 latencies + queue depth. Run monthly in staging. |
| **State** | **OPEN** · Cluster W-B |

#### W-REL-5 · Queue-depth monitoring absent

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | Heartbeat + audit events capture worker state · not queue length. Operator has no live view of inbox backlog / jobs pending / llm_retry_queue depth. |
| **Required change** | Extend `counters.ts` with `queue_depth_inbox` · `queue_depth_jobs` · `queue_depth_llm_retry` · sampled every 15s in a lightweight cron · rendered in `SystemHealthPanel`. Alert rule "queue_depth > 500 → operator". |
| **State** | **OPEN** · Cluster W-B |

#### W-REL-6 · SLA / RTO / RPO undocumented

| Column | Content |
|---|---|
| **Severity** | **P2** (P1 when enterprise contracts arrive) |
| **Evidence** | No "P95 inbox processing <5m" · no "99.9% uptime" · no RTO 4h / RPO 1h. |
| **Required change** | Covered by W-OBS-7 SLO doc + explicit RTO/RPO section citing backup rehearsal outcome (W-DAT · master audit row 287). |
| **State** | **OPEN** · Cluster W-E |

#### W-REL-7 · Load shedding / backpressure absent · queue growth unbounded

| Column | Content |
|---|---|
| **Severity** | **P2** |
| **Evidence** | All inbox items processed FIFO per source priority (Wave 11 F33). No throttling · no priority-override for urgent items · intake > worker capacity = unbounded queue growth (memory-safe on Postgres but stale-work risk). |
| **Required change** | Depends on W-REL-5 queue counters landing · new gate `NEX_INBOX_MAX_DEPTH` triggers 429 on ingest when exceeded · high-priority items skip the check. |
| **State** | **OPEN** · Cluster W-B |

#### W-REL-8 · Active-active / read-replica failover plan absent

| Column | Content |
|---|---|
| **Severity** | **P2** (aligned with W-DAT-1 multi-region) |
| **Evidence** | No DNS failover · no replica promotion runbook · single-region Fly. |
| **Required change** | Covered by W-DAT-1 multi-region strategy doc + Runbook `docs/operations/runbooks/failover.md`. |
| **State** | **OPEN** |

#### W-REL-9 · No distributed tracing (OTel / Datadog / Honeycomb)

| Column | Content |
|---|---|
| **Severity** | **P3** now (bottleneck analysis via custom scripts is workable at current scale) · **P1 at 50k merchants** |
| **Evidence** | Audit events logged locally · no OTel instrumentation. |
| **Required change** | Deferred until scale demands it OR until correlation ID threading (W-OBS-1) lands · then OTel is a small next-step. |
| **State** | **OPEN** (deferred) |

---

## Recommended remediation priority

Following the same "safest-first" pattern Wave 11 used:

| # | Task | Findings closed | Cluster |
|---|---|---|---|
| **1** | **RLS policy authorship + coverage test** | W-SEC-1 | W-D |
| **2** | **Correlation ID threading + structured logger** | W-OBS-1, W-OBS-4, W-SEC-7 | W-A |
| **3** | **Timeout budgets end-to-end** (storage + worker) | W-REL-1, W-REL-2 | W-C |
| **4** | **Runbooks (5 minimum)** | W-OBS-2 | — |
| **5** | **Prometheus metrics endpoint + SLO doc** | W-OBS-3, W-OBS-7, W-OBS-9, W-REL-6 | W-E |
| **6** | **Log-drain configuration** | W-OBS-5 | W-E |
| **7** | **Vercel / Upstash rate limiter** | W-SEC-4 | W-B |
| **8** | **Load-test harness (k6)** | W-REL-4 | W-B |
| **9** | **Centralized RBAC + admin audit log** | W-SEC-2, W-SEC-7, W-SEC-10 | W-A |
| **10** | **CSP nonce middleware** | W-SEC-3 | — |
| **11** | **Webhook HMAC + secret-scanning hook** | W-SEC-5, W-SEC-6 | — |
| **12** | **CI drift-catcher gates + release engineering pack** | W-DEP-1..W-DEP-4 | W-G |
| **13** | **GDPR operational playbook + retention cron + key rotation runbook** | W-DAT-2..W-DAT-7 | W-F |
| **14** | **Graceful-degradation gate + queue-depth counters + backpressure** | W-REL-3, W-REL-5, W-REL-7 | W-B |
| **15** | **Multi-region strategy doc + topology diagram + failover runbook** | W-DAT-1, W-REL-8, W-DEP-5 | — |
| **16** | **Alert-rule CRUD UI + incident RCA + on-call scheduler** | W-OBS-6, W-OBS-8, W-OBS-10 | — |
| **17** | **Distributed tracing (OTel)** | W-REL-9 | (deferred to scale) |

## What this document IS

- A **forward-looking gap register** — what must be built for world-class operational maturity, beyond the engineering-quality work Wave 11 covered.
- A **strategic clustering** — 7 fix-together groups so remediation lands coherently rather than as 46 disconnected patches.
- An **honest signal** on what already IS world-class (reliability substrate · data-at-rest crypto · observability core) so those aren't accidentally rewritten.

## What this document IS NOT

- Not a re-audit of Wave 11's 37 findings.
- Not a compliance certification — it points to GAPS in compliance operational flow, not to the compliance framework itself.
- Not authorization to implement — the master audit's guardrails still apply. Every P0/P1 fix requires Philip's explicit go-ahead, targeted test, integration regression, evidence recording (Wave 11 state-transition rule).
- Not a schedule — the priority order is dependency-ordered · durations depend on capacity.

## Change log

| Date | Change | Author |
|---|---|---|
| 2026-08-11 | Doc authored from 5-lens parallel Explore audit · 46 gaps registered · 3 world-class strengths named · 2 P0 candidates flagged (W-SEC-1 · W-OBS-1) | Claude |
| 2026-08-11 (later · same session) | **P0 verification pass authored** (`WORLD-CLASS-OPS-P0-VERIFICATION.md`) · **both P0 severities corrected against evidence**. W-SEC-1 downgraded P0 → P1: nex.* schema HAS 96 policies + nex_brain_app role wired (survey missed `deploy/postgres/init/` layer) · real gap is Supabase-legacy `public` schema (~20 files RLS-enabled + zero-policies · defense-in-depth only breaks if non-BYPASS role is added). W-OBS-1 severity unchanged (P1) but scope halved: journeys/attribution/error-envelope already threaded · gap is Brain worker chain (0/9 workers) + HTTP edge specifically. **Counts revised: P0=0 · P1=29 · P2=15 · P3=1.** No remediation authorized · both findings still gated on design decisions. | Philip authorised · Claude executed |
| 2026-08-11 (later · same session) | **W-OBS-1 Path A Layer 1 IMPLEMENTED end-to-end** (Philip authorized) — all 11 sequencing steps of the Path A plan complete · all 8 acceptance gates green (tsc in-scope 0 · CID 10/10 · CADP 5/5 · F12 AI 8/8 · Step 11 contracts intact · regression same-6-baseline · F35 15/15 · zero schema change). CID chain: HTTP → route handler ALS → inbox item CID → dispatch copies to job payload → worker enters ALS scope → finalize inherits parent CID into child jobs → signals + audit inherit via `emitSignal` ALS fallback. Layer 2 (schema-based CID column) remains DEFERRED pending 4-week production measurement per Path A plan §15. Journeys / attribution / error-envelope existing threading preserved by explicit-wins-over-ALS rule. W-OBS-1 state: **READY** (shipped in working tree pending commit). | Philip authorised · Claude implemented |
