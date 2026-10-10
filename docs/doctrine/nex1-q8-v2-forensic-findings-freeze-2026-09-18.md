# NEX1 · Q8 V2 · Forensic Findings Freeze

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7) · forensic reviewer
**Purpose:** preserve the forensic findings from the Q8 V2 forensic review before any corrections are applied or founder decisions are recorded.
**Precedent artifact under review:** `docs/doctrine/nex1-q8-v2-operational-policy-draft-2026-09-18.md` (490 lines · status `Q8_V2_POLICY_REQUIRES_CORRECTION`).

**Scope statement (mandatory):**

> *This document freezes forensic findings. It does not approve, reject, implement, or amend Q8 V2.*

**Prohibited actions (compliance-enforced in this task):** modify source code · modify Q8 V2 policy · modify Experience Schema V1 · implement Fix 24 · implement Q8 V2 · implement R-10 · implement R-11.1 · change Q8 V1 · change Fix 23b · change Fix 23c · create tests in source code · change registries · change runtime behaviour · authorize execution · add autonomous execution · invent a new trust system · invent a new confidence system · silently resolve C10 or C11 · silently select an R-10 option · silently select an R-11.1 option.

---

## 1. STATUS

**`Q8_V2_POLICY_REQUIRES_CORRECTION`**

Fifteen concrete findings recorded. Two require explicit founder policy disposition (C10, C11). Thirteen are pending documentation/logic corrections that may be applied only after founder disposition of the two policy questions.

**Governing invariants preserved throughout (must remain load-bearing under every option below):**

- `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`
- `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`
- `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE`
- `PRIOR SUCCESS ≠ CURRENT CORRECTNESS`
- `PRIOR FAILURE ≠ PERMANENT REJECTION` (unless founder explicitly changes doctrine)

---

## 2. C1–C15 FINDING REGISTER

Categories used: `LOAD_BEARING_POLICY_DECISION` · `LOGICAL_CORRECTION` · `DOCUMENTATION_CORRECTION` · `CLARIFICATION`.

| ID | Finding | Category | Founder Decision Required? | Implementation Allowed? |
|---|---|---|---|---|
| C1 | Q8V2-6 claims "reusing Q8 V1 vocabulary" but 4 of 6 retrieval states are new (MATCH · NO_MATCH · AMBIGUOUS · REJECT) | DOCUMENTATION_CORRECTION | NO | NO — pending founder disposition of C10/C11 |
| C2 | Q8V2-7 maps SUCCESS→PRIOR_SUCCESS but Q8V2-11 maps UNTRUSTED→PRIOR_FAILURE; same record → two classes | LOGICAL_CORRECTION | POSSIBLY — flag: correction may touch UNTRUSTED semantics which are constitutional (freeze §2.4 D-rules) | NO |
| C3 | R-10 as-drafted creates permanent lockout: UNTRUSTED → PRIOR_FAILURE → R-10 → NO_SELECTION → no new application → no path to re-verify | LOGICAL_CORRECTION | NO for the correction itself · YES for the underlying rule via Founder Decision A (R-10) | NO |
| C4 | R-11 as-drafted permits solo retrieved-SUCCESS to satisfy R-4 SUPPORTING_MAJORITY when CONTRADICTING count = 0 | LOGICAL_CORRECTION | NO for the correction itself · YES for the underlying rule via Founder Decision B (R-11.1) | NO |
| C5 | Q8V2-13 (UNRESOLVED on PRIOR_SUCCESS+PRIOR_FAILURE contradiction) and R-10 (blocks on any PRIOR_FAILURE) fire on same input; ordering undefined | LOGICAL_CORRECTION | POSSIBLY — flag: ordering choice has doctrinal implication (does contradiction preserve provenance or does failure block outright) | NO |
| C6 | Q8V2-5 MATCH criteria check target_line and expected_value but not the proposed literal (C7 literal_proposed_text) | LOGICAL_CORRECTION | NO | NO |
| C7 | "Same relative target_line" (Q8V2-5) is not defined | CLARIFICATION | NO | NO |
| C8 | AMBIGUOUS and NO_MATCH retrieval states have no rule that authoritatively produces them | CLARIFICATION | NO | NO |
| C9 | Q8V2-15 falsifiability wording "writes to disk" ambiguously conflicts with Q8V2-11's required outcome-ledger JSONL writes | CLARIFICATION | NO | NO |
| **C10** | **R-10 refinement under-specified: N undefined · "older than N days" semantics undefined · "materially different literal" undefined · age-as-evolution-proxy unproven** | **LOAD_BEARING_POLICY_DECISION** | **YES · Founder Decision A** | NO |
| **C11** | **R-11.1 refinement under-specified: "fresh" undefined · "structural evidence" undefined · double-counting prevention undefined** | **LOAD_BEARING_POLICY_DECISION** | **YES · Founder Decision B** | NO |
| C12 | Q8V2-3 line 107 references Q8V2-13 for general rule application; should be Q8V2-9 | DOCUMENTATION_CORRECTION | NO | NO |
| C13 | Q8V2-8 uses raw D1/D2 fields but Schema V1 field E2 outcome_class is authoritative derived value; derivation rule not stated | CLARIFICATION | NO | NO |
| C14 | Q8V2-1 "independently produced structural evidence" — "independently" is undefined | CLARIFICATION | NO | NO |
| C15 | Q8V2-11 adversarial mitigation ("5B strict outcome verification") does not protect against attacker who triggers genuine failures | LOGICAL_CORRECTION | POSSIBLY — flag: a new mitigation could touch doctrine on trust-decay rate or record deletion (currently forbidden) | NO |

**Flags (for founder attention when reviewing C2, C5, C15):** each of these three could, upon correction, incidentally touch founder-approved doctrine. If the founder wants those handled inside the current freeze rather than in a separate follow-up, they should indicate so.

---

## 3. FOUNDER DECISION A — R-10 PRIOR FAILURE HANDLING

### Problem statement (verbatim from forensic finding)

Current R-10 rule states: *"if `RETRIEVED_PRIOR_FAILURE` is present for a candidate, that candidate's overall_status is downgraded to `CONTRADICTED` (blocking)."*

This creates the chain:

```
PRIOR_FAILURE
  → R-10
  → CONTRADICTED
  → NO_SELECTION
  → no new application
  → no new verification outcome
  → no recovery path
```

Combined with Q8V2-11 (UNTRUSTED experiences map to PRIOR_FAILURE regardless of stored outcome_class), the record becomes permanently blocked. The re-verification path (3 consecutive SUCCESS restores VERIFIED) is unreachable because no application can occur to produce outcomes.

The proposed refinement (§5 of Q8 V2 policy) attempts to allow SUPPORTING evidence to override PRIOR_FAILURE when: (a) the FAILURE record is older than N days AND (b) the tracer produces a materially different literal. The forensic review found the refinement under-specified in six ways:

1. **N** is undefined (proposed at 90, but 90 what days?).
2. **"Older than N days"** has no authoritative time semantics (calendar days? working days? since when — record creation? last reuse? failure event?).
3. **"Materially different literal"** is undefined (different text? different position? different semantic role?).
4. **Age is being used as a proxy for code evolution** — but there is no check that the code has actually evolved.
5. **A different literal does not necessarily mean a different semantic problem** (e.g., `return 41` vs `return 42` both target the same return-literal pattern).
6. **The proposed rule could create temporal confidence decay** — a hidden confidence-like system that reduces failure significance over time.

### Options for founder decision

The founder must select exactly one option (or "Other"). Options are presented without ranking or recommendation.

---

#### OPTION R10-A — NO AGE-BASED REFINEMENT

Reject the proposed age-based mechanism entirely. Prior failure remains evidence; a candidate matching a `RETRIEVED_PRIOR_FAILURE` record is downgraded to `CONTRADICTED` and cannot select. Recovery from failure requires fresh evidence AND completion of the normal investigation/verification pathway (i.e., a new investigation packet that does not retrieve the failed record).

- **What problem it addresses:** eliminates temporal decay confidence system · eliminates age-as-evolution proxy · preserves failure durability
- **What new assumption it introduces:** prior failure is durable evidence · no mechanism escapes failure via time alone
- **What it prevents:** false "expiry" of failure records · hidden temporal confidence decay · attacker-driven bypass by waiting
- **What it does not solve:** the deadlock in C3 remains — an experience that once failed is permanently blocked from selection through retrieval; NEX1 must run a fresh investigation from scratch to re-establish equivalence to the same problem shape
- **What must be defined before implementation:** nothing new (defaults to R-10 as-drafted)
- **Which adversarial test it affects:** Test C would FAIL against founder's stated expectation ("prior failure must be evidence, not absolute prohibition") because failure IS absolute under R10-A

#### OPTION R10-B — EXPLICIT AGE-BASED REFINEMENT

Accept an age-based mechanism, but only after the founder explicitly defines all six of: N · time reference · meaning of "materially different" · required fresh evidence · required semantic comparison · whether code evolution must be directly evidenced · how contradictory evidence is handled during the override.

- **What problem it addresses:** provides escape from deadlock via time-based decay
- **What new assumption it introduces:** age is a valid proxy for problem/code evolution
- **What it prevents:** permanent lockout when underlying code has evolved past the original failure
- **What it does not solve:** does not verify that code has actually evolved (age is proxy, not evidence); does not verify that the new problem is semantically different from the failed one; does not prevent hidden temporal confidence decay
- **What must be defined before implementation:** N (specific numeric value); time reference (record creation timestamp vs last failure timestamp); "materially different" specification (position? text? role?); tracer comparison rule (must produce literal at different line, different text, or both?); contradiction handling if multiple retrievals disagree
- **Which adversarial test it affects:** Test C could PASS if the six definitions are all supplied and internally consistent

#### OPTION R10-C — EVIDENCE-BASED REFINEMENT WITHOUT AGE

Reject age as the basis for escaping prior failure. Instead, allow reconsideration only when fresh evidence demonstrates a materially different problem/context. Implementation specifics deferred to later policy drafting under founder approval.

- **What problem it addresses:** provides escape from deadlock via evidence, not time
- **What new assumption it introduces:** fresh evidence can demonstrate materially different problem/context in a way that overrides prior-failure classification
- **What it prevents:** temporal confidence decay · age-as-evolution proxy · attacker-driven bypass by waiting
- **What it does not solve:** does not specify what constitutes "materially different problem/context"; implementation deferred; provides no immediate procedural rule
- **What must be defined before implementation:** "materially different problem/context" specification (structural difference? semantic difference? both?); sufficient fresh evidence quantity/type; whether tracer-equivalence FAILURE on the new problem qualifies as "materially different"
- **Which adversarial test it affects:** Test C could PASS if evidence-based rule is well-defined at a later stage

#### OPTION R10-D — FOUNDER DEFINES ANOTHER RULE

Allow the founder to specify a mechanism not enumerated above. Claude does not propose one.

- **What problem it addresses:** whatever the founder specifies
- **What new assumption it introduces:** unknown until founder specifies
- **What it prevents:** unknown
- **What it does not solve:** unknown
- **What must be defined before implementation:** entire rule
- **Which adversarial test it affects:** depends on the specified rule

### R10 CONSTRAINTS (must hold under every option)

- No option may create autonomous execution, autonomous modification, execution whitelist, `EXECUTABLE_SELECTED`, permission bypass, or hidden execution.
- No option may weaken `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`.
- No option may make `PRIOR SUCCESS` imply `CURRENT CORRECTNESS`.
- No option may make retrieval alone (without fresh evidence, without tracer confirmation, without preservation-check) drive CHANGE.

### R10 FOUNDER DECISION RECORD · CONFIRMED 2026-09-18

- [ ] R10-A · NO AGE-BASED REFINEMENT
- [ ] R10-B · EXPLICIT AGE-BASED REFINEMENT (requires six definitions)
- [x] **R10-C · EVIDENCE-BASED REFINEMENT WITHOUT AGE** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] R10-D · FOUNDER DEFINES ANOTHER RULE — specify: ___________
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · confirmed via founder message *"NEX1 · FOUNDER DECISION RECORD · R10-C CONFIRMATION · R11 REMAINS UNDECIDED"* dated 2026-09-18
**Date:** **2026-09-18**

**Founder rationale (recorded verbatim):**

> *"An old failure is something NEX1 remembers, not something NEX1 obeys forever. NEX1 must use current evidence to determine whether a historical failure still applies to the current problem."*

> *"Historical failure must not become permanent authority over a new problem. NEX1 should preserve the historical failure, use it as evidence, investigate the current problem, and determine through current evidence whether the historical failure still applies."*

> *"Age must not be used as a substitute for evidence."*

**Selected mechanism:** allow reconsideration of a `RETRIEVED_PRIOR_FAILURE` classification only when fresh evidence demonstrates a materially different problem/context. Age is explicitly rejected as the escape mechanism.

**Implementation prerequisites · explicitly UNRESOLVED (must be defined by founder in a later policy step before Q8 V2 correction):**

- **A · "Materially different problem/context"** — precise definition required. Possible dimensions (not chosen): structural difference · function/call-chain difference · data-flow difference · semantic difference · Fix 23b tracer result. **Claude must not choose among these.**
- **B · Fresh evidence type and quantity** — required type and threshold undefined. **Claude must not invent a threshold.**
- **C · Fix 23b tracer behaviour** — undefined whether tracer refusal, different target, different expected outcome, or other tracer result is sufficient to establish material difference. **Requires later explicit policy definition.**
- **D · Anti-circularity** — historical retrieved evidence must not be allowed to prove that the current problem is materially different from the historical problem. **Principle preserved for later formalization.**

**Constitutional boundaries preserved under R10-C:**

- `MEMORY = EVIDENCE`
- `MEMORY ≠ AUTHORITY`
- `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY`
- `TRUST IN EXPERIENCE ≠ AUTHORITY TO EXECUTE`
- `REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED`
- `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`

**What R10-C does NOT create (preserved invariants):**

- No execution authority
- No modification authority
- No autonomous execution
- No execution whitelist
- No `EXECUTABLE_SELECTED` state
- No age-based decay mechanism
- No confidence weighting
- No permission bypass

**Status:** `R10 = R10-C · FOUNDER CONFIRMED · IMPLEMENTATION_PREREQUISITES_UNRESOLVED`

**No implementation authorised by this record.** Q8 V2 correction remains blocked until R11 is decided AND the four R10-C prerequisites (A/B/C/D above) are defined by the founder.

---

## 4. FOUNDER DECISION B — R-11.1 FRESH SUPPORTING EVIDENCE

### Problem statement (verbatim from forensic finding)

Current R-11 rule states: *"`RETRIEVED_PRIOR_SUCCESS` counts as SUPPORTING evidence in the V1 R-4 SUPPORTING_MAJORITY rule, provided its `E6 trust_status` is `VERIFIED` or `TRUSTED`."*

R-4 (from Q7 policy V1) fires when SUPPORTING count exceeds CONTRADICTING count by at least 1. When CONTRADICTING count = 0 (the common case), a single retrieved SUPPORTING (with `RETRIEVED_PRIOR_SUCCESS` from a VERIFIED experience) satisfies R-4 alone. Therefore memory alone can drive selection.

This contradicts R-11's own stated intent (line 207 of Q8 V2 policy claims "at least one fresh structural evidence is still required" — but the arithmetic does not enforce this).

The forensic review found R-11.1 refinement necessary — not optional — to satisfy the founder-stated adversarial expectation for Test A ("a retrieved candidate must not become execution authority; retrieval-only selection must not occur").

The proposed refinement is under-specified in three ways:

1. **"Fresh"** is not defined.
2. **"Structural evidence"** is not defined.
3. **Double-counting prevention** (whether one candidate that both matches retrieval and has fresh structural evidence attached can satisfy both requirements from a single evidence item) is not specified.

### Options for founder decision

The founder must select exactly one option (or "Other"). Options are presented without ranking or recommendation.

---

#### OPTION R11-A — REQUIRE FRESH SUPPORTING EVIDENCE

Before `RETRIEVED_PRIOR_SUCCESS` can contribute to R-4 SUPPORTING_MAJORITY, require at least one independently generated fresh SUPPORTING structural evidence item. Definitions of "fresh" and "structural evidence" and double-counting prevention deferred to later drafting under founder approval.

- **What problem it addresses:** prevents solo-retrieval SELECTION · aligns runtime with R-11's stated intent
- **What new assumption it introduces:** retrieved evidence is a contributing signal but never sufficient alone
- **What it prevents:** memory-only decisions · retrieval-driven false-green selection · Test-A regression
- **What it does not solve:** "fresh", "structural evidence", "evidence identity", "double-counting" all need explicit definition; implementation deferred
- **What must be defined before implementation:** "fresh" (proposed: `candidate_source == "fresh_generated"`); "structural evidence" (proposed: `STRUCTURALLY_SUPPORTING` class from Fix 13); double-counting rule (proposed: fresh SUPPORTING count and retrieved SUPPORTING count are separate); minimum fresh-supporting-count threshold (proposed: ≥1)
- **Which adversarial test it affects:** Test A becomes falsifiable (solo-retrieval no longer permits SELECTION)

#### OPTION R11-B — RETRIEVED EXPERIENCE CANNOT SATISFY SUPPORTING_MAJORITY AT ALL

Retrieved experience may inform investigation but may not count toward R-4 SUPPORTING_MAJORITY. Only fresh evidence may satisfy R-4. Retrieved SUCCESS still classified as `RETRIEVED_PRIOR_SUCCESS` and reported, but does not participate in the SUPPORTING count.

- **What problem it addresses:** absolute exclusion of retrieved from R-4; strongest possible protection against retrieval-driven selection
- **What new assumption it introduces:** retrieval's value is informational only for the selection stage; retrieval still guides investigation and Q8V2-9 R-9/R-10 downgrades still fire
- **What it prevents:** all memory-influenced selections; any retrieval-driven false-green
- **What it does not solve:** reduces retrieval's contribution to selection to zero; retrieval can still surface superficial mismatches (R-9) and prior failures (R-10) but not support new candidates
- **What must be defined before implementation:** confirmation that R-9 and R-10 still fire under this option (proposed: yes — R-9 downgrades on SUPERFICIAL, R-10 blocks on PRIOR_FAILURE, only R-11 is disabled)
- **Which adversarial test it affects:** Test A becomes trivially safe (no retrieval-driven selection possible); Test B and Test D unaffected

#### OPTION R11-C — FOUNDER DEFINES ANOTHER RULE

Allow the founder to specify a mechanism not enumerated above. Claude does not propose one.

- **What problem it addresses:** whatever the founder specifies
- **What new assumption it introduces:** unknown until founder specifies
- **What it prevents:** unknown
- **What it does not solve:** unknown
- **What must be defined before implementation:** entire rule
- **Which adversarial test it affects:** depends on the specified rule

### R11 CONSTRAINTS (must hold under every option)

- No option may permit retrieval alone to authorize CHANGE.
- No option may create autonomous execution.
- No option may make `RETRIEVED_PRIOR_SUCCESS` equivalent to a SELECTED authority.
- No option may bypass Q8V2-15 hard execution boundary.

### R11 FOUNDER DECISION RECORD · CONFIRMED 2026-09-18

- [ ] R11-A · REQUIRE FRESH SUPPORTING EVIDENCE (requires later definitions)
- [x] **R11-B · RETRIEVED EXPERIENCE CANNOT SATISFY SUPPORTING_MAJORITY** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] R11-C · FOUNDER DEFINES ANOTHER RULE — specify: ___________
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · confirmed via founder message *"NEX1 · FOUNDER DECISION · R11-B CONFIRMATION · MEMORY GUIDES INVESTIGATION, CURRENT EVIDENCE PROVES"* dated 2026-09-18
**Date:** **2026-09-18**

**Exact R11-B meaning (recorded verbatim):**

> *"Retrieved prior experience may inform and guide investigation, but retrieved experience must NEVER contribute to the SUPPORTING evidence count used by R-4 SUPPORTING_MAJORITY. Only fresh, independently generated current evidence may contribute to the SUPPORTING count."*

**Constitutional reason (recorded verbatim):**

> *"Memory should inform investigation, not replace investigation."*

**Architectural chain approved under R11-B:**

```
MEMORY
    ↓
GUIDES INVESTIGATION
    ↓
CURRENT PROBLEM IS INVESTIGATED
    ↓
FRESH CURRENT EVIDENCE
    ↓
PROOF / SUPPORT
```

NOT:

```
MEMORY  +  FRESH EVIDENCE  →  COMBINED PROOF
```

### R11-B authoritative rule table

**`RETRIEVED_PRIOR_SUCCESS` MAY:**
- identify a potentially relevant historical experience
- guide investigation
- identify a candidate pattern for examination
- provide historical context
- be reported as retrieved evidence
- trigger further investigation

**`RETRIEVED_PRIOR_SUCCESS` MUST NOT:**
- contribute to SUPPORTING count
- contribute to CONTRADICTING count
- satisfy SUPPORTING_MAJORITY (R-4)
- substitute for fresh evidence
- increase the proof weight of a current candidate
- create current applicability merely because it succeeded historically
- authorize modification
- authorize execution

### Critical invariant

```
RETRIEVED EXPERIENCE = EVIDENCE ABOUT THE PAST

RETRIEVED EXPERIENCE ≠ CURRENT PROOF
```

### Relationships (recorded)

- **Relationship to `MEMORY = EVIDENCE · MEMORY ≠ AUTHORITY`:** R11-B is a strict specialisation of this principle for the SUPPORTING count. Memory remains evidence about the past; it cannot enter the R-4 count that supports current conclusions.
- **Relationship to R-4 SUPPORTING_MAJORITY (Q7 V1 · founder-approved 2026-09-17):** R-4 remains unchanged. R11-B constrains which candidates may be counted by R-4 — specifically, retrieved candidates are excluded from the SUPPORTING count. R-4's count-based arithmetic remains intact for fresh evidence.
- **Relationship to `RETRIEVED_PRIOR_SUCCESS` evidence class:** the class remains defined (Q8V2-8). Retrieval still fires. The class still appears in reporting (Q8V2-14 · `retrieved_evidence_contributed` field). It is only excluded from the SUPPORTING count that R-4 arithmetic consumes.

### Confirmations preserved under R11-B

- Retrieved experience remains useful for investigation. ✓
- Retrieved experience cannot contribute to SUPPORTING. ✓
- Retrieved experience cannot authorize modification. ✓
- Retrieved experience cannot authorize execution. ✓
- The retrieval-safety-gate (Q8V2-9 R-9 SUPERFICIAL downgrade) still fires. ✓
- The prior-failure downgrade rule (per R10-C evidence-based reconsideration) still applies to retrieved failure classifications. ✓

### Long-term learning meaning (recorded)

As the experience store grows (10 · 100 · 10,000 · 1,000,000 experiences), NEX1 may become increasingly capable of:

- recognising patterns
- finding relevant experiences
- forming investigation candidates
- choosing where to investigate
- avoiding repeated blind searches

But:

```
MORE MEMORY  ≠  MORE CURRENT PROOF
```

Therefore:

```
EXPERIENCE ACCUMULATION  →  INVESTIGATION EFFICIENCY
```

NOT:

```
EXPERIENCE ACCUMULATION  →  AUTOMATICALLY GREATER PROOF WEIGHT
```

### R11-B does NOT mean "memory is ignored"

Correct statement:

```
MEMORY = INVESTIGATION INPUT

CURRENT EVIDENCE = PROOF INPUT
```

NEX1 still learns from experience. R11-B specifically prevents historical success from becoming current proof.

### What R11-B does NOT create

- No execution authority
- No modification authority
- No autonomous execution
- No execution whitelist
- No `EXECUTABLE_SELECTED` state
- No confidence weighting on retrieval
- No permission bypass
- No new autonomous capability

### Status

`R11 = R11-B · FOUNDER CONFIRMED · LOAD-BEARING`

**No implementation authorised by this record.** Q8 V2 correction remains blocked (see §8 below). Fix 24 remains blocked.

---

## 5. TEST IMPACT MAP

Effect of each decision on the five adversarial tests. This table describes only which test each decision affects. **It does not claim any test passes.** Current status of each test remains `NOT_PROVEN`.

| Decision | Test A · genuine match | Test B · superficial | Test C · prior failure | Test D · insufficient | Test E · contradictory |
|---|---|---|---|---|---|
| R10-A | not directly affected | not directly affected | **FAIL** (prior failure absolute) | not directly affected | not directly affected |
| R10-B | not directly affected | not directly affected | conditional PASS (needs six definitions) | not directly affected | may be affected (contradiction handling under override) |
| R10-C | not directly affected | not directly affected | conditional PASS (needs later spec) | not directly affected | may be affected |
| R10-D | depends on rule | depends on rule | depends on rule | depends on rule | depends on rule |
| R11-A | **falsifiable** (solo-retrieval prevented) | not directly affected | not directly affected | not directly affected | may be affected (contribution counting under contradiction) |
| R11-B | **trivially safe** (retrieval never counts) | not directly affected | not directly affected | not directly affected | not directly affected |
| R11-C | depends on rule | depends on rule | depends on rule | depends on rule | depends on rule |

**Overall test-suite status: `NOT_PROVEN`.** No adversarial test has been executed against a corrected policy. Founder decisions on R-10 and R-11.1 will change the falsifiability landscape but do not themselves execute any test.

---

## 6. POST-DECISION PROCESS

Locked sequence — do not skip steps:

```
FORENSIC FINDINGS FROZEN                    [this document · 2026-09-18]
        ↓
FOUNDER DECIDES R-10                        [Founder Decision A · §3]
        ↓
FOUNDER DECIDES R-11.1                      [Founder Decision B · §4]
        ↓
DOCUMENT-ONLY Q8 V2 v2 REVISION             [applies C1-C15 corrections
                                             under founder-approved rule
                                             direction · no code]
        ↓
FULL FORENSIC REVIEW AGAIN                  [17-section review against v2]
        ↓
ONLY IF CLEAN                               [Q8_V2_POLICY_FORENSICALLY_CLEAN]
        ↓
FOUNDER REVIEW / APPROVAL                   [operational policy signature]
        ↓
ONLY THEN CONSIDER FIX 24 PHASE A           [pre-build audit · READ-ONLY]
```

**Forbidden shortcuts:**

- Skipping the second forensic review is forbidden.
- Moving directly to Fix 24 Phase A without founder approval of the corrected policy is forbidden.
- Applying C1-C15 corrections before founder disposition of C10 and C11 is forbidden (because C3 and C4 corrections depend on the R-10 and R-11.1 decisions).
- Claude may not propose the R-10 or R-11.1 mechanism during Q8 V2 v2 revision — Claude only applies whatever the founder specified.

---

## 7. CHANGE AUDIT

**Verification of authorised-scope compliance in this task:**

- Source code changed: **NO**
- Q8 V2 policy changed: **NO**
- Experience Schema V1 changed: **NO**
- Fix 24 implementation: **NO**
- Q8 V2 implementation: **NO**
- R-10 implementation: **NO**
- R-11.1 implementation: **NO**
- Q8 V1 changed: **NO**
- Fix 23b changed: **NO**
- Fix 23c changed: **NO**
- Tests created in source code: **NO**
- Registries changed: **NO**
- Runtime behaviour changed: **NO**
- Execution authorized: **NO**
- Autonomous execution added: **NO**
- New trust system invented: **NO**
- New confidence system invented: **NO**
- C10 silently resolved: **NO** — presented as founder decision A with four options, no recommendation
- C11 silently resolved: **NO** — presented as founder decision B with three options, no recommendation
- Any founder decision invented: **NO**
- Any option ranked: **NO**
- Any option recommended: **NO**

**Documentation files created by this task:** exactly one (this document at `docs/doctrine/nex1-q8-v2-forensic-findings-freeze-2026-09-18.md`).

**All verification conditions met.**

---

## 8. FINAL STATUS · UPDATED 2026-09-18 (R10-C confirmed; R11-B confirmed; all four R10-C prerequisites confirmed)

# **`Q8_V2_FORENSIC_FINDINGS_FROZEN · ALL_SIX_FOUNDER_DECISIONS_CONFIRMED · Q8_V2_V2_REVISION_UNBLOCKED_BUT_NOT_YET_AUTHORED`**

**Founder decisions status:**

- ✅ Founder Decision A · R-10 = **R10-C · EVIDENCE-BASED REFINEMENT WITHOUT AGE** · confirmed 2026-09-18
- ✅ Founder Decision B · R-11 = **R11-B · RETRIEVED EXPERIENCE CANNOT SATISFY SUPPORTING_MAJORITY** · confirmed 2026-09-18
- ✅ R10-C-1 = **D · COMPOSITE** · confirmed 2026-09-18 (see `nex1-r10c-prerequisites-decision-instrument-2026-09-18.md` §13 and `nex1-r10c-prerequisites-founder-confirmed-and-architectural-dependencies-2026-09-18.md`)
- ✅ R10-C-2 = **C · INDEPENDENT VERIFICATION** · confirmed 2026-09-18
- ✅ R10-C-3 = **D · NECESSARY BUT NOT SUFFICIENT** · confirmed 2026-09-18
- ✅ R10-C-4 = **D · COMPOSITE ANTI-CIRCULARITY** · confirmed 2026-09-18

**All six decisions are load-bearing. Neither the decisions nor the confirmation of the four prerequisites authorise implementation.**

The Q8 V2 v2 operational-policy correction is now sequencable but not yet authored:

1. Q8 V2 v2 must apply R10-C-1 D dimension definitions + R10-C-2 C provenance semantics + R10-C-3 D sufficient-mechanism specs + R10-C-4 D three sub-mechanism specs · plus C1-C15 forensic corrections
2. Multiple `FUTURE CAPABILITY · NOT IMPLEMENTED` items must be honestly labelled (see companion architectural-dependencies doc §2 for the nine capabilities)
3. Second forensic review must complete cleanly before founder approval
4. Only after founder approval of Q8 V2 v2 does Fix 24 Phase A pre-build audit become permitted

**Fix 24 remains blocked. Autonomous execution remains not authorised.**

**Thirteen findings (C1, C2, C3, C4, C5, C6, C7, C8, C9, C12, C13, C14, C15) are frozen as pending corrections.** They may be applied in a document-only Q8 V2 v2 revision only after founder disposition of C10 and C11, because C3 and C4 corrections depend on the R-10 and R-11.1 decisions.

**Three findings (C2, C5, C15) are flagged as possibly requiring incidental founder input during correction; founder may indicate whether to handle these inside the current freeze or as a separate follow-up.**

**Nothing about the Q8 V2 policy has been improved, resolved, or amended by this document. The findings are preserved exactly as the forensic review recorded them.**

Zero code. Zero implementation. Zero autonomous execution. Zero founder decisions inferred. This document is a decision-preparation artifact only.
