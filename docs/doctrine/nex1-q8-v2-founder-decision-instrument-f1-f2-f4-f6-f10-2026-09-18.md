# NEX1 · Q8 V2 v2 · Founder Decision Instrument · F1 / F2 / F4 / F6 / F10

**Date drafted:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7)
**Status:** `FOUNDER_DECISION_REQUIRED`

**Precedent:** matches decision-instrument discipline used for R10, R11, R10-C-1..4.

**Load-bearing dependencies:**
- Q8 V2 v2 draft: `docs/doctrine/nex1-q8-v2-operational-policy-v2-2026-09-18.md` (frozen · pending correction)
- Forensic Review #2 output (15 findings)
- Founder-confirmed R10, R11, R10-C-1..4 (unchanged · not reopened)
- Pre-Fix-24 baseline measurement: `docs/doctrine/nex1-pre-fix24-baseline-2026-09-18.md`

---

## §1 · Purpose

Convert five load-bearing forensic findings into explicit founder decisions:

- **F1** · Honest Degrade compositional contradiction
- **F2** · Prior-failure retry semantics under Honest Degrade
- **F4** · Contradiction evidence unreachable under Honest Degrade
- **F6** · Scope of R11-B across memory pathways (file-memory question)
- **F10** · Composite material-difference treatment of unimplemented dimensions

**No option is selected. No recommendation is issued. No decision is inferred.**

---

## §2 · Current architectural state

Founder-confirmed and immutable (do not reopen):

| Decision | Value |
|---|---|
| R10 | R10-C · EVIDENCE-BASED WITHOUT AGE |
| R11 | R11-B · RETRIEVED EXPERIENCE NEVER SATISFIES SUPPORTING-MAJORITY |
| R10-C-1 | D · COMPOSITE |
| R10-C-2 | C · INDEPENDENT VERIFICATION |
| R10-C-3 | D · NECESSARY BUT NOT SUFFICIENT |
| R10-C-4 | D · COMPOSITE ANTI-CIRCULARITY |

Constitutional invariants preserved:

```
REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED
RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY
SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED
DESCRIBE ≠ IMPLEMENT ≠ WIRE ≠ EXECUTE ≠ VERIFY
```

Current capability facts (from pre-Fix-24 baseline · 2026-09-18):
- `RETRIEVED_PRIOR_*` evidence classes: **absent from src/**
- Investigation-conclusion store readers in src/: **zero**
- `discovery_source` provenance field on Schema V1: **absent**
- Anti-circularity mechanisms: **absent**
- File-memory tag lookup at ACTION 2: **present, currently untagged**

**Fix 24 is cumulative-learning work only. Autonomous execution is NOT authorized by this decision instrument.**

---

## §3 · Decision rules

Every decision below must distinguish:

- **CURRENT CAPABILITY** — what NEX1 can actually determine today (from the pre-Fix-24 baseline)
- **POLICY** — what the doctrine should permit or prohibit today
- **FUTURE CAPABILITY** — what would become possible after a capability is genuinely implemented

Rules for reading this instrument:

- Options presented neutrally · no ranking · no "safest / strongest / best / preferred / optimal"
- Every option carries `FUTURE CAPABILITY REQUIRED` marker where applicable
- Where two options appear compatible, they are NOT silently merged
- Where two options appear incompatible, the incompatibility is stated
- No policy correction begins until §11 founder record is signed AND §12 gate is honoured

---

## §4 · F1 · Honest Degrade when retrieval fires

### Problem

Q8 V2 v2 §10.2 currently states that when `retrieved_experience_id != null`, fresh evidence is blocked from R-4 SUPPORTING count. Compositional effect: retrieval fires → fresh evidence excluded → R-4 cannot operate normally → R10 material-difference selection becomes vacuously unavailable → contradiction evidence can disappear → output collapses into INSUFFICIENT_EVIDENCE.

**The founder must decide what should happen to fresh evidence when retrieved experience contributes to the investigation.**

### F1 Options

#### F1-A · Full Conservative Degrade

When retrieved experience contributes:

- Fresh evidence cannot satisfy R-4 SUPPORTING count
- Fresh evidence cannot satisfy R-4 CONTRADICTING count
- Q8 selection is therefore unavailable from those fresh evidence paths
- Output remains an uncertainty state (INSUFFICIENT_EVIDENCE / REQUIRE_MORE_INVESTIGATION) until the required provenance capability exists

**Explicitly documents that some current Q8 selection dynamics become intentionally unavailable when retrieval fires.** No future guessing.

#### F1-B · Controlled Fresh-Evidence Admission

Retrieved experience does not automatically invalidate all fresh evidence. Define specific classes of fresh evidence that remain admissible despite retrieval.

**The founder must define exactly which fresh-evidence classes remain admissible.** This decision instrument does NOT invent them.

#### F1-C · Separate Retrieval Contribution From Retrieval Attempt

Differentiate `RETRIEVAL_ATTEMPTED` (a retrieval call was made) from `RETRIEVAL_RETURNED_USABLE_CANDIDATE` (a retrieval call produced a candidate that was actually injected into the investigation).

Make Honest Degrade conditional on actual memory contribution — a retrieval attempt returning NO_MATCH does not trigger the degrade.

**Recorded as a possible architectural decision only.** Not implemented in this document.

#### F1-D · Founder-Defined Alternative

Founder specifies another rule. This instrument does not propose one.

### F1 Required Record

```
FOUNDER_CHOICE:                       [ ] A   [ ] B   [ ] C   [ ] D
RATIONALE:                            ___________
CURRENT-CAPABILITY CONSEQUENCE:       ___________
POLICY CONSEQUENCE:                   ___________
FUTURE-CAPABILITY DEPENDENCY:         ___________
FALSIFICATION IMPACT:                 ___________
```

---

## §5 · F2 · Prior-failure retry semantics

### Problem

Q8 V2 v2 says prior failure is not permanently authoritative. However, if retrieval of a prior-failure record triggers Honest Degrade and fresh evidence is then blocked, the prior failure can become practically self-reinforcing — reproducing the R-10 deadlock at a different layer.

**The founder must decide how NEX1 should behave when prior experience says a similar investigation previously failed.**

Guardrails: no age-based decay · no confidence weighting unless explicitly chosen · R10 remains evidence-based without age.

### F2 Options

#### F2-A · Packet-Level Block

Prior failure may block selection **within the current packet**. A later investigation may retry only when the investigation conditions change or a future policy explicitly permits retry.

Explicitly documents this as a packet-level restriction, not permanent global authority. Selection is unavailable in this packet; a new packet with different conditions is not pre-blocked.

#### F2-B · Prior Failure Guides, Never Blocks

Prior failure can inform investigation (guide what to look at, what to check) but cannot itself prevent fresh investigation or selection. It remains evidence about historical outcome, not a veto.

Under Honest Degrade (§4 F1-A), selection may still be unavailable via the count arithmetic — but the prior failure itself is not the blocker.

#### F2-C · Retry Requires New Independent Evidence

Prior failure blocks reliance on the previous solution **until genuinely new independent evidence exists**.

The definition of "new independent evidence" is required from the founder if this option is selected. This instrument does NOT invent the definition.

#### F2-D · Founder-Defined Alternative

### F2 Required Record

```
FOUNDER_CHOICE:                       [ ] A   [ ] B   [ ] C   [ ] D
RATIONALE:                            ___________
RETRY SEMANTICS:                      ___________
CURRENT-CAPABILITY CONSEQUENCE:       ___________
POLICY CONSEQUENCE:                   ___________
FUTURE-CAPABILITY DEPENDENCY:         ___________
FALSIFICATION IMPACT:                 ___________
```

---

## §6 · F4 · Contradiction evidence under Honest Degrade

### Problem

Q8 V2 v2 says contradictory fresh evidence can drive `R-4 CONTRADICTING` and preserve `UNRESOLVED`. But if Honest Degrade blocks fresh evidence whenever retrieval contributes, contradiction may never reach R-4. Therefore `UNRESOLVED` becomes unreachable in exactly the situations where contradiction matters.

**The founder must decide whether contradiction receives special treatment.**

### F4 Options

#### F4-A · Contradiction Remains Blocked

Contradictory fresh evidence is treated identically to other fresh evidence during Honest Degrade. Current capability therefore cannot use it for R-4 when retrieval contributes.

Consequence: `UNRESOLVED` is unreachable via retrieval-fired packets under current capability.

#### F4-B · Contradiction Is Admissible

Contradictory fresh evidence remains admissible under a defined safe condition. This instrument does NOT invent the condition — the founder must define it if this option is selected.

Consequence (once condition defined): `UNRESOLVED` remains reachable.

#### F4-C · Separate Contradiction Path

Contradiction is recorded as a separate `UNRESOLVED_CONTRADICTION` state without allowing it to produce a normal R-4 selection. This preserves contradiction visibility while separating it from ordinary selection.

Consequence: a new dedicated state must be added to Q8 V2 v2 · this is a policy amendment not otherwise required.

#### F4-D · Founder-Defined Alternative

### F4 Required Record

```
FOUNDER_CHOICE:                       [ ] A   [ ] B   [ ] C   [ ] D
RATIONALE:                            ___________
CONTRADICTION HANDLING:               ___________
EFFECT ON UNRESOLVED:                 ___________
CURRENT-CAPABILITY CONSEQUENCE:       ___________
FUTURE-CAPABILITY DEPENDENCY:         ___________
FALSIFICATION IMPACT:                 ___________
```

---

## §7 · F6 · Does R11-B apply to all memory pathways?

### Problem

The constitutional principle `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY` and the founder-confirmed R11-B (retrieved experience never satisfies supporting-majority) currently target the Fix 17 investigation-conclusion retrieval pathway.

However, the pre-Fix-24 baseline documented a proto-behaviour:

```
file-memory tag lookup (ACTION 2)
    → targeted investigation (ACTIONs 3-15)
    → fresh evidence
```

This is a memory pathway that currently produces evidence untagged with `discovery_source`. Structurally, it is the same memory-caused-evidence pattern R11-B is designed to prevent — but Q8 V2 v2 §10.2 keys on `retrieved_experience_id`, which is a Fix 17 concept, not a file-memory concept.

Additional memory/knowledge systems discovered in the baseline (not currently under R11-B):
- `src/lib/knowledge/*` (searchKnowledge, uses `minConfidence` threshold)
- `src/lib/nex/programmer-learning/*` (readKnowledge/readSkills/readExperiences)
- `src/lib/nex-code-brain/knowledge-store.ts`
- `src/lib/nex-agent-runtime/memory.ts` (audit-grade Ed25519-signed)

**The founder must decide whether R11-B applies only to Fix 17 retrieval or to every memory-caused evidence pathway.**

### F6 Options

#### F6-A · Q8 V2 Scope Is Narrow

R11-B directly governs investigation-conclusion (Fix 17) retrieval only. File-memory and the other memory systems remain governed by their existing policy (whatever that is).

Q8 V2 v2 explicitly states it does not claim to solve all memory-causation problems.

Consequence: file-memory-guided evidence continues to enter Q8 selection today as untagged fresh evidence. Q8 V2 v2 does not intervene.

#### F6-B · R11-B Is Global

R11-B applies to every memory pathway that can influence evidence. File-memory-caused evidence therefore requires equivalent provenance treatment. Every memory system in NEX1 becomes subject to the same constitutional constraint.

`FUTURE CAPABILITY REQUIRED` — provenance tagging on all five memory pathways enumerated in the baseline. Not implemented today.

Consequence: policy scope expands substantially. Multiple subsystems become dependent on Q8 V2 architectural direction.

#### F6-C · Constitutional Global Rule, Operationally Phased

The **constitutional principle** applies globally: memory informs but does not become proof. However, Q8 V2 v2's **operational enforcement** is limited to pathways for which the required provenance capability exists.

Uncovered pathways are explicitly recorded as `FUTURE CAPABILITY GAPS` — governed by principle but not yet by enforcement.

Consequence: honest disclosure of constitutional scope vs operational reach.

#### F6-D · Founder-Defined Alternative

### F6 Required Record

```
FOUNDER_CHOICE:                       [ ] A   [ ] B   [ ] C   [ ] D
RATIONALE:                            ___________
SCOPE OF R11-B:                       ___________
FILE-MEMORY STATUS:                   ___________
CURRENT-CAPABILITY CONSEQUENCE:       ___________
FUTURE-CAPABILITY DEPENDENCY:         ___________
FALSIFICATION IMPACT:                 ___________
```

---

## §8 · F10 · Unimplemented dimensions in composite material difference

### Problem

R10-C-1 requires `D · COMPOSITE`. Q8 V2 v2 §6.2 currently allows `NOT IMPLEMENTED` dimensions to not prevent `NOT_MATERIALLY_DIFFERENT`. That creates a potential semantic blind spot:

```
Structural dimension = same
Behavioural dimension = same
Semantic dimension = NOT IMPLEMENTED
=> Aggregate: NOT_MATERIALLY_DIFFERENT
```

...even though NEX1 cannot actually evaluate semantic equivalence today.

**The founder must decide how an unavailable safety-relevant dimension behaves in the composite.**

### F10 Options

#### F10-A · Current Permissive Semantics

An unimplemented dimension does not count as evidence of difference. The aggregate may still conclude `NOT_MATERIALLY_DIFFERENT` provided all implemented dimensions agree.

The unavailable dimension must remain **explicitly disclosed** in Q8 V2 v2 output (`semantic_dimension_available: false` etc.).

Consequence: honest disclosure of the blind spot; composite may still say "not different" when semantic dimension is silent.

#### F10-B · Conservative Indeterminate

If any safety-relevant dimension is unimplemented:

```
MATERIAL_DIFFERENCE = INDETERMINATE
```

NEX1 cannot declare `NOT_MATERIALLY_DIFFERENT` until the relevant dimensions are available.

Consequence: `NOT_MATERIALLY_DIFFERENT` becomes unreachable under current capability. All composite outputs land in `INDETERMINATE` or `MATERIALLY_DIFFERENT`.

#### F10-C · Dimension-Relevance Rule

Only dimensions **relevant to the specific comparison** are required. If a relevant dimension is not implemented → `INDETERMINATE`. If an irrelevant dimension is not implemented → does not block the result.

The doctrine must define **relevance** before implementation. This instrument does NOT define relevance.

Consequence: introduces a relevance-determination requirement (which itself requires a policy definition — potentially another founder decision).

#### F10-D · Founder-Defined Alternative

### F10 Required Record

```
FOUNDER_CHOICE:                       [ ] A   [ ] B   [ ] C   [ ] D
RATIONALE:                            ___________
COMPOSITE SEMANTICS:                  ___________
TREATMENT OF UNKNOWN DIMENSIONS:      ___________
CURRENT-CAPABILITY CONSEQUENCE:       ___________
FUTURE-CAPABILITY DEPENDENCY:         ___________
FALSIFICATION IMPACT:                 ___________
```

---

## §9 · Cross-decision dependency map

Each entry describes whether one decision constrains, interacts with, or is independent of another.

| Pair | Relationship | Notes |
|---|---|---|
| **F1 ↔ F2** | **Constrains** | F1's Honest Degrade rule determines whether F2's "packet-level block" (F2-A) is a genuine block or is dominated by the degrade. F2-B (prior failure guides only) is only meaningfully distinct from F2-A if F1 permits at least some fresh-evidence admission (F1-B or F1-C). Under F1-A + F2-B, prior failure's "does not block" property is vacuous because the degrade already blocks. |
| **F1 ↔ F4** | **Constrains** | F4's contradiction options depend directly on whether F1 admits any fresh evidence when retrieval fires. F4-B ("admissible under safe condition") is only meaningful if F1 permits admission (F1-B/C). F4-A (contradiction blocked) is entailed by F1-A. F4-C (separate contradiction path) is independent of F1. |
| **F1 ↔ F6** | **Interacts** | If F6-B (global R11-B), then F1's Honest Degrade rule must apply to every memory pathway, not just Fix 17 retrieval. This dramatically expands F1's scope. If F6-A (narrow), F1 governs only Fix 17. If F6-C (constitutional global, operational phased), F1 governs Fix 17 today but extension is documented for future pathways. |
| **F1 ↔ F10** | **Independent** | F10 (composite dimension aggregation) governs R10-C-1 D output; F1 governs Q8 R-4 count admission. They operate on different pipeline stages. However, F10-B (conservative indeterminate) makes many current-capability packets emit `INDETERMINATE` at material-difference, which then feeds into F1's downstream logic as a REQUIRE_MORE_INVESTIGATION retrieval state — a mild composition effect but not a logical dependency. |
| **F2 ↔ F4** | **Interacts** | Prior failure (F2) can co-exist with fresh contradicting evidence (F4). Their combination depends on both rule choices. Under F2-B (guides only) + F4-C (separate contradiction path), a packet can carry both signals without collapse. Under F2-A + F4-A, both signals collapse into the Honest Degrade output. |
| **F6 ↔ F10** | **Independent** | F6 (R11-B scope across pathways) governs memory-causation. F10 (composite dimension aggregation) governs material-difference determination. They address different concerns. However, if F6-B (global) is selected, then more pathways feed into R10-C-1 D input, and F10's aggregation must handle more sources — a minor composition effect but not logical dependency. |

**Choosing any option in F1 or F6 creates cascading implementation dependencies for the others. Founder should recognise this before signing.**

Independence claim: F1, F2, F4, F6, F10 cannot be decided fully independently. **F1 and F6 are the two apex decisions.** F2 and F4 downstream depend on F1. F10 is largely independent but interacts with F6 mildly.

---

## §10 · Consequence matrix

Neutral · no ranking · no "safer / preferred / optimal" language.

| Decision | Choice | What changes | What does NOT change | Current-capability impact | Future capability needed |
|---|---|---|---|---|---|
| **F1** | A · Full Conservative Degrade | Fresh evidence excluded from R-4 whenever retrieval fires. Q8 output collapses to uncertainty states. | R11-B literal enforcement remains. Constitutional invariants unchanged. | Selection unavailable via retrieval-fired packets. §10.2 rule stands as written. | None new (uses existing packet-level proxy). |
| | B · Controlled Admission | Some fresh evidence classes remain admissible under retrieval. Selection remains possible. | Requires founder to define admissible classes. | Selection sometimes possible via retrieval-fired packets. | Founder-defined admissibility rules. |
| | C · Separate Contribution vs Attempt | Degrade fires only when retrieval actually contributes. NO_MATCH retrievals do not trigger degrade. | R11-B literal enforcement remains. | Selection possible when retrieval attempts return NO_MATCH. | `retrieval_contribution_flag` on packet (may or may not require schema extension depending on where it lives). |
| | D · Founder-defined | Depends on rule. | Depends on rule. | Depends. | Depends. |
| **F2** | A · Packet-Level Block | Retry allowed in future packets under different conditions. | R11-B unchanged. | Current-packet selection blocked. | None new for the block itself. |
| | B · Guides Never Blocks | Prior failure never authoritative. | R11-B unchanged. | Selection availability depends on F1 choice. | None new. |
| | C · New Independent Evidence Required | Retry gated on defined new-evidence condition. | R11-B unchanged. | Depends on new-evidence definition. | Founder-defined "new independent evidence" specification. |
| | D · Founder-defined | Depends on rule. | Depends. | Depends. | Depends. |
| **F4** | A · Contradiction Blocked | UNRESOLVED unreachable via retrieval-fired packets. | Q8 V1 UNRESOLVED still available in non-retrieval packets. | UNRESOLVED unreachable when retrieval fires. | None new. |
| | B · Contradiction Admissible | Contradictions can drive R-4 CONTRADICTING under defined safe condition. | R11-B unchanged. | UNRESOLVED reachable once condition defined. | Founder-defined safe-condition rule. |
| | C · Separate Contradiction Path | Adds new state (e.g., `UNRESOLVED_CONTRADICTION`) distinct from ordinary R-4. | Existing R-4 selection unchanged. | Contradictions visible even when count arithmetic blocked. | Adds a new state to Q8 V2 v2 selection vocabulary (policy amendment). |
| | D · Founder-defined | Depends. | Depends. | Depends. | Depends. |
| **F6** | A · Narrow | Only Fix 17 retrieval subject to R11-B in Q8 V2 v2. | Constitutional principle preserved but not operationally extended. | File-memory-guided evidence enters Q8 as untagged fresh; no intervention. | None new for Q8 V2 v2. Other memory systems remain outside scope. |
| | B · Global | All five memory pathways subject to R11-B. | Constitutional principle globally enforced. | Under current capability, all pathways lack provenance → operational enforcement is limited. | Provenance tagging on: file-memory · programmer-learning · code-brain knowledge · audit-grade memory · knowledge search. Multi-subsystem coordination. |
| | C · Constitutional Global, Operational Phased | Principle applies globally; enforcement limited to pathways with provenance capability. | Constitutional principle preserved. | Fix 17 pathway enforced when retrieval capability lands; other pathways documented as future gaps. | Same as B but phased. Explicit `FUTURE_CAPABILITY_GAP` records for each pathway. |
| | D · Founder-defined | Depends. | Depends. | Depends. | Depends. |
| **F10** | A · Permissive Semantics | Unimplemented dimensions don't block `NOT_MATERIALLY_DIFFERENT`. | R10-C-1 D structure preserved. | Semantic blind spot possible; disclosed via `semantic_dimension_available: false`. | None new (uses existing disclosure markers). |
| | B · Conservative Indeterminate | Any unimplemented safety-relevant dimension → INDETERMINATE. | R10-C-1 D structure preserved. | `NOT_MATERIALLY_DIFFERENT` unreachable while semantic dimension unimplemented. | None new for the rule; downstream: many packets emit REQUIRE_MORE_INVESTIGATION. |
| | C · Dimension-Relevance Rule | Only relevant dimensions required. | R10-C-1 D structure preserved. | Relevance determination becomes gating factor. | Founder-defined relevance-determination policy. Adds a policy sub-decision. |
| | D · Founder-defined | Depends. | Depends. | Depends. | Depends. |

**Nothing in this matrix constitutes a recommendation.** Every row states factual mechanical consequence of the choice under the current architectural state.

---

## §11 · Founder Decision Record

### F1

```
[ ] A · Full Conservative Degrade
[ ] B · Controlled Fresh-Evidence Admission
[ ] C · Separate Retrieval Contribution From Retrieval Attempt
[ ] D · Founder-Defined Alternative — specify: ___________
```

**Founder note:** ___________________________________________

---

### F2

```
[ ] A · Packet-Level Block
[ ] B · Prior Failure Guides, Never Blocks
[ ] C · Retry Requires New Independent Evidence
[ ] D · Founder-Defined Alternative — specify: ___________
```

**Founder note:** ___________________________________________

---

### F4

```
[ ] A · Contradiction Remains Blocked
[ ] B · Contradiction Is Admissible
[ ] C · Separate Contradiction Path
[ ] D · Founder-Defined Alternative — specify: ___________
```

**Founder note:** ___________________________________________

---

### F6

```
[ ] A · Q8 V2 Scope Is Narrow
[ ] B · R11-B Is Global
[ ] C · Constitutional Global, Operationally Phased
[ ] D · Founder-Defined Alternative — specify: ___________
```

**Founder note:** ___________________________________________

---

### F10

```
[ ] A · Current Permissive Semantics
[ ] B · Conservative Indeterminate
[ ] C · Dimension-Relevance Rule
[ ] D · Founder-Defined Alternative — specify: ___________
```

**Founder note:** ___________________________________________

---

### Signature

```
Founder signature:      ___________________________________
Date:                   ___________________________________
Dependency review completed: [ ] YES  [ ] NO
```

---

## §12 · Post-decision implementation gate

> **No policy correction, schema amendment, code change, test creation, baseline execution, or Fix 24 implementation may begin until all five decisions are explicitly recorded by the founder and the resulting dependency graph has been reviewed.**

Locked sequence after founder signature:

```
FOUNDER SIGNS ALL FIVE DECISIONS
        ↓
DEPENDENCY GRAPH REVIEW (per §9)
        ↓
Q8 V2 v2 → Q8 V2 v3 REVISION (document-only, applying founder decisions)
        ↓
FORENSIC REVIEW #3 (independent · attack v3)
        ↓
CORRECTIONS (if any)
        ↓
FORENSIC REVIEW #4 (if corrections applied)
        ↓
FOUNDER APPROVAL OF Q8 V2 v3
        ↓
FIX 24 PHASE A · READ-ONLY PRE-BUILD AUDIT
        ↓
ADVERSARIAL VERIFICATION (Cases A-H)
        ↓
IMPLEMENTATION (only if all prior steps pass)
```

**No stage may be skipped. No autonomous execution is authorized at any stage.**

**`STATUS = FOUNDER_DECISION_REQUIRED`**

---

## §13 · Final forensic self-check

Documentation-only self-audit performed per founder Section 15.

| # | Check | Answer |
|---|---|---|
| 1 | Did you make any decision for the founder? | **NO** — every decision block has all boxes unchecked |
| 2 | Did you alter R10? | **NO** — §2 records R10-C unchanged |
| 3 | Did you alter R11? | **NO** — §2 records R11-B unchanged |
| 4 | Did you alter Schema V1? | **NO** — §2 preserves; no schema fields added |
| 5 | Did you modify Q8 V2 v2? | **NO** — Q8 V2 v2 document untouched |
| 6 | Did you write code? | **NO** — documentation-only |
| 7 | Did you run tests? | **NO** |
| 8 | Did you run the baseline? | **NO** — baseline already executed in prior task; this instrument references its findings only |
| 9 | Did you start Fix 24? | **NO** |
| 10 | Did you accidentally treat an unimplemented capability as implemented? | **NO** — every option requiring future capability is marked `FUTURE CAPABILITY REQUIRED` (see F1-C, F1-B, F2-C, F4-B, F4-C, F6-B, F6-C, F10-C) |
| 11 | Did you introduce any new founder decision? | **NO** — this instrument covers exactly F1, F2, F4, F6, F10 (five findings authorised by founder). Sub-decisions surfaced (e.g., "founder must define admissible classes" under F1-B, "founder must define relevance" under F10-C) are surfaced as prerequisites within each option, not as new independent decisions |
| 12 | Did you preserve `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`? | **YES** — §2 preserves verbatim; every F6 option preserves the principle at either narrow or global scope |
| 13 | Did you preserve `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`? | **YES** — §2 preserves verbatim; no option in this instrument creates any authority transition |

**Every answer NO/YES as required. Instrument is clean per authorised scope.**

---

## §14 · Final report

- **Files created:** `docs/doctrine/nex1-q8-v2-founder-decision-instrument-f1-f2-f4-f6-f10-2026-09-18.md` (this file)
- **Files modified:** NONE
- **Source-code changes:** NONE
- **Schema changes:** NONE
- **Q8 V2 v2 changes:** NONE
- **Runtime traffic:** NONE
- **Tests created / executed:** NONE / NONE
- **Fix 24:** NOT IMPLEMENTED
- **Autonomous execution:** NOT AUTHORIZED
- **Founder decisions changed:** NONE (existing R10, R11, R10-C-1..4 preserved)
- **New founder decisions authored (unanswered):** 5 · F1, F2, F4, F6, F10

**Status: `FOUNDER_DECISION_REQUIRED`**

**STOP.** No corrections. No implementation. No new founder decisions beyond F1/F2/F4/F6/F10. No baseline re-run. No Fix 24. Awaiting founder direction on the five recorded decisions.
