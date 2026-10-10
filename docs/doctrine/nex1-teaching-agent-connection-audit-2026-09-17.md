# NEX1 Teaching Agent · Connection Audit

**Date:** 2026-09-17
**Authority:** Founder-authored doctrine (20 sections) · this audit fulfills §18.
**Type:** READ-ONLY. Zero source modifications. Zero production behaviour change.
**Author:** master_ai_engineer (Claude Opus 4.7)
**Successor gate:** §19 · implementation is BLOCKED until founder explicitly authorizes.

---

## 1 · Free / sidelined agents · candidates for conversion

Ranked by fit for the Teaching Agent role.

| Rank | File | Current role | Live consumers | Fit |
|---|---|---|---|---|
| **1** | `src/lib/nex-agent/learning-ledger.ts` | Skill leveling + pattern/anti-pattern tracking. Persists to `data/nex1-learning/ledger.json`. | **NONE in active task flow** — defined + fully implemented but no orchestrator invocations. | **HIGH** — already models exactly what a Teaching Agent needs (skills · patterns · anti-patterns · reuse counts · timestamps). Convertible with wiring alone, no new subsystem. |
| 2 | `src/lib/nex-agent/adversarial-corpus.ts` | Training corpus for stress-testing NEX1 with intentionally broken code. | None in coding pipeline. | Medium — useful FOR the Teaching Agent (as a probe source), not AS it. |
| 3 | `src/lib/nex-agent/seo-agent.ts` | Deterministic SEO suggestion engine. | Test-only. | Low — domain mismatch (SEO copy, not code teaching). |
| 4 | `src/lib/nex-agent/error-guardian.ts` | Message picker (positive/clear phrasing). | Test-only. | Low — text stylistics, not engineering knowledge. |
| 5 | `src/lib/nex-agent/provider-catalog.ts` | Defined; zero references outside its own file. | None. | Low — infra, not knowledge. |
| 6 | `src/lib/nex-agent/playbook.ts` | Playbook validator. Used only by `/api/nex/agent/playbooks/route.ts` (isolated endpoint). | Isolated. | Medium — validator surface could hold teaching-lesson schemas. |

**Recommendation for founder decision:** convert `learning-ledger.ts` (Rank 1). It is already the shape the Teaching Agent needs and is not consumed anywhere in the live task flow. Conversion is a wiring exercise, not a new subsystem — which the doctrine (§4) explicitly rewards.

---

## 2 · Agent registry

**File:** `src/lib/nex-agent/code-engine/registry.ts:1-83`

**Structure:** `Map<string, Nex1ReasoningAdapter>` (line 21) with a priority ordering (line 22).

**Per-adapter fields:**
- `id: string`
- `deterministic: boolean` (line 37) — deterministic adapters last in priority
- `isAvailable(): Promise<boolean>` (line 54)
- `supports(intent: Nex1IntentKind): boolean` (line 56)

**Bootstrap:** `TemplateOnlyAdapter` registered at construction (line 26).

**Gap for Teaching Agent:** the registry types adapters as *reasoning* adapters. A Teaching Agent is a *knowledge producer*, not a reasoning adapter. It either needs a sibling registry OR the existing registry needs a `role: "reasoning" | "teaching" | "validation"` field. Founder decision required (§19 anchor #2).

---

## 3 · Knowledge / learning ledger

**File:** `src/lib/nex-agent/learning-ledger.ts:1-100`

**Storage:** filesystem JSON at `data/nex1-learning/ledger.json` (line 53).

**Existing schema:**
```typescript
SkillEntry {
  skill; level: "bronze"|"silver"|"gold"|"mythic";
  xp: 0-100; successes; failures; lastExercisedAt;
}
PatternEntry {
  id: sha256; title; skills[];
  capturedAt; taskId; reusedCount;
}
AntiPatternEntry {
  id; title; rejectionCode;
  capturedAt; taskId; avoidedCount;
}
LearningLedger {
  skills: Record<>; patterns: []; antiPatterns: [];
  lastUpdated;
}
```

**Existing API:** `loadLedger()` line 58 · `saveLedger()` line 65 · `recordSkillSuccess()` line 72 · `recordSkillFailure()` line 91.

**Doctrine §5 required lesson fields · overlap analysis:**

| §5 field | Present? | Where |
|---|---|---|
| LESSON_ID | ⚠ Partial | `PatternEntry.id: sha256` |
| TITLE | ✓ | `title` |
| DOMAIN | ✗ | not tracked |
| OBSERVATION | ⚠ Partial | derivable from title |
| SOURCE_EVIDENCE | ⚠ Partial | `taskId` link only |
| EVIDENCE_SCOPE | ✗ | not tracked |
| WHAT_IT_TEACHES | ✗ | not tracked |
| WHY_IT_MATTERS | ✗ | not tracked |
| REUSABILITY | ⚠ Partial | `reusedCount` (numeric only) |
| LIMITATIONS | ✗ | not tracked |
| COUNTER_EVIDENCE | ✗ | not tracked |
| NEX3_VALIDATION_REQUIRED | ✗ | not tracked |
| PROMOTION_STATUS | ✗ | not tracked (§5 vocab: CANDIDATE / UNDER_REVIEW / NEX3_VALIDATED / PROMOTED / REJECTED / SUPERSEDED) |
| RELATED_AGENTS | ✗ | not tracked |
| RELATED_NEX1_CAPABILITY | ⚠ Partial | `skills[]` array closest |

**Delta to §5:** need 9 additional fields per lesson + 6-state promotion vocabulary. Implementable as a schema extension without a new file.

---

## 4 · NEX3 validation mechanism

**File:** `src/lib/nex-agent/core/architecture-guardian.ts`

**Existing functions:**
- `scanTruthEngineGuard(touched_paths[]): SecurityFinding[]` — protected-path scan.
- `scanSecurity()` — secrets/PII/credential leak scan.
- `runMergeGate()` — final decision returning `{ can_merge: boolean; findings: SecurityFinding[] }`.

**NEX3 review result shape:** `orchestrator-types.ts:36-42` — `ReviewResult { pass: boolean; findings[]; reviewer: "nex3"; round: number }`.

**Delta to §7 (Teaching Agent → NEX3 validation loop):** the existing NEX3 gate validates CODE CHANGES · not LESSONS. A lesson-validation surface (`validateLesson(lesson): ReviewResult`) does not exist. Would need:
1. New function on NEX3 that reads a lesson's SOURCE_EVIDENCE + COUNTER_EVIDENCE fields and returns a validation verdict.
2. Storage of the validation result on the lesson record itself.
3. Boundary rule: NEX3 checks evidence sufficiency ONLY · it does not decide if the lesson is "correct" in the abstract (§7 explicit rule).

---

## 5 · Corpus analysis infrastructure

**File:** `src/lib/nex-agent/code-engine/capability-repo-onboarding.ts:1-100`

**Function:** `onboardRepository(input): Promise<OnboardingResult>`

**Event kinds emitted:** `started · path_resolved · size_computed · code_types · framework_detected · package_details · scan_error · scan_summary · restructure_suggestion · readme_summary · notable_signal · ready_for_prompt · onboarding_denied`.

**Sandbox:** refuses anything outside `data/nex-training-corpus/` (helper `isInsideCorpus()` at line 85).

**Consumers built earlier in this session:**
- `src/app/api/nex1/workstation/onboard/route.ts` (POST + SSE)
- `src/app/api/nex1/workstation/repo-media/route.ts` (GET · image/video/html/pdf enumeration)
- `src/app/nex1/workstation-live/agent/RepoOnboardPanel.tsx` (UI consumer)

**Delta for Teaching Agent:** the onboarding output is already emitted as structured events. Feeding those events into the lesson-generator is a wiring exercise (§4 "connect not rebuild"). Corpus safety scan artefacts live at `data/nex-training-corpus/_scans/*.json`.

---

## 6 · Trace / evidence infrastructure

**Storage:** Postgres · `nex_agent.task_steps` table.

**Emission:** `orchestrator.ts:121-126` — `emitStep(taskId, actor, step_kind, title, body?)`.

**Schema:** `task_id` FK · `actor: "nex1"|"nex2"|"nex3"|"founder"|"system"` · `step_kind: string` (check constraint enforces vocabulary — see below) · `title` · `body` JSONB · auto-timestamped.

**Step-kind vocabulary constraint:** the `task_steps_step_kind_check` DB check constraint restricts allowed values. During this session I discovered by real HTTP that `orchestrator_status` is rejected (session log 2026-09-17 04:53). Existing allowed kinds include `thought · handoff · question · plan · review · applying · applied · file_written · classify · revision · consensus`.

**Delta for Teaching Agent:** if lessons are emitted as trace steps, need to either (a) reuse `thought` or (b) migrate the check constraint to add `lesson_proposed · lesson_validated · lesson_promoted · lesson_rejected`. **(b) requires a database migration · founder must confirm before applying.**

---

## 7 · Orchestration assignment

**File:** `src/lib/nex-agent/core/orchestrator.ts:1-150`

**Model:** multi-round debate. NEX1 classify+plan → NEX2 architecture scan → NEX3 doctrine scan → consensus check → founder gate.

**No dispatcher · no dynamic agent assignment · no capability-based routing.** Agents are hard-coded participants (NEX1/2/3).

**Delta for Teaching Agent:** to make the Teaching Agent "assigned when relevant" (§9), orchestrator needs a lightweight capability query: `whichAgentsAreRelevantForTask(intent): AgentId[]`. This does NOT require the full 40+ agent orchestration (§10, which is NOT-YET-IMPLEMENT). It requires ONE new function that returns `["teaching"]` when the task matches Teaching Agent triggers (unfamiliar pattern · refactoring · repeated problem · corpus pattern applicable · previous NEX1 failure has a lesson · etc.).

---

## 8 · Agent-to-agent communication

**Finding:** **NO event bus. NO shared queue. NO message broker.**

All communication is synchronous function composition. Example: `capability-h-planning.ts:27-28` imports `capability-f-discovery.ts` directly. Orchestrator calls `generateProposedFiles()`, `analyseADRImpact()` in sequence.

**Delta for Teaching Agent:** the doctrine §8 shape `AGENT → TEACHING AGENT → NEX3 → NEX1 → AGENTS` does not exist infrastructurally today. The minimum wire needed is a shared write-append surface (the learning ledger extended per §3 delta). Agent-to-agent teaching does NOT require a message broker if lessons are written to and read from the ledger.

---

## 9 · Runtime trace schema

**Fields per step:**
- `task_id: string`
- `actor: "nex1"|"nex2"|"nex3"|"founder"|"system"`
- `step_kind: string` (check-constrained)
- `title: string`
- `body: JSONB | null`
- `created_at: timestamptz` (auto)

**Existing step-kind taxonomy (grep of `emitStep` callers):** `classify · plan · thought · handoff · question · architecture_review · doctrine_review · revision · consensus · founder_decision · approved · failed · review_fail · applying · applied · file_written`.

**Gap for §10 (agent-utilization test):** current traces do not carry a `assigned_because: string` or `capability_contribution: string`. To prove "the agent was selected · why · what it contributed" (§10), each Teaching Agent step needs these two extra body fields. Doctrine change to `emitStep` body convention (not schema).

---

## 10 · Existing coding capabilities inventory (context for §4 · "do not duplicate")

**41 deterministic capabilities identified.** Full list in the subagent report. Highlights relevant to a Teaching Agent:

- `capability-a-founder-intent/` — intent classification
- `capability-f-discovery.ts` — file symbol discovery
- `capability-h-planning.ts` + `capability-h3-multigoal-planning.ts` — planning
- `capability-source-inspection.ts` — read-only source analysis
- `capability-observed-chains.ts` · `capability-chain-narrative-emitter.ts` · `capability-chain-relationship-*` — pattern extraction from code
- `capability-root-cause-hypothesis-generator.ts` · `capability-hypothesis-evidence-evaluator.ts` — evidence-based reasoning
- `capability-candidate-comparator.ts` · `capability-candidate-ranker.ts` · `capability-candidate-selector.ts` — Q7/Q8
- `capability-repository-discovery.ts` · `capability-repo-onboarding.ts` — corpus analysis
- `capability-specification-extractor.ts` · `capability-specification-driven-loop.ts` — spec-driven coding

**Read this way:** the Teaching Agent does NOT need to build pattern extraction · chain analysis · hypothesis evaluation · candidate ranking. Those exist. The Teaching Agent COMPOSES them into lesson records validated by NEX3 (§7).

---

## §19 IMPLEMENTATION GATE · required founder decisions

The doctrine §19 says: "After the audit, stop. Do not implement the Teaching Agent until the audit identifies: exact agent being converted, exact registry connection, exact orchestration connection, exact knowledge input, exact lesson output, exact NEX3 validation boundary, exact persistence location, exact runtime assignment mechanism, exact tests."

**Nine anchors · state as of this audit:**

| # | Anchor | State | Decision needed |
|---|---|---|---|
| 1 | Exact agent being converted | **Candidate identified: `learning-ledger.ts`** | Founder: approve · pick another · request another audit round |
| 2 | Exact registry connection | Registry types adapters as *reasoning*. Teaching is a distinct role. | Founder: add `role` field to existing registry · create sibling teaching-registry · other |
| 3 | Exact orchestration connection | No dispatcher exists. New `whichAgentsAreRelevantForTask()` function needed. | Founder: approve the shape of that function |
| 4 | Exact knowledge input | Available inputs: (a) trace steps from `nex_agent.task_steps`, (b) corpus onboarding events, (c) receipts under `data/nex1-*`, (d) doctrine files under `docs/doctrine/`. | Founder: which subset is the Teaching Agent authorized to read? |
| 5 | Exact lesson output | §5 defines 15 fields. Learning ledger has ~6 today. | Founder: approve full 15-field schema or reduced starter set |
| 6 | Exact NEX3 validation boundary | `validateLesson(lesson)` does not exist. Requires new NEX3 surface. | Founder: authorize new NEX3 lesson-validation function |
| 7 | Exact persistence location | Existing `data/nex1-learning/ledger.json` OR new `data/nex1-teaching/lessons.jsonl`. | Founder: reuse existing file or isolate |
| 8 | Exact runtime assignment mechanism | Currently none. Needs `whichAgentsAreRelevantForTask()` + trigger rules from §9. | Founder: approve trigger rule set |
| 9 | Exact tests | Not designed yet. Should include: negative controls (agent NOT selected when irrelevant) · agent-utilization test (§10) · NEX3 rejection path · re-verification path (§17). | Founder: approve test set before implementation |

---

## Non-goals confirmed HOLD (per founder's own text)

- 40+ agent orchestration — **NOT YET IMPLEMENT**
- Agent-to-agent teaching wire — **NOT YET IMPLEMENT**
- NEX Twin / NEX2 / NEX3 orchestration — **NOT YET IMPLEMENT**
- Truth Engine — **ARCHITECTURE_ONLY** (per memory: ADR-0314 Gate 3 CLOSED)
- Speculative NL subsystem — **NOT YET IMPLEMENT**
- Batch 3D — **BLOCKED** on Batch 2B B/C/D re-verification

## Non-goals confirmed READY (already authorized · separate batches)

- Batch 3A Signal Preservation (narrow · 5-connection-point boundary) · **APPROVED**
- `setThreadGoal` hygiene mutator · **APPROVED**

---

## What this audit did NOT touch

- Zero source-code files modified
- Zero database migrations run
- Zero endpoints altered
- Zero registry changes
- Zero tests run
- Zero corpus files read (only structure inspected)
- Zero external LLM calls
- Zero commits · zero pushes

The workstation at `http://localhost:3008/nex1/workstation-live` is UNCHANGED by this audit.

---

## Founder next step

Answer the 9 §19 anchors above (or accept the recommendations in each row). Once anchored, implementation can proceed in ONE small independently-verifiable batch:

1. Extend `learning-ledger.ts` schema with the 9 missing §5 fields + 6-state promotion vocabulary.
2. Add `role: "reasoning" | "teaching" | "validation"` to the adapter registry.
3. Add `whichAgentsAreRelevantForTask()` in orchestrator (returns `["teaching"]` only for §9 triggers).
4. Add `validateLesson(lesson)` on NEX3 (evidence-sufficiency check only).
5. First real test: NEX1 finishes a coding task → Teaching Agent proposes ONE candidate lesson → NEX3 validates or rejects → observable in trace.

That is the smallest independently-verifiable slice. Nothing broader ships until it is RUNTIME_VERIFIED.
