# NEX1 Q8 Root-Cause Selection Policy · V1 · FOUNDER-APPROVED

**Policy ID:** `NEX1_Q8_SELECTION_POLICY`
**Policy version:** `V1`
**Effective status:** `FOUNDER_APPROVED`
**Founder approval:** ✅ APPROVED
**Approved on:** 2026-09-17
**Approved by:** founder (explicit 19-decision authorization · this session)
**Authoring role of Claude:** finalizer only · applied founder decisions verbatim · no interpretation · no substitution · no invention
**Governs:** Q8 · Root-Cause Selection · Q7 (ranking) remains governed by `NEX1_RANKING_POLICY V1`
**Supersedes:** (none — first approved Q8 version)
**Predecessor documents (historical trail — DO NOT overwrite):**
- `docs/doctrine/nex1-q8-architecture-audit-2026-09-17.md`
- `docs/doctrine/nex1-q8-founder-decision-review-2026-09-17.md`
- `docs/doctrine/nex1-ranking-policy-v1-founder-approved-2026-09-17.md` (Q7 · unrelated · unchanged)

**Q8 implementation status:** NOT_IMPLEMENTED (policy first · mechanism second · proof third)
**Q8 mechanism:** NOT_IMPLEMENTED
**Q8 runtime status:** NOT_VERIFIED
**Track A status:** FROZEN
**External model participation in this policy:** NONE
**Production code changes at approval:** 0

---

## 0 · Policy vs Mechanism · Non-Negotiable Separation

This document is a **POLICY** for Q8.

- **Policy** = what NEX1 is authorized to consider when deciding whether one candidate should be selected as the root cause. Founder-defined.
- **Mechanism** = code that implements the policy. NOT_IMPLEMENTED. A separate future founder authorization is required.
- **Proof** = runtime verification that the mechanism obeys the policy. Not applicable until the mechanism exists.

> **POLICY FIRST · MECHANISM SECOND · PROOF THIRD.**

Nothing in this document authorizes writing Q8 code. Nothing in this document authorizes connecting `nex-debugger` to NEX1. Nothing in this document authorizes modifying the existing Q7 ranking policy or the Fix 15 ranking mechanism.

---

## 0.1 · Distinctions Preserved (non-negotiable · inherited from prior founder rulings)

```
RANK  ≠  SELECTION  ≠  ROOT CAUSE
RANK 1  ≠  SELECTED
RANK 1  ≠  PROVEN ROOT CAUSE
SELECTED  ≠  ABSOLUTE PROOF
SELECTED  ≠  MODIFIED
SELECTED  ≠  EXECUTED
SELECTED  ≠  VERIFIED
STRUCTURALLY SUPPORTED  ≠  ABSOLUTE PROOF
INFERRED  ≠  OBSERVED
UNKNOWN  ≠  PROVEN
INSUFFICIENT  ≠  UNRESOLVED
TIE  ≠  SELECTION
UNRESOLVED_ORDER  ≠  ROOT CAUSE
```

None of these may be silently bridged by any Q8 mechanism.

---

## 1 · Founder Decisions Recorded (19 · verbatim intent)

### Decision 1 · Build Q8 → **A · BUILD Q8**

Q8 is authorized to be built for the NEX1 native investigation pipeline. Implementation itself remains **NOT AUTHORIZED** until a separate founder authorization is issued and Decision 19 preconditions are satisfied.

### Decision 2 · Relationship with `nex-debugger` → **A · KEEP INDEPENDENT**

NEX1 Q8 remains independent from `nex-debugger`. `nex-debugger` is not connected, absorbed, or reused as the NEX1 Q8 selection mechanism unless separately authorized in the future. `nex-debugger` remains its own `COMPONENT_COMPLETE` system.

### Decision 3 · Meaning of `SELECTED` (verbatim)

> SELECTED means that NEX1 has determined, under the approved Q8 evidence rules, that one candidate currently has sufficient evidence to be designated as the selected root-cause candidate for the investigation.
>
> SELECTED does not mean absolute proof.
> SELECTED does not mean permanently proven.
> SELECTED does not authorize modification.
> SELECTED does not authorize execution.
> SELECTED does not bypass verification.
>
> If the evidence does not satisfy the Q8 selection conditions, NEX1 must not select a candidate.

### Decision 4 · Evidence dimensions and thresholds (verbatim rules)

Q8 must use explicit evidence categories already produced by the NEX1 investigation pipeline.

**Primary evidence dimensions:**
- supporting evidence
- contradicting evidence
- insufficient evidence
- unresolved evidence
- evidence provenance
- relationship/evidence identity

**Rules:**
- Contradicting evidence is BLOCKING.
- Unresolved evidence is BLOCKING.
- Insufficient evidence is BLOCKING.
- Supporting evidence MAY support selection.
- Evidence MUST be traceable to observed investigation evidence.
- Evidence MUST NOT be fabricated.
- Evidence MUST NOT be upgraded from INFERRED to OBSERVED.
- Evidence MUST retain provenance.
- NO hidden numerical weighting.
- NO arbitrary scoring model.
- NO filename-based preference.
- NO candidate-ID preference.
- NO array-order preference.
- NO timestamp preference.
- NO database-order preference.
- NO execution-order preference.

The selection mechanism must use **explicit deterministic policy rules** rather than an opaque score.

### Decision 5 · Tie behaviour (verbatim)

If two or more candidates satisfy the same highest Q8 selection position and no authorized evidence differentiates them:

```
DO NOT SELECT ONE.
Return: TIE  and  NO_SELECTION.
```

A tie must never be silently broken. There must be no hidden tie-breaker.

### Decision 6 · Rank-1-with-blocking (verbatim)

A candidate ranked #1 by Q7 must **NOT** be selected if it has Q8-blocking evidence.

```
RANK 1 + BLOCKING EVIDENCE  ≠  SELECTED
```

The Q8 decision must override any assumption that rank 1 automatically means root cause. Ranking identifies ordering. Q8 determines whether the evidence permits selection.

### Decision 7 · Non-structural evidence (verbatim)

Q8 MAY use non-structural evidence when that evidence has been legitimately produced and recorded by the NEX1 investigation pipeline, including where available and properly evidenced:

- runtime observations
- test failures
- logs
- behavioural observations
- verification observations

**Rules:**
- Such evidence must have provenance.
- Unverified claims must NOT be treated as observed evidence.
- External-model claims must NOT become native NEX1 evidence merely because an external model produced them.

### Decision 8 · Allow "no root cause" → **YES**

NEX1 MUST be allowed to return `NO_SELECTION` / `NO_ROOT_CAUSE`.

NEX1 MUST prefer honest uncertainty over forced selection.

If evidence is insufficient, contradictory, unresolved, tied, or otherwise fails the Q8 selection conditions:

```
NO_SELECTION  must be permitted.
```

NEX1 must never invent certainty simply because the investigation requires an answer.

### Decision 9 · Ranked → selected bridge (verbatim)

There MUST be an explicit Q8 bridge:

```
candidate_rankings
    ↓
Q8 evidence evaluation
    ↓
Q8 selection policy
    ↓
candidate_selection
```

Ranking alone is never sufficient.

```
RANKED  ≠  SELECTED
```

A rank-1 candidate enters Q8 as a candidate. Q8 must independently evaluate the candidate against the approved selection policy.

### Decision 10 · Deterministic vs model-assisted → **NATIVE DETERMINISTIC**

Q8 must be deterministic and native. The Q8 selection decision MUST NOT depend on an external LLM. No Claude · GPT · Gemini · Llama · or other external model may decide which candidate NEX1 selects. External models may exist elsewhere in the wider system, but they must NOT secretly become the Q8 selection authority.

### Decision 11 · Confidence → **INFORMATIONAL ONLY**

Confidence is informational only. Confidence must NOT secretly become a numerical selection weight. Confidence must NOT override evidence. Confidence must NOT break ties. Confidence must NOT promote a candidate over another candidate. Confidence MAY be reported as part of the evidence context, but the Q8 selection decision must be determined by the explicit Q8 policy.

### Decision 12 · Provenance (verbatim required fields)

Every Q8 decision MUST preserve sufficient provenance to reconstruct why the decision occurred.

At minimum, preserve:

- `investigation_id`
- `trace_id`
- `candidate_id`
- `source_file`
- source line/range where applicable
- evidence identifiers
- relationship identifiers where applicable
- `evidence_kind`
- evidence status
- Q8 policy ID
- Q8 policy version
- selection state
- decision reason

Provenance must allow a later verifier to trace the decision back to the evidence.

### Decision 13 · Reproducibility → **YES**

Given the same investigation evidence, same candidate set, and same policy version:

```
Q8 must produce the same result.
```

There must be no dependence on:

- randomness
- timestamps
- array order
- filename ordering
- candidate IDs
- database ordering
- execution timing
- hidden model calls

unless explicitly part of the founder-approved policy (none are so authorized in V1).

### Decision 14 · Structural-only evidence (verbatim)

Structural evidence alone MAY produce a candidate selection only when it satisfies the complete Q8 selection policy. Structural evidence must NOT automatically be treated as absolute root-cause proof.

```
STRUCTURALLY SUPPORTED  ≠  ABSOLUTE PROOF
```

Q8 may select a candidate based on structural evidence if the approved policy says the evidence threshold has been met and no blocking evidence exists.

### Decision 15 · INSUFFICIENT vs UNRESOLVED (verbatim · distinct states)

**INSUFFICIENT_EVIDENCE** means:
> There is not enough evidence available to make the required selection decision.

**UNRESOLVED** means:
> Relevant evidence exists, but the investigation has not resolved the competing possibilities or uncertainty.

Both states BLOCK selection. Neither state may be silently converted into `SELECTED`.

### Decision 16 · Q8 output shape (verbatim required fields)

Q8 must produce a structured result containing, at minimum:

- `investigation_id`
- `trace_id`
- `selection_state`
- `selected_candidate`
- candidate rankings
- candidates considered
- supporting evidence
- contradicting evidence
- insufficient evidence
- unresolved evidence
- decision reason
- confidence
- provenance
- `policy_id`
- `policy_version`
- uncertainty
- recommended next action

If no candidate can be selected:

```
selected_candidate = null
```

and the selection state must explicitly communicate why.

### Decision 17 · Q8 boundaries (verbatim)

Q8 is responsible for:

```
RANKED CANDIDATES  →  EVIDENCE EVALUATION  →  SELECTION DECISION
```

Q8 is NOT responsible for:

- modifying code
- writing files
- executing code
- authorizing execution
- applying corrections
- claiming absolute proof
- bypassing verification
- replacing the authority system
- replacing Q7 ranking
- silently becoming the root-cause correction system

Therefore:

```
SELECTED  ≠  MODIFIED
SELECTED  ≠  EXECUTED
SELECTED  ≠  VERIFIED
```

A selected candidate must still pass the later appropriate stages.

### Decision 18 · REQUIRE_MORE_INVESTIGATION (verbatim)

Q8 must return:

```
REQUIRE_MORE_INVESTIGATION
```

when:

- evidence is insufficient
- relevant evidence remains unresolved
- candidates remain tied
- blocking evidence prevents selection
- required provenance is missing
- the selection conditions cannot be satisfied
- the available evidence does not justify a selection

Q8 must not force a selection merely to complete the investigation.

### Decision 19 · Preconditions before implementation (verbatim · ALL required)

Before Q8 implementation begins, the following MUST exist:

1. Founder-approved Q8 policy. ✅ (this document)
2. Explicit Q8 input/output contract. ⬜
3. Explicit evidence-state definitions. ⬜ (partially covered by Decisions 4/15 · full contract-form still required)
4. Explicit selection rules. ⬜
5. Explicit blocking rules. ⬜ (partially covered by Decision 4/6 · full contract-form still required)
6. Explicit tie rules. ⬜ (partially covered by Decision 5 · full contract-form still required)
7. Explicit `NO_SELECTION` behaviour. ⬜ (partially covered by Decision 8 · full contract-form still required)
8. Explicit `REQUIRE_MORE_INVESTIGATION` behaviour. ⬜ (partially covered by Decision 18 · full contract-form still required)
9. Explicit provenance requirements. ⬜ (partially covered by Decision 12 · full contract-form still required)
10. Deterministic behaviour requirements. ⬜ (partially covered by Decision 13 · full contract-form still required)
11. Negative controls. ⬜
12. Tests proving rank 1 does not automatically become root cause. ⬜
13. Tests proving ties are not silently resolved. ⬜
14. Tests proving blocking evidence prevents selection. ⬜
15. Tests proving insufficient evidence prevents selection. ⬜
16. Tests proving unresolved evidence prevents selection. ⬜
17. Tests proving confidence cannot alter selection. ⬜
18. Tests proving filename/candidate-ID/array-order cannot alter selection. ⬜
19. Runtime verification against real NEX1 evidence. ⬜
20. Founder authorization before activation. ⬜

Only precondition 1 is satisfied by this document. **No implementation may begin until all remaining preconditions are satisfied.** The next founder-directed step is a Q8 connect-before-build architecture audit against this finalized policy · not writing the selection code.

---

## 2 · Canonical Policy Record (from Decisions above)

### 2.1 · `policy_id`
```
NEX1_Q8_SELECTION_POLICY
```

### 2.2 · `policy_version`
```
V1
```

### 2.3 · `effective_status`
```
FOUNDER_APPROVED
```

### 2.4 · `founder_approval`
```
APPROVED
```

### 2.5 · `scope` (Decision 1 · Decision 2)
```
Q8 root-cause selection over candidates already produced by the NEX1 native
investigation pipeline (Fix 12 candidates · Fix 13 evaluations · Fix 14
comparisons · Fix 15 rankings). Independent of nex-debugger.
```

### 2.6 · `bridge_contract` (Decision 9)
```
Input:   candidate_rankings (Fix 15 · V1 Q7 policy)
Step 1:  Q8 evidence evaluation (per Decision 4)
Step 2:  Q8 selection policy (per this document)
Output:  candidate_selection (per Decision 16)
```
Ranking alone is never sufficient (Decision 9). `RANKED ≠ SELECTED`.

### 2.7 · `selected_meaning` (Decision 3 · verbatim)
```
SELECTED means that NEX1 has determined, under the approved Q8 evidence
rules, that one candidate currently has sufficient evidence to be designated
as the selected root-cause candidate for the investigation.
```
Not proof. Not permanent. Not modification authority. Not execution authority. Not verification bypass.

### 2.8 · `evidence_dimensions` (Decision 4)
```
Primary: supporting · contradicting · insufficient · unresolved ·
         provenance · relationship/evidence identity.

Blocking:      contradicting · unresolved · insufficient  (any presence blocks selection)
Supporting:    MAY support selection.
Traceability:  every evidence item must trace to observed investigation evidence.
Fabrication:   forbidden.
Upgrading:     INFERRED → OBSERVED forbidden.
Weighting:     no numerical weights · no scoring model.
Preference:    no filename / candidate-ID / array-order / timestamp /
               database-order / execution-order preference.
Mechanism:     explicit deterministic policy rules · not opaque score.
```

### 2.9 · `tie_rule` (Decision 5)
```
If two or more candidates satisfy the same highest Q8 selection position
and no authorized evidence differentiates them:

    selection_state = TIE
    outcome         = NO_SELECTION

No hidden tie-breaker permitted.
```

### 2.10 · `rank_one_blocking_rule` (Decision 6)
```
Rank-1 (per V1 Q7 policy) does NOT automatically become SELECTED.

If rank-1 has any Q8-blocking evidence (contradicting · unresolved · insufficient):

    selected_candidate = null  (unless the founder-approved policy explicitly
                                 permits selection despite that blocker · V1
                                 does NOT permit any exception)
```

### 2.11 · `non_structural_evidence_rule` (Decision 7)
```
Non-structural evidence MAY be used when legitimately produced by the NEX1
investigation pipeline · with provenance · not fabricated · not upgraded ·
not laundered through an external model.

Categories permitted where available and properly evidenced:
    runtime observations · test failures · logs · behavioural observations ·
    verification observations.
```

### 2.12 · `no_selection_rule` (Decision 8)
```
NO_SELECTION is a first-class outcome.

NEX1 must prefer honest uncertainty over forced selection.

selected_candidate = null  when evidence is insufficient / contradictory /
                            unresolved / tied / otherwise fails policy.
```

### 2.13 · `deterministic_rule` (Decision 10)
```
Q8 = NATIVE DETERMINISTIC.
No external LLM (Claude · GPT · Gemini · Llama · other) may decide the
selection. External models may exist elsewhere in the wider system, but
must NEVER secretly become the Q8 selection authority.
```

### 2.14 · `confidence_rule` (Decision 11)
```
Confidence = INFORMATIONAL ONLY.
Never a numerical selection weight.
Never overrides evidence.
Never breaks ties.
Never promotes a candidate.
May be surfaced in evidence context · never determines the decision.
```

### 2.15 · `provenance_requirements` (Decision 12 · minimum fields)
```
investigation_id · trace_id · candidate_id · source_file ·
source line/range where applicable · evidence identifiers ·
relationship identifiers where applicable · evidence_kind ·
evidence status · Q8 policy ID · Q8 policy version ·
selection state · decision reason.

Every Q8 decision must be reconstructable back to the underlying evidence.
```

### 2.16 · `reproducibility_rule` (Decision 13)
```
Identical inputs (investigation evidence · candidate set · policy version)
must produce identical Q8 outputs.

Forbidden dependencies: randomness · timestamps · array order · filename
ordering · candidate IDs · database ordering · execution timing · hidden
model calls.
```

### 2.17 · `structural_evidence_ceiling` (Decision 14)
```
Structural evidence alone MAY produce a selection ONLY when the complete
Q8 policy is satisfied.

STRUCTURALLY SUPPORTED  ≠  ABSOLUTE PROOF

Structural evidence never automatically becomes proof.
```

### 2.18 · `state_definitions` (Decision 15 · non-mergeable)
```
INSUFFICIENT_EVIDENCE:  "There is not enough evidence available to make
                        the required selection decision."
UNRESOLVED:             "Relevant evidence exists, but the investigation has
                        not resolved the competing possibilities or uncertainty."

Both BLOCK selection. Neither may be silently converted to SELECTED.
```

### 2.19 · `output_contract` (Decision 16 · minimum fields)
```
investigation_id · trace_id · selection_state · selected_candidate ·
candidate_rankings (input) · candidates_considered · supporting_evidence ·
contradicting_evidence · insufficient_evidence · unresolved_evidence ·
decision_reason · confidence · provenance · policy_id · policy_version ·
uncertainty · recommended_next_action.

selected_candidate = null  when no candidate can be selected · selection_state
must explicitly communicate why.
```

### 2.20 · `boundary_rules` (Decision 17)
```
Q8 responsibility:      RANKED CANDIDATES → EVIDENCE EVALUATION → SELECTION.

Q8 NOT responsible for: modifying code · writing files · executing code ·
                        authorizing execution · applying corrections ·
                        claiming absolute proof · bypassing verification ·
                        replacing the authority system · replacing Q7 ranking ·
                        silently becoming the root-cause correction system.

SELECTED  ≠  MODIFIED
SELECTED  ≠  EXECUTED
SELECTED  ≠  VERIFIED
```

### 2.21 · `require_more_investigation_rule` (Decision 18)
```
Q8 must return REQUIRE_MORE_INVESTIGATION when:

- evidence is insufficient
- relevant evidence remains unresolved
- candidates remain tied
- blocking evidence prevents selection
- required provenance is missing
- selection conditions cannot be satisfied
- available evidence does not justify a selection

Q8 must not force a selection to complete an investigation.
```

### 2.22 · `implementation_preconditions` (Decision 19)
See §1 · Decision 19. Only precondition 1 (policy) is satisfied by this document. All others remain outstanding before implementation may begin.

---

## 3 · Selection State Vocabulary (derived from decisions 3, 5, 8, 15, 18)

Q8 selection outcomes:

| State | Meaning | selected_candidate |
|---|---|---|
| `SELECTED` | Candidate satisfies the complete Q8 policy (Decision 3) | non-null (single candidate_id) |
| `NO_SELECTION` | No candidate meets the policy · umbrella honest-uncertainty state (Decision 8) | null |
| `TIE` | Multiple candidates tied at highest Q8 position with no authorized differentiator (Decision 5) | null |
| `INSUFFICIENT_EVIDENCE` | Not enough evidence available (Decision 15) | null |
| `UNRESOLVED` | Evidence exists but competing possibilities not resolved (Decision 15) | null |
| `REQUIRE_MORE_INVESTIGATION` | Selection conditions unmet · investigation should continue (Decision 18) | null |

These states are **non-overlapping**: `TIE`, `INSUFFICIENT_EVIDENCE`, `UNRESOLVED`, `REQUIRE_MORE_INVESTIGATION`, and `NO_SELECTION` are distinct outcomes. A Q8 mechanism must not silently collapse them.

`NO_SELECTION` may function as a residual outcome when no more-specific state applies.

---

## 4 · Explicit Prohibitions (aggregated from all 19 decisions · defence-in-depth)

The finalized Q8 policy explicitly prohibits:

- ✅ Rank 1 automatically becoming root cause (Decision 6 · §0.1)
- ✅ Filename tie-breaking (Decision 4)
- ✅ Candidate-ID tie-breaking (Decision 4)
- ✅ Array-order tie-breaking (Decision 4)
- ✅ Timestamp tie-breaking (Decision 4)
- ✅ Hash tie-breaking (Decision 4 · Decision 13)
- ✅ Database-order tie-breaking (Decision 4)
- ✅ Creation-order tie-breaking (Decision 4 · Decision 13)
- ✅ Execution-order tie-breaking (Decision 4 · Decision 13)
- ✅ Hidden numerical weighting (Decision 4)
- ✅ Hidden confidence weighting (Decision 11)
- ✅ Silent tie resolution (Decision 5)
- ✅ Unsupported causal claims (Decision 3)
- ✅ Fabrication of evidence (Decision 4)
- ✅ Converting UNKNOWN into PROVEN (Decision 3 · §0.1)
- ✅ Converting INFERRED into OBSERVED (Decision 4 · §0.1)
- ✅ Using `nex-debugger` authority merely because it exists (Decision 2)
- ✅ Automatic modification (Decision 17)
- ✅ Automatic execution (Decision 17)
- ✅ Bypassing authorization (Decision 17)
- ✅ Bypassing verification (Decision 17)
- ✅ External-model-decided selection (Decision 10)
- ✅ Confidence overriding evidence (Decision 11)
- ✅ Provenance-less decisions (Decision 12)
- ✅ Silent conversion of INSUFFICIENT → SELECTED (Decision 15)
- ✅ Silent conversion of UNRESOLVED → SELECTED (Decision 15)
- ✅ Forced selection to complete an investigation (Decision 18)

Any future Q8 mechanism must enforce these prohibitions at runtime (mirror of Fix 15's `PROHIBITED_RANKING_FIELDS` + `FORBIDDEN_CAUSAL_TOKENS` pattern).

---

## 5 · Comparison Against Q7 Ranking Policy (V1 · FOUNDER_APPROVED)

Per §"Compare Against Existing Doctrine" step:

| Aspect | Q7 (V1 ranking policy) | Q8 (this policy) |
|---|---|---|
| Question answered | Which candidate occupies the highest evidence-policy position? | Is there sufficient evidence to select one candidate as the root cause? |
| Scope | Same source_file within same investigation | Consumes Q7 rankings; adds evidence-evaluation and selection layer |
| Rule chain | R-1..R-5 lexicographic (contradiction · unresolved · insufficient · supporting majority · tie) | Founder-authored rules per Decisions 4-8 · with explicit selection states per §3 |
| Numerical weights | Forbidden | Forbidden (Decision 4) |
| Confidence | Not used | Informational only (Decision 11) |
| Provenance | Informational only | REQUIRED (Decision 12 · minimum fields listed) |
| Reproducibility | Deterministic per Fix 15 | Required by policy (Decision 13) |
| External model | Zero LLM | Zero LLM (Decision 10) |
| Outcome vocabulary | RANKED · TIED · UNRESOLVED_ORDER | SELECTED · NO_SELECTION · TIE · INSUFFICIENT_EVIDENCE · UNRESOLVED · REQUIRE_MORE_INVESTIGATION |
| Bridge into next stage | Terminus of Q7 → Q8 evaluation | Terminus of Q8 → downstream stages (verification / action) · NOT self-authorized to modify or execute |
| Fix 15 mechanism | RUNTIME_VERIFIED | Not applicable · Q8 mechanism NOT_IMPLEMENTED |

**Q7 policy is UNCHANGED.** This document does not modify, rewrite, weaken, or interpret V1. Q8 consumes Q7's `candidate_rankings` as input to its own separate evaluation and selection layer.

The two policies coexist:
- V1 (Q7) governs `rank_position` / `ranking_state` outputs.
- V1 (Q8) governs `selection_state` / `selected_candidate` outputs.

---

## 6 · Policy Validation

| # | Check | Result |
|---|---|---|
| 1 | All 19 founder decisions recorded | ✅ verbatim in §1 |
| 2 | No decision changed | ✅ founder wording preserved |
| 3 | No unresolved decision | ✅ 19/19 explicit |
| 4 | No policy invented beyond decisions | ✅ every rule traces to a decision |
| 5 | Q7 ranking policy unchanged | ✅ file untouched · comparison in §5 confirms |
| 6 | `nex-debugger` unchanged | ✅ Decision 2 = KEEP INDEPENDENT · no imports · no bridge |
| 7 | Track A untouched | ✅ no G15 / C6 / Ed25519 / WO-04 / execution-broker changes |
| 8 | Production code changes | ✅ 0 |
| 9 | Q8 mechanism created | ✅ 0 (per Decision 19 preconditions · 19 of 20 outstanding) |
| 10 | External model used | ✅ NONE |
| 11 | Deterministic requirement stated | ✅ Decision 10 · Decision 13 · §2.13 · §2.16 |
| 12 | RANK ≠ SELECTED preserved | ✅ Decisions 6, 9 · §0.1 |
| 13 | NO_SELECTION first-class | ✅ Decision 8 · §2.12 · §3 |
| 14 | Reproducibility required | ✅ Decision 13 · §2.16 |
| 15 | Provenance required | ✅ Decision 12 · §2.15 |
| 16 | Prohibitions aggregated | ✅ §4 · 27 items enumerated |
| 17 | Commits | ✅ 0 |
| 18 | Pushes | ✅ 0 |

---

## 7 · Decision Trail

```
Q8 ARCHITECTURE AUDIT (2026-09-17)
    └── nex1-q8-architecture-audit-2026-09-17.md
         (Claude · diagnostic-only · classified Q8 NOT_IMPLEMENTED in NEX1
          pipeline · discovered nex-debugger as parallel unconnected engine)
        ↓
Q8 FOUNDER DECISION REVIEW (2026-09-17)
    └── nex1-q8-founder-decision-review-2026-09-17.md
         (Claude · 19-decision review sheet · all decisions ⬜ NOT YET GIVEN)
        ↓
EXPLICIT FOUNDER DECISIONS (2026-09-17)
    (in-session founder authorization message · 19/19 supplied)
        ↓
FOUNDER-APPROVED Q8 POLICY V1 (2026-09-17 · THIS DOCUMENT)
    └── nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md
         (effective_status = FOUNDER_APPROVED)
```

Historical documents are preserved unchanged. This document is the authoritative Q8 policy record.

---

## 8 · Post-Approval Locks

- **Q8 mechanism** · NOT_IMPLEMENTED · requires satisfaction of Decision 19 preconditions AND a separate founder authorization
- **Q8 runtime** · NOT_VERIFIED (no mechanism exists to verify)
- **`nex-debugger` connection** · NOT authorized · Decision 2 = INDEPENDENT
- **Q7 ranking policy** · UNCHANGED
- **Fix 15 ranking mechanism** · UNCHANGED
- **Track A** · FROZEN (Ed25519 · C6 · G15 · WO-04 · authority activation untouched)
- **Production code** · UNCHANGED at time of approval
- **Q8 verification tests** · NOT CREATED (Decision 19 preconditions 11-19)
- **Q8 selection code** · NOT CREATED

Any future work that would touch the above requires an explicit, separate authorization prompt from the founder.

---

## 9 · Next Founder-Directed Step

Per the founder's instruction (recorded verbatim):

> "The next technical step after this should be a Q8 connect-before-build architecture audit against the finalized policy, not immediately writing the selection code."

This document does not authorize that audit. A separate authorization prompt is required.

When such an audit is authorized, it should:
- Trace this policy's Decision 19 preconditions (2-20) against the current repository state
- Identify which preconditions can be satisfied by existing capabilities (connect-before-build)
- Identify which preconditions require new capability (build)
- Classify each precondition · **not** implement any
- Preserve `nex-debugger` independence (Decision 2)
- Preserve Q7 unchanged
- Preserve Track A frozen

---

## 10 · Governing Rule

> The founder decides what "selected" means. → §2.7 (Decision 3 verbatim)
> The policy records that decision. → §1-§4 verbatim
> Q8 mechanism (when authorized) will implement that decision. → NOT_IMPLEMENTED
> Runtime verification (when authorized) will prove implementation obeys it. → NOT_VERIFIED
>
> RANK ≠ SELECTED ≠ ROOT CAUSE.
>
> **POLICY FIRST · MECHANISM SECOND · PROOF THIRD.**

---

*End of NEX1_Q8_SELECTION_POLICY V1 · FOUNDER-APPROVED · 2026-09-17*
