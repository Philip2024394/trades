# NEX1 Ranking Policy · V1 · FOUNDER-APPROVED

**Policy ID:** `NEX1_RANKING_POLICY`
**Policy version:** `V1`
**Effective status:** `FOUNDER_APPROVED`
**Founder approval:** ✅ APPROVED
**Approved on:** 2026-09-17
**Approved by:** founder (explicit 19-decision authorization)
**Authoring role of Claude:** finalizer only · applied founder decisions verbatim · no interpretation · no substitution
**Supersedes:** (none — first approved version)
**Predecessor documents (historical trail — DO NOT overwrite):**
- `docs/doctrine/nex1-ranking-policy-v1-draft-2026-09-17.md`
- `docs/doctrine/nex1-ranking-policy-v1-founder-decision-review-2026-09-17.md`

**Track A status:** FROZEN
**Fix 15 status:** NOT IMPLEMENTED (blocked pending separate authorization)
**Q8 status:** NOT IMPLEMENTED (out of scope for this policy)
**External model participation in implementation:** NONE (this is a policy document · not code)
**Production code changes at policy approval:** 0

---

## 0 · Policy vs Mechanism · Non-Negotiable Separation

This document is a **POLICY**.

- **Policy** = what NEX1 is authorized to consider when ranking candidates. Founder-defined.
- **Mechanism** = how the policy is implemented in code. Fix 15's future scope.
- **Proof** = runtime verification that the mechanism obeys the policy. Fix 15 verification's future scope.

> POLICY FIRST · MECHANISM SECOND · PROOF THIRD.

Fix 15 is **not** authorized by this document. A separate founder authorization is required before any ranking mechanism, ranking algorithm, ranking score, or ranking test is created.

---

## 1 · Design Bias (Founder-Approved · Decision 19)

> **When the authorized evidence does not meaningfully discriminate between candidates, NEX1 must prefer an explicit TIE / UNRESOLVED_ORDER outcome rather than manufacture a ranking preference.**

This is a founder-approved principle · not a Claude proposal. It governs interpretation of every rule below in edge cases.

---

## 2 · Canonical Policy Record (§6 required fields · founder decisions applied)

### 2.1 · `policy_id`
```
NEX1_RANKING_POLICY
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

### 2.5 · `ranking_scope` (Decision 1 · APPROVE V1)
```
Same source file within the same investigation.
```
Candidates are ranked only when they share:
- the same `source_file` scope, AND
- the same investigation packet (identified by `investigation_id`).

Cross-file comparisons are out of scope. Cross-investigation comparisons are out of scope.

### 2.6 · `evidence_precedence` (Decision 2 · APPROVE V1)

Ranking is decided by a strict lexicographic rule chain. Rules are evaluated top-to-bottom · the first rule that produces a difference decides ordering. If no rule produces a difference · the result is a TIE (per §2.16).

```
R-1 · CONTRADICTION_BLOCK
R-2 · UNRESOLVED_BLOCK
R-3 · INSUFFICIENT_BLOCK
R-4 · SUPPORTING_MAJORITY
R-5 · TIE
```

The full behavior of each rule appears in §2.8 (R-1) · §2.10 (R-2) · §2.9 (R-3) · §2.7 (R-4) · §2.16 (R-5).

### 2.7 · `supporting_rule` (Decision 3 · APPROVE V1 · governs R-4)
```
COUNT-BASED equal-weight supporting evidence.

A strictly greater number of valid supporting evidence items
may differentiate candidates when the applicable higher-precedence
rules do not prevent ranking.
```

- Each valid STRUCTURALLY_SUPPORTING evidence item counts as 1.
- Higher count outranks lower count under R-4 only.
- If R-1, R-2, or R-3 apply, R-4 does not fire.
- No numerical weights (see §2.12).

### 2.8 · `contradicting_rule` (Decision 4 · APPROVE V1 · governs R-1)
```
BLOCKING.

A candidate with CONTRADICTING evidence cannot outrank a candidate
with zero CONTRADICTING evidence.

If both candidates contain CONTRADICTING evidence,
this rule does not by itself differentiate them.
```

- Exactly one candidate has CONTRADICTING evidence → the other outranks.
- Both candidates have CONTRADICTING evidence → R-1 does not differentiate · evaluation proceeds to R-2 (per §2.10 rule flow: differentiate under later rule OR fall through to TIE / UNRESOLVED_ORDER).

Note: the founder's DRAFT §2.6 formulation "both candidates contradicted → UNRESOLVED_ORDER (do not rank)" is preserved as a valid interpretation. In the founder-approved form, when both candidates carry CONTRADICTING evidence, ranking cannot proceed unless a later rule creates a difference. If no later rule produces a difference · the result is UNRESOLVED_ORDER per §2.18.

### 2.9 · `insufficient_rule` (Decision 5 · APPROVE V1 · governs R-3)
```
BLOCKING.

INSUFFICIENT evidence prevents a candidate from gaining
a ranking advantage over a candidate that does not have
the applicable insufficiency condition.

If both candidates are affected equally, the rule does
not differentiate them.
```

- Exactly one candidate has INSUFFICIENT evidence for the aspect under consideration → the other outranks.
- Both candidates are equally affected → R-3 does not differentiate · evaluation proceeds.

### 2.10 · `unresolved_rule` (Decision 6 · APPROVE V1 · governs R-2)
```
BLOCKING.

UNRESOLVED evidence prevents a candidate from gaining
a ranking advantage where the unresolved condition applies.

If both candidates are affected equally, the rule does
not differentiate them.
```

**Preserved invariant:**
```
UNRESOLVED ≠ CONTRADICTING
```

UNRESOLVED must not be silently promoted to CONTRADICTING. R-1 handles CONTRADICTING · R-2 handles UNRESOLVED · they are distinct.

### 2.11 · `shared_evidence_rule` (Decision 7 · APPROVE V1)
```
Shared evidence does not differentiate candidates.

Evidence shared by both candidates must not create an artificial
ranking advantage for either candidate.

Shared evidence must not be double-counted.
```

Under R-4 · shared supporting evidence contributes 0 to the differentiation calculus for either candidate. Only unique supporting evidence contributes (see §2.12).

### 2.12 · `unique_evidence_rule` (Decision 8 · APPROVE V1)
```
Unique supporting evidence contributes by equal count under R-4.

A-only and B-only supporting evidence may therefore contribute
to the supporting-evidence comparison.
```

- A-only supporting count = number of STRUCTURALLY_SUPPORTING evidence items on A that are not shared with B.
- B-only supporting count = the mirror of the above.
- R-4 compares these unique counts. Ties under R-4 fall through to §2.16.

### 2.13 · `weighting_model` (Decision 9 · APPROVE V1)
```
NO NUMERICAL WEIGHTS.

Do not create a numerical scoring system.

Ranking must use the explicit lexicographic policy rather
than an invented numerical score.
```

- No weights.
- No composite scores.
- No aggregate numeric ranks beyond the ordinal position produced by the lexicographic chain.

### 2.14 · `precedence_model` (derived from Decision 2)
```
LEXICOGRAPHIC.
```

Precedence between rules is fixed by the R-1 → R-5 chain in §2.6. There is no numerical trade-off between rules. R-1 always precedes R-2 · R-2 always precedes R-3 · R-3 always precedes R-4 · R-4 always precedes R-5. This model is a direct consequence of Decisions 2 and 9 · it introduces no new founder decision.

### 2.15 · `confidence_rule` (Decision 10 · APPROVE V1)
```
CONFIDENCE NOT USED FOR Q7 RANKING.

Confidence must not silently influence candidate ordering.
```

**Preserved invariants:**
```
confidence ≠ truth
confidence ≠ automatic rank
```

Confidence values may be surfaced diagnostically but must never enter the ranking function.

### 2.16 · `tie_rule` (Decision 13 · APPROVE V1)
```
Explicit TIE state.

When candidates are indistinguishable under the authorized ranking policy:
    result = TIE

Equal candidates share the same rank position.
The next distinct rank position skips accordingly.

No hidden tie-breaker is permitted.
```

**PROHIBITED as tie-breakers (Decision 13 explicit list · reaffirmed in §5 below):**
- `filename`
- `candidate_id`
- array position
- `timestamp`
- hash
- creation order
- database order
- alphabetical order
- source order
- execution order

Any implementation that produces deterministic ordering by silently reading one of these fields violates the policy.

### 2.17 · `minimum_difference_rule` (Decision 14 · APPROVE V1)
```
A minimum difference of Δ ≥ 1 valid supporting evidence item
under R-4 is required to differentiate otherwise eligible candidates.

If no qualifying difference exists:
    TIE

Do not manufacture a ranking difference.
```

R-4 fires only when |unique_supporting(A) − unique_supporting(B)| ≥ 1 after shared-evidence removal (§2.11) and correlated-evidence deduplication (§2.19).

### 2.18 · `no_information_rule` (Decision 15 · APPROVE V1)
```
UNRESOLVED_ORDER

when available evidence cannot legitimately distinguish candidates.

Do not force a ranking merely because Q7 has been invoked.
```

`UNRESOLVED_ORDER` is a distinct, first-class outcome of Q7. It is **not** an error. It is **not** a fallback to alphabetical or file-index ordering. Q7 producing `UNRESOLVED_ORDER` is a legitimate answer.

### 2.19 · `correlation_rule` (Decision 12 · APPROVE V1)
```
Deduplicate correlated evidence by relationship_id.

Multiple records representing the same underlying relationship
must not artificially inflate the evidence count.
```

Evidence items sharing a `relationship_id` collapse to a single contribution under R-4.

### 2.20 · `provenance_rule` (Decision 11 · APPROVE V1)
```
Provenance is informational only.

Do not use source count, source diversity, provenance depth,
source type, or other provenance characteristics as hidden
ranking factors.
```

Provenance may be recorded and surfaced for auditability. It may not enter the ranking function.

### 2.21 · `conflict_rule` (Decision 16 · APPROVE V1)
```
Conflicting evidence follows the CONTRADICTING / BLOCKING treatment.

Do not silently convert conflicting evidence into supporting evidence.

Do not invent an additional conflict score.
```

Conflict → CONTRADICTING → R-1. No parallel score. No re-classification.

### 2.22 · `rank_one_definition` (Decision 17 · APPROVE V1)
```
Rank 1 = the highest position produced by the authorized Q7
ranking policy within the applicable candidate set.
```

**Preserved invariants:**
```
RANK 1  ≠  PROVEN ROOT CAUSE
RANK 1  ≠  Q8 ROOT-CAUSE SELECTION
```

Rank 1 is a Q7 ordinal position within the ranked set. It does not assert causal truth. It does not trigger acceptance. It does not confirm diagnosis.

### 2.23 · `q8_selection_excluded` (Decision 18 · APPROVE AND REAFFIRM)
```
q8_selection_excluded = TRUE
```

Q8 root-cause selection is **outside this policy**.

This policy does **not** define, authorize, or implement:
- root-cause selection
- root-cause acceptance
- automatic diagnosis
- root-cause confirmation
- autonomous causal declaration
- acceptance thresholds
- confidence thresholds triggering acceptance

Fix 15 must not implement Q8. Q8 is a separate capability governed by a separate future policy.

---

## 3 · Rule Flow Reference (informational · derived from §2 · not a new decision)

For any two candidates A and B within the authorized `ranking_scope` (§2.5):

```
Step 1  · Evaluate R-1 (CONTRADICTION_BLOCK) · §2.8
Step 2  · If unresolved by R-1 · evaluate R-2 (UNRESOLVED_BLOCK) · §2.10
Step 3  · If unresolved by R-2 · evaluate R-3 (INSUFFICIENT_BLOCK) · §2.9
Step 4  · If unresolved by R-3 · evaluate R-4 (SUPPORTING_MAJORITY) · §2.7
             · use only unique supporting evidence (§2.11 · §2.12)
             · deduplicate correlated evidence (§2.19)
             · require Δ ≥ 1 (§2.17)
Step 5  · If R-4 does not fire · result = TIE (§2.16)
Step 6  · If evidence cannot legitimately distinguish · result = UNRESOLVED_ORDER (§2.18)
```

Confidence values (§2.15) and provenance (§2.20) do **not** enter this flow.

---

## 4 · Current Corpus Observation (informational · does not motivate policy revision)

At the time of policy approval · the Test S corpus recorded:

```
candidates_observed = 5
supporting_per_candidate = 2
contradicting_per_candidate = 0
insufficient_per_candidate = 0
unresolved_per_candidate = 0
shared_evidence_across_candidates = 0
```

Under this policy applied to that corpus:

- R-1 · does not fire (no CONTRADICTING)
- R-2 · does not fire (no UNRESOLVED)
- R-3 · does not fire (no INSUFFICIENT)
- R-4 · does not fire (equal supporting count · no unique differentiation exceeding Δ ≥ 1)
- Result · **TIE** at rank 1 across all 5 candidates

**This is the correct behavior under Decision 19.** The founder-approved honest-uncertainty bias states that when evidence does not meaningfully discriminate · NEX1 must produce TIE or UNRESOLVED_ORDER rather than manufacture a rank.

The current corpus does **not**:
- prove the policy is correct
- prove the policy is discriminative
- prove the policy is complete
- justify weakening any rule to force discrimination

Future Fix 15 verification (§5) must supply cases that exercise each rule discriminatively.

---

## 5 · No-Hidden-Ranking Invariant

The finalized policy explicitly prohibits determinism achieved by silently reading any of the following as an evidence-bearing factor unless the founder authorizes it in writing as such:

- `filename`
- `candidate_id`
- array position / array order
- `timestamp`
- hash
- alphabetical order
- creation order
- database order
- source order
- execution order

None of these have been authorized by the founder as evidence-bearing under V1. Any Fix 15 implementation that produces deterministic ordering by relying on any of the above without registering that reliance as founder-authorized evidence violates the policy.

Determinism must never be achieved by silently inventing an evidential preference.

---

## 6 · Evidence Category Preservation

The finalized policy preserves the four evidence categories established by Fix 13:

```
STRUCTURALLY_SUPPORTING       (per §2.7 · counts under R-4)
STRUCTURALLY_CONTRADICTING    (per §2.8 · blocks under R-1)
INSUFFICIENT                  (per §2.9 · blocks under R-3)
UNRESOLVED                    (per §2.10 · blocks under R-2)
```

These four categories are not collapsible. UNRESOLVED is not CONTRADICTING (§2.10). INSUFFICIENT is not UNRESOLVED. No new evidence category is introduced by V1.

---

## 7 · Fix 15 Verification Requirement (statement of future scope · builds nothing now)

When Fix 15 is later authorized · verification must include controlled cases that exercise the policy discriminatively. At minimum · verification should cover · where applicable to a case:

- clear ranking (R-4 differentiates by Δ ≥ 1 with all higher rules inactive)
- TIE (all rules yield no difference · §2.16)
- CONTRADICTION blocking (R-1 fires · §2.8)
- INSUFFICIENT evidence blocking (R-3 fires · §2.9)
- UNRESOLVED evidence blocking (R-2 fires · §2.10)
- shared evidence (must not confer advantage · §2.11)
- unique evidence (must contribute under R-4 · §2.12)
- correlated evidence (must deduplicate · §2.19)
- confidence effects (must NOT alter ranking · §2.15)
- provenance effects (must NOT alter ranking · §2.20)
- Δ threshold behaviour (§2.17)
- UNRESOLVED_ORDER outcome (§2.18)

**None of these verification cases are constructed by this document.** Fix 15's future verification authorization owns that work.

---

## 8 · Policy Validation (V1-V15 per §17 of finalization prompt)

Performed on this document at time of writing:

| # | Check | Result |
|---|---|---|
| V1  | All 19 founder decisions accounted for | ✅ (Decisions 1–19 · each mapped to §2.5–§2.23 or §1) |
| V2  | No founder decision was changed | ✅ (verbatim quoted rules retained · wording unaltered) |
| V3  | No unresolved decision remains | ✅ (0 unresolved) |
| V4  | No policy was invented | ✅ (no rule beyond founder-supplied text · §2.14 is derived from Decision 2 · not new) |
| V5  | No ranking mechanism exists | ✅ (this is a policy document · zero code) |
| V6  | No production code changed | ✅ (0 production edits) |
| V7  | No Q8 logic was introduced | ✅ (§2.23 explicitly excludes Q8) |
| V8  | No hidden tie-breaker exists | ✅ (§2.16 and §5 explicitly prohibit) |
| V9  | Evidence categories remain explicit | ✅ (§6 preserves four-way taxonomy) |
| V10 | Policy and mechanism remain separated | ✅ (§0 declares separation · Fix 15 blocked) |
| V11 | Rank 1 does not automatically mean root cause | ✅ (§2.22 preserves both invariants) |
| V12 | Track A remains frozen | ✅ (declared in header · no verifier/Ed25519/authority changes) |
| V13 | No external model participated in implementation | ✅ (no code · policy authored deterministically from founder input) |
| V14 | No commit | ✅ (finalization prompt §19 forbids · none performed) |
| V15 | No push | ✅ (finalization prompt §19 forbids · none performed) |

---

## 9 · Decision Trail

```
V1 DRAFT (2026-09-17)
    └── nex1-ranking-policy-v1-draft-2026-09-17.md
         (Claude proposed rules · founder had not decided)
        ↓
FOUNDER DECISION REVIEW (2026-09-17)
    └── nex1-ranking-policy-v1-founder-decision-review-2026-09-17.md
         (19-decision review sheet · all decisions ⬜ NOT YET GIVEN)
        ↓
EXPLICIT FOUNDER DECISIONS (2026-09-17)
    (in-session founder authorization message · 19/19 APPROVE V1)
        ↓
FOUNDER-APPROVED V1 (2026-09-17 · THIS DOCUMENT)
    └── nex1-ranking-policy-v1-founder-approved-2026-09-17.md
         (finalization · effective_status = FOUNDER_APPROVED)
```

Historical documents are preserved unchanged. This document supersedes the DRAFT for `effective_status` but not for authorship of the alternative proposals · which remain the historical DRAFT's contribution.

---

## 10 · Post-Approval Locks

- **Fix 15** · NOT IMPLEMENTED · requires a separate founder authorization
- **Q8** · NOT IMPLEMENTED · out of scope for this policy · separate future scope
- **Track A** · FROZEN · Ed25519 · C6 · G15 · WO-04 · authority activation untouched
- **Production code** · UNCHANGED at time of approval
- **Ranking tests** · NOT CREATED (Fix 15's future scope)
- **Ranking scores** · NOT CREATED (see §2.13 · none permitted)
- **Ranking mechanism** · NOT CREATED (see §0 · policy first · mechanism second)

Any future work that would touch the above requires an explicit, separate authorization prompt from the founder.

---

## 11 · Governing Rule

> The founder decides what "better" means.
> The policy records that decision.
> Fix 15 implements that decision.
> Runtime verification proves whether implementation obeys it.
> Q8 remains a separate capability and cannot be smuggled into Q7.
>
> **POLICY FIRST · MECHANISM SECOND · PROOF THIRD.**

---

*End of NEX1_RANKING_POLICY V1 · FOUNDER-APPROVED*
