# NEX1 · Q8 V2 v2 · Founder Decisions Recorded · F1 / F2 / F4 / F6 / F10

**Date:** 2026-09-18
**Author (recorder):** master_ai_engineer (Claude Opus 4.7)
**Status:** `FOUNDER_DECISIONS_RECORDED`
**Founder:** Philip O'Farrell (via founder message *"NEX1 · Q8 V2 v2 · Founder Decision Recording — F1 / F2 / F4 / F6 / F10"* dated 2026-09-18)
**Companion:** `docs/doctrine/nex1-q8-v2-founder-decision-instrument-f1-f2-f4-f6-f10-2026-09-18.md` (the instrument from which these options were selected)

**Recording discipline:** this document records the founder's decisions verbatim. It does not paraphrase option names. It does not resolve sub-decisions. It does not authorise implementation.

---

## §1 · Decision Status

**`FOUNDER_DECISIONS_RECORDED`** — all five decisions explicitly supplied.

---

## §2 · Frozen Precedent (unchanged)

| Decision | Value | Status |
|---|---|---|
| R10 | R10-C · EVIDENCE-BASED WITHOUT AGE | **UNCHANGED** |
| R11 | R11-B · RETRIEVED EXPERIENCE NEVER SATISFIES SUPPORTING-MAJORITY | **UNCHANGED** |
| R10-C-1 | D · COMPOSITE | **UNCHANGED** |
| R10-C-2 | C · INDEPENDENT VERIFICATION | **UNCHANGED** |
| R10-C-3 | D · NECESSARY BUT NOT SUFFICIENT | **UNCHANGED** |
| R10-C-4 | D · COMPOSITE ANTI-CIRCULARITY | **UNCHANGED** |

**Constitutional invariants preserved (verbatim):**

```
REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED
RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY
SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED
DESCRIBE ≠ IMPLEMENT ≠ WIRE ≠ EXECUTE ≠ VERIFY
```

---

## §3 · F1 Decision

### `F1 = C`

**Selected option:** **C — Separate Retrieval Attempt From Retrieval Contribution**

NEX1 must distinguish:

```
RETRIEVAL_ATTEMPTED
```

from:

```
RETRIEVAL_RETURNED_USABLE_CANDIDATE
```

Honest Degrade must not trigger merely because retrieval was attempted. The special retrieval/degrade policy applies only when retrieval actually returns a usable experience that contributes to the investigation.

### Founder rationale (verbatim)

> *"A retrieval attempt that produces no usable experience must not suppress independent fresh investigation. Otherwise, `NO_MATCH` would incorrectly behave like `MEMORY_CONTRIBUTED` and could block evidence that had nothing to do with retrieved experience. This preserves the constitutional principle `RETRIEVED EXPERIENCE = EVIDENCE, NOT AUTHORITY` while preventing retrieval machinery itself from becoming an evidence-blocking mechanism."*

### Direct policy consequence

Q8 V2 v2 §10.2's Honest Degrade rule must be reformulated to key on a **retrieval-contribution flag** (whether retrieval produced a usable candidate that was injected into ACTION 11's `root_cause_candidates[]`), not on **retrieval attempt** (whether retrieval was consulted at all). Under F1-C, a packet with `retrieval_attempted == true · retrieval_returned_usable_candidate == false` continues to admit fresh evidence normally.

### Current-capability consequence

Under current architecture:
- The `retrieval_experience_id` field on packets is a retrieval-attempt indicator, not a contribution indicator
- No `retrieval_returned_usable_candidate` flag exists in Schema V1 or in any ACTION output
- The distinction F1-C requires cannot be represented by current runtime instrumentation

### Future-capability dependency

- A `retrieval_returned_usable_candidate: boolean` marker (or equivalent field distinguishing attempted-vs-contributed) must be produced by the retrieval layer at generation-time
- If this field is added to Schema V1, that constitutes a Schema V1 amendment (founder-approved separately)
- If this field lives only on the runtime packet (not persisted), it does not amend Schema V1 but requires ACTION-level instrumentation

### Unresolved prerequisite

`DEPENDENCY REQUIRES FURTHER FOUNDER DEFINITION` — the founder must eventually specify:
- Where the `retrieval_returned_usable_candidate` flag lives (Schema V1 field vs runtime-only packet field)
- Whether the flag is set by the retrieval layer or by the injector (ACTION 11)
- The exact set of retrieval outcomes that count as "returned a usable candidate" (MATCH? MATCH+REJECT-of-superficial? MATCH-with-tracer-equivalence-verified only?)

Founder has not resolved these sub-decisions in this task. Recorded as pending.

### Important limitation (founder statement)

**This does NOT authorize implementation of retrieval yet.** The distinction must first be defined precisely in the Q8 V2 policy. If the current Schema V1 cannot represent the distinction, that capability gap must be explicitly recorded rather than invented.

---

## §4 · F2 Decision

### `F2 = B`

**Selected option:** **B — Prior Failure Guides, Never Blocks**

A previously retrieved failure may inform the investigation. It must not itself prevent:
- fresh investigation
- new evidence gathering
- a new hypothesis
- a new selection when current evidence independently supports it

Prior failure is historical evidence about what happened previously. **It is not a permanent veto.**

### Founder rationale (verbatim)

> *"NEX1 must be capable of learning from failure without becoming permanently trapped by failure. The principle is `PRIOR FAILURE = GUIDANCE` not `PRIOR FAILURE = AUTHORITY` and not `PRIOR FAILURE = PERMANENT VETO`. This also preserves R10 = R10-C · EVIDENCE-BASED WITHOUT AGE. No age decay or confidence-weighting mechanism is introduced. A current investigation must be evaluated using current admissible evidence."*

### Direct policy consequence

Q8 V2 v2 §11.2 (`PRIOR_FAILURE ≠ NEVER_RETRY`) and §5.2 (`RETRIEVED_PRIOR_FAILURE · May contribute to R-4 SUPPORTING count: NO`) remain intact. Additionally:
- `RETRIEVED_PRIOR_FAILURE` may enter ACTION 11's candidate reasoning as historical guidance
- `RETRIEVED_PRIOR_FAILURE` MUST NOT trigger any automatic candidate blocking, permanent prohibition, or unconditional CONTRADICTED classification
- Current investigation's fresh evidence is the sole basis for the current candidate's overall_status

### Current-capability consequence

Under current architecture: retrieval is absent, so this rule has no runtime instantiation today. Once retrieval exists, this rule specifies the semantic role of PRIOR_FAILURE evidence within Q8 V2.

**Interaction with F1-C:** if a retrieval returns `RETRIEVED_PRIOR_FAILURE` as a usable candidate, F1-C's degrade applies (contribution triggers special handling). F2-B ensures the PRIOR_FAILURE's semantic role is guidance-only within that handling.

### Future-capability dependency

None new beyond F1-C's dependencies. F2-B is a semantic-role rule that operates on retrieved evidence once retrieval exists.

### Unresolved prerequisite

No new prerequisites. F2-B is fully specified by the founder's rationale under the guardrails "no age decay · no confidence-weighting · R10-C preserved."

### Explicit preservation

- No age-based decay introduced ✓
- No confidence weighting introduced ✓
- No treatment of historical failure as authority ✓
- R10 = R10-C preserved ✓

---

## §5 · F4 Decision

### `F4 = C`

**Selected option:** **C — Separate Contradiction Path**

When fresh evidence contradicts retrieved experience, contradiction must remain visible as a **distinct unresolved condition**. Contradiction must not silently disappear merely because retrieval occurred. The contradiction pathway must not automatically become ordinary supporting evidence or an automatic selection mechanism.

### Founder rationale (verbatim)

> *"The system must preserve the distinction between `RETRIEVED EXPERIENCE` and `CURRENT CONTRADICTORY EVIDENCE`. If contradiction exists, NEX1 must be able to represent `UNRESOLVED` rather than collapsing the situation into `INSUFFICIENT_EVIDENCE` simply because retrieval occurred. This preserves falsifiability. Contradiction visibility is not the same as authority to select."*

### Direct policy consequence

Q8 V2 v2 must introduce (or make explicit) a distinct contradiction-representation mechanism that is not silenced by F1-C's Honest Degrade. Options include:
- A new selection state (e.g., `UNRESOLVED_CONTRADICTION` distinct from Q8 V1's ordinary `UNRESOLVED`), OR
- A separate packet-level field (e.g., `contradiction_flags[]`) that surfaces contradictions even when R-4 count is degraded

The exact mechanism is not authored in this task; F4-C establishes that **some** such mechanism must exist and must preserve contradiction visibility.

**Contradiction visibility is not selection authority.** F4-C does not authorise the contradiction path to produce a SELECTED outcome; it only ensures the contradiction is observably reported.

### Current-capability consequence

Under current architecture: no contradiction-representation-distinct-from-selection mechanism exists. Q8 V1's `UNRESOLVED` state is a selection state consumed by R-4 arithmetic; it does not survive degrade. F4-C requires that a separate contradiction channel be authored.

### Future-capability dependency

- A packet-level or selection-state-level contradiction marker distinct from R-4 count arithmetic
- Reporting-contract update in Q8 V2 v2 §14.3 or §5 to include a contradiction-visibility field
- May require Schema V1 extension IF the contradiction record is persisted (founder-approved amendment required)

### Unresolved prerequisite

`DEPENDENCY REQUIRES FURTHER FOUNDER DEFINITION` — the founder must eventually specify:
- Whether the contradiction path introduces a new selection-state token (adds to the six existing ones) or lives as a separate packet field
- Whether contradiction records are persisted to Schema V1 or ephemeral to the packet only
- The exact conditions under which contradiction is emitted (any `STRUCTURALLY_CONTRADICTING` fresh evidence? some subset?)

Founder has not resolved these sub-decisions in this task. Recorded as pending.

---

## §6 · F6 Decision

### `F6 = C`

**Selected option:** **C — Constitutional Global Rule, Operationally Phased**

The constitutional principle applies across NEX1:

```
MEMORY INFORMS BUT DOES NOT BECOME PROOF
```

and:

```
RETRIEVED EXPERIENCE NEVER SATISFIES SUPPORTING-MAJORITY
```

However, operational enforcement must be **phased** according to the provenance capabilities that actually exist. Q8 V2 v2 must NOT falsely claim that all memory pathways are already governed when the necessary provenance mechanisms do not yet exist.

### Founder rationale (verbatim)

> *"The constitutional rule should not depend on the name of the memory subsystem. If a memory pathway can influence evidence, the underlying principle must eventually apply. However, `POLICY ≠ CAPABILITY`. Therefore NEX1 must not pretend that every memory pathway is already provenance-controlled. Known memory-shaped systems remain explicitly identified as capability/scope gaps until the necessary mechanisms exist. This preserves the distinction `CONSTITUTIONAL SCOPE = GLOBAL` while `RUNTIME ENFORCEMENT = CAPABILITY-DEPENDENT`."*

### Direct policy consequence

Q8 V2 v2 must:
- State constitutional scope as global — R11-B and the memory-not-authority principle apply to every memory pathway in NEX1
- State operational enforcement scope as capability-dependent — Q8 V2 v2 today enforces only against pathways for which provenance capability exists
- Explicitly enumerate the memory-shaped pathways discovered in the pre-Fix-24 baseline as `FUTURE CAPABILITY GAP · CONSTITUTIONAL RULE APPLIES · OPERATIONAL ENFORCEMENT PENDING`

### Known memory-shaped pathways (from pre-Fix-24 baseline)

Explicitly listed and preserved per the decision instrument §7:

1. `src/lib/knowledge/*` (searchKnowledge · uses `minConfidence` threshold)
2. `src/lib/nex/programmer-learning/*` (readKnowledge / readSkills / readExperiences / readEvents)
3. `src/lib/nex-code-brain/knowledge-store.ts`
4. `src/lib/nex-agent-runtime/memory.ts` (audit-grade Ed25519-signed)
5. `src/lib/nex-agent/code-engine/capability-m-file-memory/*` (file-memory tag lookup · ACTION 2)

Under F6-C, all five are covered by the constitutional principle but NOT operationally enforced by Q8 V2 v2 today. Each remains a documented gap.

### Current-capability consequence

Under current architecture: none of the five pathways carry provenance sufficient to enforce R11-B against them. Q8 V2 v2's operational enforcement remains scoped to the Fix 17 investigation-conclusion pathway (once retrieval capability exists there).

Under F6-C, evidence produced by any of the five pathways today enters Q8 selection as untagged fresh — the current runtime behaviour is unchanged, but the constitutional gap is now explicitly recorded rather than silently accepted.

### Future-capability dependency

- Provenance tagging on each of the five memory pathways (each requires its own capability work, potentially per-pathway founder authorisation)
- A registry that records which pathways are currently under operational enforcement and which remain gaps
- Reporting contract update: Q8 V2 v2 output must disclose per-packet which memory pathways were in scope for the current investigation and their provenance status

### Unresolved prerequisite

`DEPENDENCY REQUIRES FURTHER FOUNDER DEFINITION` — the founder must eventually specify:
- Which pathways are targeted for future operational enforcement (all five? subset?)
- Priority ordering of the extension work
- Whether new memory-shaped subsystems added to NEX1 in future automatically inherit constitutional coverage under F6-C

Founder has not resolved these sub-decisions in this task. Recorded as pending.

### Explicit preservation

Q8 V2 v2 scope is not automatically expanded to include the five pathways operationally. Each remains a documented `FUTURE CAPABILITY GAP` until specific founder authorisation to include it.

---

## §7 · F10 Decision

### `F10 = B`

**Selected option:** **B — Conservative Indeterminate**

If any safety-relevant dimension required for the composite comparison is not implemented, the aggregate result must be:

```
INDETERMINATE
```

rather than:

```
NOT_MATERIALLY_DIFFERENT
```

### Founder rationale (verbatim)

> *"NEX1 must not convert `UNKNOWN` into `SAME`. If a semantic or other safety-relevant dimension cannot currently be evaluated, NEX1 cannot honestly claim that the objects are materially equivalent across that dimension. Therefore `NOT IMPLEMENTED ≠ NO DIFFERENCE` and `UNKNOWN ≠ SAME`. The composite result may only become `NOT_MATERIALLY_DIFFERENT` when the required safety-relevant dimensions have actually been evaluated. This preserves the existing founder decision R10-C-1 = D · COMPOSITE while making the meaning of unavailable dimensions conservative and explicit."*

### Direct policy consequence

Q8 V2 v2 §6.2's aggregation rule must be revised. The current v2 rule states:

> *"NOT_MATERIALLY_DIFFERENT iff every dimension either (a) reports 'not different' or (b) is FUTURE CAPABILITY · NOT IMPLEMENTED"*

Under F10-B this rule becomes:

> *"NOT_MATERIALLY_DIFFERENT iff every safety-relevant dimension is (a) IMPLEMENTED AND (b) reports 'not different'. If any safety-relevant dimension is NOT IMPLEMENTED, the aggregate result is INDETERMINATE."*

### Current-capability consequence

Under current architecture:
- Structural dimension: IMPLEMENTED (Fix 23b + Schema V1 Block C fields)
- Semantic dimension: NOT IMPLEMENTED
- Behavioural dimension: PARTIALLY IMPLEMENTED (Schema V1 Block D fields exist; comparison rule requires founder policy definition)
- Contextual dimension: NOT IMPLEMENTED

Under F10-B, **any Q8 V2 v2 composite material-difference evaluation today emits `INDETERMINATE`** (because at minimum the semantic dimension is NOT IMPLEMENTED, and semantic role is safety-relevant per the F10 problem statement). The `NOT_MATERIALLY_DIFFERENT` verdict becomes unreachable under current capability.

This is the founder's explicit choice. It is not a defect.

### Composite retrieval-state consequence

Under F10-B, the composite emits INDETERMINATE → Q8 V2 retrieval state escalates to `REQUIRE_MORE_INVESTIGATION` (per Q8 V2 v2 §4.6). Under F1-C, if retrieval did not return a usable candidate, degrade does not fire and fresh investigation proceeds independently. Under F1-C + F10-B, most retrieval attempts today would emit `REQUIRE_MORE_INVESTIGATION` at the retrieval state, at which point fresh investigation carries the decision.

### Future-capability dependency

- Semantic dimension capability (requires `semantic_role` field on Schema V1 OR a zero-LLM semantic classifier)
- Contextual dimension capability (call-site analysis · invariant model)
- Behavioural dimension full specification (comparison rule for sibling-test-outcome divergence)
- Founder-approved list of which dimensions are "safety-relevant" (some dimensions may not gate the composite)

### Unresolved prerequisite

`DEPENDENCY REQUIRES FURTHER FOUNDER DEFINITION` — the founder must eventually specify:
- Which of the four dimensions are "safety-relevant" (all four? subset?)
- Whether a dimension can be marked `NOT SAFETY-RELEVANT` and thus not required for `NOT_MATERIALLY_DIFFERENT`
- Whether behavioural dimension's "partial implementation" counts as IMPLEMENTED for aggregation purposes

Founder has not resolved these sub-decisions in this task. Recorded as pending.

### Explicit preservation

- R10-C-1 = D · COMPOSITE preserved ✓
- `NOT IMPLEMENTED ≠ NO DIFFERENCE` explicitly enforced ✓
- `UNKNOWN ≠ SAME` explicitly enforced ✓

---

## §8 · Cross-decision consistency check

Testing each pair for logical contradiction. Each pair is neutrally evaluated.

### F1 + F2 · retrieval degrade vs prior-failure semantics

- F1-C says: degrade fires only when retrieval returns a usable candidate
- F2-B says: prior failure never permanently blocks
- **Interaction:** if retrieval returns `RETRIEVED_PRIOR_FAILURE` (usable candidate contributed), F1-C's degrade engages. Under F2-B, PRIOR_FAILURE's semantic role remains guidance-only within the degrade; PRIOR_FAILURE does not become a permanent veto. The two rules operate at different layers (F1 = R-4 admission; F2 = evidence-class semantic role). **No contradiction.**

### F1 + F4 · retrieval degrade vs contradiction visibility

- F1-C says: degrade blocks fresh evidence from R-4 when retrieval contributes
- F4-C says: contradiction must remain visible via a separate path
- **Interaction:** F4-C's separate contradiction path is architecturally distinct from R-4 count arithmetic. Under F1-C, R-4 is degraded when retrieval contributes; under F4-C, contradiction visibility survives that degrade via a distinct channel. **No contradiction.**

### F1 + F6 · retrieval degrade vs global constitutional scope

- F1-C says: degrade fires on retrieval-contribution from any covered pathway
- F6-C says: constitutional scope is global, operational enforcement is phased per capability
- **Interaction:** F1-C's degrade currently applies to the Fix 17 pathway (the only pathway with retrieval capability planned). Other pathways (file-memory · programmer-learning · code-brain-knowledge · audit-grade memory · knowledge-search) are documented `FUTURE CAPABILITY GAP` per F6-C, and F1-C's degrade will extend to them only as their provenance capability lands. **No contradiction.**

### F1 + F10 · retrieval degrade vs composite material difference

- F1-C says: degrade fires on retrieval-contribution
- F10-B says: unimplemented safety-relevant dimension → INDETERMINATE
- **Interaction:** F10-B's INDETERMINATE at composite → REQUIRE_MORE_INVESTIGATION retrieval state → no candidate injected (per Q8 V2 v2 §4.6). If no candidate is injected, retrieval did not return a usable candidate, so F1-C's degrade does not fire. F10-B's conservative default is upstream of F1-C's degrade condition. **No contradiction.**

### F2 + F4 · prior-failure guidance vs contradiction handling

- F2-B says: prior failure guides, never permanently blocks
- F4-C says: contradiction gets a separate path
- **Interaction:** if a candidate has both `RETRIEVED_PRIOR_FAILURE` (F2 domain) and fresh `STRUCTURALLY_CONTRADICTING` evidence (F4 domain), F2-B ensures the PRIOR_FAILURE's semantic role is guidance-only, and F4-C ensures the fresh contradiction is visible via the separate path. Both rules operate at different layers. **No contradiction.**

### F6 + F10 · memory scope vs dimension aggregation

- F6-C says: constitutional scope global · operational per-capability
- F10-B says: unimplemented safety-relevant dimension → INDETERMINATE
- **Interaction:** F6-C determines which memory pathways are under Q8 V2 v2 operational enforcement. F10-B determines the composite material-difference verdict. If F6-C extends operational enforcement to more pathways in future, F10-B's rule applies to each pathway's composite comparison uniformly. **No contradiction.**

### Summary

**`FOUNDER DECISIONS ARE INTERNALLY CONSISTENT`**

No contradictions detected across all six pair-wise interactions. The five decisions form a coherent architectural direction:

- F1-C prevents retrieval machinery from becoming an evidence-blocking mechanism when nothing was actually retrieved
- F2-B prevents prior failure from becoming a permanent authority
- F4-C preserves contradiction visibility even under degrade
- F6-C honestly distinguishes constitutional scope from operational enforcement
- F10-B prevents "UNKNOWN" from being misread as "SAME"

Under all five, **memory guides but never proves. Contradiction stays visible. Unknown stays unknown. Constitutional scope is honest.**

---

## §9 · Aggregate implementation gate

Recording these decisions does **NOT** authorise implementation.

Prohibited by this task (verbatim from founder's implementation gate):

- Modifying Q8 V2 v2
- Modifying Schema V1
- Writing source code
- Creating runtime retrieval
- Creating provenance
- Implementing contradiction search
- Implementing dual-path investigation
- Implementing composite semantic equivalence
- Implementing retry logic
- Implementing Fix 24
- Running runtime tests
- Rerunning the baseline
- Beginning autonomous execution

**Next stage (per founder):** `Q8 V2 DOCUMENTATION CORRECTION`.

Nothing beyond that.

---

## §10 · Sub-decisions surfaced as future prerequisites

Recorded honestly per founder's "sub-decisions" rule. **None of these are resolved by this task.**

| Decision | Unresolved prerequisite |
|---|---|
| F1-C | Location + population rule of `retrieval_returned_usable_candidate` flag; exact set of retrieval outcomes that count as "contribution" |
| F2-B | None new (fully specified by rationale + guardrails) |
| F4-C | Whether contradiction path is a new selection state OR a packet field; whether contradiction records are persisted; emission conditions |
| F6-C | Priority ordering of pathway coverage; whether new memory subsystems inherit coverage automatically; per-pathway founder authorisation |
| F10-B | Which dimensions are "safety-relevant"; whether behavioural partial-implementation counts as IMPLEMENTED for aggregation |

All labelled `DEPENDENCY REQUIRES FURTHER FOUNDER DEFINITION`. None resolved silently.

---

## §11 · Final report

### Founder decisions recorded

```
F1 = C · Separate Retrieval Attempt From Retrieval Contribution
F2 = B · Prior Failure Guides, Never Blocks
F4 = C · Separate Contradiction Path
F6 = C · Constitutional Global Rule, Operationally Phased
F10 = B · Conservative Indeterminate
```

### Frozen precedent

```
R10 = R10-C · UNCHANGED
R11 = R11-B · UNCHANGED
R10-C-1 = D · UNCHANGED
R10-C-2 = C · UNCHANGED
R10-C-3 = D · UNCHANGED
R10-C-4 = D · UNCHANGED
```

### Consistency

**`FOUNDER DECISIONS ARE INTERNALLY CONSISTENT`**

### Side effects

| Item | Status |
|---|---|
| Source code | NONE |
| Schema V1 | NONE |
| Q8 V2 implementation | NONE |
| Runtime traffic | NONE |
| Tests | NONE |
| Baseline rerun | NONE |
| Fix 24 | NOT IMPLEMENTED |
| Autonomous execution | NOT AUTHORIZED |
| Existing founder decisions | NONE CHANGED |
| Sub-decisions resolved silently | NONE |

### Status

**`FOUNDER_DECISIONS_RECORDED`**

### Next gate

**`NEXT GATE = Q8 V2 DOCUMENTATION CORRECTION`** (separately authorised · not begun in this task)

**STOP.**
