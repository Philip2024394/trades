# NEX1 · Autonomous Generalisation from Failures · §25.1 PRE-BUILD AUDIT

**Date:** 2026-09-18
**Mission:** Autonomous generalisation from failures (per your build brief).
**Discipline enforced:** §3 read-only audit before any code change. §11 zero-LLM verification budget. §23 no-fake-intelligence rule.
**Author:** master_ai_engineer (Claude Opus 4.7)
**Method:** 6 parallel Explore agents · scoped to failure/verification · hypothesis/evidence · knowledge/persistence · programming-loop · NEX3/safety · workforce/orchestration.

---

## §1 · What NEX1 already has (relevant to the mission)

### §1.1 · Failure capture · rich signal, thin persistence

| Capability | File | State | Reusable? |
|-----------|------|-------|-----------|
| Vitest runner + structured failure extraction | `src/lib/nex-agent/tools/verification.ts` (1-227) | Returns `{ exit_code, findings[] }` in-memory. **Not persisted.** | **YES** as evidence source |
| J.1 runtime-failure extractor | `capability-j-runtime-diagnosis.ts` | Parses `Nex1RuntimeFailureFinding[]` deterministically | **YES** for pattern seed |
| J.2 cause-analysis + repair proposal | `capability-j2-cause-analysis.ts` | Generates hand-coded heuristic proposals | Partial · heuristics not learned |
| J.3 verify-repair with auto-rollback | `capability-j3-verify-repair.ts` | Original + modified + restored hashes captured **in-memory only** | **YES** as before/after evidence |
| Fix 23c preservation check | `native-programming-loop.ts:513-993` | Auto-revert on sibling-test regression. **Which mutations regressed is not archived.** | **YES** as counterexample source |
| Conversation graph refused_prompts | `capability-conversation-graph.ts:97-119` | JSONL-persisted refusal records with reason | **YES** for failure corpus |
| VerificationRecord / MutationRecord types | `capability-conversation-context.ts:68-83` | Thread-scoped, persisted via head snapshot | Partial · schema too thin for pattern extraction (missing pre/post hashes) |

**Gap:** no `data/nex1-failure-corpus/*.jsonl`. Failures are extracted but not archived cross-run. Cannot pattern-extract without corpus.

### §1.2 · Hypothesis pipeline · rich, but instance-specific · not generalisation

| Fix | Module | Output | Would it produce a GENERALISATION? |
|-----|--------|--------|-----------------------------------|
| 8 | `capability-observed-chains.ts` | Observed groupings (same_function_body / shared_identifier) | **Partial** · relationship types abstract but bindings concrete |
| 9 | `capability-chain-narrative-emitter.ts` | Templated statements | **No** · verbalisation, not abstraction |
| 10 | `capability-chain-relationship-detector.ts` | Three fixed patterns (producer_consumer / condition_gates_return / selector_literal_mapping) | **YES for pattern class · No for arbitrary rules** |
| 11 | `capability-chain-relationship-composer.ts` | Multi-hop chains with concrete endpoints | **No** · specific traversals, no variables |
| 12 | `capability-root-cause-hypothesis-generator.ts` | First-endpoint-of-composition heuristic → RootCauseCandidate (HYPOTHESIS) | **No** · one-heuristic, per-composition |
| 13 | `capability-hypothesis-evidence-evaluator.ts` | 4-state classification (SUPPORTED / CONTRADICTED / INSUFFICIENT / UNRESOLVED) | **No** · classifier, not synthesiser |
| 14 | `capability-candidate-comparator.ts` | 16 kinds of structural difference between pairs | **No** · pair-specific deltas |
| 15 | `capability-candidate-ranker.ts` | Q7 ranking per V1 policy (R-1..R-5) | **No** · orders known candidates, doesn't generate rules |
| 16 | `capability-candidate-selector.ts` | Q8 selection (6 states: SELECTED / NO_SELECTION / TIE / INSUFFICIENT / UNRESOLVED / REQUIRE_MORE_INVESTIGATION) | **No** · picks best from known set |

**Vocabulary presence check (grep confirmed):**
- `generalis` — **ABSENT** everywhere in nex-agent
- `pattern` — appears only in "3 relationship patterns" (Fix 10) · not user-extractable
- `abstract` — **ABSENT** for parametric rules
- `variable` / `quantif` — **ABSENT** in pattern sense

**Gap:** the entire hypothesis pipeline produces **candidate instances**, never **abstract rules with variables**.

### §1.3 · Persistence + state vocabulary · present, but no "PROMOTION" pipeline

| Store | States | Provenance | Can hold GENERALISATION row? |
|-------|--------|-----------|------------------------------|
| `data/nex1-paraphrase/entries.jsonl` | seed / founder_correction / harvested / manual · upsert + touch events | source · canonical · target_slug | **YES** with entry_kind="generalised" addition |
| `data/nex1-conversation-heads/{id}.json` | explicit/inferred (prefs) · resolved bool (questions) | conversation_id · turn_id · thread_id | **Partial** · needs new `learned_patterns[]` field |
| `data/nex1-chat-conversations/{id}.jsonl` | turn transcripts | timestamp · turn_id · sender | **No** · wrong shape |
| `data/nex1-envelope-history/{task_id}.jsonl` | 7 verdict states · confidence · provenance | ts · envelope | **Partial** · via envelope `meta_pattern` field |
| `data/nex1-notes-panel/dismissals.jsonl` | dismiss / undismiss | ts · prefix | Weak · UX-scoped only |
| `data/nex1-investigation-conclusions/entries.jsonl` (Fix 17) | Q8 6-state · INFERRED evidence_kind | policy_id · policy_version · investigation_id · trace_id · provenance | **YES · critical** with extension |
| `data/nex1-learning/ledger.json` (learning-ledger.ts) | Skills / Patterns / AntiPatterns with reusedCount | Skill IDs | **YES · exists but UNCALLED** |

**Critical finding:** `learning-ledger.ts` **exists** as a persistent store for Skills, Patterns, and AntiPatterns with reuse counts · but the programming loop's LEARN stage NEVER CALLS IT. It's an orphan store.

**States that exist across stores** (mission §14 lookup):
- OBSERVED · CANDIDATE · CHALLENGED · VALIDATED · PROMOTED · REJECTED · REVISED · SUPERSEDED

Grep result: **NONE of these 8 states exist as a coherent lifecycle vocabulary anywhere.** The closest matches are:
- Fix 13's evidence states (SUPPORTED / CONTRADICTED / INSUFFICIENT / UNRESOLVED) · covers CHALLENGED partially
- Q8's selection states · covers PROMOTED partially via SELECTED
- Paraphrase kinds · covers PROMOTED partially via founder_correction

**Gap:** no unified 8-state promotion lifecycle exists.

### §1.4 · Programming loop · 10 stages, LEARN is a stub

`native-programming-loop.ts` (1800+ LOC) implements:
```
1. UNDERSTAND  2. INSPECT  3. REASON (J.1)  4. PLAN (J.2/K)  5. CHANGE
6. TEST  7. DIAGNOSE  8. REPAIR (bounded retry)  9. VERIFY  10. LEARN
```

**Stages 1-9 are real and wired.** They produce `StageResult[]` with `evidence[]` and `reasoning_trace[]`.

**Stage 10 (LEARN) is aspirational only** (lines 665-712):
```ts
const lessonBody = [`# NEX1 Native Programming Loop · verified completion`, ...].join("\n");
stages.push({
  stage: "learn",
  verdict: "VERIFIED",
  summary: `lesson recorded · loop verified end-to-end without LLM`,
  evidence: [`lesson body ${lessonBody.length}B captured in loop result`],
  reasoning_trace: [`stored inline (nex-code-brain lesson-extractor consumes coding-team runs · not this loop's artifact model)`],
});
```

**The `lessonBody` string is constructed then discarded.** No file write. No `learning-ledger` call. No pattern extraction. Zero persistence.

**Gap:** the LEARN stage is where generalisation belongs. It's structurally present but functionally empty.

### §1.5 · NEX3 validation · 7 layers · none can validate a GENERALISATION today

| Layer | File | Blocking | Can validate a generalisation? |
|-------|------|----------|-------------------------------|
| Safety doctrine | `src/lib/nex/master-ai/safety-doctrine.ts` | Missing evidence_refs on I_KNOW/I_INFER · missing execution_receipt on I_DID_IT | **No** · validates response STRUCTURE, not candidate |
| Safety boundary gate | `capability-safety-boundary.ts` | HOSTILE_AI_ZONE / CROSS_REPO / PROTECTED_PATHS | **No** · boundary safety, not evidence |
| Context evidence gate (α.10) | `capability-a-founder-intent/context-evidence-gate.ts` | Perfective/passive · speculative frames | Partial · linguistic evidence only |
| Architecture guardian + ADR impact | `architecture-guardian.ts` + `adr-impact.ts` | ADR FAIL · critical security · truth-engine touch | Partial · architectural |
| Fix 13 evidence evaluator | `capability-hypothesis-evidence-evaluator.ts` | None directly · classifies for Q8 to block | Partial · candidate-specific |
| Q8 selector | `capability-candidate-selector.ts` | 8-step precedence with CONTRADICTED/INSUFFICIENT/UNRESOLVED blocking | Partial · single-scope selection |
| Preservation check (Fix 23c) | `native-programming-loop.ts:513-545` | Sibling test regression | **No** · mutation safety |

**Gap:** no validator with a **generalisation-specific policy** (e.g., "does this abstract rule survive a counterexample search across the failure corpus?"). Q8 is the closest but scoped to single-scope candidate selection.

### §1.6 · Workforce · 142 files · 51 capabilities · 3 orchestrators · **zero orphans**

Every file in `src/lib/nex-agent/` is imported by something (transitively). But:
- `learning-ledger.ts` is **imported by tests only** · not by production code. **Functional orphan.**
- The 11 specialists imported by `nex1-orchestrator/orchestrator.ts` are **connected but rarely invoked** from user-facing paths per the Session-3 finding you recorded in memory.

**Gap:** the workforce IS connected · but no path today would call multiple agents on a **generalisation task** because generalisation is not a task class NEX1 recognises.

---

## §2 · The exact missing capability

Mission §4 asks for precise definitions. Here they are, mapped to what does/doesn't exist:

| §4 stage | Exists today? | Where |
|----------|---------------|-------|
| **Observation** (what happened) | ✅ | Programming-loop stages · investigation packet |
| **Failure** (what failed) | ✅ | J.1 findings · vitest exit codes · preservation regressions |
| **Cause** (evidence) | ✅ | Fix 12 candidates · Fix 13 evidence classification |
| **Pattern** (relationship) | 🔸 Only for 3 fixed classes (producer_consumer / condition_gates_return / selector_literal_mapping) · not extracted from data |
| **Generalisation candidate** (reusable rule) | ❌ | **DOES NOT EXIST** |
| **Challenge** (counterexample) | ❌ | **DOES NOT EXIST** as a systematic engine |
| **Validation** (evidence required for promotion) | 🔸 Q8 can validate single-scope candidates · no policy for generalisations |
| **Promotion** (when candidate → knowledge) | ❌ | **DOES NOT EXIST** as a lifecycle |
| **Application** (retrieve + apply to novel case) | ❌ | **DOES NOT EXIST** |
| **Reverification** (does it still hold) | ✅ | Programming-loop TEST/VERIFY can rerun |

**Five load-bearing gaps · exactly what the mission specifies:**
1. **Generalisation candidate extraction** from a completed run
2. **Counterexample challenge** against the failure corpus
3. **Generalisation-specific validation policy** (Q8-style but for abstract rules)
4. **Promotion lifecycle** (OBSERVED → CANDIDATE → CHALLENGED → VALIDATED → PROMOTED · with reject/hold/supersede paths)
5. **Retrieval + application** to a materially different Case B

Everything else the mission needs (observation · failure detection · evidence extraction · execution · verification) **already exists** and can be reused.

---

## §3 · Proposed smallest architecture (per §20)

**Do NOT create a monolithic `nex-intelligence.ts`.** Instead, five small modules + one JSONL store + one endpoint + one wire into the existing LEARN stage:

```
src/lib/nex-agent/generalisation/
  capability-generalisation-extractor.ts       (new · ~200 LOC)
  capability-generalisation-challenger.ts      (new · ~200 LOC)
  capability-generalisation-validator.ts       (new · ~150 LOC · policy consumer)
  capability-generalisation-store.ts           (new · ~120 LOC · JSONL persistence)
  capability-generalisation-retriever.ts       (new · ~150 LOC)
  capability-generalisation-applier.ts         (new · ~150 LOC)
  policy/generalisation-policy-v1.ts           (new · ~100 LOC · founder-approved constants)
```

**Persistence:**
```
data/nex1-generalisations/entries.jsonl        (append-only event log)
data/nex1-generalisation-fixtures/             (Case A + Case B test files)
  case-a/src/*.ts
  case-a/src/*.test.ts
  case-b/src/*.ts
  case-b/src/*.test.ts
```

**Wire changes (minimal):**
- `native-programming-loop.ts` LEARN stage · call `runGeneralisationExtractor()` on completion
- New endpoint `POST /api/nex1/generalise/apply` · takes a new prompt, retrieves+applies

**State lifecycle (per §14):**
```
OBSERVED (single-run evidence)
  → CANDIDATE (extractor emits)
  → CHALLENGED (challenger finds N ≥ 0 counterexamples)
  → VALIDATED (validator applies policy) OR REJECTED
  → PROMOTED (stored in generalisation entries.jsonl · applicable to Case B)
  → SUPERSEDED (if a stronger candidate replaces it) OR REVISED (scope narrowed)
```

**Domain of first proof (per §6):** numeric-literal transformation on return statements.
- Abstract shape: `{ function_shape: "returns literal", current_literal: X, expected_literal: Y }`
- Variables: X (before), Y (after)
- Constants: "failing test expected Y but got X" · "fix is replace X→Y in the return"

**Case A fixture:** `getMagicNumber()` in `pricing-fixture.ts` returns `41` · test expects `42`.
**Case B fixture:** `getBaseDiscount()` in `discount-fixture.ts` returns `10` · test expects `15`.
- Different domain (pricing vs discount) · different function name · different file · different literals · different task wording.
- **Same abstract shape** · so the promoted rule from A should apply to B.

---

## §4 · Founder-decisions needed before I write code

Per your mission §16 (rejection is a valid intelligent outcome) and §22 (acceptance criteria), several policy decisions belong to you, not me:

1. **Promotion threshold:** what counts as "validated"?
   - Option A · zero counterexamples across the failure corpus (strict)
   - Option B · counterexample rate below X% (probabilistic · would need X)
   - Option C · founder-approval gate before PROMOTED (safest · slower)
   - I recommend **A for the first proof · B for later domains**.

2. **Scope declaration:** how narrow must a generalisation be to be safe?
   - Option A · same fact_kind pair (e.g., both are "returns literal") · restrictive · high confidence
   - Option B · same relationship_type · looser · more general
   - I recommend **A for the first proof.**

3. **Case B novelty enforcement:** what makes B "materially different" from A?
   - The mission §8 lists surface differences (wording · file · function · variables · values · domain · structure)
   - I propose the fixture designer must vary ≥ 4 of these 7 dimensions.

4. **Rejection outcomes:** which of the mission §16 states should we support in V1?
   - NOT_PROVEN · AMBIGUOUS · INSUFFICIENT_EVIDENCE · CONTRADICTED · REQUIRES_MORE_OBSERVATION
   - I recommend **all five · same shape as Q8's honest-uncertainty vocabulary**.

5. **Zero-LLM budget:** any concessions?
   - The mission §11 says **zero**. I propose **strict zero** — the pattern extractor works over structured evidence (Fix 12-16 outputs · appliedMutations · failing tests) · never over free-form prose.

---

## §5 · What I am NOT proposing to change (per §18)

- pricing.ts (unrelated · protected)
- Track A · Fix 15/16/17 · existing verified coding loop · existing safety doctrine · existing streaming · existing native gateway · legacy consumer capabilities · Truth Engine (all frozen)
- The 11 nex1-orchestrator specialists (may READ their outputs · never modify their code)
- Any existing capability-*.ts under code-engine/ (may consume their outputs · never rewrite)

---

## §6 · Honest limits I need to name up-front

1. **First proof will be narrow.** Numeric-literal-in-return is a well-defined shape. The engine will only demonstrate generalisation in THAT shape. Extending to "string literal transformation" · "conditional logic changes" · "cross-module refactors" is separate work, not this batch.
2. **Counterexample search is bounded by the failure corpus.** If we've only seen 3 failures, the challenger has weak evidence for or against promotion. Solution: **REQUIRES_MORE_OBSERVATION** verdict when corpus < N.
3. **The generalisation policy V1 is my draft · founder-approved-required before I ship the validator.**
4. **NEX1 will not gain "general intelligence" from this.** It will gain "genuine pattern generalisation within one specific well-defined shape". Multiple shapes = multiple domain-scoped generalisation policies over time.
5. **This is honest capability growth · not AGI.** Consistent with your Continuous Learning Program memory: "finish line = self-sufficient across expanding range · NOT fixed pass rate".

---

## §7 · Before I write any code, I need your explicit go on:

1. **The 5 founder decisions in §4.** (I've recommended defaults · you approve or override.)
2. **The domain of first proof** (numeric literal in return) · approve or pick different narrow domain.
3. **Authorisation to create the 7 new files under `src/lib/nex-agent/generalisation/`.**
4. **Authorisation to add the LEARN-stage wire** (~15 LOC change to `native-programming-loop.ts`).
5. **Authorisation to create the Case A + Case B fixtures** under `data/nex1-generalisation-fixtures/`.

Once approved, the build order is:

```
Slice 1: policy V1 + store  (persist infrastructure)
Slice 2: extractor          (Case A run → CANDIDATE)
Slice 3: challenger         (counterexample search over failure corpus)
Slice 4: validator          (CANDIDATE + challenger result → VALIDATED/REJECTED per policy)
Slice 5: retriever          (given a new prompt · find applicable promoted rules)
Slice 6: applier + wire     (LEARN stage + Case B endpoint · full end-to-end)
Slice 7: negative-proof case (§17 · a case where the rule must NOT apply · verify honest refusal)
Slice 8: closure doctrine   (§25.1-25.13 · full acceptance evidence)
```

Each slice ships with real HTTP verification per prior discipline. The mission's §22 acceptance criteria (A through N) are checked at slice 6 and 7.

---

## §8 · What this audit does NOT do

- Does NOT modify any code.
- Does NOT claim NEX1 is close to general intelligence.
- Does NOT promise that autonomous generalisation will work — the mission itself says "if the answer is no, identify exactly where the pipeline stops" (§24).
- Does NOT invent a monolithic AI file. Every new module is small and single-purpose.
- Does NOT touch any protected file (pricing.ts, Track A, Fix 15/16/17, Truth Engine).

**Ready for your decision on §4 and §7 · then I start slice 1.**
