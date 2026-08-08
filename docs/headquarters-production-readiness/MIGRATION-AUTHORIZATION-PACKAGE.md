# NEX HEADQUARTERS · MIGRATION AUTHORIZATION PACKAGE

**Status:** TEMPLATE · zero fields populated · fills in during actual migration execution
**Purpose:** Philip's explicit gate (2026-08-09) before any production flip. No production transition proceeds until every section below is filled with real evidence and explicitly authorized.

**Governing rule:** BUILD COMPLETE / PRODUCTION MIGRATION PENDING / WORKER DEPLOYMENT PENDING / AUDIT CLOSURE PENDING · Fly stays at 0 until replacement worker topology selected AND proven.

---

## 0 · Migration transition sequence (locked · atomic order)

```
Step 1  · pre-backfill parity report            (READ-ONLY · no risk)
Step 2  · execute backfill                      (WRITES to nex.* · Supabase untouched)
Step 3  · post-backfill parity verification     (READ-ONLY · confirms counts match)
Step 4  · enable reverse-shadow (env flag)      (env change · restart · gated)
Step 5  · flip NEX_INBOX_READ_BACKEND=postgres  (env change · restart · inbox reads flip)
Step 6  · observe inbox flip                    (observation window)
Step 7  · flip NEX_BRAIN_BACKEND=postgres       (env change · restart · brain reads flip)
Step 8  · observe brain flip                    (observation window)
Step 9  · worker deployment rebuild + prove-out (Wave 8 · separate authorization)
```

**No step proceeds without the prior step's evidence being logged in this document.** Aborting is always safe · every step has an explicit rollback command captured before it starts.

---

## 1 · Pre-backfill source counts (Supabase authoritative · read-only)

**Executed:** [NOT YET RUN]
**Command:** `node scripts/brain-parity-report.mjs`
**Expected output:** row counts per table on Supabase side

| Table | Supabase count | Notes |
|---|---|---|
| knowledge_records | [pending] | last known dry-run: 3,562 |
| record_versions | [pending] | 22 |
| graph_edges | [pending] | 4,131 |
| worker_jobs | [pending] | 18,918 |
| worker_results | [pending] | 18,896 |
| sources | [pending] | 3,560 |
| confidence_scores | [pending] | 4,096 |
| contradictions | [pending] | 7 |
| deprecations | [pending] | 0 |
| knowledge_feedback | [pending] | 278 |
| audit_log | [pending] | 19,737 |
| llm_retry_queue | [pending] | 0 (12 test rows on pg side · not yet scrubbed) |
| worker_heartbeats | [pending] | 26 |
| **TOTAL** | **[pending]** | last dry-run: 73,233 |

---

## 2 · Destination counts (pre-backfill · our Postgres · read-only)

**Executed:** [NOT YET RUN]
**Expected:** near-zero across most tables (only 12 test-residue rows in `nex.llm_retry_queue` from earlier parity harness runs)

| Table | Postgres count pre-backfill | Notes |
|---|---|---|
| knowledge_records | [pending] | must be 0 · scrub any test residue first |
| record_versions | [pending] | 0 |
| graph_edges | [pending] | 0 |
| worker_jobs | [pending] | 0 |
| worker_results | [pending] | 0 |
| sources | [pending] | 0 |
| confidence_scores | [pending] | 0 |
| contradictions | [pending] | 0 |
| deprecations | [pending] | 0 |
| knowledge_feedback | [pending] | 0 |
| audit_log | [pending] | 0 |
| llm_retry_queue | [pending] | 12 test rows · must scrub |
| worker_heartbeats | [pending] | 0 |

**Pre-migration scrub required:** `DELETE FROM nex.llm_retry_queue WHERE parent_worker_type = 'knowledge-extractor' AND call_purpose = 'parity-test'` (or similar targeted delete to remove parity_test_* residue).

---

## 3 · Per-table parity target (post-backfill · must all pass)

**Executed:** [NOT YET RUN]
**Pass condition:** for each table, `pg_count = supa_count` OR `pg_count = supa_count + delta_since_pre_check` (where delta accounts for writes that happened during the backfill window).

Documented per-table row in the post-backfill parity report (Section 8 below).

---

## 4 · Primary-key collision report

**Executed:** [NOT YET RUN]
**Method:** the backfill script uses `INSERT ... ON CONFLICT DO NOTHING`. Rows that already exist on pg (same PK) are silently skipped. The rowCount delta between "attempted" and "inserted" per chunk = collisions.

**Expected collisions:**
- `worker_heartbeats.host_id` — 12.3-format local pids may already exist on pg from dev testing · low count
- `llm_retry_queue.id` — the 12 test rows on pg won't conflict with Supabase's 0 rows · N/A
- Elsewhere — zero expected (pg tables are empty)

**Populated by:** [pending]

---

## 5 · Nullability / schema mismatch report

**Executed:** [NOT YET RUN]
**Method:** during backfill · any INSERT that fails a NOT NULL or CHECK constraint on the pg side surfaces as a per-chunk error in the backfill log. The parity harness (`brain-adapter-contract`) already verified schema equivalence for the 13 core tables · additional issues would appear here only if Supabase data violates the pg constraints (e.g., a NULL where pg says NOT NULL).

Known constraint deltas (all pre-verified):
- `primary_audience` on `knowledge_records` — pg has CHECK constraint `IN ('homeowner','manufacturer','engineer')` · verified all Supabase rows use these values
- `feedback_source` on `knowledge_feedback` — CHECK `IN ('philip','customer','worker-audit','automated-check')` · verified
- `status` on multiple tables — CHECK constraints match

**Populated by:** [pending backfill execute output]

---

## 6 · Failed-row report

**Executed:** [NOT YET RUN]
**Format:** per-chunk error lines from `brain-backfill.mjs`
**Expected count:** 0 (or acceptably low with explanations captured here)

**Populated by:** [pending]

---

## 7 · Backfill completion marker

**Executed:** [NOT YET RUN]
**Marker:** timestamp + command + exit code + total inserted count

```
executed_at:    [pending]
command:        node scripts/brain-backfill.mjs --execute
exit_code:      [pending]  (0 = clean · 2 = drift detected · 1 = fatal)
total_inserted: [pending]  (must equal or exceed pre-backfill Supabase count)
duration:       [pending]
```

---

## 8 · Post-backfill parity report

**Executed:** [NOT YET RUN]
**Command:** `node scripts/brain-parity-report.mjs`
**Pass condition:** exits 0 (zero drift tables)

Documented per-table:
| Table | Supabase post | Postgres post | Delta | Verdict |
|---|---|---|---|---|
| (all tables) | [pending] | [pending] | [pending] | [pending] |

---

## 9 · Reverse-shadow activation confirmation

**Executed:** [NOT YET RUN]
**Env change:** `NEX_BRAIN_SHADOW_SUPABASE=1` set in the environment where the flip will happen
**Verification method:** perform one test write via a NEX API endpoint · confirm the row appears in BOTH pg (nex.audit_log) AND Supabase (public.audit_log) within seconds
**Expected latency:** < 500ms typical · < 5s worst case

```
env_set_at:         [pending]
test_write_at:      [pending]
pg_row_visible_at:  [pending]
supa_row_visible_at:[pending]
```

---

## 10 · Exact rollback command (per step)

Captured BEFORE each step executes so operator has one command in muscle memory:

### Rollback of Step 5 (inbox read-flip)
```
# Remove or unset NEX_INBOX_READ_BACKEND from environment
# Then: restart server
# Effect: reads return to filesystem within one restart cycle
# Loss: zero (writes always dual-wrote)
```

### Rollback of Step 7 (brain backend flip)
```
# 1. Confirm reverse-shadow was active during Postgres-primary window
#    (checked via: recent Supabase inserts have last_seen_at within the past window)
# 2. Unset both env vars:  NEX_BRAIN_BACKEND  and  NEX_BRAIN_SHADOW_SUPABASE
# 3. Restart server
# 4. Reads return to Supabase (which has all the writes thanks to reverse-shadow)
# Loss: zero (as long as reverse-shadow was active · Section 9 confirms this)

# Emergency fallback if reverse-shadow was OFF during the window:
node scripts/brain-reverse-backfill.mjs --execute --since=<flip-timestamp>
```

### Rollback of Step 9 (worker deployment)
```
# Depends on chosen topology - documented at deployment time
```

---

## 11 · Exact environment changes (per step)

| Step | Environment variable | Value | Where set | When |
|---|---|---|---|---|
| Step 4 | `NEX_BRAIN_SHADOW_SUPABASE` | `1` | production env | Before Step 7 |
| Step 5 | `NEX_INBOX_READ_BACKEND` | `postgres` | production env | After backfill · after Step 4 |
| Step 7 | `NEX_BRAIN_BACKEND` | `postgres` | production env | After Step 6 observation passes |
| Step 9 | worker deployment envs | (topology-specific) | Fly/Vercel/other | After Step 8 observation passes |

Never set multiple env changes simultaneously · each step gets its own observation window.

---

## 12 · Smoke-test checklist (per step)

### After Step 5 (inbox flip)
- `GET /api/nex/knowledge-inbox/list` — 200 · item count matches previous list-endpoint response · shows Phase 3a `objectBucket`/`objectKey` fields
- `POST /api/nex/knowledge-inbox/dump` (new text item) — 200 · item created · visible via list
- `GET /api/nex/brain/cron-tick` — 200 · `scanned` count non-zero · dispatch executes without ENOENT
- Watch for `[jobs-pg-read]` or `[inbox-pg-read]` warnings in logs · zero fallback events expected

### After Step 7 (brain flip)
- `GET /api/nex/brain/status` — 200 · backend field reports "postgres" · counts match Supabase snapshot
- `GET /api/nex/brain/warehouse` — 200 · vault_records match pre-flip
- `POST /api/nex/brain/cron-tick` — 200 · full pipeline runs · workers claim jobs from `nex.worker_jobs`
- Look for `[pg→supa-shadow]` messages in logs · reverse-shadow should fire without errors
- After 1 hour: run parity report again · pg counts should exceed supa counts by the delta of writes during the window (reverse-shadow captured them all)

### After Step 9 (worker deploy)
Full 6-worker prove-out per Wave 8 · not scoped in this authorization package.

---

## 13 · Observation window (per step)

| Step | Minimum observation before proceeding | Success criteria |
|---|---|---|
| Step 5 | 30 minutes | Zero fallback events · zero list-endpoint errors · new inbox items writable + readable |
| Step 7 | 60 minutes | worker_jobs claim/complete cycle observable on pg · zero adapter errors · reverse-shadow writes to Supabase confirmed |
| Step 9 | 24 hours | Full 6-worker prove-out passes · zero split-brain evidence · zero image ENOENTs |

---

## 14 · Abort criteria

Rollback the current step immediately if ANY of:

- Any smoke test fails
- Parity drift detected post-backfill that isn't explained by the reverse-shadow window
- New `[nex-audit] insert failed` or `[jobs-pg-read] failed` or `[inbox-pg-read] failed` warnings appear in logs at higher rate than pre-flip baseline
- Any P0 alert in monitoring
- Any user-visible regression (missing inbox items · missing brain records · dashboard shows stale data)
- worker_heartbeats show any worker offline > 60s in production
- Any 5xx error rate above baseline
- Fly worker resurrection detected (`worker_heartbeats` hosts matching legacy `<host_id_hex>` pattern with cycles growing)

**Abort protocol:**
1. Run the Step's rollback command
2. Log the abort in this document (append to Section 15)
3. Notify Philip
4. Do NOT retry until root cause identified

---

## 15 · Execution log (append-only)

Every migration step attempt logged here with timestamp + outcome.

```
[NO EXECUTIONS YET]
```

---

## 16 · Sign-off gates

Each gate requires Philip's explicit go before proceeding:

- [ ] Gate A · Pre-backfill scrub authorized (remove test residue from nex.llm_retry_queue)
- [ ] Gate B · Backfill `--execute` authorized
- [ ] Gate C · Reverse-shadow env activation authorized
- [ ] Gate D · Inbox read-flip authorized
- [ ] Gate E · Brain backend flip authorized
- [ ] Gate F · Worker deployment topology decision made
- [ ] Gate G · Worker deployment authorized
- [ ] Gate H · Six-worker prove-out passed
- [ ] Gate I · P1/P2/P3 engineering audit complete
- [ ] Gate J · Security audit complete
- [ ] Gate K · Compliance audit complete
- [ ] Gate L · **HEADQUARTERS PRODUCTION READY** declared

---

## 17 · Current honest label

```
HEADQUARTERS ENGINEERING BUILD:     COMPLETE               ✅
HEADQUARTERS PRODUCTION DEPLOYMENT: NOT YET COMPLETE       ⏳
HEADQUARTERS PRODUCTION READINESS:  NOT YET VERIFIED       ⏳
```

**Verdict:** the earlier architectural problems have been reduced from a confusing collection of failures to a controlled migration programme with explicit closure criteria. But every field in this document (Sections 1-14) is EMPTY. Nothing has actually moved to production. The Reception fix rule applies to this document itself · do not conflate "engineering build complete" with "production deployment complete" with "production readiness verified." They are three distinct states.

---

*Template created 2026-08-09. Populated in real-time as each migration step executes. This file is the definitive record of the production transition · lives in git so the history is auditable.*
