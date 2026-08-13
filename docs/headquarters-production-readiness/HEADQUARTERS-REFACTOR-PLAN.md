# HEADQUARTERS REFACTOR PLAN · WAVE 3

**Status:** LIVING · superseded by production execution
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** Compose every P0 · P1 · P2 finding from the master audit + Phase A3 + Phase B into one dependency-ordered execution plan. Every row: **fix · rollback · retest · owner · authorisation gate.**
**Rule:** No item may move from READY → EXECUTING without Philip's explicit authorisation (standing rule Section 14 of master audit).

**Sources composed here:**
- `HEADQUARTERS-PRODUCTION-READINESS-AUDIT.md` — Sections 3 · 11 · 16
- `HEADQUARTERS-DATA-STORAGE-MAP.md` — A1
- `HEADQUARTERS-WORKER-DEPLOYMENT-AUDIT.md` — A2
- `HEADQUARTERS-VERCEL-DEPLOYMENT-AUDIT.md` — A3
- `HEADQUARTERS-ENGINEERING-QUALITY-AUDIT.md` — B (engineering)
- `HEADQUARTERS-COMPLIANCE-AUDIT.md` — B (compliance)
- `HEADQUARTERS-OPERATIONAL-AUDIT.md` — B (ops)

---

## How to read

Each row uses the master audit's three-state model:
- **OPEN** — code hasn't been written / merged
- **READY** — machinery exists, gate defaults off, production hasn't switched
- **VERIFIED CLOSED** — production switched, observed, rollback path tested

**Priority letters map to the master audit:** P0 = production blocker · P1 = serious · P2 = important · P3 = improvement.

**Authorisation gate column:**
- 🟢 auto — Claude may proceed
- 🟡 code — Claude may write/commit; Philip must review before deploy
- 🔴 authorisation — Philip must explicitly authorise before Claude touches this

---

## Group A · Production data migration (P0)

Executes the brain-records move to NEX Postgres. Everything downstream depends on this.

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| A1 | P0-10 · Brain data backfill not executed | Run `node scripts/brain-backfill.mjs --execute` against dev first, then production Supabase→NEX Postgres. 154 chunks · idempotent · ON CONFLICT DO NOTHING. | Reverse-backfill script (`scripts/brain-reverse-backfill.mjs`) already built · Wave 7. Reverse-shadow keeps Supabase in sync during observation. | `brain-parity-report.mjs` shows PG count = Supa count per table (target: 11 tables, 73,233 rows). | 🔴 |
| A2 | P0-6 · Brain records still on Supabase | After A1 completes + parity verified · Vercel env `NEX_BRAIN_BACKEND=postgres`. Redeploy. | Flip env back to `supabase`. Reverse-shadow means writes made during postgres window mirror back — no data loss. | Six-worker prove-out runner (`scripts/six-worker-proveout.mjs`) against production URL: 33/33 fresh-evidence PASS. | 🔴 |
| A3 | Reverse-shadow not proven live | With `NEX_BRAIN_BACKEND=postgres` + `NEX_BRAIN_SHADOW_SUPABASE=1`, insert a probe record in Postgres and verify it appears in Supabase within 30s. | Flip `NEX_BRAIN_SHADOW_SUPABASE=0` — mirror stops; Postgres continues. | 15/15 reverse-shadow contract tests already pass; add live probe run to acceptance evidence. | 🔴 |

**Group A gate:** Nothing else in Group C can start until A1-A3 are VERIFIED CLOSED with 24h+ observation.

---

## Group B · Storage & object-store cutover (P0)

Wave 2 decision recorded 2026-08-10: **NEX Storage runtime service** is the standard. Postgres adapter is production-active in dev; ImageKit adapter is the second production backend (to author).

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| B1 | P0-1 · Inbox binaries per-machine (verified closed in dev only) | Vercel env `NEX_OBJECT_BACKEND=postgres` post-migration. | Flip back to `filesystem` — legacy fallback in image-analyst reads still works for pre-Phase-3a items. | Harper end-to-end on production URL: `bytes:nex-object-storage` flag on `worker_result`. | 🔴 |
| B2 | P0-7 / P0-8 · Inbox items + stats filesystem-authoritative | Vercel env `NEX_INBOX_READ_BACKEND=postgres`. | Flip back — filesystem reads resume. | `GET /api/nex/knowledge-inbox/list` returns matching Postgres count + Phase-3a object_bucket/object_key fields visible. | 🔴 |
| B3 | P0-9 · Knowledge Dump jobs filesystem-authoritative | Same env flag as B2 · fs-store.ts routes via Postgres when flag ON. | Same flip. | Job-lifecycle test suite covers this. | 🔴 |
| B4 | *(withdrawn 2026-08-10 per Philip's directive "use nex storage")* — ImageKit adapter build is not scheduled. The Postgres adapter is the standing production backend. `migrate-imagekit-to-supabase.mjs` confirms the codebase direction is away from external ImageKit. Adding an external adapter (R2 or similar) is deferred until Postgres BYTEA soft-cap (~50 MB) becomes limiting. | — | — | — | — |
| B5 | P0-3 / P0-4 · Fly split-brain (READY) | `fly apps destroy nex-brain-worker` after 7-day post-cutover stability window. | N/A — destruction of decommissioned app. | Confirm zero heartbeats visible in `worker_heartbeats` from Fly-origin machine IDs for 7 consecutive days. | 🔴 |

---

## Group C · Deployment consolidation (P0/P1)

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| C1 | P0-5 · `dispatchNewInboxItems` filesystem-locked (READY) | Env flag from B2 removes filesystem dependency. Any worker can now dispatch. | Flip B2 back. | Cron-tick invoked from Vercel produces `scanned:N` matching Postgres row count. | 🔴 |
| C2 | Vercel A3 · 7 orphaned cron paths | Delete missing entries from `vercel.json` OR author the missing routes. Recommend delete for `/api/cron/nex-backup-daily`, `nex-overnight-prep`, `nex-social-publish`, `nex-weekly-report`, `bi-daily-aggregate`, `yard-release-queued`, `yard-expire-notifications`. | Re-add lines from git history. | Vercel dashboard shows 21 configured crons (matching route count). | 🟢 |
| C3 | Vercel A3 · build errors ignored (`next.config.mjs:13-14`) | Two-step: (a) turn ESLint on for builds, fix warnings, (b) turn TypeScript strict-build on, fix errors. | Restore original file. | `next build` completes without ignoring flags. | 🟡 |
| C4 | Vercel A3 · `NEX_BRAIN_BACKEND` on Vercel unconfirmed | Set env after A1/A2 pass. | Flip back. | Deployment logs show var picked up. | 🔴 |
| C5 | Vercel A3 · no `deploy/VERCEL-DEPLOYMENT.md` runbook | Author it. Sections: project setup · env vars grouped by system · cron enablement · `CRON_SECRET` rotation · health-check URLs · rollback SOP. | Delete file. | Peer read; execute the checklist against a fresh Vercel project. | 🟢 |

---

## Group D · Engineering quality (P1/P2)

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| D1 | Eng B · `dispatchNewInboxItems` not idempotent under concurrency | Add partial-unique index + `INSERT … ON CONFLICT (inbox_item_id, job_type) WHERE status IN ('queued','claimed') DO NOTHING` | `DROP INDEX` + revert insert | New test: fire cron-tick 3× within 1s, assert only one queued job per inbox item | 🟡 |
| D2 | Eng B · Per-consumer LLM budget not isolated | Namespace `daily_calls` by `worker_type`; per-consumer budget slice | Revert changes | Simulate one worker exhausting its slice, confirm others still have quota | 🟡 |
| D3 | Eng B · Zero deployment-level smoke tests | `scripts/prod-smoke.mjs` hitting `/api/nex/brain/cron-tick`, `/status`, `/health` against `NEX_APP_URL` | Delete script | Smoke run against dev URL passes | 🟡 |
| D4 | Eng B · Cron-token single-secret concentration | Scoped tokens per route class (mutation/read/cron); rotation cadence; per-token audit-log entries | Restore single-token check | `require-cron-token.test.mjs` extended for scoped roles | 🟡 |
| D5 | Eng B · Silent audit-failures unmonitored | Increment silent-failure counters at existing `.catch` sites; expose in `/brain-health`; alert if >5/min | Remove counters | Fault-injection: force audit-log write to throw, confirm counter climbs | 🟡 |
| D6 | Eng B · Analytics ingest synchronous | Split rollup UPSERT into `nex.analytics_rollup_queue` + dedicated worker | Delete queue, restore synchronous path | Ingest latency P99 within budget | 🟡 |
| D7 | Eng B · No LLM cost model | Provider pricing table + USD spend in `dailyUsageSnapshot()` | Revert | Dashboard shows spend column | 🟢 |
| D8 | Eng B · `LLM_ALLOW_MOCK_FALLBACK=false` in prod env template | Update `.env.example` + Vercel/Fly env docs | Revert | `.env.example` diff | 🟢 |
| D9 | Eng B · zod validation missing on brain routes | Shared `zod` schemas at route boundary | Remove middleware | Route contract tests | 🟡 |
| D10 | Eng B · Embedding column schema debt | Either implement pgvector + embed worker OR document decision & drop column | Migration rollback | Schema audit | 🔴 |
| D11 | Eng B · No load-test harness | `scripts/load-test-cron-tick.mjs` firing 100× in 60s | Delete script | Assert P99 latency within budget | 🟢 |
| D12 | Eng B · Empty catch at `manager.ts:696` | Investigate; fix or delete | Restore | Static analysis | 🟢 |
| D13 | Master audit · Concurrent-claim test only 2-worker | Extend to 3+ | Revert | Test still passes | 🟢 |
| D14 | Master audit · `worker_audit_events` migration 004 broken | Apply 004 to Supabase short-term OR migrate audit log to Postgres | Reverse migration | Confirm inserts succeed | 🟡 |

---

## Group E · Compliance & data governance (P0/P1/P2)

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| E1 | Compliance · Erasure code missing (P0 · NEEDS LEGAL) | `POST /api/nex/contacts/{id}/erase` + `scripts/erase-contact.mjs` writing `deleted_at=NOW()` + optional anonymisation | Restore rows from backup | Burner contact walked end-to-end | 🟡 (code) · 🔴 (legal decision on anonymisation scope) |
| E2 | Compliance · Consent round-trip runtime-untested | `scripts/prove-unsubscribe-roundtrip.mjs` | Delete script | Script passes | 🟢 |
| E3 | Compliance · Connector lawful basis undocumented (NEEDS LEGAL) | Author per-connector lawful-basis doc; legal review; attach to compliance audit | N/A | Legal sign-off | 🔴 (legal) |
| E4 | Compliance · Retention policy absent (NEEDS LEGAL) | Document per-lifecycle-stage retention; auto-purge job for `never_contact=true` after 18 months | Revert purge job | Purge dry-run against staging | 🔴 (legal) |
| E5 | Compliance · Stripe LIVE key possibly leaked (P1) | Philip verifies rotation at dashboard.stripe.com/apikeys; update all consumers | Restore prior key if still valid | Test Stripe webhook against new key | 🔴 |
| E6 | Compliance · Secrets rotation cadence missing (P2) | Author `docs/operations/SECRETS-ROTATION.md` | Delete file | Peer read | 🟢 |
| E7 | Compliance · Provider training opt-out unknown (NEEDS LEGAL) | Add per-provider opt-out headers where supported; document policy | Remove headers | Verify calls still succeed | 🔴 (legal) |
| E8 | Compliance · Cross-border transfer path unknown (NEEDS LEGAL) | Confirm NEX Postgres region; document; legal supplies SCCs/BCRs if non-EU | N/A | Doc updated | 🔴 (legal) |
| E9 | Compliance · Log/Event Bus redaction policy missing | `src/lib/nex/observability/redact.ts` helper; wire on every payload write | Remove helper | Unit tests for redaction | 🟡 |
| E10 | Compliance · Supabase RLS unverified (OPERATOR-RUN) | Philip runs the `pg_policies` query from Compliance Audit §10 | N/A | Query returns policy rows | 🔴 |

---

## Group F · Operational readiness (P1/P2)

| ID | Finding | Fix | Rollback | Retest | Auth gate |
|---|---|---|---|---|---|
| F1 | Ops · Zero DR runbooks | Author 10 runbooks (queue-stuck · storage-unreachable · cron-stale · LLM-circuit-open · Postgres conn-loss · Supabase RLS-lockout · heartbeat-missing · audit-growth · inbox-backlog · dead-letter) | Delete files | Runbook fire-drill | 🟢 |
| F2 | Ops · Prometheus export missing | New `/api/nex/observability/metrics` reading from `counters.snapshot()` | Delete route | curl route, validate `# HELP`/`# TYPE`/counter format | 🟡 |
| F3 | Ops · Log aggregation not configured | Add `logDrains` to `vercel.json`; wire to log destination (Datadog / Better Stack / Papertrail) | Remove key | Verify logs land in aggregator | 🔴 (billing decision) |
| F4 | Ops · Structured logging not adopted | Introduce `logger` helper wrapping JSON payload; migrate hot-path console.log → logger | Revert helper | Log inspection | 🟡 |
| F5 | Ops · Alert-rule CRUD missing | `nex.alert_rules` table + CRUD UI in HQ | DROP TABLE | Rule create/enable/disable | 🟡 |
| F6 | Ops · SLO/SLI contract absent | Author `docs/operations/SLO.md` per subsystem | Delete file | Peer read | 🟢 |
| F7 | Ops · MTTD/MTTA/MTTR targets undefined | Same as F6 | Same | Same | 🟢 |
| F8 | Ops · No on-call rotation / PagerDuty integration | Rotation table + PagerDuty/Opsgenie webhook | Remove | Rotation entry firing test alert | 🔴 (staffing decision) |
| F9 | Ops · No IR playbook / postmortem template | Author `docs/operations/INCIDENT-RESPONSE.md` + `docs/operations/POSTMORTEM-TEMPLATE.md` | Delete | Simulated incident walk-through | 🟢 |
| F10 | Ops · Backup for filesystem data dirs missing | Backup job for `data/nex-events/**`, `data/nex-brains/**` | Delete job | Restore drill | 🟡 |
| F11 | Ops · Postgres rollback drill not rehearsed | Rehearse in dev — flip `NEX_BRAIN_BACKEND` postgres → supabase mid-load | Restore | Zero data loss | 🔴 |
| F12 | Ops · No stale-cron detection | Add mutation-timestamp check per cron in SystemHealthPanel | Remove | Force one cron to skip 3 runs, verify alert | 🟡 |
| F13 | Ops · No fresh-clone/isolated-VM procedure | Author `docs/operations/PRE-PRODUCTION-CHECKLIST.md` | Delete | Execute on clean VM | 🟢 |
| F14 | Ops · Cron auth token-only (replay-vulnerable) | Add HMAC signature `X-Signature: sha256=<hex>` over `timestamp.body`; reject > 5 min | Restore single token | Test replay attempt fails | 🟡 |
| F15 | Ops · Object-storage PITR missing | Design retention/versioning for `nex.object_blobs` | Revert migration | Restore drill | 🔴 |

---

## Group G · Wave 8 cutover (post-observation)

| ID | Fix | Auth gate |
|---|---|---|
| G1 | Kill Supabase writes · demote to read-only reference | 🔴 |
| G2 | 30-day retention window | 🔴 |
| G3 | Delete Supabase brain tables | 🔴 |

---

## Dependency graph (top-down)

```
Group A · brain migration
  │
  ├─▶ Group C · deployment consolidation (env flips)
  │     │
  │     ├─▶ Group B · object-storage cutover (parallel-eligible)
  │     │     │
  │     │     └─▶ B5 · Fly destroy (after 7-day observation)
  │     │
  │     └─▶ Group G · Supabase cutover (after 30-day observation)
  │
  ├─▶ Group D · engineering quality (parallel-eligible with A/C)
  │
  ├─▶ Group E · compliance (parallel-eligible; blocked externally by legal)
  │
  └─▶ Group F · operational readiness (parallel-eligible with everything; F1-F13 unlock without prod state)
```

---

## Acceptance-gate coverage (master audit Section 11 · 27 items)

| Gate | Item | Closed by |
|---|---|---|
| 1 | Six workers proven end-to-end | A1+A2 land + prod smoke (D3) |
| 2 | Text pipeline proven | ✅ done |
| 3 | Image pipeline proven | B1 (Postgres object-storage in prod) |
| 4 | AI calls with real evidence | ✅ done for 4 workers |
| 5 | Queue/concurrency proven | D13 · extend to 3 |
| 6 | Retry/recovery proven | ✅ done |
| 7 | Heartbeats/liveness proven | ✅ done |
| 8 | Offline detection | ✅ done |
| 9 | No local-fs dependency | B1+B2+B3 |
| 10 | Shared object storage proven | B1 |
| 11 | NEX Postgres migration proven | A1+A2 |
| 12 | Backfill verified | A1 |
| 13 | Reverse-shadow/parity | A3 |
| 14 | All critical R/W verified post-migration | Prod smoke D3 after A2 |
| 15 | RLS verified | E10 (Supabase side) |
| 16 | Audit trail verified | D14 |
| 17 | Contact data storage | ✅ done |
| 18 | Consent behaviour | E2 |
| 19 | Data deletion/retention | E1 + E4 |
| 20 | Secrets/config audited | E5 + E6 + D8 |
| 21 | Backup/recovery tested | F10 + F11 |
| 22 | Monitoring/alerting tested | F2 + F4 + F5 + F14 |
| 23 | Production build clean checkout | C3 + F13 |
| 24 | No unexplained test failures | ✅ done |
| 25 | No critical/high security issues | Compliance audit + E5+E10 |
| 26 | No critical/high data-integrity issues | Group A |
| 27 | Dashboards distinguish current/historical | ✅ done |

---

## What Claude can complete without further authorisation

**🟢 auto-eligible (immediate):** C2 · C5 · D7 · D8 · D11 · D12 · D13 · E2 · E6 · F1 · F6 · F7 · F9 · F13

**🟡 code + review (Claude authors, Philip reviews before deploy):** C3 · D1-D6 · D9 · D14 · E9 · F2 · F4 · F5 · F10 · F12 · F14

**🔴 authorisation required (Philip decides / executes):** A1 · A2 · A3 · B1 · B2 · B3 · B5 · C1 · C4 · D10 · E1 · E3 · E4 · E5 · E7 · E8 · E10 · F3 · F8 · F11 · F15 · G1 · G2 · G3

---

## Standing rule reminder

Section 14 of the master audit — no auto-execution of any risky action. Every 🔴 row requires Philip's explicit go per row.
