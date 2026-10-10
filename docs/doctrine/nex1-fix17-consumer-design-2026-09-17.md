# NEX1 · Fix 17 · Q8 Consumer Design + Authorization Preparation

**Date:** 2026-09-17
**Authorization:** Founder Fix 17 Consumer Design prompt · **DESIGN / INVESTIGATION ONLY** · no implementation
**Baseline:** Q8 Downstream Consumer Audit (2026-09-17) established `PRODUCTION CONSUMER: NOT FOUND` after Fix 16.
**External model:** NONE
**Production code changes:** 0
**Track A:** FROZEN
**Commits:** 0 · **Pushes:** 0

This document proposes NO consumer. It surfaces options α · β · γ · ε neutrally for founder decision.

---

## A · Current State

```
Q8:                      COMPONENT_COMPLETE
                         (Fix 16 · RUNTIME_VERIFIED in isolation · 24/24 verifier cases)

Production consumer:     NOT FOUND
                         (grep `runInvestigation` / `InvestigationEvidencePacket` in src/: 1 file each = definition only)
                         (grep `candidate_selection` in src/app/: 0 matches)

Reporting:               NOT FOUND
                         (no API route invokes runInvestigation; no report emitter reads packet)

Persistence:             NOT FOUND
                         (native-investigation-mode.ts contains ZERO writeFile/persist/save calls; grep verified)

Next action:             NOT FOUND
                         (no code reads selection_state; no loop consumes REQUIRE_MORE_INVESTIGATION)

Authority boundary:      Q8 has SELECT-only authority (Fix 16 Q8-N12/N13/N14/N15 verified)
                         MODIFY / EXECUTE / AUTHORIZE / VERIFY / DEPLOY all remain outside Q8

External model:          NONE (Q8-N10 verified; no LLM imports)

Fix 15 / Fix 16:         RUNTIME_VERIFIED and UNCHANGED by this design task
```

---

## B · Actual Data Flow

### Currently proven path (as-is)

```
Founder Problem (natural-language string)
         │
         ▼
[ NO PRODUCTION API ENTRY POINT — pipeline runs only when test scripts invoke it ]
         │
         ▼
runInvestigation()   ← src/lib/nex-agent/code-engine/native-investigation-mode.ts
         │
         ├── ACTION 1..4   (classifier · file memory · observer · dep graph)
         ├── ACTION 6      (source_inspections · OBSERVED)
         ├── ACTION 7..10  (chains · narratives · relationships · compositions)
         ├── ACTION 11     (root_cause_candidates · HYPOTHESIS)
         ├── ACTION 12     (hypothesis_evaluations · INFERRED · 4 states)     ← Fix 13
         ├── ACTION 13     (candidate_comparisons · INFERRED)                 ← Fix 14
         ├── ACTION 14     (candidate_rankings · INFERRED · rank_position)    ← Fix 15
         ├── ACTION 15     (candidate_selection · INFERRED · 6-state)         ← Fix 16
         ├── ACTION 5      (absence analysis · unrelated to Q8)
         └── ASSESS + finalise
                 │
                 ▼
      InvestigationEvidencePacket
      (includes candidate_selection[])
                 │
                 ▼
       runInvestigation() returns to caller
                 │
                 ▼
       [ TERMINATES · read only by 23 test-probe scripts ]
```

### Potential future paths (illustrative · not selected)

Each option below joins at the `[TERMINATES]` point above · none re-enters or modifies the current pipeline. Presented separately in §D.

---

## C · Existing Consumer Inventory (evidence-based · direct file inspection)

Below is every existing NEX1 component that could plausibly consume `InvestigationEvidencePacket` and its actual state today.

### C-1 · `runInvestigation` (producer)

| Field | Value |
|---|---|
| Component | Investigation pipeline entry point |
| File | `src/lib/nex-agent/code-engine/native-investigation-mode.ts` |
| Function | `runInvestigation(input: RunInvestigationInput): Promise<InvestigationEvidencePacket>` |
| Current purpose | Pipeline producer · runs ACTION 1..15 |
| Current input | RunInvestigationInput (problem_statement · repo_root · mission_id · store) |
| Current output | `Promise<InvestigationEvidencePacket>` |
| Can consume its own output? | N/A (it IS the producer) |
| Current callers | 23 test-probe scripts · 0 production callers |

### C-2 · nex1-orchestrator (WO-1..WO-13 workflow engine)

| Field | Value |
|---|---|
| Component | Workflow state machine · founder-in-the-loop decision handler |
| Files | `src/lib/nex1-orchestrator/*.ts` (38 files) · `src/app/api/nex1/orchestrator/{submit,decision,trace}/route.ts` |
| Key functions | `submitWorkflow(SubmitInput)` · `applyFounderDecision(DecisionInput)` · `getTrace(trace_id)` · `saveTrace` |
| Current purpose | 13-stage workflow (WO-1 idempotency · WO-2 authorization · WO-3 challenger · WO-4 manifest builder · WO-5 executor · WO-6 runtime · WO-7 run-specialist · WO-8 persist · WO-9 diagnoser/corrector · WO-11 three-page-app · WO-13 attestation) |
| Current input | SubmitInput.raw_request (string · founder-authored) |
| Current output | WorkflowTrace |
| Currently imports `runInvestigation`? | ❌ NO (grep confirmed) |
| Can consume `InvestigationEvidencePacket`? | **PARTIAL** · orchestrator has trace-store persistence + founder-decision API pattern · but the WorkflowTrace type is not currently shaped to receive investigation data |
| Track A intersection | **YES** · WO-2 auth store · WO-4 manifest · WO-5 executor · WO-13 attestation involve authority · execution · signing (per audit history) |
| Connection feasibility | HIGH · but authority intersection requires caution |
| Authority implications | If Q8 output feeds any WO-4 / WO-5 / WO-13 stage · SELECTED could become MODIFY / EXECUTE / AUTHORIZE. Direct violation of Q8 policy §2.20 (Decision 17). |
| **Verdict** | Cannot be connected in Fix 17 without crossing Q8's SELECT-only boundary. Would require a separate authorization contract. |

### C-3 · native-programming-loop

| Field | Value |
|---|---|
| Component | End-to-end coding-task composition |
| File | `src/lib/nex-agent/code-engine/native-programming-loop.ts` · exposed via `POST /api/nex1/native-loop/run` |
| Key function | `runNativeProgrammingLoop(input: NativeLoopInput): Promise<...>` |
| Current purpose | UNDERSTAND → INSPECT → REASON → PLAN → CHANGE → TEST → DIAGNOSE → REPAIR → VERIFY → LEARN pipeline for coding tasks |
| Current input | NativeLoopInput (founder_goal · target_test_file · target_line · mode) |
| Currently imports `runInvestigation`? | ❌ NO (grep confirmed) |
| Can consume `InvestigationEvidencePacket`? | **PARTIAL** · has a LEARN stage that records to nex-code-brain · but its domain is CODE FIX not investigation-conclusion · adopting it would blur domains |
| Track A intersection | Includes CHANGE stage (`writeFileSync` used in loop) · **crosses MODIFY authority** |
| Authority implications | Same as C-2 · CHANGE → MODIFY authority · Q8 SELECT ≠ MODIFY |
| **Verdict** | Cannot be connected in Fix 17 without violating Q8 policy §2.20. Different domain. |

### C-4 · nex-code-brain (append-only knowledge store)

| Field | Value |
|---|---|
| Component | Advisory knowledge JSONL ledger |
| File | `src/lib/nex-code-brain/knowledge-store.ts` · `feed.ts` · `brain.ts` |
| Key function | `addKnowledgeEntry(input: AddEntryInput): { ok, entry_id }` |
| Current purpose | Append-only JSONL of coding knowledge (patterns · anti-patterns · fix-recipes · conventions · framework-notes · gotchas) |
| Current input | `AddEntryInput` with `kind ∈ ["pattern","anti-pattern","fix-recipe","convention","framework-note","gotcha"]` |
| Current output | entry_id + append to `data/nex-code-brain/knowledge/entries.jsonl` |
| Currently accepts investigation-conclusion kind? | ❌ NO (grep confirmed) |
| Can consume `InvestigationEvidencePacket`? | **PARTIAL** · pattern reusable (append-only JSONL) · but current `kind` enum does not include `investigation-conclusion` |
| Track A intersection | ❌ NO (explicitly declared "no Ed25519 signature · advisory only") |
| Authority implications | Read-only from Q8's perspective · writes to advisory JSONL · zero MODIFY/EXECUTE authority |
| **Verdict** | HIGH feasibility for **γ · PERSISTENCE**. Could either extend `AllowedKinds` OR use a parallel JSONL file. No authority conflict. Minimum touch. |

### C-5 · Fix 15 / Fix 16 receipt pattern

| Field | Value |
|---|---|
| Component | JSON receipt emission from verifier probes |
| Files | `scripts/nex1-fix15-verification/probe.ts` · `scripts/nex1-q8-verification/probe.ts` |
| Pattern | `writeFileSync(receipt_path, JSON.stringify(receipt))` at end of probe |
| Current purpose | Runtime evidence receipt of verifier runs |
| Currently invoked by production? | ❌ NO (probes are `scripts/` · not production code) |
| Can be extended to persist Q8 output from `runInvestigation` runs? | **YES pattern-wise** · but the pattern currently lives in probe scripts · not production capabilities |
| Track A intersection | ❌ NO |
| Authority implications | Write-to-file only · same domain as C-4 |
| **Verdict** | Reusable pattern for γ · PERSISTENCE. Could be lifted from probe script into a production emitter · but this is `BUILD` not `CONNECT`. |

### C-6 · API surface `src/app/api/nex1/`

| Field | Value |
|---|---|
| Existing routes | orchestrator · workstation-live · native-loop · intent · file-memory · builder · controlled-hands |
| Route that invokes `runInvestigation` | ❌ NONE (grep verified) |
| Route that returns `InvestigationEvidencePacket` | ❌ NONE |
| Nearest analogue | `POST /api/nex1/native-loop/run` (returns loop result) · `POST /api/nex1/orchestrator/submit` (returns trace) |
| Pattern reusable? | YES · both routes follow the same shape · JSON body in · NextResponse.json out · zero authority · zero execution |
| **Verdict** | Empty CONSUMER slot · a new API route (e.g. `POST /api/nex1/investigate/run`) would be a small BUILD (~50 LOC) matching existing patterns · required for **α · REPORTING**. |

### C-7 · nex-debugger

| Field | Value |
|---|---|
| Founder decision | Decision 2 · APPROVED A · KEEP INDEPENDENT |
| Verdict | **NOT AVAILABLE** for Fix 17 unless founder re-authorizes. Excluded from all options. |

### C-8 · No existing re-investigation loop mechanism

Grep for `re[_-]?investigation` / `investigate again` / `retry investigation` in `src/`: 0 matches.

`native-programming-loop` has a bounded-retry pattern for repair · but not for investigation. No existing controller loops `runInvestigation` on `REQUIRE_MORE_INVESTIGATION`.

**Verdict:** any β option is a GENUINE BUILD · zero existing infrastructure to connect.

---

## D · Options (α · β · γ · ε · presented separately · not ranked · not recommended)

### OPTION α — REPORTING CONSUMER

Present Q8 output to a founder/user via a new API route + response formatter.

| Field | Value |
|---|---|
| EXISTING COMPONENT to reuse | API route pattern from `src/app/api/nex1/native-loop/run/route.ts` (thin wrapper · JSON body → run function → JSON response) |
| CONNECTION POINT | New route: `POST /api/nex1/investigate/run` (or similar founder-chosen path) invoking `runInvestigation(problem_statement)` and returning `InvestigationEvidencePacket` (or a formatted subset containing `candidate_selection`, `selection_state`, `decision_reason`, `provenance`) |
| NEW BUILD REQUIRED | YES · small |
| ESTIMATED CHANGE SIZE | 1 new file (route.ts · ~50 LOC) + optional 1 formatter helper (~50 LOC) · zero modifications to Fix 12-16 · zero modifications to Track A |
| NEW INTELLIGENCE REQUIRED | NONE (route only wraps existing `runInvestigation` + emits result) |
| AUTHORITY IMPACT | READ-ONLY response · zero MODIFY · zero EXECUTE · zero AUTHORIZE · Q8 SELECT-only boundary preserved |
| RUNTIME PROOF REQUIRED | End-to-end runtime run · not just fixture · Test S problem_statement → full pipeline → SELECTED-or-TIE state emitted in HTTP response |
| RISKS | (1) if the endpoint later gets extended to trigger downstream actions from `selection_state`, the SELECT ≠ MODIFY boundary could be crossed accidentally · mitigation: response formatter must be a pure read-only shape · (2) untrusted callers may issue arbitrary problem_statements · same risk profile as `POST /api/nex1/native-loop/run` which currently accepts arbitrary `founder_goal` strings · precedent exists · not new risk |
| SIDE-EFFECT | None to files · none to database · none to broker · none to Track A |

### OPTION β — RE-INVESTIGATION CONSUMER

Consume `REQUIRE_MORE_INVESTIGATION` state by re-invoking `runInvestigation` with augmented parameters. Loop bounded by budget.

| Field | Value |
|---|---|
| EXISTING COMPONENT to reuse | Pattern from `native-programming-loop.ts` (bounded repair-retry) is architecturally similar but domain-different · would need adaptation not reuse |
| CONNECTION POINT | New controller (e.g. `capability-investigation-loop.ts`) that consumes `SelectCandidatesResult` · checks for `REQUIRE_MORE_INVESTIGATION` · augments seed corpus or expands concept tags · re-invokes `runInvestigation` up to N times |
| NEW BUILD REQUIRED | YES · larger than α (needs budget contract · augmentation strategy · fixed-point detection) |
| ESTIMATED CHANGE SIZE | 1 new capability file (~300 LOC) + 1 new API route (~50 LOC) + 1 new verifier probe (~500 LOC) · zero modifications to Fix 12-16 · zero to Track A |
| NEW INTELLIGENCE REQUIRED | **YES · augmentation heuristic must exist**: what changes on re-run? (broader tag search? · additional evidence dimensions? · more candidates?) This is founder-only policy · not currently defined by Q8 V1 |
| AUTHORITY IMPACT | Still READ-ONLY (multiple runInvestigation calls) · zero MODIFY · zero EXECUTE · but bounded budget contract is essential |
| RUNTIME PROOF REQUIRED | Determinism at loop level (5 runs · same fixed-point) · budget-exhaustion test · fixed-point convergence test · escape from `REQUIRE_MORE_INVESTIGATION` on augmented run |
| RISKS | (1) unbounded recursion · mitigation: explicit budget · (2) infinite REQUIRE_MORE_INVESTIGATION on undecidable corpus · mitigation: fixed-point detection with fail-terminal state · (3) augmentation strategy must not introduce hidden weighting or non-native reasoning · (4) founder has NOT authorized what augmentation means — this option DEPENDS ON a prior founder policy decision |

### OPTION γ — PERSISTENCE CONSUMER

Append `InvestigationEvidencePacket` conclusions to an existing or parallel JSONL log.

| Field | Value |
|---|---|
| EXISTING COMPONENT to reuse | `nex-code-brain/knowledge-store.ts::addKnowledgeEntry` (option γ-1) OR Fix 15/16 receipt-write pattern (option γ-2) |
| CONNECTION POINT | Either: (γ-1) extend `AllowedKinds` in nex-code-brain to include `investigation-conclusion` · call `addKnowledgeEntry` from a new emitter after ACTION 15 · appends to `data/nex-code-brain/knowledge/entries.jsonl`; OR (γ-2) create parallel `data/nex1-investigation-conclusions/entries.jsonl` with fresh appender modeled on Fix 15 receipt pattern |
| NEW BUILD REQUIRED | γ-1: **minimal** · +1 kind in enum + ~30 LOC emitter that maps CandidateSelection to AddEntryInput. γ-2: **small** · new JSONL emitter file + entry-id generator (reused pattern) |
| ESTIMATED CHANGE SIZE | γ-1: ~50 LOC · touches `nex-code-brain/types.ts` + `knowledge-store.ts` + 1 new emitter file. γ-2: ~150 LOC · new file only · nex-code-brain untouched |
| NEW INTELLIGENCE REQUIRED | NONE (persistence only · no interpretation of the record beyond the CandidateSelection field mapping) |
| AUTHORITY IMPACT | Write-only to advisory JSONL · zero MODIFY of code · zero EXECUTE · zero AUTHORIZE · nex-code-brain explicitly declared "advisory · no Ed25519 signature · no governance authority" |
| RUNTIME PROOF REQUIRED | Append idempotency · read-back verification · determinism (5 runs · 5 identical JSONL rows) · concurrency safety (append-only is naturally concurrent-safe) |
| RISKS | (1) γ-1 requires modifying nex-code-brain schema · founder Decision 2-style boundary risk (nex-code-brain is a separate constitutional subsystem · like nex-debugger) — mitigation: use γ-2 (parallel file) to avoid modifying nex-code-brain · (2) neither variant exposes Q8 to a HUMAN reader · founder may still need a report emitter (α) to actually SEE the persisted output |

### OPTION ε — OTHER EXISTING CONSUMER

Documented candidates surveyed · none suitable without violating Q8 policy §2.20 (SELECT-only):

| Component | Why not suitable |
|---|---|
| `nex1-orchestrator` (WO-1..WO-13) | Track A intersection: WO-2/WO-4/WO-5/WO-13 involve authority · execution · signing. Consuming Q8 into orchestrator stages could convert SELECT → MODIFY/EXECUTE/AUTHORIZE. Requires separate authorization contract. |
| `native-programming-loop` | Different domain (coding-fix pipeline) · CHANGE stage crosses MODIFY boundary. |
| `nex-debugger` | Founder Decision 2 · KEEP INDEPENDENT · excluded. |
| `capability-m-file-memory` | INPUT to `runInvestigation` · consuming its own output would be circular. |
| Any Track A component | FROZEN. |

**Verdict:** No existing consumer outside α · β · γ is safe to connect in Fix 17.

If the founder identifies a legitimate ε consumer (e.g. a reporting UI page in `src/app/` not yet audited · a specific mission-runner subsystem), they should specify it explicitly. Fix 17 does not invent one.

---

## E · Connect-Before-Build Classification (per option)

| Option | Classification | Why |
|---|---|---|
| α · REPORTING | **C · BUILD GAP** (small) + **A · pattern reuse** | No existing API route invokes `runInvestigation` · a new thin route is required · pattern to reuse comes from existing `native-loop/run` route. |
| β · RE-INVESTIGATION | **C · BUILD GAP** (larger) + **D · POLICY GAP** | No existing re-investigation controller · Q8 V1 policy Decision 18 defines WHEN to REQUIRE_MORE_INVESTIGATION but does NOT define WHAT augmentation to try · augmentation policy is a NEW founder-only decision. |
| γ-1 · PERSISTENCE via nex-code-brain | **B · PARTIAL CONNECT** + **C · small BUILD** | `addKnowledgeEntry` exists · schema extension required · nex-code-brain boundary risk. |
| γ-2 · PERSISTENCE via parallel JSONL | **A · pattern reuse** + **C · small BUILD** | JSONL append pattern exists in Fix 15/16 · reusable · new emitter file. nex-code-brain untouched. |
| ε · OTHER | **F · CONSUMER GAP** | No suitable existing consumer identified without authority-boundary violation. |

---

## F · Proposed Fix 17 Boundary (applies to whichever option founder selects)

Regardless of which option the founder chooses, Fix 17 must obey:

```
INPUT:
    InvestigationEvidencePacket (or CandidateSelection subset from it)

CONSUMES:
    candidate_selection (Fix 16 output field)
    Optionally: candidate_rankings · hypothesis_evaluations · provenance for audit context

OUTPUT:
    (α) HTTP JSON response (read-only)
    (β) re-invoked runInvestigation() bounded loop with fixed-point terminator
    (γ) JSONL append (write-only advisory record)

DOES NOT:
    modify any source file
    execute any process (no spawn / exec / child_process)
    authorize any change (no Ed25519 / trust-anchor / G15 / WO-04 / broker call)
    verify anything (evidence_kind remains INFERRED · never PROVEN)
    deploy anything (no CI/CD trigger · no build hook)
    connect nex-debugger (Decision 2 preserved)
    connect Track A (FROZEN)
    modify Fix 12/13/14/15/16 (upstream chain preserved)
    use external LLM (native-only)

FIX 17 INVARIANTS (mirror Fix 15/16 pattern · runtime-enforced):
    · zero_llm invariant declaration in header
    · type-lock evidence_kind = "INFERRED" if any packet field is emitted
    · forbidden-causal-vocab check on any templated string
    · deterministic sort / stable ordering if any lists are emitted
    · policy_id / policy_version stamping for audit (both Q7 and Q8 policy IDs preserved)
```

---

## G · End-to-End Verification Plan (post-authorization · not run now)

If Fix 17 is later authorized, verification must include:

### TEST INPUT

- Real corpus: Test S problem statement in `wo9-corrector.ts::proposeCorrection`
- Route: whichever consumer option is selected
- Runtime path: **actual `runInvestigation()` invocation** (closing the D · TEST/PROOF GAP from prior audit)

### EXPECTED Q8 STATE

- On Test S corpus: `selection_state = "TIE"` · `selected_candidate = null`
- On single-supported candidate fixture: `selection_state = "SELECTED"`
- On UNRESOLVED_ORDER scope fixture: `selection_state = "REQUIRE_MORE_INVESTIGATION"`

### EXPECTED CONSUMER BEHAVIOUR

- **α:** HTTP 200 · JSON body containing `selection_state` · `selected_candidate` · `decision_reason` · matching upstream Q8 output byte-for-byte
- **β:** bounded loop terminates within budget · either escapes REQUIRE_MORE_INVESTIGATION or emits terminal `NO_SELECTION_AFTER_MAX_INVESTIGATIONS` state
- **γ:** JSONL row appended · entry_id unique · round-trip readback matches original

### NEGATIVE CONTROLS (mirror Fix 16 Q8-N1..N15 · adapt for consumer)

- **N-α1:** consumer does NOT modify any source file (grep newly-touched paths · confirm 0)
- **N-α2:** consumer does NOT execute any process
- **N-α3:** consumer does NOT change `evidence_kind` from INFERRED to anything else
- **N-α4:** consumer does NOT invoke external LLM
- **N-α5:** consumer does NOT touch Track A files
- **N-β1..3:** for β · loop respects budget · terminates deterministically · does not modify upstream Fix 12-16
- **N-γ1..3:** for γ · JSONL is append-only · does not modify existing rows · does not modify Fix 12-16

### AUTHORITY CONTROLS

- Grep consumer file for: `writeFileSync\|fs.writeFile\|spawn\|execSync\|child_process\|Ed25519\|WO-04\|broker\.execute\|G15\.activate`
- Expected: 0 matches for α; 0 matches for β (loop only re-invokes `runInvestigation` · does not spawn); γ-2 permits ONE `fs.appendFile` (to the JSONL) · nothing else

### DETERMINISM

- 5 identical runs of the consumer with the same input produce identical output
- For α: identical HTTP response bytes
- For β: identical fixed-point termination state
- For γ: identical JSONL row content (excluding a monotonic entry_id)

### PROVENANCE

- Every Q8 output propagated to the consumer carries: investigation_id · trace_id · candidate_id · source_file · policy_id · policy_version · decision_reason · provenance array
- Provenance chain end-to-end: source_file line ranges → Fix 13 evidence_ids → Fix 15 rank_position → Fix 16 selection_state → consumer output
- No provenance lost at consumer boundary

### NO-LLM CHECK

- Grep the consumer file for: `openai|@anthropic|anthropic|@google|groq|llama|ollama|openrouter`
- Expected: 0 matches

### NO-MODIFICATION CHECK

- Consumer must not `writeFileSync` any file except its own append target (γ-2 · JSONL entries only)
- No touching Fix 12/13/14/15/16 source files
- No touching Track A source files

### NO-EXECUTION CHECK

- Consumer must not spawn processes · call `execSync` · use `child_process`
- Verified by grep on consumer source

### END-TO-END REGRESSION

- Fix 12/13/14/15/16 verifier probes must all still exit 0 after Fix 17 landing
- Test S probe re-run: candidate_selection field still populated · state still TIE · no regression

---

## H · Required Founder Decision

```
FOUNDER DECISION REQUIRED

Choose exactly one (or one combination · if founder specifies):

[ ] α · REPORTING CONSUMER
        → new POST /api/nex1/investigate/run route
        → returns InvestigationEvidencePacket (or Q8-shaped subset)
        → ~50 LOC · pattern reuse from native-loop/run
        → BUILD: small · read-only · zero authority risk
        → verified boundary: HTTP response only · zero mutation

[ ] β · RE-INVESTIGATION CONSUMER
        → new bounded-loop controller consuming REQUIRE_MORE_INVESTIGATION
        → requires PRIOR founder decision on augmentation policy
        → ~300 LOC controller + ~50 LOC route + verifier
        → BUILD: larger · POLICY GAP must be resolved first
        → verified boundary: multiple re-runs of runInvestigation · zero MODIFY/EXECUTE

[ ] γ-1 · PERSISTENCE via nex-code-brain
        → extend AllowedKinds enum with "investigation-conclusion"
        → new emitter appends to data/nex-code-brain/knowledge/entries.jsonl
        → ~50 LOC · touches nex-code-brain schema (constitutional-boundary risk)
        → BUILD: minimal · advisory persistence only
        → verified boundary: JSONL append-only · zero authority

[ ] γ-2 · PERSISTENCE via parallel JSONL
        → new emitter appends to data/nex1-investigation-conclusions/entries.jsonl
        → nex-code-brain untouched · zero constitutional-boundary risk
        → ~150 LOC · reuses Fix 15/16 receipt pattern
        → BUILD: small · advisory persistence only
        → verified boundary: JSONL append-only · zero authority

[ ] ε · FOUNDER-DEFINED OPTION
        → founder identifies an existing consumer this design did not cover
        → founder specifies: _______________________________

[ ] PAUSE
        → Q8 remains COMPONENT_COMPLETE indefinitely
        → no consumer built · no runtime end-to-end proof pursued
        → Q7 · Fix 15 · Fix 16 all remain runtime-verified in isolation

Combinations valid (founder-only):
   e.g.  α + γ-2  = report to user AND persist to parallel JSONL
          β + γ-2  = re-investigation loop AND persist each iteration

If multiple options are technically valid, keep them separate. This design
does not choose for the founder.
```

---

## I · Existing Components That Should NOT Be Touched (defence-in-depth reminder)

| Do NOT modify | Reason |
|---|---|
| Fix 12 · capability-root-cause-hypothesis-generator.ts | RUNTIME_VERIFIED · zero upstream changes required for any Fix 17 option |
| Fix 13 · capability-hypothesis-evidence-evaluator.ts | same |
| Fix 14 · capability-candidate-comparator.ts | same |
| Fix 15 · capability-candidate-ranker.ts | same |
| Fix 16 · capability-candidate-selector.ts | same |
| Q7 policy | FOUNDER_APPROVED · unchanged |
| Q8 policy | FOUNDER_APPROVED · unchanged |
| nex-debugger | Decision 2 · INDEPENDENT |
| Track A (G15 · C6 · Ed25519 · WO-04 · execution broker · trusted keys · Stage 13-16) | FROZEN |
| native-programming-loop | different domain · CHANGE stage crosses MODIFY authority |
| nex1-orchestrator WO-2/WO-4/WO-5/WO-13 | authority-adjacent · would require separate contract |

`native-investigation-mode.ts` will need a **read-only trace-note** in the α case if the API route also wants to attach the consumer to the trace · but the caller path is: `route.ts` invokes `runInvestigation` and receives the packet · no modification to `native-investigation-mode.ts` itself. Verified minimal change.

---

## J · Boundary Compliance (this design task)

- ✅ Did NOT build anything
- ✅ Did NOT create any implementation files (this design document only)
- ✅ Did NOT modify Fix 12/13/14/15/16
- ✅ Did NOT modify Q7 or Q8 policy
- ✅ Did NOT touch nex-debugger
- ✅ Did NOT touch Track A
- ✅ Did NOT commit · did NOT push
- ✅ Did NOT recommend a consumer option
- ✅ Did NOT rank the options
- ✅ Did NOT declare one "best"
- ✅ Native inspection only · zero external model
- ✅ Founder decision required before any implementation

---

## K · Final Discipline

The objective is not "make Q8 do more." The objective is: **connect the already-proven Q8 intelligence to the correct existing NEX1 system boundary without creating duplicate intelligence or bypassing authority.**

Discovery → trace → connect-before-build → design → founder decision. **Only after explicit authorization**: build → execute → observe → verify → report.

Awaiting founder response.

---

*End of NEX1 Fix 17 Consumer Design · 2026-09-17*
