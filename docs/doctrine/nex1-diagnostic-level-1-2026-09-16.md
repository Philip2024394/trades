# NEX1 Diagnostic · Level 1 · Investigate-Only · 2026-09-16

**Founder-directed diagnostic experiment.** Master AI Engineer designed the probe · invoked NEX1's native endpoints · captured raw outputs verbatim · **did NOT solve the problem for NEX1** · **did NOT augment NEX1's output**. Report is 100% truthful — every claim below is either a direct quote from NEX1's runtime output or an observation about the presence/absence of a capability.

**Status:** READ-ONLY diagnostic · freeze intact · zero code changes · zero designation moves · zero G15/C1/C3 advancement

**Raw evidence:** `data/nex1-diagnostic-level-1/probe-receipt-2026-09-16.json` (13KB · full JSON)
**Probe script:** `scripts/nex1-diagnostic-level-1/probe.ts`

---

## §1 · The experiment

**Founder-supplied problem statement (verbatim · fed to NEX1 unmodified):**

> *"Programming missions are completing without the expected TypeScript, ESLint and Vitest verification evidence. Investigate why."*

**Correct answer (KNOWN to master_ai_engineer from prior audit · WITHHELD from NEX1):**

The verification bypass is at `src/lib/nex-cap/cap-spec-bridge.ts:607-619` — `buildProgrammingMissionBridge()` only queues `node-syntax` SpecialistInvocation, omitting tsc + eslint + vitest.

**Question tested:**

> *"Can NEX1 reason about a real coding problem and produce a correct resolution, even before we activate the C6 execution path?"*

**NEX1 endpoints invoked (native · zero-LLM · deterministic):**

1. `classifyFounderIntent()` — Capability A · founder intent classifier
2. `runNativeProgrammingLoop()` — NEX1's native investigate-and-fix loop
3. `createFileMemoryStore().listFiles()` — Capability M-1 · file memory listing
4. `createFileMemoryStore().recallFile()` — Capability M-1 · file memory recall for 3 relevant paths

---

## §2 · Verbatim NEX1 outputs

### 2.1 · Capability A · Founder Intent Classifier

Direct output (excerpted from receipt):

```
kind: "classified"
verb_family: "INVESTIGATE"
verb_family_confidence: 1.0
verb_hits: [ { family: "INVESTIGATE", variant: "investigate", span: "Investigate" } ]
deliverable_kind: "unclear"
deliverable_confidence: 0
coding_concepts:
  - { token: "typescript", category: "language", occurrences: 1 }
  - { token: "eslint",     category: "tool",     occurrences: 1 }
  - { token: "vitest",     category: "tool",     occurrences: 1 }
file_references: []
project_dir_references: []
requirement_phrases: []
domain_tokens: [programming, missions, completing, without, expected, verification]
ambiguities:
  - { kind: "low_deliverable_confidence", detail: "no deliverable phrase from the controlled vocabulary matched" }
  - { kind: "requirement_phrases_missing", detail: "no phrases matched the requirement marker set" }
overall_confidence: 0.6
reasoning_trace: [
  "goal_length=126",
  "token_count=15",
  "verb_hits_total=1 · per_family={INVESTIGATE:1}",
  "deliverable_no_match · kind=unclear",
  "file_references=0",
  "project_dir_references=0",
  "requirement_phrases=0",
  "coding_concepts=3 · by_category={language:1, tool:2}",
  "domain_tokens=6 · top=programming,missions,completing",
  "overall_confidence=0.6 = 0.45·1.000 + 0.25·0 + 0.15·domain(6) + 0.15·req(0)"
]
vocabulary_version: "v5.0.0-alpha.10"
```

### 2.2 · Native Programming Loop

Direct output (verbatim):

```
loop_id: "nex1-loop-mu41ktmj-qdv2rz"
overall_verdict: "CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM"
target_test_file: null
target_line: null
stages: [
  {
    stage: "understand",
    verdict: "NOT_IMPLEMENTED",
    summary: "no target file identifiable from goal without natural-language interpretation",
    reasoning_trace: [ "extracted 0 file references from goal" ]
  }
]
capability_gaps: [ "understand: no natural-language target extraction without LLM" ]
founder_summary: "UNDERSTAND could not identify a target file. Only deterministic file:line extraction is implemented. Natural-language target inference is CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM."
baseline_test_result: null
final_test_result: null
```

**One stage ran. The loop halted safely at UNDERSTAND.**

### 2.3 · File Memory · listFiles

Direct output — File Memory currently holds **7 entries** (none related to programming-mission verification):

| # | Path | Language | Tags | Summary |
|---|---|---|---|---|
| 1 | `src/lib/nex/reflex/reflex-brain.ts` | typescript | — | — |
| 2 | `src/lib/nex/agent.ts` | typescript | — | — |
| 3 | `src/lib/affiliateSession.ts` | typescript | — | — |
| 4 | `src/app/api/auth/trade/otp/verify/route.ts` | typescript | — | — |
| 5 | `src/lib/adminAuth.ts` | typescript | — | — |
| 6 | `src/lib/nex-agent/code-engine/capability-a-founder-intent/classifier.ts` | typescript | capability, classifier, v3 | Native founder-intent classifier (deterministic, zero LLM) |
| 7 | `package.json` | json | project-root | Thenetworkers workspace root manifest |

**Observation:** File Memory reflects prior arbitrary session activity — not curated for programming-mission or verification-pipeline context.

### 2.4 · File Memory · recallFile (3 targeted lookups)

Direct outputs:

| Path queried | Result |
|---|---|
| `src/lib/nex-cap/cap-spec-bridge.ts` (the actual bypass location) | `not_remembered` |
| `src/lib/nex1-orchestrator/wo7-run-specialist.ts` (the WO-07 real adapters) | `not_remembered` |
| `src/lib/nex-agent-runtime/programming-mission/mission.ts` (the mission runtime) | `not_remembered` |

**None of the three files most relevant to the problem exist in NEX1's file memory.**

---

## §3 · Truth-only capability-break map (founder's checklist)

Per §13 of the founder's diagnostic prompt · answered from NEX1's actual outputs only:

| NEX1 receives problem | Actual result | Evidence |
|---|---|---|
| Understands correctly? | **PARTIAL** | Intent verb correctly classified as `INVESTIGATE` (conf 1.0) ✅ · but only 3 tools extracted as vocab tokens · no problem model built · overall confidence 0.6 (below GOOD 0.85 threshold) |
| Finds correct evidence? | **NO** | `file_references=0` · `project_dir_references=0` · no repository search invoked · file memory contains 7 unrelated entries · none of the 3 relevant files present |
| Identifies root cause? | **NO** | Native Loop halted at UNDERSTAND · verdict `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` · zero diagnostic stages reached |
| Plans correctly? | **NO** | No plan produced · no `SpecialistInvocation` proposals emitted · no fix candidate identified |
| Produces correct code? | **N/A** | Level 1 explicitly forbids modification · not tested |
| Tests correctly? | **N/A** | Never reached test stage |
| Detects its own failure? | **YES** | Native Loop reported `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` verbatim · Capability A raised 2 ambiguity flags · overall_confidence dropped to 0.6 |
| Reports honestly? | **YES** | Zero fabricated files · zero invented diagnosis · zero fake evidence · loop halt is by design and explicitly named |

**Summary:** NEX1 correctly recognised the input as an INVESTIGATE-kind task and correctly extracted the three named tools (typescript · eslint · vitest) from the problem statement. Then it halted safely — reporting its own limitation rather than fabricating a diagnosis.

**NEX1 did NOT discover C3 on its own.** It could not reach the correct answer with its current native capabilities.

---

## §4 · What broke · precisely

### Break 1 · No natural-language → file-target bridge

**Verbatim NEX1 output:** `"UNDERSTAND could not identify a target file. Only deterministic file:line extraction is implemented. Natural-language target inference is CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM."`

**Location of the gap:** `src/lib/nex-agent/code-engine/native-programming-loop.ts` lines 140-197 · UNDERSTAND stage.

**What NEX1 does today:** regex-matches `foo.ts:123` patterns in the goal string. If none present, halts.

**What NEX1 cannot do today:** map from extracted `coding_concepts` (typescript · eslint · vitest) + `domain_tokens` (programming · missions · verification) to specific candidate files in the repository.

### Break 2 · No knowledge-substrate consultation at investigation time

**Verbatim NEX1 output:** File Memory contains 7 entries · none of them include the 3 files that would be needed to reach the correct diagnosis. `recallFile("src/lib/nex-cap/cap-spec-bridge.ts")` returned `not_remembered`.

**Location of the gap:** NEX1's classifier + native-loop never consult:
- File Memory (M-1) as a candidate-file source
- Native Code Understanding S2 (Stage 2 dep-graph) as a symbol/path resolver
- `nex.concepts` (44 rows live in nex_dev — verified prior · unused per prior interconnection audit gap C4)
- G16 traces (past mission outcomes)

**Even though these substrates exist, they are not wired to NEX1's investigation entry point.**

### Break 3 · No repository search primitive

Prior audit already found `grep is a developer tool, not native intelligence` (memory · agent-identity-audit 2026-09-16). This diagnostic confirms it operationally: NEX1 has **no deterministic repository-search primitive** it can invoke from the classifier/native-loop path to find files by extracted concept tokens.

### Break 4 · Investigation-mode absence in Native Loop

Native Loop's stages are: `understand → inspect (vitest) → reason → plan → change → test → diagnose → repair → verify → learn`. It is designed for **"here's a failing test at file:line, fix it"** — not for **"figure out where the problem is."**

**No investigation-mode exists.**

### Break 5 · Confidence signalling is honest but non-actionable

Capability A returned confidence 0.6 (below the 0.85 threshold from ADR-0027 Rule 6). It reported 2 ambiguity flags. **The signal was correct**, but there is no downstream consumer that receives this signal and requests founder clarification or offers a follow-up question.

### Break 6 · File-memory content is not curated

The 7 entries in File Memory are from arbitrary prior activities. There is no policy that ensures files relevant to NEX1's own capability paths (programming-mission · verification · orchestration) are pre-memorised.

---

## §5 · Suggested fixes to NEX1 (per founder directive · "if any fail suggest what needs fixing")

Ranked by leverage (highest first) · none authorised · founder-decision required for each.

### Fix 1 · Add Investigation Mode to Native Loop (highest leverage)

**What:** A new mode alongside `vitest` and `tsc` — call it `investigation`. Inputs: classifier output. Behaviour:
1. Take verb=INVESTIGATE proposals
2. Use extracted coding_concepts + domain_tokens as search terms
3. Call a deterministic repository-search primitive
4. Return a **candidate-list envelope** (not a fix envelope) — files, symbols, line ranges likely relevant
5. Honest confidence band on each candidate

**Why largest leverage:** unlocks NEX1's ability to answer any "why is X happening" question without fabrication.

**Complexity:** MEDIUM. Requires Fix 3 (search primitive).

### Fix 2 · Wire NEX1 classifier → `nex.concepts` retrieval (prior audit's C4)

**What:** extend classifier to annotate `coding_concepts` with `concept_id` from `nex.concepts` (44 rows live in nex_dev). Then `evidence` chains + `contexts` become traversable at mission-draft time.

**Why:** the vocab match `{typescript, eslint, vitest}` should immediately hydrate to concept metadata (canonical_key · sense_id · surface signals · known ADRs). That gives NEX1 a starting corpus of relevant knowledge instead of nothing.

**Complexity:** LOW-MEDIUM. Read-only DB query + join. Prior interconnection audit rank #5.

### Fix 3 · Add deterministic repository-search primitive to NEX1 native

**What:** a `nex1SearchRepo({ tokens, path_prefix?, extensions? }): SearchResult` function callable from Capability A and native-loop. Uses:
- Existing dep-graph (Native Code Understanding S2)
- File Memory as fast index (Fix 4)
- Filesystem walk (bounded)

**Why:** grep is a developer tool. NEX1 currently has no equivalent native primitive. This is the missing organ that turns "concept tokens" into "file candidates".

**Complexity:** MEDIUM. Deterministic. Bounded. Must respect protected paths.

### Fix 4 · Pre-populate File Memory with programming-mission surface

**What:** on initialisation, `rememberFile()` all files under:
- `src/lib/nex1-orchestrator/**`
- `src/lib/nex-agent-runtime/programming-mission/**`
- `src/lib/nex-cap/**`
- `src/lib/nex-agent/code-engine/**`
- Every `WO-*` test file

Tag each with `system-file` and appropriate capability tag (`orchestrator`, `programming-mission`, `cap-spec`, etc.)

**Why:** File Memory recall becomes usable for investigation. Currently 7 arbitrary entries · none relevant to programming-mission.

**Complexity:** LOW. One-time seed script. No new capability required.

### Fix 5 · Wire confidence-band signal to founder-clarification path

**What:** when overall_confidence < 0.85 or ambiguity_flags.length > 0, native-loop / mission-draft should emit a `NeedsFounderClarification` envelope with specific questions ("Which module do you mean?" · "Which test suite?").

**Why:** the honest signal is emitted but ignored. Downstream consumers should treat sub-GOOD confidence as a request for input, not silent proceed.

**Complexity:** LOW. Wiring only. NCP envelope (per Cognitive-Layer Brief).

### Fix 6 · Concept→file trigram/index (bridging Fix 2 and Fix 3)

**What:** for each concept in `nex.concepts`, maintain an index of files that reference tokens for that concept. Rebuilt on Git commit (or via manual `--reindex` command).

**Why:** turns Capability A's concept extraction directly into a file-candidate list without a full repository walk.

**Complexity:** MEDIUM. Deterministic. Cache maintenance.

### Fix 7 · Sentry/Archivist/Critic/Dependency-Analyst (deferred)

The Cognitive-Layer Brief specifies four specialists (NEX-13/14/15/16) that would each address parts of this diagnostic. Not authorised for build yet · deferred until C6-C1-C3 chain proven. Explicitly noted here so the founder can see how the diagnostic maps to the earlier design brief.

---

## §6 · Doctrinal implications

### 6.1 · The zero-LLM constitution is honoured

NEX1 refused to fabricate. It did NOT invent a file path. It did NOT hallucinate a fix. It reported `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM` — the honest verdict. This is exactly the founder-locked doctrine working correctly.

### 6.2 · Undercount Protection Rule is validated

Prior to this probe I could have said "NEX1 can investigate problems" based on the existence of Native Loop. Direct inspection shows Native Loop only works when given a specific `file:line`. **Undercount Protection Rule applies: architecture ≠ capability, but presence of an endpoint ≠ presence of a working investigative capability.**

### 6.3 · Connect-Before-Build Principle · new evidence

Multiple existing components could power an investigation mode:
- **Native Code Understanding S2** (dep-graph) — exists · not consulted
- **File Memory** (M-1) — exists · under-populated · not queried at investigation time
- **`nex.concepts`** (44 rows) — live in DB · not consulted (prior C4 gap)
- **G16 traces** — persisted · not surfaced as prior-mission memory

**The organs exist. The wires do not.** Fix 1 through Fix 6 above are largely **connection work**, not build work.

### 6.4 · Prove-Before-Progression is armed

This diagnostic **did NOT advance any truth-state**. G15 remains `COMPONENT_COMPLETE · SYSTEM_NOT_ACTIVATED`. C1 and C3 remain deferred. Native Loop remains `PARTIAL for vitest/tsc modes · investigation mode NOT_FOUND`. Every capability keeps its earned classification.

---

## §7 · What this diagnostic proves (positive findings)

| Claim | Evidence |
|---|---|
| NEX1 correctly classifies task intent | verb_family=INVESTIGATE at confidence 1.0 |
| NEX1 correctly extracts named tools | typescript / eslint / vitest recognised as concepts |
| NEX1 correctly counts what it doesn't know | file_references=0 · project_dir_references=0 |
| NEX1 correctly reports uncertainty | overall_confidence=0.6 · 2 ambiguity flags |
| NEX1 refuses to fabricate | Native Loop halted at UNDERSTAND · returned CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM |
| NEX1 honours zero-LLM constitution | no LLM invoked · no hallucinated file · no fake diagnosis |
| NEX1's file-memory reports honestly | recall returned `not_remembered` for 3 relevant files instead of fabricating |

## §8 · What this diagnostic proves (negative findings)

| Claim | Evidence |
|---|---|
| NEX1 cannot investigate abstract problems | Native Loop halted without target file · no fallback investigation mode |
| NEX1 has no repository-search primitive | grep is developer tool · not exposed as NEX1 capability |
| NEX1 does not consult `nex.concepts` at mission time | prior audit + this diagnostic — no concept lookup path |
| NEX1's File Memory is not curated for its own runtime | 7 arbitrary entries · none of the 3 relevant files present |
| NEX1's honest-uncertainty signal has no downstream consumer | confidence 0.6 emitted · nothing catches it and offers founder clarification |
| NEX1 cannot bridge concept tokens to files | typescript/eslint/vitest extracted · no file candidates generated |

---

## §9 · Founder decisions triggered

| # | Decision | Options |
|---|---|---|
| **DL1-1** | Accept the truth-only diagnostic findings | YES · REVISE · NO |
| **DL1-2** | Which fix set (1-6) to advance first | Founder-only priority |
| **DL1-3** | Whether Fix 1 (Investigation Mode) is authorised as a separate Work Order — independent of C6-C1-C3 chain, since it doesn't touch execution/authority | YES · NO · DEFER (recommend defer until C6-C1-C3 chain proven, per Connect-Before-Build) |
| **DL1-4** | Level 2 diagnostic — hand NEX1 a real coding problem WITH authorisation to modify code, restricted execution boundary | YES · NO · schedule after C6 |
| **DL1-5** | Level 3 diagnostic — deliberately difficult multi-file problem | YES · NO · schedule later |
| **DL1-6** | Ratify the diagnostic pattern (raw output only · no augmentation · truthful capability-break map) as durable testing discipline | YES · REVISE · NO |

---

## §10 · What this report does NOT do

- Does NOT solve the WO-07 verification bypass (that is C3 · deferred)
- Does NOT modify any NEX1 code
- Does NOT populate NEX1's file memory
- Does NOT wire `nex.concepts` retrieval
- Does NOT authorise Fix 1-6
- Does NOT advance any capability's truth-state
- Does NOT feed NEX1 the answer that master_ai_engineer knows
- Does NOT commit or push
- Does NOT change env or designations
- Does NOT open Gate 3 or advance G15
- Does NOT count NEX1 as having "attempted" C3 — this was a diagnostic probe, not an authorised implementation

---

## §11 · Final truth statement

**Question asked:** Can NEX1 reason about a real coding problem and produce a correct resolution, before we activate the C6 execution path?

**Answer, evidence-cited:**

**NO — not for this class of problem (abstract natural-language investigation).**

- NEX1 correctly recognised the intent (INVESTIGATE) and extracted the relevant tool tokens (typescript · eslint · vitest)
- NEX1 correctly reported its own uncertainty (confidence 0.6 · 2 ambiguity flags)
- NEX1 correctly halted rather than fabricate a fix
- NEX1 could NOT bridge from concept tokens to file candidates
- NEX1 has no repository-search primitive
- NEX1 does not consult its own knowledge substrate at investigation time
- NEX1's Native Programming Loop is bounded to `vitest` / `tsc` modes with explicit `file:line` targets — there is no `investigation` mode

**The zero-LLM constitution is preserved by NEX1's honest refusal.** This is the correct behaviour for an evidence-only intelligence system faced with a task outside its current capability envelope.

**The correct next step is not to blame NEX1 for failure — it is to identify the missing wires (Fix 1-6 above) that would convert the honest refusal into a genuine investigation capability, using components that mostly already exist.**

---

**End of Level 1 diagnostic · freeze intact · no code changes · no truth-state advancement · founder-only decisions queued (DL1-1 through DL1-6).**
