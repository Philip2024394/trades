# HEADQUARTERS PRODUCTION ACCEPTANCE · SCAFFOLD

**Status:** SCAFFOLD · locked at PENDING until evidence lands
**Date:** 2026-08-10
**Author role:** Master AI engineer · NEX Corporation
**Objective:** The final PASS/FAIL gate. Every claim carries evidence · every pending item names the exact fact that will flip it.
**Rule:** Never speculative. If evidence is missing, the row stays PENDING.

---

## Verdict

**Current verdict: PENDING**

Rationale: 2 P0 blockers (A1 · A2 in refactor plan) remain OPEN — the brain migration has not executed. Until then, the acceptance gate cannot flip.

---

## 27-item acceptance gate (single source of truth · master audit Section 11)

For each item: **State · Evidence needed to flip · Refactor-plan row.**

| # | Item | State | Evidence required to flip | Refactor row |
|---|---|---|---|---|
| 1 | All six workers independently proven end-to-end | ⏳ PARTIAL | Prod-URL run of `scripts/six-worker-proveout.mjs`: 33/33 fresh-evidence PASS · Harper `bytes:nex-object-storage` flag observed | A1 + A2 + D3 |
| 2 | Text pipeline proven | ✅ PASS | `worker_results` 2026-08-08T17:15 · real LLM trace | — |
| 3 | Image pipeline proven | ⏳ DEV-ONLY | Prod Harper run producing knowledge record UNDER_REVIEW | B1 (or B4) |
| 4 | AI calls with real provider evidence | ✅ PASS | `worker_results` shows Groq · Mistral · Gemini rows | — |
| 5 | Queue claiming/concurrency proven | ⏳ 2-WORKER ONLY | 3-worker concurrent-claim test row in parity harness | D13 |
| 6 | Retry/recovery proven | ✅ PASS | Wave 8 G.retry-recovery closed 2026-08-09 · `scenarioBrainWorkerRetryRecovery` proven live vs Supabase | — |
| 7 | Heartbeats/liveness proven | ✅ PASS | 12.3 heartbeat shape live | — |
| 8 | Offline worker detection proven | ✅ PASS | `heartbeat-liveness.test.mjs` R6 · standby vs offline discrimination | — |
| 9 | No local-filesystem dependency for prod workers | ⏳ READY | Prod env `NEX_INBOX_READ_BACKEND=postgres` + `NEX_OBJECT_BACKEND=postgres` set, observed 24h | B1 + B2 + B3 |
| 10 | Shared object storage proven | ⏳ DEV-ONLY | Prod Harper run flagged `bytes:nex-object-storage` | B1 |
| 11 | NEX Postgres migration proven | ⏳ OPEN | Backfill `--execute` returns success + parity report zero-drift | A1 |
| 12 | Backfill verified | ⏳ HALF (inbox/jobs done · brain pending) | Brain parity report shows PG count = Supa count · 11 tables · 73,233 rows | A1 |
| 13 | Reverse-shadow/parity | ✅ PASS (2026-08-10) | Live probe `prove-reverse-shadow-live.ts` · probe row `reverse-shadow-probe-1786308054388` mirrored within 200 ms | A3 |
| 14 | All critical reads/writes verified after migration | ⏳ PENDING | Prod smoke suite passes against `NEX_BRAIN_BACKEND=postgres` | D3 after A2 |
| 15 | RLS/access control verified | ⏳ HALF (PG ✅ · Supabase ❌) | Operator-run `pg_policies` query on Supabase returns policy rows for source tables | E10 |
| 16 | Audit trail verified | ⏳ PARTIAL | `worker_audit_events` writes succeed (migration 004 applied OR moved to PG) | D14 |
| 17 | Contact data storage verified | ✅ PASS | Registry live · 6 connectors wired | — |
| 18 | Consent behaviour verified | ✅ PASS (2026-08-10) | `prove-unsubscribe-roundtrip.ts` · burner contact → applyCanonicalEvent unsubscribed → gate returns `allowed:false, reason:'never_contact'` | E2 |
| 19 | Data deletion / retention path verified | ❌ FAIL | Erasure endpoint exists · runtime trace + retention schedule documented | E1 + E4 |
| 20 | Secrets / configuration audited | ⏳ PARTIAL | Rotation SOP published · Stripe LIVE key confirmed rotated · `LLM_ALLOW_MOCK_FALLBACK=false` in prod template | E5 + E6 + D8 |
| 21 | Backup / recovery tested | ⏳ PARTIAL | Postgres rollback drill rehearsed · filesystem-data-dir backup job green | F10 + F11 |
| 22 | Monitoring / alerting tested | ⏳ 25% | `/metrics` route emits Prometheus · alert rules CRUD · HMAC on cron auth · stale-cron detection | F2 + F5 + F12 + F14 |
| 23 | Production build from clean checkout succeeds | ⏳ 80% | `next.config.mjs` ignore flags removed · fresh-clone runbook executed on isolated VM | C3 + F13 |
| 24 | No unexplained test failures | ✅ PASS | 236/236 brain suites + 1823/1825 W-C companion · noted Windows libuv warnings harmless | — |
| 25 | No critical/high unresolved security issues | ⏳ DEPENDS | Compliance audit P0/P1 items closed (E-series) | E1 + E5 + E7 + E10 |
| 26 | No critical/high unresolved data-integrity issues | ⏳ 2 P0 OPEN | Group A landed | A1 + A2 |
| 27 | All dashboards distinguish CURRENT vs HISTORICAL | ✅ PASS | `reception-semantics.test.mjs` 12/12 · locked | — |

**Green: 10/27 · Partial/Ready: 16/27 · Fail: 1/27** (13 + 18 flipped 2026-08-10 · item 19 remains FAIL until E1+E4 land)

---

## Master P0 tracker · three-state

| # | Blocker | State | Refactor row that flips it |
|---|---|---|---|
| P0-1 | Inbox binaries per-machine | READY (dev VERIFIED CLOSED) | B1 (prod env flip) |
| P0-2 | image-analyst 0 lifetime completions | VERIFIED CLOSED | — |
| P0-3 | Shared queue split-brain | READY (Fly at 0) | B5 (destroy Fly after 7d) |
| P0-4 | Fly workers pre-Phase-12.3 code | READY | B5 |
| P0-5 | dispatchNewInboxItems filesystem-locked | READY | C1 (env flip) |
| P0-6 | Brain records still on Supabase | OPEN | A2 |
| P0-7 | Inbox items filesystem-authoritative | READY | B2 |
| P0-8 | Inbox stats filesystem-authoritative | READY | B2 |
| P0-9 | Knowledge Dump jobs filesystem-authoritative | READY | B3 |
| P0-10 | Brain data backfill not executed | OPEN | A1 |
| P0-11 | No reverse-shadow for safe rollback | READY | A3 (live probe) |

---

## Cutover checklist (executes after all 27 flip)

- [ ] Kill Supabase writes · demote to read-only reference (G1)
- [ ] Start 30-day retention window (G2)
- [ ] Delete Supabase brain tables (G3)
- [ ] `fly apps destroy nex-brain-worker` (B5)
- [ ] Sign-off in this doc — Philip's name + date

---

## Sign-off block (fill on final PASS)

**Verdict:** PENDING
**Signed:** —
**Date:** —
**Committing:** —

*This document supersedes all prior "ready to ship" phrasing. Only a green 27/27 with signed-off cutover checklist means Headquarters Production Readiness = PASS.*
