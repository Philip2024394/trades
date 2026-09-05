# NEX PROGRAMMER AGENT · PHASE A · FINAL REPORT
### Learning Observer · Knowledge + Skill + Experience Memory
_Philip 2026-09-05 · AUTHORIZE · PROGRAMMER LEARNING OBSERVER_

**Verdict: 🟢 IMPLEMENTED · TEST-PROVEN · REAL-LEARNING-PROVEN · ZERO REGRESSIONS**

Phase A is complete. NEX now has a durable substrate for capturing engineering events, ingesting authoritative external sources, and recording real Experience with full provenance. Every discipline in the AUTHORIZE literal is enforced at the type level or the code level. No autonomy granted. No Stage-2 capabilities anticipated.

---

## 1 · EXACT FILES CREATED

| # | File | Type | LOC |
|---|---|---|---|
| 1 | `src/lib/nex/programmer-learning/types.ts` | NEW | 178 |
| 2 | `src/lib/nex/programmer-learning/store.ts` | NEW | 176 |
| 3 | `src/lib/nex/programmer-learning/ingestion.ts` | NEW | 253 |
| 4 | `src/lib/nex/programmer-learning/verification.ts` | NEW | 202 |
| 5 | `src/lib/nex/programmer-learning/query.ts` | NEW | 141 |
| 6 | `src/lib/nex/programmer-learning/programmer-learning.test.ts` | NEW | 559 (25 tests) |
| 7 | `tests/fixtures/programmer-learning-proof/_phase_a_first_learning.mjs` | NEW · proof runner | 230 |
| 8 | `tests/fixtures/programmer-learning-proof/_phase_a_run_summary.json` | AUTO-GENERATED | live evidence |
| 9 | `tests/fixtures/programmer-learning-proof/store/` | AUTO-GENERATED | events.jsonl · knowledge.jsonl · skills.jsonl · experiences.jsonl · learning_runs.jsonl · sources/*.txt |

**Total: 6 code files + 1 proof runner + auto-generated storage.** Within §16 budget (5-8 components + tests).

## 2 · EXACT FILES MODIFIED

**None.** Phase A is entirely additive. No existing NEX code was modified.

## 3 · DATABASE / PERSISTENCE CHANGES

**Zero DB schema changes.** Persistence is file-based JSONL under `data/programmer-learning/` (or `NEX_PROGRAMMER_LEARNING_DIR` when overridden for tests/proofs). Append-only. This aligns with existing NEX persistence patterns (workforce runs, walker output) — no parallel infrastructure.

Storage layout:
```
data/programmer-learning/
  events.jsonl            · append-only engineering events
  knowledge.jsonl         · knowledge items
  skills.jsonl            · skill items
  experiences.jsonl       · experience items
  learning_runs.jsonl     · learning-run headers (final_status=null per §OP.5)
  sources/{sha256}.txt    · raw source snapshots · deterministic filename
```

## 4 · KNOWLEDGE MODEL

`KnowledgeItem` (types.ts:118):
- `knowledge_id` · `statement` · `domain` · `technology`
- `provenance` (mandatory · see §8 model below)
- `verification_status`: `DISCOVERED | CHECKED | VERIFIED | SUPERSEDED | REJECTED`
- `confidence`: 0..1 · derived from `authority_tier + verification_status`
- `superseded_by` · `related_knowledge`
- `content_hash` for dedup detection
- `created_at`

Lifecycle: **DISCOVERED → CHECKED → VERIFIED**, never auto-promoted. §7 no-self-reference rule enforced in `verifyKnowledge` (throws if `independent_evidence_pointer === source_url`).

## 5 · SKILL MODEL

`SkillItem` (types.ts:150):
- `skill_id` · `name` · `domain` · `description`
- `prerequisites` · `knowledge_dependencies`
- `verification_recipe` · `benchmark_reference`
- `promotion_state`: `OBSERVED | PRACTICED | VERIFIED`
- `supporting_experiences[]`
- `confidence`: 0.20 / 0.50 / 0.80

Lifecycle: **OBSERVED → PRACTICED → VERIFIED**. Documentation alone does NOT graduate a skill — supporting experiences required (§5).

## 6 · EXPERIENCE MODEL

`ExperienceItem` (types.ts:175):
- `experience_id` · `task` · `initial_hypothesis` · `action_taken`
- `files_involved[]` · `expected_result` · `actual_result`
- `evidence[]` (pointers)
- `outcome`: `success | partial_success | failure | reverted`
- `root_cause` · `correction` · `regression_result` · `lessons[]`
- `related_knowledge[]` · `related_skill`
- `provenance`
- **`captureExperience` REJECTS `outcome=failure` without `root_cause`** (§11 doctrine enforcement)

## 7 · EVENT MODEL

`EngineeringEvent` (types.ts:88) with 19 closed-union kinds:
observation · implementation_attempt · code_change · test_result · typecheck_result · runtime_result · bug · root_cause · fix · regression · architecture_decision · architecture_rejection · security_finding · performance_finding · migration_event · external_source_read · verification · learning · experience_created

Each event: `event_id · kind · timestamp · source · source_type · project · task · description · evidence_pointer · status · related_event_ids · meta`.

**All events default to `status: "DISCOVERED"`.** Never auto-VERIFIED (§16).

## 8 · PROVENANCE MODEL

`Provenance` (types.ts:76):
- `source` · `source_type` (14 kinds) · `source_url`
- `authority_tier`: `TIER_1 | TIER_2 | TIER_3 | TIER_4 | TIER_5` (§8)
- `retrieved_at`
- `evidence_pointer`
- `observed_by`: `claude | ollama | human | system | runtime | test_runner`

Every knowledge item · every skill provenance (via supporting experiences) · every experience · every event carries provenance. **Retrieval returns it** (§14) — proven by `queryKnowledge` test §17.14.

## 9 · TEST RESULTS

```
npx vitest run src/lib/nex/programmer-learning
  Test Files: 1 passed (1)
  Tests:      25 passed (25)
  Duration:   790ms
```

All 17 required tests from AUTHORIZE §17 passing:

| # | Requirement | Test | Status |
|---|---|---|---|
| 1 | engineering event captured | §17.1 | 🟢 |
| 2 | Claude implementation attempt captured | §17.2 | 🟢 · both claim + attempt DISCOVERED |
| 3 | test result attached to event | §17.3 | 🟢 · via related_event_ids |
| 4 | runtime evidence attached | §17.4 | 🟢 · runtime_result with meta.http_status |
| 5 | knowledge stored with provenance | §17.5 | 🟢 |
| 6 | external source stored | §17.6 | 🟢 · storeSourceSnapshot returns pointer |
| 7 | unverified internet info remains unverified | §17.7 | 🟢 · Tier-4/5 stays DISCOVERED |
| 8 | verified knowledge can be represented | §17.8 | 🟢 + REJECTS self-reference |
| 9 | skill references supporting experience | §17.9 | 🟢 |
| 10 | experience references evidence | §17.10 | 🟢 |
| 11 | failed implementation retained | §17.11 | 🟢 + REJECTS failure without root_cause |
| 12 | contradiction retained not overwritten | §17.12 | 🟢 · recordContradiction + classifyIncomingKnowledge |
| 13 | duplicate knowledge detected | §17.13 | 🟢 · detectDuplicate + findExistingKnowledgeByHash |
| 14 | retrieval returns provenance | §17.14 | 🟢 |
| 15 | provider identity ≠ truth | §17.15 | 🟢 · Claude + Ollama events both DISCOVERED |
| 16 | no self-reported success authoritative | §17.16 | 🟢 · doctrine meta marker + LearningRun rejects non-null final_status |
| 17 | unauthorized autonomous actions impossible | §17.17 | 🟢 · store exports no commit/deploy/etc · ForbiddenPhaseAWrite guard |

Plus 8 adversarial tests all passing.

## 10 · REAL CLAUDE ENGINEERING EVENT CAPTURED

The P0.3 hotel-resolved-reference-continuity slice (implemented earlier this session) was captured as a real Claude event chain:

- `evt_60c0b8bb-...` · CLAIM (Claude said "Reference now survives...") · status=DISCOVERED
- `evt_60c0b8bb-...` · attempt (Claude modified 3 files) · status=DISCOVERED · chained to claim
- `evt_b6320450-...` · test_result (vitest 20/20 passed) · status=VERIFIED · chained to attempt
- `evt_2360dadf-...` · runtime_result (live HTTP T2 returned "Gaotama Hotel is a hotel in Yogyakarta...") · status=VERIFIED
- `evt_5efd3eee-...` · regression (2597 brain tests · 0 failed · Δ+20) · status=VERIFIED
- `evt_70f4187f-...` · verification (verifyClaims rejected LLM's "great choice near Malioboro" with semantic_contradiction flag) · status=VERIFIED

**Doctrine marker on the CLAIM event**: `meta.doctrine = "op_truth.no_self_reported_success"`. The claim is preserved for the historical record but NEVER promoted to authoritative — only the chained evidence events reach VERIFIED status.

## 11 · REAL EXPERIENCE CREATED

`exp_7dec7f4d-142d-4555-b41f-14d4cd6a0613`:
- **task**: P0.3 hotel resolved-reference continuity
- **hypothesis**: Injecting hydrated hotel record + deterministic fallback preserves resolved reference all the way to final response
- **outcome**: success
- **evidence[]**: 3 real on-disk artifacts (`_reproduce_hotel_t3.json` · `_p0_3_hotel_reference_continuity_report.md` · `_hotel_negative_proof.json`)
- **regression_result**: "2597 brain tests passed · 0 failed · +20 delta matches new hydration tests exactly"
- **lessons[]** (4 concrete learnings):
  1. Gate/verifier/fallback triad each play distinct role
  2. LLM composition even with grounded evidence can add subjective language ("great choice near Malioboro") the record doesn't support
  3. Deterministic record-summary using only DB fields is safer than any LLM output when reference must be preserved
  4. Scope-locking via allowlist prevents scope creep during narrow-mandate slices

## 12 · AUTHORITATIVE INTERNET SOURCES ACTUALLY INGESTED

Three Tier-1 official sources fetched via WebFetch tool and stored with full provenance + raw snapshot:

| # | Source | URL | Statement extracted | Snapshot |
|---|---|---|---|---|
| 1 | TypeScript Handbook · Narrowing | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | "TypeScript narrows union types through control-flow analysis..." | `programmer-learning/sources/{hash}.txt` (verbatim quote preserved) |
| 2 | Node.js API · fs | https://nodejs.org/api/fs.html | "Node.js synchronous fs APIs block the event loop and throw exceptions immediately on error..." (honest note: doc did NOT include explicit `readFileSync throws ENOENT`; captured what the docs actually say) | snapshot stored |
| 3 | PostgreSQL Docs · MVCC | https://www.postgresql.org/docs/current/mvcc-intro.html | "PostgreSQL uses MVCC where each SQL statement sees a snapshot of the data..." | snapshot stored |

All three stored at `verification_status=CHECKED` (Tier-1 · structural integrity verified · URL fetched and content captured). TypeScript one subsequently promoted to `VERIFIED` via independent evidence (repo's own test suite exercises narrowing).

**Honest retrieval note captured**: for Node.js `fs.readFileSync`, the WebFetch snapshot did NOT include the specific `throws ENOENT on missing file` statement. Rather than fabricate it, the ingested knowledge captures ONLY what the docs actually provide, plus an honesty note in the raw snapshot explaining that further specificity requires independent verification. This is §11 in action — honest about the retrieval's limits.

## 13 · VERIFICATION EVIDENCE

- **Unit tests**: `npx vitest run src/lib/nex/programmer-learning` → 25/25 passed
- **Real learning run**: `node tests/fixtures/programmer-learning-proof/_phase_a_first_learning.mjs` exit-code 0 · summary at `_phase_a_run_summary.json`
- **On-disk artifacts**: events.jsonl · knowledge.jsonl · skills.jsonl · experiences.jsonl · learning_runs.jsonl all present with real content
- **Regression**: `npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning` → 2622/2622 passed · 0 failed

## 14 · WHAT REMAINS UNVERIFIED

- **Node.js fs.readFileSync ENOENT** — captured knowledge is the general synchronous-throws statement · specific ENOENT claim would require an independent test-runner event
- **PostgreSQL MVCC deeper properties** — snapshot semantics captured but per-isolation-level guarantees (READ COMMITTED vs REPEATABLE READ vs SERIALIZABLE) would need dedicated ingestion + verification
- **Skill VERIFIED promotion** — the P0.3 skill is at PRACTICED (1 supporting experience) · promotion to VERIFIED needs additional supporting experiences (per §12 · promotion threshold left conservative for Phase A · data model already supports it)
- **Cross-verifier attestation** — no third-party has cross-verified any of the recorded facts. Phase A intentionally has one verifier (the ingesting code itself).

## 15 · WHAT WAS DELIBERATELY NOT BUILT (per §20)

- ❌ Autonomous Programmer Agent
- ❌ Autonomous coding / autonomous commits / autonomous deploys
- ❌ Code review engine
- ❌ Benchmark execution suite (spec exists in `doctrine_nex_programmer_agent_falsifiable_benchmark_2026_09_05.md` but no runner)
- ❌ Multi-model engineering competition
- ❌ Web crawler / autonomous web research workforce
- ❌ 24/7 autonomous learning
- ❌ Database schema changes
- ❌ Workforce creation
- ❌ Self-modification
- ❌ Governance changes
- ❌ Production authority

None of these were silently anticipated in the code. Type unions are closed. `PhaseAPermission` (types.ts:239) enumerates ONLY the permitted actions. `ForbiddenPhaseAAction` (types.ts:255) documents what's explicitly forbidden.

## 16 · REGRESSION RESULT

| Metric | Pre-Phase-A | Post-Phase-A | Δ |
|---|---|---|---|
| Test files | 120 | **121** | +1 (new programmer-learning test file) |
| Tests passed (brain + programmer-learning) | 2,597 | **2,622** | **+25** (exactly matches the 25 new Phase-A tests) |
| Tests failed | 0 | **0** | 0 |
| Tests skipped | 44 | 44 | 0 |

**Zero regressions.** The +25 delta matches exactly the new Phase-A tests — no test outside `src/lib/nex/programmer-learning/` changed status.

Pre-existing failure preserved (unrelated to Phase A · not touched): `every seed record carries required provenance fields` (walker.travel.airports `stability="high"` data bug from prior session).

---

## Compliance summary

- ✅ KNOWLEDGE / SKILL / EXPERIENCE separated at type level (three distinct types, three distinct stores)
- ✅ Every record carries provenance (retrieval tests prove this end-to-end)
- ✅ Verification lifecycle enforced (DISCOVERED → CHECKED → VERIFIED · never auto-promoted)
- ✅ §7 Claude-as-source discipline (claim + attempt both DISCOVERED · doctrine marker in meta)
- ✅ §8 authority tiers (5-tier ranking · Tier 1/2 stays CHECKED · Tier 4/5 stays DISCOVERED)
- ✅ §10 contradictions retained, never silently overwritten (append-only supersession)
- ✅ §11 failures preserved as first-class (root_cause required)
- ✅ §12 promotion state supports future thresholds without schema change
- ✅ §13 retrieval supports basic filters + provenance returned
- ✅ §14 no autonomous actions (permission enum · ForbiddenPhaseAWrite · no export leaks)
- ✅ §15 provider independence (Claude · Ollama · human · runtime all valid sources · no hardcoded preference)
- ✅ §16 file budget respected (6 code files + 1 proof + tests)
- ✅ §17 all 17 required tests passing
- ✅ §18 first real learning: 3 authoritative external sources + 1 real P0.3 experience + 1 real skill + 5 chained events
- ✅ §19 LearningRun.final_status=null enforced at write time (test §17.16)
- ✅ §20 deferred items explicitly not built
- ✅ §21 success condition met: NEX IS NOW LEARNING (verifiable via retrieval + provenance)

## Reproduction

```
cd C:/Users/Victus/trades

# Unit tests (25 tests)
npx vitest run src/lib/nex/programmer-learning

# Real learning proof (3 external sources + P0.3 experience + skill + run)
node tests/fixtures/programmer-learning-proof/_phase_a_first_learning.mjs

# Full regression (brain + programmer-learning)
npx vitest run src/lib/nex/brain src/lib/nex/programmer-learning
```

Artifacts persisted at `tests/fixtures/programmer-learning-proof/store/*.jsonl` for independent inspection.

---

HARD STOP · AWAITING REVIEW
