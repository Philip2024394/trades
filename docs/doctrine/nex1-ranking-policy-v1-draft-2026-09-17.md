# NEX1 Ranking Policy · V1 · DRAFT

**Policy ID:** `NEX1_RANKING_POLICY`
**Policy version:** `V1_DRAFT`
**Effective status:** `DRAFT`
**Founder approval:** ❌ NOT YET APPROVED
**Author:** master_ai_engineer (Claude Opus 4.7) · **proposing rules only · not deciding on founder's behalf**
**Date:** 2026-09-17

---

## Founder Instruction (per §35)

This document is a DRAFT policy proposal. It does **not** decide the policy on the founder's behalf. Every field carries a **PROPOSED rule** with **ALTERNATIVES** the founder may pick instead. The founder must respond with one of:

1. **APPROVE POLICY** — accept all proposed rules · authorize V1
2. **REVISE POLICY** — specify which fields to change and to what
3. **PAUSE** — hold policy work indefinitely · Q7 stays blocked

Until one of these three arrives, `effective_status` remains `DRAFT` and no Fix 15 code may be written.

**No implementation code has been written.** Zero production changes. Track A frozen. External model: NONE.

---

## Design Bias Stated Upfront (§28 · no hidden semantics)

Every proposal below leans toward one explicit stance:

> **When evidence is not strongly discriminative, prefer TIE / UNRESOLVED_ORDER over ranking.**

The rationale is consistent with NEX1's Fix 12-14 discipline: prefer honest uncertainty over manufactured preference. All proposed rules are consistent with this bias. The founder may reject that bias entirely — say so explicitly under REVISE.

---

## §31 · Canonical Policy Record

### 1 · `policy_id`
```
NEX1_RANKING_POLICY
```

### 2 · `policy_version`
```
V1_DRAFT
```

### 3 · `ranking_scope`

**PROPOSED:**
```
Rank only candidates that share the same source_file scope AND originated
from the same investigation packet (identified by investigation_id).
Do NOT compare candidates across unrelated investigations.
Do NOT compare candidates across different source_files (matches Fix 14
comparison scope · consistent with founder §22).
```

**ALTERNATIVES:**
- A · Rank across all target-file candidates in the packet (broader scope)
- B · Rank only within same `enclosing_function` (narrower · matches Fix 12 alternatives scope)
- C · Rank only when explicitly requested per-investigation
- D · Explicit alternative from founder

---

### 4 · `evidence_precedence`

**PROPOSED (lexicographic · contradiction-first · block-on-uncertainty):**

Rule chain, top-to-bottom · first rule that produces a difference decides ordering:

```
R-1 · CONTRADICTION_BLOCK:
      If either candidate has any STRUCTURALLY_CONTRADICTING evidence AND
      the other has none → the one with none ranks above.
      If BOTH candidates have STRUCTURALLY_CONTRADICTING evidence →
      UNRESOLVED_ORDER (do not rank).

R-2 · UNRESOLVED_BLOCK:
      If either candidate has ≥1 UNRESOLVED evidence AND the other has
      zero → the one with zero ranks above.
      If BOTH candidates have UNRESOLVED evidence →
      UNRESOLVED_ORDER (do not rank).

R-3 · INSUFFICIENT_BLOCK:
      Same shape as R-2 but for INSUFFICIENT.

R-4 · SUPPORTING_MAJORITY:
      Only if R-1, R-2, R-3 all produce no difference AND both candidates
      have zero contradicting/unresolved/insufficient evidence → the
      candidate with strictly MORE STRUCTURALLY_SUPPORTING evidence ranks
      above.

R-5 · TIE:
      If R-1 through R-4 all produce no difference → TIE.
```

**Rationale of proposal**: contradictions and uncertainty **block** ranking; only strictly-clean-evidence-set candidates can rank against each other on supporting count.

**ALTERNATIVES:**
- A · Numerical scoring: `score = 1·SUPPORTING − 2·CONTRADICTING − 0.5·UNRESOLVED − 0.5·INSUFFICIENT` · higher score ranks higher · ties preserved
- B · Contradiction-permissive: contradictions produce a numerical penalty but never block ranking
- C · Supporting-first: rank on supporting count first · treat contradiction as informational
- D · Even stricter: any uncertainty (INSUFFICIENT, UNRESOLVED) blocks ranking of the whole set
- E · Founder-authored alternative

---

### 5 · `supporting_rule`

**PROPOSED:**
```
COUNT-BASED · equal weight per STRUCTURALLY_SUPPORTING evidence record.
Only exercised via R-4 of evidence_precedence (i.e. only when both candidates
have zero CONTRADICTING/UNRESOLVED/INSUFFICIENT).
Correlated evidence deduplicated (see correlation_rule §11).
```

**ALTERNATIVES:**
- A · Weighted per relationship_type (producer_consumer weight X, condition_gates_return weight Y, selector_literal_mapping weight Z)
- B · Weighted per composition depth (deeper composition = more weight)
- C · Only counts if from a distinct composition_id (never double-count within same composition)
- D · Supporting evidence alone never creates a ranking difference (delete R-4 · every clean-evidence pair TIEs)
- E · Founder-authored alternative

---

### 6 · `contradicting_rule`

**PROPOSED:**
```
BLOCKING per R-1 of evidence_precedence.
Any STRUCTURALLY_CONTRADICTING record on a candidate places it below any
candidate with zero such records.
If both candidates have contradictions → UNRESOLVED_ORDER.
Count of contradictions is NOT used to rank between contradicting candidates
(consistent with the "uncertainty blocks ranking" bias).
```

**ALTERNATIVES:**
- A · Numerical penalty: `−2 per contradiction` in a weighted scoring model (alternative A of evidence_precedence)
- B · Any contradiction removes the candidate from ranking entirely (harder blocking · candidate is "not rankable")
- C · Contradictions do not affect rank (informational only)
- D · Founder-authored alternative

---

### 7 · `insufficient_rule`

**PROPOSED:**
```
BLOCKING per R-3 of evidence_precedence · symmetric with UNRESOLVED.
Any INSUFFICIENT record places the candidate below any candidate with zero
INSUFFICIENT records.
If both have INSUFFICIENT → UNRESOLVED_ORDER.
```

**ALTERNATIVES:**
- A · Ignore (informational only)
- B · Numerical penalty (−0.5 per INSUFFICIENT in a weighted model)
- C · Force TIE across the whole set until the INSUFFICIENT is resolved
- D · Founder-authored alternative

---

### 8 · `unresolved_rule`

**PROPOSED:**
```
BLOCKING per R-2 of evidence_precedence.
Fix 13 UNRESOLVED means data is missing (relationship_id or composition_id
not found in packet). Ranking a candidate with missing evidence data would
be silent invention · therefore blocked.
Any UNRESOLVED record places the candidate below any candidate with zero
UNRESOLVED records.
If both have UNRESOLVED → UNRESOLVED_ORDER.
CRITICAL: UNRESOLVED ≠ CONTRADICTING · never conflate.
```

**ALTERNATIVES:**
- A · Ignore
- B · Numerical penalty
- C · Force whole-set UNRESOLVED_ORDER when any candidate has UNRESOLVED
- D · Founder-authored alternative

---

### 9 · `shared_evidence_rule`

**PROPOSED:**
```
SHARED evidence does NOT differentiate candidates.
Each shared evidence_id counted once for each candidate that references it,
but presence-in-both cancels out under evidence_precedence R-4 supporting
count (both candidates get +1 · net delta = 0).
No double-counting.
No penalty.
Shared evidence is informational · aids provenance transparency · never
determines rank alone.
```

**ALTERNATIVES:**
- A · Shared evidence explicitly excluded from supporting counts (each candidate's supporting count = candidate-only evidence only)
- B · Shared evidence flag creates a special "structurally-equivalent" tag on the pair
- C · Founder-authored alternative

---

### 10 · `unique_evidence_rule`

**PROPOSED:**
```
UNIQUE evidence (A-only or B-only from Fix 14 comparisons) is counted under
supporting_rule with equal weight to shared evidence.
The RULE is: total supporting evidence per candidate = shared + candidate-only.
Unique evidence does not receive a rank advantage on top of the count.
```

**ALTERNATIVES:**
- A · Unique evidence receives extra weight (e.g., 1.5x per unique) — favours differentiated evidence
- B · Only unique evidence counts for ranking (shared ignored entirely)
- C · Founder-authored alternative

---

### 11 · `weighting_model`

**PROPOSED:**
```
NO NUMERICAL WEIGHTS.
Ranking is lexicographic via evidence_precedence R-1..R-5.
Every rule produces a boolean "A above B / B above A / no-difference" answer;
downstream rules only fire when upstream rules produce no-difference.
```

**ALTERNATIVES:**
- A · Numerical weighting model (see evidence_precedence Alternative A)
- B · Hybrid: lexicographic contradictions/uncertainty as blocks · numerical below
- C · Founder-authored alternative

---

### 12 · `precedence_model`

**PROPOSED:**
```
LEXICOGRAPHIC via ordered rule chain.
Rules evaluated in order R-1 → R-2 → R-3 → R-4 → R-5.
First rule producing a difference decides.
If R-5 (TIE) fires → both candidates rank equally (deterministic TIE state).
No hidden combination · no post-hoc adjustment.
```

**ALTERNATIVES:**
- A · Numerical (see weighting_model Alternative A)
- B · Different rule ordering (e.g. supporting-first · contradiction-second)
- C · Founder-authored alternative

---

### 13 · `confidence_rule`

**PROPOSED:**
```
CONFIDENCE IS NOT USED for ranking.
Fix 12/13/14 confidence values are uncertainty signals · not rank scores
(founder §19).
The ranking policy operates on evidence status counts and evidence identity,
not on confidence numbers.
```

**ALTERNATIVES:**
- A · Confidence used as a tie-breaker after R-5 (rejected in proposal because §11 forbids hidden tie-breakers)
- B · Confidence used as a weight multiplier in a weighted model
- C · Confidence values reported alongside ranks for reader awareness · but not used in ordering
- D · Founder-authored alternative

---

### 14 · `provenance_rule`

**PROPOSED:**
```
PROVENANCE IS INFORMATIONAL ONLY.
Ranking rules do not use provenance count/diversity/depth/type as a signal.
Provenance is preserved on ranking output for reader traceability.
Every ranked position must expose the underlying candidate + evaluation +
comparison + relationship + source provenance chain (Fix 14 already does this).
```

**ALTERNATIVES:**
- A · Provenance-diversity rule: candidate whose supporting evidence spans more distinct source_files ranks above one that spans fewer (breaks R-4 ties)
- B · Provenance-depth rule: candidate whose supporting relationships come from deeper compositions ranks above one from shallower compositions
- C · Provenance-directness rule: candidate whose provenance touches endpoints closer to the symptom ranks above one farther away
- D · Founder-authored alternative

---

### 15 · `correlation_rule`

**PROPOSED:**
```
CORRELATED EVIDENCE IS DEDUPLICATED BY relationship_id.
Two evidence_ids that reference the same relationship_id are collapsed to a
single supporting count (or single contradicting/insufficient/unresolved count)
before applying R-1..R-5.
This prevents artificial evidence inflation when the same relationship
appears multiple times in a candidate's supporting set (theoretical edge case
· Fix 13's current output does not naturally produce this).
```

**ALTERNATIVES:**
- A · Deduplicate by evidence_id (Fix 13 already ensures uniqueness · so this is a no-op)
- B · Deduplicate by composition_id (stricter · treats different relationships within same composition as one)
- C · No deduplication (each Fix 13 evidence record counts once regardless of underlying identity)
- D · Founder-authored alternative

---

### 16 · `tie_rule`

**PROPOSED:**
```
TIE is an EXPLICIT rank state.
When R-1..R-5 all produce no-difference → both candidates receive rank_state=TIE.
Both candidates share the same rank_position (e.g. both rank 1).
The following candidate (if any) receives rank_position 3 (not 2).

NO HIDDEN TIE-BREAKER: filename order, candidate_id order, timestamp, hash
order, and array position are all FORBIDDEN as tie-breakers (founder §17).

For deterministic ordering of ties in reporting output:
  Ties are grouped · candidate_ids within a tie group are sorted lex for
  DISPLAY purposes only · this ordering has NO ranking semantics.
```

**ALTERNATIVES:**
- A · Ties preserved but no display ordering (candidates in tie group appear in insertion order · which itself is deterministic)
- B · Ties trigger UNRESOLVED_ORDER for the entire set (harder discipline)
- C · Ties allow provenance-diversity tie-breaker (see provenance_rule Alt A)
- D · Founder-authored alternative

---

### 17 · `minimum_difference_rule`

**PROPOSED:**
```
NO MINIMUM DIFFERENCE THRESHOLD.
Any policy-defined difference produced by R-1..R-4 is sufficient to order
two candidates.
For R-4 supporting-count comparisons, `A > B` where A has strictly more
supporting evidence than B (Δ ≥ 1).
```

**ALTERNATIVES:**
- A · Require Δ ≥ 2 supporting evidence for R-4 to fire (stricter · more ties)
- B · Require Δ ≥ 30% of the max supporting count in the pair
- C · Percentage-based threshold on other evidence classes
- D · Founder-authored alternative

---

### 18 · `no_information_rule`

**PROPOSED:**
```
When ranking inputs are entirely absent (e.g. no Fix 14 comparisons exist,
or candidate has empty evaluation) → UNRESOLVED_ORDER for the whole set.
NO ranking is emitted.
This is honest refusal · consistent with Fix 12/13/14's uncertainty discipline.
```

**ALTERNATIVES:**
- A · Emit a rank with all candidates tied at rank 1
- B · Emit no ranking record (silent · empty output)
- C · Emit an explicit `no_information_notice` explaining the refusal
- D · Founder-authored alternative

---

### 19 · `conflict_rule`

**PROPOSED:**
```
Same treatment as contradicting_rule R-1.
A candidate carrying BOTH STRUCTURALLY_SUPPORTING and STRUCTURALLY_CONTRADICTING
evidence is treated as a "candidate with contradiction present" · R-1
demotes it below candidates with no contradiction.
The presence of supporting evidence does NOT cancel contradicting evidence.
The presence of contradicting evidence does NOT invalidate supporting evidence.
Both are preserved in provenance.
```

**ALTERNATIVES:**
- A · Numerical net: `net_score = SUPPORTING − 2·CONTRADICTING` (weighted-model alternative)
- B · Any conflict → UNRESOLVED_ORDER for that candidate (stricter)
- C · Supporting evidence can cancel contradicting evidence if count is greater (harder to justify)
- D · Founder-authored alternative

---

### 20 · `rank_one_definition`

**PROPOSED:**
```
Rank position #1 means:
  "The candidate that occupies the top of the lexicographic ordering
   defined by evidence_precedence R-1..R-5 within this investigation's
   candidate set."

Explicitly:
  Rank 1 is NOT: the actual root cause
  Rank 1 is NOT: the correct hypothesis
  Rank 1 is NOT: the recommended action
  Rank 1 is NOT: causally significant
  Rank 1 is NOT: automatically selected

Rank 1 is: the candidate whose evidence profile places it first under this
           deterministic policy.
```

**ALTERNATIVES:**
- Founder-authored refinement of wording

---

### 21 · `q8_selection_excluded`

**PROPOSED:**
```
TRUE · unconditionally.
The ranking output must NEVER contain fields named:
  root_cause, selected_candidate, final_root_cause, actual_cause,
  chosen_candidate, winner, most_likely_cause, correct_hypothesis,
  cause_candidate, preferred_root_cause
or any disguised equivalent.

Q8 root-cause selection is a separately-authorized future capability.
This policy neither implements nor implies Q8.
```

**ALTERNATIVES:**
- None acceptable · this field is non-negotiable per founder §24

---

### 22 · `effective_status`
```
DRAFT
```

Advances to `FOUNDER_APPROVED` only upon explicit founder response.

---

## §34 · P1-P23 Validation Checklist

| # | Check | Status | Notes |
|---|---|---|---|
| P1 | Every evidence state has defined treatment | ✓ | SUPPORTING (§5), CONTRADICTING (§6), INSUFFICIENT (§7), UNRESOLVED (§8) |
| P2 | Supporting treatment explicit | ✓ | COUNT-BASED · equal weight |
| P3 | Contradicting treatment explicit | ✓ | BLOCKING R-1 |
| P4 | Insufficient treatment explicit | ✓ | BLOCKING R-3 |
| P5 | Unresolved treatment explicit | ✓ | BLOCKING R-2 |
| P6 | Shared evidence treatment explicit | ✓ | Does not differentiate |
| P7 | Unique evidence treatment explicit | ✓ | Counted equal to shared under supporting_rule |
| P8 | Weights or precedence explicit | ✓ | LEXICOGRAPHIC · no numerical weights |
| P9 | Confidence treatment explicit | ✓ | NOT USED |
| P10 | Provenance treatment explicit | ✓ | INFORMATIONAL ONLY |
| P11 | Correlated evidence treatment explicit | ✓ | Deduplicated by relationship_id |
| P12 | Tie handling explicit | ✓ | Explicit TIE state · both candidates share rank_position · next candidate skips to +2 |
| P13 | No hidden tie-breaker | ✓ | Filename/candidate_id/timestamp/hash/array-order all forbidden · display-order sort is not semantic |
| P14 | Minimum difference explicit | ✓ | Δ ≥ 1 supporting for R-4 · no threshold above |
| P15 | No causal semantics | ✓ | Rank 1 is not causal · §29 held |
| P16 | Q8 selection excluded | ✓ | 10 forbidden field names + disguised aliases · §21 lists all |
| P17 | Ranking does not equal truth | ✓ | evidence_kind of ranking output must be INFERRED (specified by future Fix 15 · never PROVEN) |
| P18 | Ranking does not equal root cause | ✓ | §20 rank_one_definition rejects this explicitly |
| P19 | Policy is deterministic | ✓ | Lexicographic rule chain · no randomness · no time-dependence |
| P20 | Policy is versioned | ✓ | V1_DRAFT · future changes require new version |
| P21 | No implementation code written | ✓ | Zero production changes · this is a policy document only |
| P22 | No external model used | ✓ | NEX1_NATIVE authorship · founder ratification pending |
| P23 | Track A remains frozen | ✓ | No touches to Ed25519 · C6 · G15 · WO-04 · authority · execution |

**All 23 checks pass on the DRAFT.** Approval is a founder decision.

---

## Worked Example (Applied to Current Corpus)

To ground the proposal, apply it to the actual Test S corpus (5 candidates · 10 Fix 14 comparisons):

**Corpus fact:** all 5 candidates have identical status distribution (2 SUPPORTING · 0 CONTRA · 0 INSUFF · 0 UNRES). Shared = 0 · A-only = 2 · B-only = 2 for every pair.

**Applying rules to any pair (A, B):**
- R-1 CONTRADICTION_BLOCK: both have 0 CONTRA → no difference
- R-2 UNRESOLVED_BLOCK: both have 0 UNRES → no difference
- R-3 INSUFFICIENT_BLOCK: both have 0 INSUFF → no difference
- R-4 SUPPORTING_MAJORITY: both have 2 supporting → no difference
- R-5 TIE fires

**Result under this policy:** all 5 candidates TIE at rank position 1.

**This is honest.** The current corpus does not exercise ranking. Building Fix 15 against this corpus alone would not prove the policy in a discriminative way. That's an argument for either:
- Approving the policy anyway (so Fix 15 can be built, and a future corpus with real contradictions/insufficiency will exercise it), OR
- Deferring policy approval until a richer corpus exists

Founder chooses.

---

## §37 · Final Truth

### POLICY STATUS
`DRAFT`

### POLICY VERSION
`V1_DRAFT`

### WHAT THE POLICY DEFINES

A deterministic lexicographic rule chain (R-1..R-5) that orders candidates within a single investigation's scope · uses only Fix 13 evidence-status distributions and Fix 14 shared/unique evidence sets · treats CONTRADICTING/UNRESOLVED/INSUFFICIENT as blocking uncertainty (candidates with any of these three ranked below candidates with none · both having any → UNRESOLVED_ORDER) · uses SUPPORTING count as the sole differentiator among clean-evidence pairs · treats TIE as an explicit rank state · forbids all hidden tie-breakers · deduplicates correlated evidence by relationship_id · does not use confidence · treats provenance as informational only.

### WHAT THE POLICY DOES NOT DEFINE

Q8 root-cause selection. The policy explicitly excludes any field, semantic, or output that would identify one candidate as "the" root cause. Rank 1 is the top of a deterministic ordering under this policy · not a causal claim.

### NEXT BOUNDARY

**If founder responds APPROVE POLICY:**
- V1 becomes `FOUNDER_APPROVED`
- Fix 15 authorization becomes possible as a distinct prompt · Fix 15 must implement V1 exactly · no reinterpretation

**If founder responds REVISE POLICY:**
- Founder specifies which fields to change and to what
- New DRAFT (V1_DRAFT_R1, V1_DRAFT_R2, ...) is produced
- Approval loop continues

**If founder responds PAUSE:**
- Q7 stays blocked
- Ranking implementation remains blocked
- Track B stops at Stage 12c green · Stage 12d red

Ranking implementation remains blocked in all cases until an approved version exists.

---

## Founding Rule (§37 · verbatim)

> NEX1 must never invent what "better" means. The founder defines the policy; the system implements it; runtime evidence proves whether it obeys it.
>
> Policy before mechanism. Mechanism before verification. Verification before progression.
>
> Ranking is not root-cause selection.

---

**Freeze remains in force. No commits. No push. Track A untouched. No implementation. Awaiting founder APPROVE / REVISE / PAUSE.**
