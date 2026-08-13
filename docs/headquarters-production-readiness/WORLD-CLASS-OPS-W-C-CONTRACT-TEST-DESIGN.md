# WORLD-CLASS-OPS · W-C · Contract Test Design

**Phase:** 4 of CONTROLLED COMPLETION DIRECTIVE
**Status:** DESIGN ONLY · no test files authored · no CI wiring
**Inputs:**
- Phase 2: `WORLD-CLASS-OPS-W-C-STORAGE-CONTRACT-EXTENSION-DESIGN.md` (methods to test)
- Phase 3: `WORLD-CLASS-OPS-W-C-COMPANION-SUPERVISOR-DESIGN-V2.md` (supervisor invariants to protect)
**Governs:** Phase 5 (contract test authoring) and Phase 6 (supervisor test authoring)
**Doctrine anchors:** F12 AI2 (adapter isolation), pre-existing contract-test convention at `tests/nex/brain-storage-contract.test.mjs`

---

## 1 · Test strategy in one page

Two test surfaces:

- **A · Storage contract tests** — assert every BrainStore method behaves identically across the 3 adapters (filesystem, postgres, supabase). One test file per method group. Runs against filesystem always, postgres when `PG_TEST_URL` set, supabase when `NEX_SUPABASE_URL` + service key set.
- **B · Supervisor behavior tests** — assert Path A · Path B · Path C decisions on synthetic and real fixture data. Runs against filesystem adapter (deterministic seeding) plus a smoke against postgres (integration confidence).

The 10 preserved stuck KnowledgeJobs are the **anchor fixture** for supervisor tests. Contract tests use seeded data (no dependency on prod state).

**Test framework:** existing Node `--test` runner (matches Wave 11 convention · no new framework).

---

## 2 · Contract test surface (A)

### 2.1 · File organization

Extend existing `tests/nex/brain-storage-contract.test.mjs` OR split into per-method files:

```
tests/nex/
  brain-storage-contract.test.mjs           (existing · augmented)
  brain-storage-workerjob-lookup.test.mjs   (NEW · §3.2 + §3.3 methods)
  brain-storage-workerresult-join.test.mjs  (NEW · §3.4)
  brain-storage-kjob-audit.test.mjs         (NEW · §3.5)
```

Split preferred for readability at review time. Each file targets one method or tight method cluster.

### 2.2 · Per-adapter run matrix (identical to existing)

```js
const adapters = [
  { name: 'filesystem', factory: makeFilesystemStore },
  ...(process.env.PG_TEST_URL ? [{ name: 'postgres', factory: makePostgresStore }] : []),
  ...(process.env.NEX_SUPABASE_URL && process.env.NEX_SUPABASE_SERVICE_ROLE_KEY
      ? [{ name: 'supabase', factory: makeSupabaseStore }] : []),
];
for (const { name, factory } of adapters) {
  test(`${name} · <method> · <case>`, async () => { ... });
}
```

Every new test iterates the same matrix. **Zero adapter-specific test logic** — that's the whole point of a contract test.

### 2.3 · Test seed helpers

New helpers in `tests/nex/_helpers/brain-seed.mjs`:

```js
export async function seedWorkerJob(store, overrides = {}) { ... }
export async function seedWorkerJobsForInboxItem(store, inbox_item_id, worker_types) { ... }
export async function seedExtractorWithResult(store, {kjid?, inbox_item_id, draft_record_ids}) { ... }
export async function seedKnowledgeJobTransition(store, {kjid, from, to, ...rest}) { ... }
export async function resetStore(store) { /* filesystem: rm tables · postgres: TRUNCATE · supabase: skip · use isolated test schema */ }
```

**Isolation strategy per adapter:**

- **filesystem** — each test uses a fresh `tmp/test-<uuid>` directory · full reset between tests
- **postgres** — each test runs inside a transaction ROLLBACKed on teardown · zero side-effect
- **supabase** — each test uses `nex_test.*` schema (test-only) OR row-tagging with `test_run_id` for cleanup · NEVER writes to `public.*` production tables

### 2.4 · Individual test cases per method

#### 2.4.1 · `getWorkerJob(job_id)`

| Case | Seed | Assert |
| --- | --- | --- |
| happy path | seed 1 WorkerJob | `getWorkerJob(j.id)` returns row with matching fields |
| missing id | none | `getWorkerJob(randomUuid())` returns `null` |
| id with special chars | none | `getWorkerJob("'; DROP TABLE --")` returns `null` without throwing (SQL injection safety) |

#### 2.4.2 · `listWorkerJobsByInputRef(input_refs, opts?)`

| Case | Seed | Assert |
| --- | --- | --- |
| single input_ref match | 3 jobs with 2 distinct input_refs | filter to one input_ref → 2 rows returned · ordered by created_at ASC |
| batch match | 5 jobs across 3 input_refs | filter to all 3 input_refs → 5 rows |
| empty input_refs | none | returns `[]` immediately (no adapter round-trip · assert via spy on filesystem) |
| limit truncation | 10 jobs with same input_ref | limit=5 returns exactly 5 · rest omitted |
| no match | 3 jobs | filter unknown input_ref → `[]` |
| ordering guarantee | seed jobs at t0, t2, t1 | result index [0].created_at < [1].created_at < [2].created_at |

#### 2.4.3 · `findWorkerJobsByKnowledgeJobId(kjid)`

| Case | Seed | Assert |
| --- | --- | --- |
| kjid in payload | seed 2 knowledge-context jobs with matching kjid + 1 without | returns 2 · excludes negative |
| no kjid match | seed 3 jobs without matching kjid | returns `[]` |
| kjid with special chars | none | filter with unicode / punctuation kjid returns `[]` without throw |
| only knowledge-context has kjid | seed knowledge-context + extractor · both with matching input_ref · only kc has kjid | returns 1 (the kc) · NOT the extractor |

The last case is the **guardrail against the exact Cohort A gotcha** — enforces documented behavior that method matches by payload key alone, not by inbox_item resolution.

#### 2.4.4 · `listWorkerResultsByJobIds(job_ids, opts?)`

| Case | Seed | Assert |
| --- | --- | --- |
| happy path | 2 jobs · 2 results linked by job_id | filter by both job_ids → 2 results |
| partial match | 3 jobs · 2 have results | filter all 3 → 2 results (missing skipped) |
| empty | none | `[]` returns · no adapter round-trip |
| limit | 5 results | limit=3 returns 3 |

#### 2.4.5 · `writeKnowledgeJobTransitionAudit(input)`

| Case | Seed | Assert |
| --- | --- | --- |
| happy path | write transition claimed→completed | `listAudit({entity_id: kjid})` returns 1 row · entity_type='knowledge_jobs' · action='completed' · before_state/after_state populated |
| minimum fields | write with just kjid, from, to, actor | row exists · optional fields null-safe |
| all fields populated | write with reason + correlation_id + worker_job_id + metadata | row exists · notes JSON preserves metadata |
| repeated write | write same transition twice | 2 rows exist (audit is append-only · no dedup at Storage layer) |

**Note:** dedup enforcement lives in the SUPERVISOR (fs-store CAS check), not the audit-write itself. Contract test asserts audit is append-only.

### 2.5 · Cross-method integration test

One test asserts the full Cohort A recovery flow via new methods:

```js
test('storage contract · Cohort A attest-and-finalize integration', async () => {
  // Seed: kjid + inbox_item_id + 4 completed extractor WorkerJobs with results containing draft_record_ids
  const {kjid, inbox_item_id} = await seedStuckCohortA(store);

  // Act: exercise the query chain the supervisor will use
  const wjs = await store.listWorkerJobsByInputRef([inbox_item_id]);
  const extractors = wjs.filter(w => w.worker_type === 'knowledge-extractor');
  const results = await store.listWorkerResultsByJobIds(extractors.map(w => w.result_id));

  // Assert
  assert.equal(extractors.length, 4);
  assert.equal(extractors.every(w => w.status === 'completed'), true);
  assert.equal(results.every(r => r.output_kind === 'record_draft'), true);
  assert.equal(results.every(r => r.output_payload.draft_record_ids.length > 0), true);
});
```

This test PROVES the supervisor's query pattern (§4.1 of V2 design) is executable through Storage · zero bypass required.

---

## 3 · Supervisor behavior test surface (B)

### 3.1 · File organization

New file: `tests/nex/kjob-supervisor.test.mjs`

Runs supervisor logic (Paths A, B, C) against a filesystem-backed store with seeded data. One assertion per decision branch.

### 3.2 · Path A · Attest Sweep tests

| Case | Seed | Assert |
| --- | --- | --- |
| happy attest (Class X) | stuck KJ + 4 completed extractors + results with draft_record_ids | Sweep transitions KJ claimed → completed with reason='supervisor-attested-completion' · transition audit written · no LLM call attempted |
| no extractors | stuck KJ + only knowledge-context worker completed | Path A falls through · Path B triggers |
| extractors incomplete | stuck KJ + extractors in `claimed`/`assigned` state | Path A falls through · Path B triggers |
| extractors completed · zero drafts | stuck KJ + completed extractors · empty draft_record_ids | Path A falls through · Path B triggers |
| already terminal | KJ status='completed' before sweep | Sweep no-ops (CAS guard) · no audit written |
| concurrent completion race | KJ transitions completed mid-sweep | fs-store CAS returns false · sweep no-ops silently |
| stale threshold not reached | stuck KJ · updated_at 5 min ago · threshold 30 min | Sweep skips this KJ · not in candidate set |

### 3.3 · Path B · Review Queue tests

| Case | Seed | Assert |
| --- | --- | --- |
| routed from Path A fallthrough (no extractor) | stuck KJ + partial chain | Review record written with recommended_action='requeue' or 'manual_investigate' |
| routed from Path A fallthrough (zero drafts) | stuck KJ + completed extractor · empty drafts | Review record written · recommended_action reflects "extractor ran but no output" |
| escalation | Class Y KJ in review >72h | Sweep emits page-worthy signal · escalation flag set |
| operator resolves review | manually transition via admin API | Review row marked resolved · sweep no longer surfaces it |

### 3.4 · Path C · Positive Cascade tests

| Case | Setup | Assert |
| --- | --- | --- |
| successful cascade | extractor completes · `resolveKnowledgeJobIdForExtractorJob` returns kjid | fs-store.updateJob invoked · KJ transitions claimed → completed · audit row written |
| kjid resolves to null (KJ already terminal) | KJ.status='completed' before cascade | Cascade no-ops · zero writes · idempotent |
| cascade throws | inject fs-store.updateJob throw | Extractor's completeJob succeeded · WorkerJob is complete · KJ stays claimed · Path A catches on next sweep |
| kjid resolution via inbox_item | seed extractor job with input_ref pointing to inbox_item · fs-store has active KJ for that inbox_item | `resolveKnowledgeJobIdForExtractorJob` returns correct kjid |
| cascade disabled | `NEX_KJOB_CASCADE_ENABLED=0` | Cascade skipped · Path A relied upon exclusively |

### 3.5 · The 10 stuck jobs fixture test

Only test in this suite that requires REAL fs-store state (not synthetic seeds):

```js
test('supervisor · 10 preserved stuck KJs · classification snapshot', async () => {
  const stuck = await fsStore.listJobs({status: 'claimed'});
  assert.equal(stuck.length, 10, 'fixture jobs still preserved');

  const classification = await supervisor.classifyOnly(stuck); // dry-run · no writes

  const classX = classification.filter(c => c.path === 'A-attest');
  const classY = classification.filter(c => c.path === 'B-review');

  assert.equal(classX.length, 4, 'Cohort A · 4 attestable');
  assert.equal(classY.length, 6, 'Cohort B · 6 for review');

  // Cohort A specific kjids
  const cohortA = ['7e1fc4f9-efb5-4892-8d55-51b347babe1c', '6381641c-...', '1e09c119-...', 'b1772902-...'];
  for (const k of cohortA) assert.ok(classX.some(c => c.kjid === k));

  // Cohort B specific kjids
  const cohortB = ['270865e6-...', '7fc668ef-...', '47e0cf43-...', 'ab5835b8-...', '56e1da78-...', '46a8eb51-...'];
  for (const k of cohortB) assert.ok(classY.some(c => c.kjid === k));
});
```

**Critical property:** this test is DRY-RUN only (`classifyOnly`). It NEVER un-sticks the fixture. If it accidentally did, the next test run would fail because there'd be no stuck jobs to classify.

**Test skip guard:** the test skips if `stuck.length !== 10` (fixture already released), so it doesn't fail after intentional release.

### 3.6 · Duplicate-work invariant test

```js
test('supervisor · Path A does not invoke LLM · duplicate-work guarantee', async () => {
  const {kjid, inbox_item_id} = await seedStuckCohortA(store);

  const llmCallCount = { count: 0 };
  mockGlobal.llmClient.chat = () => { llmCallCount.count++; return {}; };

  await supervisor.sweep({ dry_run: false });

  assert.equal(llmCallCount.count, 0, 'Path A must never call LLM');
  const kj = await fsStore.getJob(kjid);
  assert.equal(kj.status, 'completed');
});
```

This test protects **the primary win of V2 over V1**: Path A never re-drives extraction.

---

## 4 · Drift-catcher tests

Under `scripts/nex/f12-drift-check.mjs` extensions from Phase 2 §7:

- **CADP4a test** — deliberately add a stub adapter file that omits `getWorkerJob` · assert drift-catcher exits non-zero
- **KJT1 test** — deliberately add a terminal `updateJob({status:"completed"})` without paired audit call · assert drift-catcher flags it

These are executed as part of `npm test` OR as pre-commit hook (matches existing Wave 11 pattern).

---

## 5 · CI / local execution wiring

Contract tests already run under `npm test`. New files auto-include via existing `--test` glob. No CI config change required beyond ensuring `NEX_SUPABASE_URL` + `NEX_SUPABASE_SERVICE_ROLE_KEY` env vars point to a **test-only Supabase project or schema** in CI, NOT the production Supabase.

**Explicit CI safety:** if the target Supabase URL matches the production URL, contract tests FAIL fast with a "safety guard tripped" message. Prevents CI from ever wiping prod data.

```js
const PROD_URL = 'https://ijvqdvsvwtwxzcqmoqit.supabase.co';
if (process.env.NEX_SUPABASE_URL === PROD_URL && process.env.NODE_ENV !== 'production-readonly-audit') {
  throw new Error('CONTRACT TESTS WILL NOT RUN AGAINST PRODUCTION SUPABASE');
}
```

---

## 6 · Fixture data audit trail

Every test seed helper writes to a `test_run_id` column (added to test-schema tables · not to production tables) so cleanup can target-truncate. If a test crashes mid-run, the next run finds and cleans stale test_run_id rows automatically.

For Supabase adapter tests specifically, tests run against a `nex_test` schema (created in test env only) with identical table shapes. Production schema unchanged. This matches existing Wave 11 F12 test pattern.

---

## 7 · Non-goals (V1 test discipline preserved)

- ❌ No test that requires production Supabase read access
- ❌ No test that writes to production tables
- ❌ No test that un-sticks the 10 fixture jobs
- ❌ No mock LLM that consumes real API calls
- ❌ No end-to-end test that spans HTTP → API → workers (integration test scope · separate cluster)

---

## 8 · Timing and confidence

**Contract tests (surface A):** ~20 test cases · <5s runtime against filesystem · <30s against postgres · <60s against supabase test schema.

**Supervisor tests (surface B):** ~15 test cases · deterministic (all fixtures seeded) · <10s runtime.

**Drift-catcher tests:** ~5 assertions · <2s runtime.

**Total added CI time:** ~45-90s. Acceptable at Wave 11 test discipline.

---

## 9 · What Phase 4 does NOT authorize

- Phase 5 implementation (author tests + retrofits + migrations · separate authorization at Phase 5 gate)
- Any test file creation
- Any drift-catcher script edit
- Any CI config edit
- Any commit / push

Phase 4 is design-only. Phase 5 executes contract-test authoring alongside contract implementation.

---

## 10 · Sequencing into Phase 5

Phase 5 test-authoring order (matches implementation order in Phase 2 §11):

1. Author contract test skeletons for §2.4.1 - §2.4.5 (RED · no methods yet)
2. Implement filesystem adapter methods · contract tests §2.4.1 - §2.4.5 GO GREEN for filesystem
3. Implement postgres adapter · contract tests GO GREEN for postgres
4. Implement supabase adapter · contract tests GO GREEN for supabase
5. Author §2.5 cross-method integration test · assert Cohort A pattern executes
6. Author drift-catcher tests (§4) · fail cases first · then real assertions
7. Path A/B/C supervisor tests (§3) come in Phase 6, not Phase 5

---

## 11 · Boundaries preserved

| | Status |
| --- | --- |
| Test files written | ❌ zero |
| CI wiring | ❌ zero |
| Drift-catcher edits | ❌ zero |
| Contract implementation | ❌ zero |
| Supervisor implementation | ❌ zero |
| 10 stuck jobs | 🔒 preserved · never touched by any test in this design |
| Commit | ❌ zero |
| Push | ❌ zero |

---

**Phase 4 status: COMPLETE. Next phase (Phase 5) begins implementation of the Storage contract extension — this is a high-risk new domain per the CONTROLLED COMPLETION DIRECTIVE (interface change · adapter modifications · migration authoring · Supabase index creation · retrofit of terminal-write sites). STOPPING here for explicit Phase 5 authorization.**
